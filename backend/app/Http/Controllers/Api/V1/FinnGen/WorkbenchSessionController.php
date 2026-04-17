<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\CreateWorkbenchSessionRequest;
use App\Http\Requests\FinnGen\MatchWorkbenchCohortRequest;
use App\Http\Requests\FinnGen\MaterializeWorkbenchCohortRequest;
use App\Http\Requests\FinnGen\PreviewWorkbenchCountsRequest;
use App\Http\Requests\FinnGen\PromoteMatchedCohortRequest;
use App\Http\Requests\FinnGen\UpdateWorkbenchSessionRequest;
use App\Models\App\CohortDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\WebApiRegistry;
use App\Services\FinnGen\CohortOperationCompiler;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarTimeoutException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use App\Services\FinnGen\WorkbenchSessionService;
use App\Services\WebApi\AtlasCohortImportService;
use App\Services\WebApi\AtlasDiscoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * SP4 Phase A — Cohort Workbench session CRUD.
 *
 * Routes are protected by auth:sanctum + permission:finngen.workbench.use at
 * the route layer; ownership is enforced inside this controller (a researcher
 * can only see and mutate their own sessions). No role escalation possible.
 */
class WorkbenchSessionController extends Controller
{
    public function __construct(
        private readonly WorkbenchSessionService $sessions,
        private readonly CohortOperationCompiler $compiler,
        private readonly FinnGenSourceContextBuilder $sourceBuilder,
        private readonly FinnGenClient $client,
        private readonly FinnGenRunService $runs,
        private readonly AtlasDiscoveryService $atlasDiscovery,
        private readonly AtlasCohortImportService $atlasImporter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $sourceKey = $request->query('source_key');
        $sourceKey = is_string($sourceKey) ? $sourceKey : null;

        return response()->json([
            'data' => $this->sessions->listForUser($userId, $sourceKey),
        ]);
    }

    public function show(Request $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        return response()->json(['data' => $found]);
    }

    public function store(CreateWorkbenchSessionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $created = $this->sessions->create(
            userId: (int) $request->user()->id,
            sourceKey: (string) $data['source_key'],
            name: (string) $data['name'],
            description: isset($data['description']) ? (string) $data['description'] : null,
            sessionState: is_array($data['session_state'] ?? null) ? $data['session_state'] : [],
            schemaVersion: (int) ($data['schema_version'] ?? 1),
        );

        return response()->json(['data' => $created], 201);
    }

