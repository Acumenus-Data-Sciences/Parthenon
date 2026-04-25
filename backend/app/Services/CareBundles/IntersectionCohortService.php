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
 *
 * Members are streamed server-side via INSERT … SELECT from the same query
 * that powers the read-side intersection endpoint — no PHP-heap roundtrip
 * (HIGH-6). The delete + insert run in a single results-connection
 * transaction so a crash partway through rolls the cohort back to its
 * previous state instead of leaving partial members (HIGH-4).
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

        // Server-side count of intersection members. The same predicate fires
        // again for the INSERT…SELECT below, but care_bundle_qualifications is
        // indexed for this exact (source_id, condition_bundle_id) shape so the
        // marginal cost is negligible compared to materializing the full ID
        // set in PHP.
        $memberCount = $this->qualifications->intersectionCount($source, $bundleIds, $mode);

        // App-DB state first, in one transaction — CohortDefinition and a
        // Running CohortGeneration commit together or not at all.
        [$cohort, $generation] = DB::transaction(function () use (
            $source, $bundleIds, $mode, $name, $description, $author, $isPublic, $memberCount,
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
                'person_count' => $memberCount,
            ]);

            return [$cohort, $generation];
        });

        // Now write members to the OMOP results schema. On failure we mark
        // the generation Failed; the CohortDefinition stays so the user can
        // retry without losing the metadata they entered.
        try {
            $this->writeToResultsCohort(
                $connectionName,
                $resultsSchema,
                $cohort->id,
                $source,
                $bundleIds,
                $mode,
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
            'person_count' => $memberCount,
        ]);

        return $cohort->fresh();
    }

    /**
     * Atomically replace cohort members with the intersection's persons. The
     * delete + INSERT … SELECT run in a single transaction on the default
     * app connection (search_path = app,php), so a crash partway through
     * rolls back; the previous member set is either fully preserved or
     * fully replaced.
     *
     * The INSERT…SELECT runs entirely server-side (no PHP-heap roundtrip)
     * by replicating the intersection predicate inline and writing to the
     * fully-qualified `<resultsSchema>.cohort` destination. We use the
     * default connection (not the source's `omop` connection) because the
     * source query references `app.care_bundle_qualifications`, which the
     * `omop` connection's search_path doesn't include.
     *
     * @param  list<int>  $bundleIds
     */
    private function writeToResultsCohort(
        string $connectionName,
        string $resultsSchema,
        int $cohortDefinitionId,
        Source $source,
        array $bundleIds,
        string $mode,
    ): void {
        // $connectionName is reserved for future per-source connection isolation
        // (a Parthenon source may eventually live on a different Postgres
        // instance from the app DB). Today every results schema lives in the
        // same database as `app`, so the default connection is the right
        // one to use for cross-schema INSERT…SELECT.
        unset($connectionName);

        $conn = DB::connection();
        $today = now()->toDateString();

        $intersectionQuery = $this->qualifications
            ->intersectionQueryForExport($source, $bundleIds, $mode);

        $selectSql = $intersectionQuery->toSql();
        $selectBindings = $intersectionQuery->getBindings();

        $conn->transaction(function () use (
            $conn, $resultsSchema, $cohortDefinitionId, $today, $selectSql, $selectBindings,
        ) {
            $conn->table("{$resultsSchema}.cohort")
                ->where('cohort_definition_id', $cohortDefinitionId)
                ->delete();

            $conn->statement(
                "
                INSERT INTO \"{$resultsSchema}\".cohort
                    (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                SELECT ?, sub.person_id, ?, ?
                FROM ({$selectSql}) sub
                ",
                array_merge([$cohortDefinitionId, $today, $today], $selectBindings),
            );
        });
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
