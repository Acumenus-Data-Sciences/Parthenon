<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Materializes a (bundle, source, measure) compliance bucket into a first-class
 * CohortDefinition + pre-computed CohortGeneration. The bridge from
 * "we measured a gap" to "let's intervene on these patients."
 *
 * Mirrors IntersectionCohortService — sentinel expression in expression_json,
 * member rows written directly to the source's results.cohort table, no
 * Circe re-compilation.
 *
 * Members are streamed server-side via INSERT … SELECT from
 * `app.care_bundle_measure_person_status` directly into
 * `<resultsSchema>.cohort` (same Postgres database, schema-isolated). This
 * avoids materializing the full person_id list in PHP heap, which on a
 * 2M-patient CDM with a wide non-compliant bucket can be hundreds of
 * thousands of integers (HIGH-6). The delete + insert run in a single
 * results-connection transaction so a crash partway through rolls the cohort
 * back to its previous state instead of leaving partial members (HIGH-4).
 */
class MeasureCohortExportService
{
    private const BUCKETS = ['non_compliant', 'compliant', 'excluded'];

    public function export(
        ConditionBundle $bundle,
        QualityMeasure $measure,
        Source $source,
        string $bucket,
        string $name,
        ?string $description,
        User $author,
        bool $isPublic = false,
    ): CohortDefinition {
        if (! in_array($bucket, self::BUCKETS, true)) {
            throw new \InvalidArgumentException("Unknown compliance bucket: {$bucket}");
        }

        $source->load('daimons');
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        if ($resultsSchema === null) {
            throw new \RuntimeException('Source is missing Results daimon configuration.');
        }

        $runId = (int) DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === 0) {
            throw new \RuntimeException(
                'No materialized run for this bundle/source — '
                .'export is only valid against a completed materialization.'
            );
        }

        // Server-side count of bucket members. Cheaper than the prior
        // pluck-into-PHP-array-then-count, and stable: counted in the same
        // index scan that the INSERT…SELECT will repeat.
        $memberCount = (int) $this->bucketQuery($runId, $measure->id, $bucket)->count();

        // App-DB state first, in one transaction — CohortDefinition + Running
        // CohortGeneration commit together or not at all.
        [$cohort, $generation] = DB::transaction(function () use (
            $bundle, $measure, $source, $bucket, $name, $description, $author, $isPublic, $memberCount,
        ) {
            $cohort = CohortDefinition::create([
                'name' => $name,
                'description' => $description,
                'expression_json' => $this->sentinelExpression($bundle, $measure, $source, $bucket),
                'author_id' => $author->id,
                'is_public' => $isPublic,
                'version' => 1,
            ]);

            $generation = CohortGeneration::create([
                'cohort_definition_id' => $cohort->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Running,
                'started_at' => now(),
                'person_count' => $memberCount,
            ]);

            return [$cohort, $generation];
        });

        try {
            $this->writeMembers(
                $resultsSchema,
                $cohort->id,
                $runId,
                $measure->id,
                $bucket,
            );
            $generation->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
            ]);
        } catch (\Throwable $e) {
            $generation->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            throw $e;
        }

        Log::info('CareBundles measure roster → cohort materialized', [
            'cohort_definition_id' => $cohort->id,
            'generation_id' => $generation->id,
            'bundle_id' => $bundle->id,
            'measure_id' => $measure->id,
            'source_id' => $source->id,
            'bucket' => $bucket,
            'person_count' => $memberCount,
        ]);

        return $cohort->fresh();
    }

    /**
     * Atomically replace cohort members with the bucket's persons. Single
     * cross-schema INSERT … SELECT — no PHP-side ID materialization.
     *
     * Runs on the default app connection because the source `app.…` table is
     * referenced unqualified for the `JOIN` builder convention; the default
     * connection's search_path includes `app`, the source-specific `omop`
     * connection's does not.
     */
    private function writeMembers(
        string $resultsSchema,
        int $cohortDefinitionId,
        int $runId,
        int $measureId,
        string $bucket,
    ): void {
        $conn = DB::connection();
        $today = now()->toDateString();

        [$bucketPredicate, $bucketBindings] = $this->bucketSqlClause($bucket);

        $conn->transaction(function () use (
            $conn, $resultsSchema, $cohortDefinitionId, $runId, $measureId, $today,
            $bucketPredicate, $bucketBindings,
        ) {
            $conn->table("{$resultsSchema}.cohort")
                ->where('cohort_definition_id', $cohortDefinitionId)
                ->delete();

            $conn->statement(
                "
                INSERT INTO \"{$resultsSchema}\".cohort
                    (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                SELECT ?, person_id, ?, ?
                FROM app.care_bundle_measure_person_status
                WHERE care_bundle_run_id = ?
                  AND quality_measure_id = ?
                  AND {$bucketPredicate}
                ",
                array_merge(
                    [$cohortDefinitionId, $today, $today, $runId, $measureId],
                    $bucketBindings,
                )
            );
        });
    }

    /**
     * Cheap COUNT(*) for the bucket — server-side, no PHP heap.
     */
    private function bucketQuery(int $runId, int $measureId, string $bucket): Builder
    {
        $q = DB::table('care_bundle_measure_person_status')
            ->where('care_bundle_run_id', $runId)
            ->where('quality_measure_id', $measureId);

        match ($bucket) {
            'non_compliant' => $q->where('is_numer', false)->where('is_excl', false),
            'compliant' => $q->where('is_numer', true)->where('is_excl', false),
            'excluded' => $q->where('is_excl', true),
            default => throw new \InvalidArgumentException("Unknown compliance bucket: {$bucket}"),
        };

        return $q;
    }

    /**
     * Bucket predicate as a parameterized SQL fragment, suitable for splicing
     * into a raw INSERT…SELECT WHERE clause.
     *
     * @return array{0: string, 1: list<bool>}
     */
    private function bucketSqlClause(string $bucket): array
    {
        return match ($bucket) {
            'non_compliant' => ['is_numer = ? AND is_excl = ?', [false, false]],
            'compliant' => ['is_numer = ? AND is_excl = ?', [true, false]],
            'excluded' => ['is_excl = ?', [true]],
            default => throw new \InvalidArgumentException("Unknown compliance bucket: {$bucket}"),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function sentinelExpression(
        ConditionBundle $bundle,
        QualityMeasure $measure,
        Source $source,
        string $bucket,
    ): array {
        return [
            'meta' => [
                'derived_from' => 'care_bundle_measure_roster',
                'bundle_id' => $bundle->id,
                'bundle_code' => $bundle->bundle_code,
                'measure_id' => $measure->id,
                'measure_code' => $measure->measure_code,
                'source_id' => $source->id,
                'compliance_bucket' => $bucket,
                'derived_at' => now()->toIso8601String(),
                'note' => 'Members materialized from care_bundle_measure_person_status; do not regenerate.',
            ],
        ];
    }
}
