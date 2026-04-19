<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Phase 18 GENOMICS-09/10/11 — dispatch service for `co2.endpoint_profile` runs.
 *
 * Mirrors {@see PrsDispatchService}: precondition ladder → FinnGenRunService::create.
 *
 * Preconditions (all MUST pass or abort(422)):
 *   1. Source exists in app.sources (else error_code=source_ineligible).
 *   2. Source has death OR observation_period rows (D-15 — if BOTH are empty,
 *      the source is structurally unable to produce a profile). Drug data is
 *      queried for the `source_has_drug_data` meta flag but does not gate
 *      dispatch.
 *   3. Endpoint exists in finngen.endpoint_definitions AND
 *      qualifying_event_spec resolves to at least one standard concept
 *      (else error_code=endpoint_not_resolvable).
 *   4. Resolve cohort_definition_id: if latest FinnGenEndpointGeneration
 *      (endpoint_name, source_key, last_status='succeeded') exists, use
 *      `$gen->id + OMOP_COHORT_ID_OFFSET`; else null so the R worker
 *      recomputes qualifying events on-the-fly from the expression.
 *
 * T-18-03/T-18-06 mitigation: source_key is validated upstream by
 * ComputeEndpointProfileRequest regex and re-validated here on the derived
 * lowercase schema name (`/^[a-z][a-z0-9_]*$/`) before SQL interpolation.
 * ANALYSIS_TYPE is a hard-coded class constant so no user-controlled string
 * flows into the R dispatcher.
 */
final class EndpointProfileDispatchService
{
    public const ANALYSIS_TYPE = 'co2.endpoint_profile';

    public function __construct(
        private readonly FinnGenRunService $runs,
        private readonly FinnGenSourceContextBuilder $sourceContext,
        private readonly EndpointExpressionHasher $hasher,
    ) {}

    /**
     * @param  array{source_key: string, min_subjects?: int}  $input
     * @return array{
     *     run: Run,
     *     endpoint_name: string,
     *     source_key: string,
     *     expression_hash: string,
     *     cohort_definition_id: int|null
     * }
     */
    public function dispatch(int $userId, string $endpointName, array $input): array
    {
        $sourceKey = $input['source_key'];
        $minSubjects = (int) ($input['min_subjects'] ?? 20);

        // ── Precondition 1: source exists ──
        $source = Source::query()->where('source_key', $sourceKey)->first();
        if ($source === null) {
            $this->fail422('source_ineligible', "Source {$sourceKey} not found");
        }

        // ── Precondition 2: source has death + observation_period rows ──
        $envelope = $this->sourceContext->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);
        $cdm = $envelope['schemas']['cdm'];
        if (preg_match('/^[a-z][a-z0-9_]*$/', $cdm) !== 1) {
            abort(500, "Unsafe cdm schema resolved: {$cdm}");
        }

        $deathCount = $this->safeCount($cdm, 'death');
        $obsCount = $this->safeCount($cdm, 'observation_period');
        $drugCount = $this->safeCount($cdm, 'drug_exposure');

        if ($deathCount === 0 && $obsCount === 0) {
            $this->fail422(
                'source_ineligible',
                "Source {$sourceKey} has no death AND no observation_period rows"
            );
        }

        // ── Precondition 3: endpoint has resolvable concepts ──
        /** @var EndpointDefinition|null $endpoint */
        $endpoint = EndpointDefinition::query()
            ->where('name', $endpointName)
            ->first();
        if ($endpoint === null) {
            $this->fail422(
                'endpoint_not_resolvable',
                "Endpoint {$endpointName} not found in finngen.endpoint_definitions"
            );
        }

        $spec = is_array($endpoint->qualifying_event_spec) ? $endpoint->qualifying_event_spec : [];
        $resolved = $spec['resolved_concepts'] ?? [];
        $conditionIds = array_values(array_map('intval', $resolved['conditions_standard'] ?? []));
        $drugIds = array_values(array_map('intval', $resolved['drugs_standard'] ?? []));
        $sourceConceptIds = array_values(array_map('intval', $resolved['source_concept_ids'] ?? []));
        $conceptCount = count($conditionIds) + count($drugIds) + count($sourceConceptIds);

        if ($conceptCount === 0) {
            $this->fail422(
                'endpoint_not_resolvable',
                "Endpoint {$endpointName} has no resolvable concepts"
            );
        }

        $expressionHash = $this->hasher->hash($spec);

        // ── Precondition 4: resolve cohort_definition_id ──
        // If the endpoint has a succeeded generation on this source, reuse
        // its offset cohort id. Else pass null and let the R worker recompute
        // qualifying events on-the-fly from the expression.
        $cohortDefinitionId = null;
        $finngenGenerationId = null;
        /** @var FinnGenEndpointGeneration|null $gen */
        $gen = FinnGenEndpointGeneration::query()
            ->where('endpoint_name', $endpointName)
            ->where('source_key', $sourceKey)
            ->where('last_status', 'succeeded')
            ->orderByDesc('id')
            ->first();
        if ($gen !== null) {
            $finngenGenerationId = (int) $gen->id;
            $cohortDefinitionId = $finngenGenerationId + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET;
        }

        // ── Dispatch ──
        $params = [
            'endpoint_name' => $endpointName,
            'source_key' => $sourceKey,
            'expression_hash' => $expressionHash,
            'min_subjects' => $minSubjects,
            'cohort_definition_id' => $cohortDefinitionId,
            'finngen_endpoint_generation_id' => $finngenGenerationId,
            'condition_concept_ids' => $conditionIds,
            'drug_concept_ids' => $drugIds,
            'source_concept_ids' => $sourceConceptIds,
            'source_has_death_data' => $deathCount > 0,
            'source_has_drug_data' => $drugCount > 0,
        ];

        $run = $this->runs->create(
            userId: $userId,
            sourceKey: $sourceKey,
            analysisType: self::ANALYSIS_TYPE,
            params: $params,
        );

        return [
            'run' => $run,
            'endpoint_name' => $endpointName,
            'source_key' => $sourceKey,
            'expression_hash' => $expressionHash,
            'cohort_definition_id' => $cohortDefinitionId,
        ];
    }

    /**
     * Count rows in {schema}.{table}; treats a missing table as zero so a CDM
     * source without drug_exposure (a common minimal-seed case) is still
     * eligible as long as death and/or observation_period are present.
     */
    private function safeCount(string $schema, string $table): int
    {
        try {
            $row = DB::connection('pgsql')->selectOne(
                "SELECT COUNT(*) AS c FROM {$schema}.{$table}"
            );

            return (int) ($row->c ?? 0);
        } catch (\Throwable $e) {
            return 0;
        }
    }

    private function fail422(string $errorCode, string $message): void
    {
        abort(response()->json([
            'message' => $message,
            'error_code' => $errorCode,
        ], HttpResponse::HTTP_UNPROCESSABLE_ENTITY));
    }
}
