<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 GENOMICS-07 D-10/D-11/D-12 — PRS dispatch service.
 *
 * Mirrors {@see GwasRunService} but for plink2 --score (no cases/controls split,
 * no step-1/step-2). Preconditions (all MUST pass or abort(422)):
 *
 *   1. score_id exists in vocab.pgs_scores (Plan 02 ingestion landed it).
 *   2. source_key resolves to a real Source row.
 *   3. app.finngen_source_variant_indexes has a row for this source
 *      (Phase 14 PGEN built via parthenon:finngen:prepare-source-variants).
 *   4. Target cohort has >=1 row in {cohort_schema}.cohort.
 *
 * On success, creates a Run via FinnGenRunService::create with
 * analysis_type = 'finngen.prs.compute'. The Horizon job dispatches to the
 * Darkstar plumber POST /finngen/prs/compute route, which invokes the R
 * worker in darkstar/api/finngen/prs_compute.R.
 *
 * When cohort_definition_id is omitted, resolves via the latest
 * FinnGenEndpointGeneration for (endpoint_name × source_key) and applies the
 * Phase 13.2 100B offset — same semantics as the R worker, just on the PHP
 * side so the precondition check (#4) targets the right row range.
 */
final class PrsDispatchService
{
    public const ANALYSIS_TYPE = 'finngen.prs.compute';

    public function __construct(
        private readonly FinnGenRunService $runs,
        private readonly FinnGenSourceContextBuilder $sourceContext,
    ) {}

    /**
     * @param  array{source_key:string, score_id:string, cohort_definition_id:int|null, overwrite_existing?:bool}  $input
     * @return array{
     *     run: Run,
     *     cohort_definition_id: int,
     *     score_id: string,
     *     source_key: string,
     *     finngen_endpoint_generation_id: int|null
     * }
     */
    public function dispatch(int $userId, string $endpointName, array $input): array
    {
        $sourceKey = $input['source_key'];
        $scoreId = $input['score_id'];

        // (1) score_id must exist in vocab.pgs_scores (Plan 01 migration).
        // Raw SELECT to avoid a new Eloquent model until Plan 02 lands one.
        // vocab is searchable on default connection per CLAUDE.md schema arch.
        $scoreRow = DB::selectOne(
            'SELECT 1 AS ok FROM vocab.pgs_scores WHERE score_id = ? LIMIT 1',
            [$scoreId],
        );
        if ($scoreRow === null) {
            abort(
                422,
                "score_id {$scoreId} not found in vocab.pgs_scores \u2014 run "
                ."`php artisan parthenon:load-pgs-catalog --score-id={$scoreId}` first"
            );
        }

        // (2) source must exist.
        $source = Source::query()->where('source_key', $sourceKey)->first();
        if ($source === null) {
            abort(422, "Source {$sourceKey} not found");
        }

        // (3) variant_index must exist (Phase 14 PGEN prerequisite).
        if (! SourceVariantIndex::query()
            ->where('source_key', strtolower($sourceKey))
            ->exists()) {
            abort(
                422,
                "Source {$sourceKey} has no variant_index \u2014 run "
                ."`php artisan parthenon:finngen:prepare-source-variants --source-key={$sourceKey}` "
                .'first (Phase 14 prerequisite)'
            );
        }

        // (4) Resolve cohort_definition_id — either provided (user cohort)
        //     or derive from latest FinnGenEndpointGeneration (offset-keyed).
        $finngenGenerationId = null;
        $cohortDefinitionId = $input['cohort_definition_id'] ?? null;
        if ($cohortDefinitionId === null) {
            /** @var FinnGenEndpointGeneration|null $gen */
            $gen = FinnGenEndpointGeneration::query()
                ->where('endpoint_name', $endpointName)
                ->where('source_key', $sourceKey)
                ->orderByDesc('id')
                ->first();
            if ($gen === null) {
                abort(
                    422,
                    "No FinnGenEndpointGeneration for endpoint='{$endpointName}' "
                    ."source_key='{$sourceKey}'. Provide explicit cohort_definition_id "
                    .'or POST /generate first.'
                );
            }
            $finngenGenerationId = (int) $gen->id;
            $cohortDefinitionId = $finngenGenerationId + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET;
        }

        // (5) Cohort rows must exist. Resolve cohort_schema via SourceContextBuilder.
        // SourceContextBuilder uses _results convention (e.g. pancreas_results).
        $envelope = $this->sourceContext->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);
        $cohortSchema = $envelope['schemas']['cohort'];

        // T-15-10 mitigation: regex allow-list before schema interpolation.
        if (preg_match('/^[a-z][a-z0-9_]*$/', $cohortSchema) !== 1) {
            abort(500, "Unsafe cohort_schema resolved: {$cohortSchema}");
        }

        // Use pgsql connection with fully-qualified schema — same pattern as
        // GwasRunService::assertControlCohortPrepared. Direct `omop` connection
        // is banned per PHPStan SourceAware rule; cross-schema SELECT works
        // because Parthenon is a single-DB deployment (schemas are isolated
        // via search_path, not separate databases).
        $row = DB::connection('pgsql')->selectOne(
            "SELECT COUNT(*) AS c FROM {$cohortSchema}.cohort WHERE cohort_definition_id = ?",
            [$cohortDefinitionId],
        );
        $count = (int) ($row->c ?? 0);
        if ($count < 1) {
            abort(
                422,
                "Cohort {$cohortSchema}.cohort has 0 rows for "
                ."cohort_definition_id={$cohortDefinitionId}"
            );
        }

        // (6) Dispatch.
        $params = [
            // R worker reads whichever is non-null; generation wins if both set.
            'cohort_definition_id' => $finngenGenerationId === null ? $cohortDefinitionId : null,
            'finngen_endpoint_generation_id' => $finngenGenerationId,
            'score_id' => $scoreId,
            'source_key' => $sourceKey,
            'overwrite_existing' => (bool) ($input['overwrite_existing'] ?? false),
        ];

        $run = $this->runs->create(
            userId: $userId,
            sourceKey: $sourceKey,
            analysisType: self::ANALYSIS_TYPE,
            params: $params,
        );

        return [
            'run' => $run,
            'cohort_definition_id' => (int) $cohortDefinitionId,
            'score_id' => $scoreId,
            'source_key' => $sourceKey,
            'finngen_endpoint_generation_id' => $finngenGenerationId,
        ];
    }
}
