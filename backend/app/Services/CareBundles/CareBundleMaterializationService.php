<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrates full (bundle × source) materialization.
 *
 * Flow per run:
 *   1. Create CareBundleRun (status=running).
 *   2. Populate care_bundle_qualifications from CDM condition_occurrence for
 *      every patient matching the bundle's omop_concept_ids.
 *   3. For each measure in the bundle: delegate to CareBundleMeasureEvaluator,
 *      which updates measure_summary JSONB per person and returns counts.
 *   4. Persist one CareBundleMeasureResult per measure.
 *   5. Promote to care_bundle_current_runs (upsert pointer table).
 *   6. Mark CareBundleRun completed.
 *
 * On any failure: mark run failed with message, no promotion, previous current
 * run remains in place.
 */
class CareBundleMaterializationService
{
    public function __construct(
        private readonly CareBundleMeasureEvaluator $evaluator,
    ) {}

    public function materialize(
        ConditionBundle $bundle,
        Source $source,
        ?User $triggeredBy = null,
        string $trigger = 'manual',
    ): CareBundleRun {
        $run = CareBundleRun::create([
            'condition_bundle_id' => $bundle->id,
            'source_id' => $source->id,
            'status' => 'running',
            'started_at' => now(),
            'triggered_by' => $triggeredBy?->id,
            'trigger_kind' => $trigger,
            'bundle_version' => (string) $bundle->updated_at?->timestamp,
        ]);

        try {
            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

            if ($cdmSchema === null) {
                throw new \RuntimeException('Source is missing CDM daimon configuration.');
            }

            $appConn = DB::connection();

            DB::transaction(function () use ($run, $bundle, $source, $cdmSchema, $appConn) {
                $this->populateQualifications($run, $bundle, $source, $cdmSchema, $appConn);
                $bundle->load('measures');
                $this->runMeasures($run, $bundle->measures, $source, $cdmSchema);
                $this->promoteToCurrent($run, $appConn);
            });

            $qualifiedCount = (int) $appConn->table('care_bundle_qualifications')
                ->where('care_bundle_run_id', $run->id)
                ->count();

            $run->update([
                'status' => 'completed',
                'completed_at' => now(),
                'qualified_person_count' => $qualifiedCount,
                'measure_count' => $bundle->measures->count(),
                'cdm_fingerprint' => $this->fingerprintCdm($source, $cdmSchema),
            ]);

            Log::info('CareBundle materialization complete', [
                'run_id' => $run->id,
                'bundle' => $bundle->bundle_code,
                'source_id' => $source->id,
                'qualified_persons' => $qualifiedCount,
            ]);
        } catch (\Throwable $e) {
            Log::error('CareBundle materialization failed', [
                'run_id' => $run->id,
                'bundle' => $bundle->bundle_code,
                'source_id' => $source->id,
                'error' => $e->getMessage(),
            ]);

            $run->update([
                'status' => 'failed',
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
        }

        return $run->fresh();
    }

    /**
     * Populate care_bundle_qualifications with one row per qualifying person.
     * Uses a single INSERT...SELECT on the CDM — no PHP-side patient loading.
     */
    private function populateQualifications(
        CareBundleRun $run,
        ConditionBundle $bundle,
        Source $source,
        string $cdmSchema,
        Connection $appConn,
    ): void {
        $conceptIds = $bundle->omop_concept_ids ?? [];

        if (empty($conceptIds)) {
            Log::warning('CareBundle materialization: bundle has no concept IDs', [
                'bundle' => $bundle->bundle_code,
            ]);

            return;
        }

        $placeholders = implode(',', array_fill(0, count($conceptIds), '?'));

        $sql = "
            INSERT INTO care_bundle_qualifications
                (care_bundle_run_id, condition_bundle_id, source_id,
                 person_id, qualifies, measure_summary, created_at)
            SELECT
                ?, ?, ?, co.person_id, TRUE, '{}'::jsonb, NOW()
            FROM \"{$cdmSchema}\".condition_occurrence co
            WHERE co.condition_concept_id IN ({$placeholders})
            GROUP BY co.person_id
            ON CONFLICT (care_bundle_run_id, person_id) DO NOTHING
        ";

        $bindings = array_merge([$run->id, $bundle->id, $source->id], $conceptIds);
        $appConn->statement($sql, $bindings);
    }

    /**
     * @param  iterable<QualityMeasure>  $measures
     */
    private function runMeasures(
        CareBundleRun $run,
        iterable $measures,
        Source $source,
        string $cdmSchema,
    ): void {
        foreach ($measures as $measure) {
            $result = $this->evaluator->evaluate($run, $measure, $source, $cdmSchema);

            CareBundleMeasureResult::updateOrCreate(
                [
                    'care_bundle_run_id' => $run->id,
                    'quality_measure_id' => $measure->id,
                ],
                [
                    'denominator_count' => $result->denominatorCount,
                    'numerator_count' => $result->numeratorCount,
                    'exclusion_count' => $result->exclusionCount,
                    'rate' => $result->rate(),
                    'computed_at' => now(),
                ],
            );
        }
    }

    private function promoteToCurrent(CareBundleRun $run, Connection $appConn): void
    {
        $appConn->statement(
            "
            INSERT INTO care_bundle_current_runs
                (condition_bundle_id, source_id, care_bundle_run_id, updated_at)
            VALUES (?, ?, ?, NOW())
            ON CONFLICT (condition_bundle_id, source_id) DO UPDATE SET
                care_bundle_run_id = EXCLUDED.care_bundle_run_id,
                updated_at = NOW()
        ",
            [$run->condition_bundle_id, $run->source_id, $run->id]
        );
    }

    /**
     * Cheap CDM fingerprint for cache invalidation: source.data_version if set,
     * else a deterministic hash of source_id + now() date (daily refresh).
     */
    private function fingerprintCdm(Source $source, string $cdmSchema): string
    {
        $version = $source->data_version ?? null;
        if ($version) {
            return substr(hash('sha256', (string) $version), 0, 64);
        }

        return substr(hash('sha256', $source->id.'|'.now()->toDateString()), 0, 64);
    }
}
