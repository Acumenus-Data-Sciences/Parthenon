<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\TopVariantsQueryRequest;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\ManhattanAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * Phase 16-03 (GENOMICS-04) — Top-variants HTTP surface for a FinnGen GWAS
 * run. Single endpoint:
 *
 *   index() — GET /api/v1/finngen/runs/{run}/top-variants
 *             Sortable top-N rows (default 50) for the PheWeb-lite variants
 *             table + per-row drawer (D-10 / D-11 / D-12). Rows carry all 10
 *             drawer fields: chrom, pos, ref, alt, af, beta, se, p_value,
 *             snp_id, gwas_run_id.
 *             Redis-cached 15 min under
 *             `finngen:manhattan:{run_id}:top-variants:{sort}:{dir}:{limit}` (D-20).
 *
 * HIGHSEC §2 three-layer model (mirrors GwasManhattanController):
 *   Layer 1 (auth:sanctum)   — applied by route group.
 *   Layer 2 (permission)     — `permission:finngen.workbench.use` at the route
 *                               AND reinforced in the FormRequest.
 *   Layer 3 (ownership)      — controller-level: run.user_id === user.id
 *                               OR user is admin/super-admin.
 *
 * Status handling (parity with Plan 02 controller):
 *   queued / running  → 202 + Retry-After: 30
 *   failed / canceled → 410
 *   succeeded         → 200 with payload
 *   missing / foreign → 404
 *   other             → 409 (defensive fallthrough)
 *
 * Q6 RESOLUTION (confirmed in Plan 01 ManhattanAggregationService):
 *   Run.params JSONB key `cohort_definition_id` identifies the case-cohort
 *   so that topVariants() can hit the (cohort_definition_id, p_value) BTREE
 *   fast-path (Pitfall 6). When absent the service falls back to a plain
 *   (gwas_run_id) BRIN scan.
 */
final class GwasTopVariantsController extends Controller
{
    public function __construct(
        private readonly ManhattanAggregationService $aggregator,
    ) {}

    public function index(TopVariantsQueryRequest $request, string $run): JsonResponse
    {
        $runModel = Run::query()->find($run);
        if ($runModel === null) {
            abort(404, 'Run not found');
        }

        $this->assertOwnershipOrAdmin($request, $runModel);

        if (in_array($runModel->status, [Run::STATUS_QUEUED, Run::STATUS_RUNNING], true)) {
            return response()->json([
                'status' => $runModel->status,
                'run_id' => $runModel->id,
                'message' => 'Run is still processing',
            ], 202)->header('Retry-After', '30');
        }
        if (in_array($runModel->status, [Run::STATUS_FAILED, Run::STATUS_CANCELED], true)) {
            abort(410, "Run status: {$runModel->status}");
        }
        if ($runModel->status !== Run::STATUS_SUCCEEDED) {
            abort(409, "Run status: {$runModel->status}");
        }

        $schema = $this->aggregator->resolveSchemaForRun($runModel);
        if ($schema === null) {
            abort(404, 'No GWAS results schema for this run');
        }

        /** @var string $sort */
        $sort = $request->validated('sort') ?? 'p_value';
        /** @var string $rawDir */
        $rawDir = $request->validated('dir') ?? 'ASC';
        $dir = strtoupper($rawDir) === 'DESC' ? 'DESC' : 'ASC';
        /** @var int $limit */
        $limit = (int) ($request->validated('limit') ?? 50);

        // Q6 fast-path: pull cohort_definition_id from Run.params if present.
        /** @var array<string,mixed> $params */
        $params = is_array($runModel->params) ? $runModel->params : [];
        $cohortId = isset($params[ManhattanAggregationService::CASE_COHORT_PARAM_KEY])
            ? (int) $params[ManhattanAggregationService::CASE_COHORT_PARAM_KEY]
            : null;

        $cacheKey = sprintf(
            'finngen:manhattan:%s:top-variants:%s:%s:%d',
            $runModel->id,
            $sort,
            strtolower($dir),
            $limit,
        );

        /** @var array{rows: list<array<string,mixed>>, total: int} $payload */
        $payload = Cache::remember(
            $cacheKey,
            now()->addMinutes(15),
            fn (): array => $this->aggregator->topVariants(
                $schema,
                $runModel->id,
                $sort,
                $dir,
                $limit,
                $cohortId,
            ),
        );

        return response()->json($payload);
    }

    /**
     * HIGHSEC §2 Layer 3 — aborts 403 unless the requester owns the run
     * or holds a platform-admin role. Mirrors Plan 02 controller helper.
     */
    private function assertOwnershipOrAdmin(TopVariantsQueryRequest $request, Run $run): void
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }

        if ((int) $run->user_id === (int) $user->id) {
            return;
        }

        if ($user->hasRole(['admin', 'super-admin'])) {
            return;
        }

        abort(403);
    }
}
