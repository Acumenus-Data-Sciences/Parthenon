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
 */
class MeasureCohortExportService
{
    public function __construct(
        private readonly MeasureRosterService $roster,
    ) {}

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
        $source->load('daimons');
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        if ($resultsSchema === null) {
            throw new \RuntimeException('Source is missing Results daimon configuration.');
        }

        $connectionName = $source->source_connection ?? 'omop';
        $personIds = $this->roster->allPersonIds($bundle, $measure, $source, $bucket);

        [$cohort, $generation] = DB::transaction(function () use (
            $bundle, $measure, $source, $bucket, $name, $description, $author, $isPublic, $personIds,
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
                'person_count' => count($personIds),
            ]);

            return [$cohort, $generation];
        });

        try {
            $this->writeMembers($connectionName, $resultsSchema, $cohort->id, $personIds);
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
            'person_count' => count($personIds),
        ]);

        return $cohort->fresh();
    }

    /**
     * @param  list<int>  $personIds
     */
    private function writeMembers(
        string $connectionName,
        string $resultsSchema,
        int $cohortDefinitionId,
        array $personIds,
    ): void {
        $conn = DB::connection($connectionName);

        $conn->table("{$resultsSchema}.cohort")
            ->where('cohort_definition_id', $cohortDefinitionId)
            ->delete();

        if (empty($personIds)) {
            return;
        }

        $today = now()->toDateString();

        foreach (array_chunk($personIds, 5_000) as $chunk) {
            $rows = array_map(fn (int $pid) => [
                'cohort_definition_id' => $cohortDefinitionId,
                'subject_id' => $pid,
                'cohort_start_date' => $today,
                'cohort_end_date' => $today,
            ], $chunk);

            $conn->table("{$resultsSchema}.cohort")->insert($rows);
        }
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
