<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\ManhattanQueryRequest;
use App\Http\Requests\FinnGen\ManhattanRegionQueryRequest;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\ManhattanAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * Phase 16-02 (GENOMICS-04) — Manhattan plot HTTP surface for a FinnGen GWAS
 * run. Two endpoints:
 *
 *   show()   — GET /api/v1/finngen/runs/{run}/manhattan
 *              Thinned, whole-genome payload for the top-level Manhattan plot.
 *              D-04 envelope: {variants, genome: {chrom_offsets}, thinning}.
 *              Redis-cached 24h under `finngen:manhattan:{run_id}:thin:{bin_count}`.
 *
 *   region() — GET /api/v1/finngen/runs/{run}/manhattan/region
 *              Full-resolution rows in a ≤ 2 Mb window for the regional view.
 *              NOT cached — small payloads, always live.
 *
 * HIGHSEC §2 three-layer model:
 *   Layer 1 (auth:sanctum)   — applied by route group.
 *   Layer 2 (permission)     — `permission:finngen.workbench.use` at the route
 *                               AND reinforced in the FormRequest.
 *   Layer 3 (ownership)      — controller-level check: run.user_id === user.id
 *                               OR user is admin/super-admin.
 *
 * Status handling (per D-? / Pitfall 3):
 *   queued / running  → 202 + Retry-After: 30
 *   failed            → 410
 *   canceled          → 410
 *   succeeded         → 200 with payload
 *   missing / foreign → 404
 */
final class GwasManhattanController extends Controller
{
    public function __construct(
        private readonly ManhattanAggregationService $aggregator,
    ) {}

    public function show(ManhattanQueryRequest $request, string $run): JsonResponse
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

        $binCount = (int) ($request->validated('bin_count') ?? 100);
        $threshold = (float) ($request->validated('thin_threshold') ?? 5e-8);

        $cacheKey = sprintf('finngen:manhattan:%s:thin:%d', $runModel->id, $binCount);
        $payload = Cache::remember(
            $cacheKey,
            now()->addHours(24),
            fn (): array => $this->aggregator->thin($schema, $runModel->id, $binCount, $threshold),
        );

        return response()->json($payload);
    }

    public function region(ManhattanRegionQueryRequest $request, string $run): JsonResponse
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

        $chrom = (string) $request->validated('chrom');
        $start = (int) $request->validated('start');
        $end = (int) $request->validated('end');

        // Regional view is NOT cached — windows are small and always full-res.
        $payload = $this->aggregator->region($schema, $runModel->id, $chrom, $start, $end);

        return response()->json($payload);
    }

    /**
     * HIGHSEC §2 Layer 3 — aborts 403 unless the requester owns the run
     * or holds a platform-admin role.
     */
    private function assertOwnershipOrAdmin(
        ManhattanQueryRequest|ManhattanRegionQueryRequest $request,
        Run $run,
    ): void {
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
