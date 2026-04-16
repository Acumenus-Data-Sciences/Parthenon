<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\CreateWorkbenchSessionRequest;
use App\Http\Requests\FinnGen\MatchWorkbenchCohortRequest;
use App\Http\Requests\FinnGen\PreviewWorkbenchCountsRequest;
use App\Http\Requests\FinnGen\UpdateWorkbenchSessionRequest;
use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Services\FinnGen\CohortOperationCompiler;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarTimeoutException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use App\Services\FinnGen\WorkbenchSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
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

        $total = is_int($result['total'] ?? null) ? $result['total'] : null;
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

        Bus::dispatch(new RunFinnGenAnalysisJob($run->id));

        return response()->json(['data' => $run], 202);
    }
}
