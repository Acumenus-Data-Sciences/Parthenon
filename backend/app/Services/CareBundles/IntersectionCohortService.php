<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Materializes a care-bundle intersection into a first-class CohortDefinition
 * + pre-computed CohortGeneration, suitable for downstream Studies.
 *
 * Unlike the normal cohort-generation pipeline, members come directly from the
 * workbench fact table — no Circe compilation, no CDM re-query. The resulting
 * CohortDefinition is marked "derived" via a sentinel in expression_json, so
 * any attempt to re-generate it will be a no-op (the derived row set is the
 * source of truth).
 */
class IntersectionCohortService
{
    public function __construct(
        private readonly CareBundleQualificationService $qualifications,
    ) {}

    /**
     * @param  list<int>  $bundleIds
     */
    public function createFromIntersection(
        Source $source,
        array $bundleIds,
        string $mode,
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
        $personIds = $this->qualifications
            ->intersection($source, $bundleIds, $mode)
            ->all();

        // App-DB state first, in one transaction — CohortDefinition and a
        // Running CohortGeneration commit together or not at all.
        [$cohort, $generation] = DB::transaction(function () use (
            $source, $bundleIds, $mode, $name, $description, $author, $isPublic, $personIds,
        ) {
            $cohort = CohortDefinition::create([
                'name' => $name,
                'description' => $description,
                'expression_json' => $this->sentinelExpression($source, $bundleIds, $mode),
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

        // Now write members to the OMOP results schema (a different connection
        // — cannot share the transaction above). On failure we mark the
        // generation Failed; the CohortDefinition stays so the user can retry.
        try {
            $this->writeToResultsCohort(
                $connectionName,
                $resultsSchema,
                $cohort->id,
                $personIds,
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

        Log::info('CareBundles intersection → cohort materialized', [
            'cohort_definition_id' => $cohort->id,
            'generation_id' => $generation->id,
            'source_id' => $source->id,
            'bundle_ids' => $bundleIds,
            'mode' => $mode,
            'person_count' => count($personIds),
        ]);

        return $cohort->fresh();
    }

    /**
     * Replace any existing rows for this cohort definition in the Results
     * schema and bulk-insert the new member list. Chunked to keep INSERT
     * payloads within Postgres's parameter limit (default 65k bindings).
     *
     * @param  list<int>  $personIds
     */
    private function writeToResultsCohort(
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
     * @param  list<int>  $bundleIds
     * @return array<string, mixed>
     */
    private function sentinelExpression(Source $source, array $bundleIds, string $mode): array
    {
        return [
            'meta' => [
                'derived_from' => 'care_bundle_intersection',
                'source_id' => $source->id,
                'bundle_ids' => array_values($bundleIds),
                'mode' => $mode,
                'derived_at' => now()->toIso8601String(),
                'note' => 'Members materialized directly from care_bundle_qualifications; do not regenerate.',
            ],
        ];
    }
}