    public function update(UpdateWorkbenchSessionRequest $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        $updated = $this->sessions->update($found, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        $this->sessions->delete($found);

        return response()->json(['data' => null], 204);
    }

    /**
     * SP4 Phase B.3 — preview-counts. Validates the operation tree, compiles
     * to a SELECT-subject_id SQL fragment using the source's cohort schema,
     * and dispatches to Darkstar's sync /finngen/cohort/preview-count route
     * to get COUNT(DISTINCT subject_id).
     *
     * Errors:
     *   - 422 — tree fails validation (missing children, bad cohort_id, ...)
     *   - 404 — source_key not found
     *   - 504 — Darkstar timeout
     *   - 502 — Darkstar unreachable (network) or rejected (4xx)
     */
    public function previewCounts(PreviewWorkbenchCountsRequest $request): JsonResponse
    {
        $data = $request->validated();
        // validated() strips nested keys (tree.op, tree.children) that aren't
        // declared as dot-rules. CohortOperationCompiler is the source of
        // truth for structural validation, so pull the raw tree blob here.
        $rawTree = $request->input('tree');
        $tree = is_array($rawTree) ? $rawTree : [];

        $errors = $this->compiler->validate($tree);
        if (! empty($errors)) {
            return response()->json([
                'message' => 'Operation tree failed validation',
                'errors' => $errors,
            ], 422);
        }

        $source = $this->sourceBuilder->build(
            (string) $data['source_key'],
            FinnGenSourceContextBuilder::ROLE_RO,
        );
        $cohortSchema = (string) $source['schemas']['cohort'];

        try {
            $sql = $this->compiler->compileSql($tree, $cohortSchema);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        try {
            $result = $this->client->postSync('/finngen/cohort/preview-count', [
                'source' => $source,
                'sql' => $sql,
            ]);
        } catch (FinnGenDarkstarTimeoutException $e) {
            return response()->json(['message' => 'Preview timed out'], 504);
        } catch (FinnGenDarkstarUnreachableException|FinnGenDarkstarRejectedException $e) {
            return response()->json(['message' => 'Darkstar error: '.$e->getMessage()], 502);
        }

        // Darkstar's .safe_sync wraps the handler return in the same
        // {ok, result} envelope that run_with_classification uses — so a
        // successful preview comes back as {ok: true, result: {total: N}}.
        // Fall through to the direct-total shape for backwards compat.
        $inner = is_array($result['result'] ?? null) ? $result['result'] : $result;
        if (isset($result['ok']) && $result['ok'] === false) {
            $err = is_array($result['error'] ?? null) ? $result['error'] : [];
            $msg = is_string($err['message'] ?? null) ? $err['message'] : 'Darkstar preview failed';

            return response()->json(['message' => $msg, 'raw' => $result], 502);
        }
        $total = is_int($inner['total'] ?? null) ? $inner['total'] : null;
        if ($total === null) {
            return response()->json([
                'message' => 'Malformed preview response from Darkstar',
                'raw' => $result,
            ], 502);
        }

        return response()->json([
            'data' => [
                'total' => $total,
                'cohort_ids' => $this->compiler->listCohortIds($tree),
                'operation_string' => $this->compiler->compile($tree),
            ],
        ]);
    }

    /**
     * SP4 Phase D — match a primary cohort against 1+ comparators.
     *
     * Wraps the existing async finngen.cohort.match analysis (registered in
     * FinnGenAnalysisModuleSeeder) with workbench-namespaced RBAC. Returns
     * the run_id; the caller polls the standard /api/v1/finngen/runs/{id}
     * endpoint for status + summary.counts.
     */
    public function matchCohort(MatchWorkbenchCohortRequest $request): JsonResponse
    {
        $data = $request->validated();
        $params = [
            'primary_cohort_id' => (int) $data['primary_cohort_id'],
            'comparator_cohort_ids' => array_map('intval', $data['comparator_cohort_ids']),
            'ratio' => (int) ($data['ratio'] ?? 1),
            'match_sex' => (bool) ($data['match_sex'] ?? true),
            'match_birth_year' => (bool) ($data['match_birth_year'] ?? true),
            'max_year_difference' => (int) ($data['max_year_difference'] ?? 1),
        ];

        $run = $this->runs->create(
            userId: (int) $request->user()->id,
            sourceKey: (string) $data['source_key'],
            analysisType: 'cohort.match',
            params: $params,
        );

        return response()->json(['data' => $run], 202);
    }

    /**
     * SP4 Polish 2 — materialize an operation tree as a new cohort_definition
     * + cohort table rows in the source's cohort schema.
     *
     * Flow:
     *   1. Validate the tree structurally (CohortOperationCompiler).
     *   2. Create the cohort_definition row in app.cohort_definitions owned
     *      by the caller; store the operation tree under expression_json
     *      so the definition round-trips.
     *   3. Compile the tree to a subject-id SELECT fragment + collect the
     *      referenced cohort IDs (needed for the INSERT that joins back to
     *      cohort for start/end dates).
     *   4. Dispatch a cohort.materialize Run; caller polls /runs/{id}.
     *
     * Returns 202 with the Run record + the new cohort_definition_id so the
     * UI can wire the Handoff step to the freshly materialized cohort.
     */
    public function materializeCohort(MaterializeWorkbenchCohortRequest $request): JsonResponse
    {
        $data = $request->validated();
        $rawTree = $request->input('tree');
        $tree = is_array($rawTree) ? $rawTree : [];

        $errors = $this->compiler->validate($tree);
        if (! empty($errors)) {
            return response()->json([
                'message' => 'Operation tree failed validation',
                'errors' => $errors,
            ], 422);
        }

        $source = $this->sourceBuilder->build(
            (string) $data['source_key'],
            FinnGenSourceContextBuilder::ROLE_RW,
        );
        $cohortSchema = (string) $source['schemas']['cohort'];

        try {
            $subjectSql = $this->compiler->compileSql($tree, $cohortSchema);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $referenced = $this->compiler->listCohortIds($tree);
        if (empty($referenced)) {
            return response()->json([
                'message' => 'Operation tree references no cohorts',
            ], 422);
        }

        // SP4 Polish #7 — overwrite flow. When the request carries a valid
        // overwrite_cohort_definition_id AND it belongs to the caller, reuse
        // that row (update metadata + bump version), then pass overwrite=true
        // to the R worker so it DELETEs existing cohort rows before INSERT.
        $overwriteId = $data['overwrite_cohort_definition_id'] ?? null;
        $overwrite = false;
        $definition = null;
        if ($overwriteId !== null) {
            /** @var CohortDefinition|null $existing */
            $existing = CohortDefinition::where('id', (int) $overwriteId)
                ->where('author_id', (int) $request->user()->id)
                ->first();
            if ($existing === null) {
                return response()->json([
                    'message' => "Cohort definition {$overwriteId} not found or not owned by you",
                ], 404);
            }
            $existing->update([
                'name' => (string) $data['name'],
                'description' => isset($data['description']) ? (string) $data['description'] : null,
                'version' => ((int) $existing->version) + 1,
                'expression_json' => [
                    'source_key' => (string) $data['source_key'],
                    'workbench_tree' => $tree,
                    'referenced_cohort_ids' => $referenced,
                ],
            ]);
            $definition = $existing;
            $overwrite = true;
        } else {
            // Normal path — create a fresh cohort_definition.
            $definition = CohortDefinition::create([
                'name' => (string) $data['name'],
                'description' => isset($data['description']) ? (string) $data['description'] : null,
                'author_id' => (int) $request->user()->id,
                'is_public' => false,
                'version' => 1,
                'expression_json' => [
                    'source_key' => (string) $data['source_key'],
                    'workbench_tree' => $tree,
                    'referenced_cohort_ids' => $referenced,
                ],
            ]);
        }

        $run = $this->runs->create(
            userId: (int) $request->user()->id,
            sourceKey: (string) $data['source_key'],
            analysisType: 'cohort.materialize',
            params: [
                'cohort_definition_id' => $definition->id,
                'subject_sql' => $subjectSql,
                'cohort_schema' => $cohortSchema,
                'referenced_cohort_ids' => $referenced,
                'overwrite_existing' => $overwrite,
            ],
        );

        return response()->json([
            'data' => [
                'run' => $run,
                'cohort_definition_id' => $definition->id,
                'overwrite' => $overwrite,
            ],
        ], 202);
    }

    /**
     * SP4 Phase D.3 — promote a succeeded cohort.match run's matched output
     * into a first-class cohort_definition so downstream SP3 analyses can
     * consume it.
     *
     * The R worker (darkstar/api/finngen/cohort_ops.R) writes matched subjects
     * under a phantom cohort_definition_id = 9,000,000 + primary_id. This
     * endpoint mints a real row in app.cohort_definitions, then UPDATEs the
     * phantom rows in {cohort_schema}.cohort to point at the new id.
     *
     * Idempotent: if the run was already promoted (any cohort_definition row
     * owned by the user with expression_json->finngen_match_promotion.run_id
     * matching), returns the existing record without creating a duplicate.
     */
    public function promoteMatchedCohort(PromoteMatchedCohortRequest $request): JsonResponse
    {
        $data = $request->validated();
        $userId = (int) $request->user()->id;
        $runId = (string) $data['run_id'];

        /** @var Run|null $run */
        $run = Run::where('id', $runId)->where('user_id', $userId)->first();
        if ($run === null) {
            throw new NotFoundHttpException('Match run not found');
        }
        if ($run->analysis_type !== 'cohort.match') {
            return response()->json([
                'message' => 'Run is not a cohort.match run',
            ], 422);
        }
        if ($run->status !== Run::STATUS_SUCCEEDED) {
            return response()->json([
                'message' => "Run must be succeeded before promotion (status={$run->status})",
            ], 422);
        }

        $params = is_array($run->params) ? $run->params : [];
        $primaryCohortId = (int) ($params['primary_cohort_id'] ?? 0);
        if ($primaryCohortId <= 0) {
            return response()->json([
                'message' => 'Run params missing primary_cohort_id',
            ], 422);
        }
        $comparatorIds = array_values(array_filter(
            array_map('intval', is_array($params['comparator_cohort_ids'] ?? null) ? $params['comparator_cohort_ids'] : []),
            static fn (int $id): bool => $id > 0,
        ));
        $ratio = (int) ($params['ratio'] ?? 1);
        $matchSex = (bool) ($params['match_sex'] ?? true);
        $matchBirthYear = (bool) ($params['match_birth_year'] ?? true);
        $maxYearDifference = (int) ($params['max_year_difference'] ?? 1);
        $phantomCohortId = 9_000_000 + $primaryCohortId;

        // Idempotency — return the prior promotion when present.
        /** @var CohortDefinition|null $existing */
        $existing = CohortDefinition::where('author_id', $userId)
            ->whereRaw("expression_json::jsonb->'finngen_match_promotion'->>'run_id' = ?", [$runId])
            ->first();
        if ($existing !== null) {
            return response()->json([
                'data' => [
                    'cohort_definition_id' => (int) $existing->id,
                    'name' => (string) $existing->name,
                    'run_id' => $runId,
                    'already_promoted' => true,
                    'rows_migrated' => 0,
                    'provenance' => [
                        'primary_cohort_id' => $primaryCohortId,
                        'comparator_cohort_ids' => $comparatorIds,
                        'ratio' => $ratio,
                        'match_sex' => $matchSex,
                        'match_birth_year' => $matchBirthYear,
                        'max_year_difference' => $maxYearDifference,
                    ],
                ],
            ]);
        }

        $source = $this->sourceBuilder->build(
            (string) $run->source_key,
            FinnGenSourceContextBuilder::ROLE_RW,
        );
        $cohortSchema = (string) $source['schemas']['cohort'];

        // Defense-in-depth — cohortSchema is interpolated into raw SQL below
        // (we can't bind a schema name as a parameter). SourceDaimon.table_qualifier
        // is admin-owned so this should never trip, but guard anyway.
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $cohortSchema) !== 1) {
            return response()->json([
                'message' => "Invalid cohort schema name '{$cohortSchema}'",
            ], 500);
        }

        // Pre-flight: verify phantom rows exist. A succeeded run with zero
        // matched rows is an upstream inconsistency we should report cleanly
        // rather than create an empty cohort_definition.
        $phantomCount = (int) DB::connection()
            ->selectOne(
                "SELECT COUNT(*) AS n FROM {$cohortSchema}.cohort WHERE cohort_definition_id = ?",
                [$phantomCohortId],
            )->n;
        if ($phantomCount === 0) {
            return response()->json([
                'message' => "Matched cohort rows not found in {$cohortSchema}.cohort for phantom id {$phantomCohortId}",
            ], 422);
        }

        $defaultName = sprintf('Matched controls for cohort #%d (1:%d)', $primaryCohortId, $ratio);
        $name = isset($data['name']) && trim((string) $data['name']) !== ''
            ? (string) $data['name']
            : $defaultName;
        $description = isset($data['description']) && trim((string) $data['description']) !== ''
            ? (string) $data['description']
            : sprintf(
                'Matched output from cohort.match run %s. Primary #%d vs comparators [%s]. '.
                'Ratio 1:%d. match_sex=%s, match_birth_year=%s (±%d years).',
                $runId,
                $primaryCohortId,
                implode(', ', array_map(static fn (int $id): string => '#'.$id, $comparatorIds)),
                $ratio,
                $matchSex ? 'yes' : 'no',
                $matchBirthYear ? 'yes' : 'no',
                $maxYearDifference,
            );

        // Atomic: if the UPDATE fails we don't want an orphan cohort_definition
        // pointing at zero rows. cohort_definitions and {cohortSchema}.cohort
        // both live in the primary Parthenon DB (different schemas), so a
        // single transaction on the pgsql connection covers both writes.
        [$definition, $rowsMigrated] = DB::connection()->transaction(
            function () use (
                $userId,
                $name,
                $description,
                $run,
                $runId,
                $primaryCohortId,
                $comparatorIds,
                $ratio,
                $matchSex,
                $matchBirthYear,
                $maxYearDifference,
                $phantomCohortId,
                $cohortSchema,
            ) {
                $def = CohortDefinition::create([
                    'name' => $name,
                    'description' => $description,
                    'author_id' => $userId,
                    'is_public' => false,
                    'version' => 1,
                    'expression_json' => [
                        'source_key' => (string) $run->source_key,
                        'finngen_match_promotion' => [
                            'run_id' => $runId,
                            'primary_cohort_id' => $primaryCohortId,
                            'comparator_cohort_ids' => $comparatorIds,
                            'ratio' => $ratio,
                            'match_sex' => $matchSex,
                            'match_birth_year' => $matchBirthYear,
                            'max_year_difference' => $maxYearDifference,
                            'phantom_cohort_id' => $phantomCohortId,
                            'cohort_schema' => $cohortSchema,
                        ],
                    ],
                ]);

                $updated = DB::connection()->update(
                    "UPDATE {$cohortSchema}.cohort SET cohort_definition_id = ? WHERE cohort_definition_id = ?",
                    [(int) $def->id, $phantomCohortId],
                );

                return [$def, (int) $updated];
            },
        );

        return response()->json([
            'data' => [
                'cohort_definition_id' => (int) $definition->id,
                'name' => $name,
                'run_id' => $runId,
                'already_promoted' => false,
                'rows_migrated' => $rowsMigrated,
                'provenance' => [
                    'primary_cohort_id' => $primaryCohortId,
                    'comparator_cohort_ids' => $comparatorIds,
                    'ratio' => $ratio,
                    'match_sex' => $matchSex,
                    'match_birth_year' => $matchBirthYear,
                    'max_year_difference' => $maxYearDifference,
                ],
            ],
        ], 201);
    }

    /**
     * SP4 Phase E — list Atlas cohorts from the active WebAPI registry.
     *
     * Wraps AtlasDiscoveryService::discover() with a registry-based lookup
     * so researchers can browse Atlas cohorts via the Workbench Import step
     * without ever seeing WebAPI credentials (admin owns registry config).
     *
     * Response shape:
     *   200 { data: { registry: {name, base_url}, cohorts: [...] } }
     *   503 { message: "No active WebAPI registry configured" }
     */
    public function listAtlasCohorts(Request $request): JsonResponse
    {
        if (! ($request->user()?->can('finngen.workbench.use') ?? false)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        /** @var WebApiRegistry|null $registry */
        $registry = WebApiRegistry::query()
            ->where('is_active', true)
            ->orderByDesc('last_synced_at')
            ->orderByDesc('id')
            ->first();

        if ($registry === null) {
            return response()->json([
                'message' => 'No active WebAPI registry configured. Ask an admin to configure one under Admin → WebAPI Registries.',
            ], 503);
        }

        $inventory = $this->atlasDiscovery->discover(
            (string) $registry->base_url,
            (string) ($registry->auth_type ?? 'none'),
            $registry->getRawOriginal('auth_credentials') !== null
                ? (string) $registry->auth_credentials
                : null,
        );
        $cohorts = $inventory['cohort_definitions']['items'] ?? [];

        return response()->json([
            'data' => [
                'registry' => [
                    'id' => $registry->id,
                    'name' => $registry->name,
                    'base_url' => $registry->base_url,
                ],
                'cohorts' => $cohorts,
                'cohort_count' => $inventory['cohort_definitions']['count'] ?? count($cohorts),
            ],
        ]);
    }

    /**
     * SP4 Phase E — import a set of Atlas cohorts into app.cohort_definitions.
     *
     * Wraps AtlasCohortImportService::importFromActiveRegistry(). Imported
     * rows land in the same table the Parthenon browse tab reads from, so
     * they become findable in ImportCohortsStep tab 1 immediately.
     */
    public function importAtlasCohorts(Request $request): JsonResponse
    {
        if (! ($request->user()?->can('finngen.workbench.use') ?? false)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'atlas_ids' => ['required', 'array', 'min:1', 'max:50'],
            'atlas_ids.*' => ['integer', 'min:1'],
            'import_behavior' => ['nullable', 'string', 'in:auto,reuse_existing,reimport'],
        ]);

        $result = $this->atlasImporter->importFromActiveRegistry(
            $validated['atlas_ids'],
            (int) $request->user()->id,
            (string) ($validated['import_behavior'] ?? 'auto'),
        );

        if ($result['registry'] === null) {
            return response()->json([
                'message' => 'No active WebAPI registry configured.',
                'warnings' => $result['warnings'] ?? [],
            ], 503);
        }

        return response()->json([
            'data' => [
                'cohorts' => $result['cohorts'] ?? [],
                'concept_sets' => $result['concept_sets'] ?? [],
                'warnings' => $result['warnings'] ?? [],
                'diagnostics' => $result['diagnostics'] ?? [],
            ],
        ]);
    }
}
