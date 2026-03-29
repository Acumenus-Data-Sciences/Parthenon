<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\PoseidonRun;
use App\Models\App\PoseidonSchedule;
use App\Services\Poseidon\PoseidonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PoseidonController extends Controller
{
    public function __construct(
        private readonly PoseidonService $poseidon,
    ) {}

    /* ── Schedules ──────────────────────────────────────────────────── */

    public function schedules(Request $request): JsonResponse
    {
        $schedules = PoseidonSchedule::with('source:id,source_name,source_key')
            ->withCount('runs')
            ->latest()
            ->get();

        return response()->json(['data' => $schedules]);
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|exists:sources,id',
            'schedule_type' => 'required|in:manual,cron,sensor',
            'cron_expr' => 'nullable|string|max:100',
            'sensor_config' => 'nullable|array',
            'is_active' => 'boolean',
            'dbt_selector' => 'nullable|string|max:255',
        ]);

        $schedule = PoseidonSchedule::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $schedule->load('source:id,source_name,source_key')], 201);
    }

    public function updateSchedule(Request $request, PoseidonSchedule $schedule): JsonResponse
    {
        $validated = $request->validate([
            'schedule_type' => 'sometimes|in:manual,cron,sensor',
            'cron_expr' => 'nullable|string|max:100',
            'sensor_config' => 'nullable|array',
            'is_active' => 'boolean',
            'dbt_selector' => 'nullable|string|max:255',
        ]);

        $schedule->update($validated);

        return response()->json(['data' => $schedule->fresh('source:id,source_name,source_key')]);
    }

    public function destroySchedule(PoseidonSchedule $schedule): JsonResponse
    {
        $schedule->update(['is_active' => false]);
        $schedule->delete();

        return response()->json(['message' => 'Schedule deactivated']);
    }

    /* ── Runs ───────────────────────────────────────────────────────── */

    public function runs(Request $request): JsonResponse
    {
        $query = PoseidonRun::with('source:id,source_name,source_key')
            ->latest();

        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $runs = $query->paginate($request->integer('per_page', 25));

        return response()->json($runs);
    }

    public function showRun(PoseidonRun $run): JsonResponse
    {
        return response()->json([
            'data' => $run->load(['source:id,source_name,source_key', 'schedule']),
        ]);
    }

    public function triggerRun(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'nullable|exists:sources,id',
            'run_type' => 'required|in:incremental,full_refresh,vocabulary',
            'schedule_id' => 'nullable|exists:poseidon_schedules,id',
            'dbt_selector' => 'nullable|string|max:255',
        ]);

        $result = $this->poseidon->triggerRun(
            $validated['run_type'],
            $validated['source_id'] ?? null,
            $validated['dbt_selector'] ?? null,
        );

        $dagsterRunId = $result['dagster_run_id'] ?? Str::uuid()->toString();

        $runData = [
            'dagster_run_id' => $dagsterRunId,
            'source_id' => $validated['source_id'] ?? null,
            'schedule_id' => $validated['schedule_id'] ?? null,
            'run_type' => $validated['run_type'],
            'status' => $result ? 'pending' : 'failed',
            'started_at' => now(),
            'triggered_by' => 'manual',
            'created_by' => $request->user()->id,
        ];

        if (! $result) {
            $runData['error_message'] = 'Failed to communicate with Dagster orchestration service';
        }

        $run = PoseidonRun::create($runData);

        return response()->json(['data' => $run], 201);
    }

    public function cancelRun(PoseidonRun $run): JsonResponse
    {
        if (! $run->isRunning()) {
            return response()->json(['message' => 'Run is not active'], 422);
        }

        $run->update([
            'status' => 'cancelled',
            'completed_at' => now(),
        ]);

        return response()->json(['data' => $run->fresh()]);
    }

    /* ── Freshness + Lineage ────────────────────────────────────────── */

    public function freshness(): JsonResponse
    {
        $freshness = $this->poseidon->getFreshness();

        return response()->json(['data' => $freshness]);
    }

    public function lineage(): JsonResponse
    {
        $lineage = $this->poseidon->getLineage();

        return response()->json(['data' => $lineage]);
    }

    /* ── Webhook (Dagster → Laravel) ────────────────────────────────── */

    public function webhook(Request $request): JsonResponse
    {
        $secret = config('services.poseidon.webhook_secret');
        if ($secret && $request->header('X-Poseidon-Secret') !== $secret) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'dagster_run_id' => 'required|string',
            'status' => 'required|in:pending,running,success,failed,cancelled',
            'stats' => 'nullable|array',
            'error_message' => 'nullable|string',
            'completed_at' => 'nullable|date',
        ]);

        $run = PoseidonRun::where('dagster_run_id', $validated['dagster_run_id'])->first();

        if (! $run) {
            return response()->json(['message' => 'Run not found'], 404);
        }

        $run->update([
            'status' => $validated['status'],
            'stats' => $validated['stats'] ?? $run->stats,
            'error_message' => $validated['error_message'] ?? $run->error_message,
            'completed_at' => $validated['completed_at'] ?? (in_array($validated['status'], ['success', 'failed', 'cancelled']) ? now() : null),
        ]);

        // Update schedule last_run_at if linked
        if ($run->schedule_id && $validated['status'] === 'success') {
            $run->schedule?->update(['last_run_at' => now()]);
        }

        return response()->json(['data' => $run->fresh()]);
    }

    /* ── Dashboard summary ──────────────────────────────────────────── */

    public function dashboard(): JsonResponse
    {
        $activeSchedules = PoseidonSchedule::where('is_active', true)->count();
        $totalSchedules = PoseidonSchedule::count();
        $activeRuns = PoseidonRun::whereIn('status', ['pending', 'running'])->count();
        $recentRuns = PoseidonRun::with('source:id,source_name,source_key')
            ->latest()
            ->limit(10)
            ->get();
        $runStats = PoseidonRun::selectRaw("
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) as success,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
            COALESCE(SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END), 0) as active
        ")->first();

        $schedules = PoseidonSchedule::with('source:id,source_name,source_key')
            ->withCount('runs')
            ->latest()
            ->get();

        return response()->json([
            'data' => [
                'active_schedules' => $activeSchedules,
                'total_schedules' => $totalSchedules,
                'active_runs' => $activeRuns,
                'run_stats' => $runStats,
                'recent_runs' => $recentRuns,
                'schedules' => $schedules,
            ],
        ]);
    }
}
