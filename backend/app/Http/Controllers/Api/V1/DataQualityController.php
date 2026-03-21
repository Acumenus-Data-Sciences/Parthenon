<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\Dqd\RunDqdJob;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Services\Dqd\DqdCheckRegistry;
use App\Services\Dqd\DqdEngineService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

#[Group('Data Explorer', weight: 160)]
class DataQualityController extends Controller
{
    public function __construct(
        private DqdEngineService $engine,
        private DqdCheckRegistry $registry,
    ) {}

    /**
     * List all DQD runs for a source, grouped by run_id.
     */
    public function runs(Source $source): JsonResponse
    {
        $runs = DqdResult::where('source_id', $source->id)
            ->select('run_id')
            ->selectRaw('COUNT(*) as total_checks')
            ->selectRaw('SUM(CASE WHEN passed = true THEN 1 ELSE 0 END) as passed')
            ->selectRaw('SUM(CASE WHEN passed = false THEN 1 ELSE 0 END) as failed')
            ->selectRaw('MIN(created_at) as started_at')
            ->selectRaw('MAX(created_at) as completed_at')
            ->selectRaw('SUM(execution_time_ms) as total_execution_time_ms')
            ->groupBy('run_id')
            ->orderByDesc('started_at')
            ->get();

        return response()->json([
            'data' => $runs->map(fn ($run) => [
                'run_id' => $run->run_id,
                'total_checks' => (int) $run->total_checks,
                'passed' => (int) $run->passed,
                'failed' => (int) $run->failed,
                'pass_rate' => $run->total_checks > 0
                    ? round(($run->passed / $run->total_checks) * 100, 2)
                    : 0.0,
                'started_at' => $run->started_at,
                'completed_at' => $run->completed_at,
                'total_execution_time_ms' => (int) $run->total_execution_time_ms,
            ]),
        ]);
    }

    /**
     * Get detailed information for a specific run.
     */
    public function showRun(Source $source, string $runId): JsonResponse
    {
        $exists = DqdResult::where('source_id', $source->id)
            ->where('run_id', $runId)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'Run not found'], 404);
        }

        $summary = $this->engine->getSummary($runId);

        // Add table-level breakdown
        $byTable = DqdResult::where('run_id', $runId)
            ->select('cdm_table')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN passed = true THEN 1 ELSE 0 END) as passed')
            ->selectRaw('SUM(CASE WHEN passed = false THEN 1 ELSE 0 END) as failed')
            ->groupBy('cdm_table')
            ->orderBy('cdm_table')
            ->get()
            ->map(fn ($row) => [
                'table' => $row->cdm_table,
                'total' => (int) $row->total,
                'passed' => (int) $row->passed,
                'failed' => (int) $row->failed,
                'pass_rate' => $row->total > 0
                    ? round(($row->passed / $row->total) * 100, 2)
                    : 0.0,
            ]);

        $summary['by_table'] = $byTable;

        // Add timing info
        $timing = DqdResult::where('run_id', $runId)
            ->selectRaw('MIN(created_at) as started_at')
            ->selectRaw('MAX(created_at) as completed_at')
            ->selectRaw('SUM(execution_time_ms) as total_execution_time_ms')
            ->first();

        $summary['started_at'] = $timing->started_at;
        $summary['completed_at'] = $timing->completed_at;
        $summary['total_execution_time_ms'] = (int) $timing->total_execution_time_ms;

        return response()->json(['data' => $summary]);
    }

    /**
     * Get paginated results for a run with filters.
     */
    public function results(Source $source, string $runId, Request $request): JsonResponse
    {
        $exists = DqdResult::where('source_id', $source->id)
            ->where('run_id', $runId)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'Run not found'], 404);
        }

        $category = $request->query('category');
        $table = $request->query('table');
        $severity = $request->query('severity');
        $page = (int) $request->query('page', 1);
        $perPage = min((int) $request->query('per_page', 50), 200);

        // Handle "passed" filter: accept true/false/1/0
        $passed = null;
        if ($request->has('passed')) {
            $passedValue = $request->query('passed');
            $passed = filter_var($passedValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        $results = $this->engine->getResults(
            $runId,
            $category,
            $table,
            $passed,
            $severity,
            $page,
            $perPage,
        );

        return response()->json($results);
    }

    /**
     * Get category-level summary for a run.
     */
    public function summary(Source $source, string $runId): JsonResponse
    {
        $exists = DqdResult::where('source_id', $source->id)
            ->where('run_id', $runId)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'Run not found'], 404);
        }

        $summary = $this->engine->getSummary($runId);

        return response()->json(['data' => $summary]);
    }

    /**
     * Get results for a specific CDM table within a run.
     */
    public function tableResults(Source $source, string $runId, string $table): JsonResponse
    {
        $results = DqdResult::where('run_id', $runId)
            ->where('source_id', $source->id)
            ->where('cdm_table', $table)
            ->orderByRaw('CASE WHEN passed = false THEN 0 ELSE 1 END')
            ->orderBy('severity')
            ->orderBy('check_id')
            ->get();

        if ($results->isEmpty()) {
            return response()->json(['message' => 'No results found for this table and run'], 404);
        }

        $total = $results->count();
        $passed = $results->where('passed', true)->count();
        $failed = $results->where('passed', false)->count();

        return response()->json([
            'data' => [
                'table' => $table,
                'total' => $total,
                'passed' => $passed,
                'failed' => $failed,
                'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 2) : 0.0,
                'results' => $results,
            ],
        ]);
    }

    /**
     * Dispatch a new DQD run.
     */
    public function dispatch(Source $source, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => 'nullable|string|in:completeness,conformance,plausibility',
            'table' => 'nullable|string',
        ]);

        $category = $validated['category'] ?? null;
        $table = $validated['table'] ?? null;

        // Validate table name exists in registry
        if ($table && ! in_array($table, $this->registry->tables())) {
            return response()->json([
                'message' => "Unknown CDM table: {$table}",
                'available_tables' => $this->registry->tables(),
            ], 422);
        }

        $runId = (string) Str::uuid();

        RunDqdJob::dispatch($source, $category, $table, $runId);

        // Determine check count
        if ($category) {
            $checkCount = count($this->registry->byCategory($category));
        } elseif ($table) {
            $checkCount = count($this->registry->byTable($table));
        } else {
            $checkCount = $this->registry->count();
        }

        return response()->json([
            'message' => 'DQD run dispatched',
            'run_id' => $runId,
            'check_count' => $checkCount,
            'category' => $category,
            'table' => $table,
        ], 202);
    }

    /**
     * Lightweight progress endpoint for 1s polling during a running DQD job.
     */
    public function progress(Source $source, string $runId): JsonResponse
    {
        $totalExpected = $this->registry->count();

        // Use DB facade to avoid DqdResult model's boolean cast on 'passed' column
        $overall = DB::table('app.dqd_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->selectRaw('COUNT(*) as completed')
            ->selectRaw('SUM(CASE WHEN passed = true THEN 1 ELSE 0 END)::int as passed_count')
            ->selectRaw('SUM(CASE WHEN passed = false THEN 1 ELSE 0 END)::int as failed_count')
            ->first();

        $completed = (int) ($overall->completed ?? 0);
        $status = $completed === 0 ? 'pending' : ($completed >= $totalExpected ? 'completed' : 'running');

        $byCategory = DB::table('app.dqd_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->selectRaw('category, COUNT(*) as completed, SUM(CASE WHEN passed = true THEN 1 ELSE 0 END)::int as passed_count, SUM(CASE WHEN passed = false THEN 1 ELSE 0 END)::int as failed_count')
            ->groupBy('category')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'completed' => (int) $row->completed,
                'total' => count($this->registry->byCategory($row->category)),
                'passed' => (int) $row->passed_count,
                'failed' => (int) $row->failed_count,
            ]);

        // Add categories not yet started
        foreach ($this->registry->categories() as $cat) {
            if (! $byCategory->contains('category', $cat)) {
                $byCategory->push([
                    'category' => $cat,
                    'completed' => 0,
                    'total' => count($this->registry->byCategory($cat)),
                    'passed' => 0,
                    'failed' => 0,
                ]);
            }
        }

        // Latest check completed (for live feed)
        $latestCheck = DqdResult::where('run_id', $runId)
            ->where('source_id', $source->id)
            ->orderByDesc('id')
            ->first(['check_id', 'cdm_table', 'cdm_column', 'passed', 'category']);

        return response()->json([
            'run_id' => $runId,
            'status' => $status,
            'completed' => $completed,
            'total' => $totalExpected,
            'passed' => (int) ($overall->passed_count ?? 0),
            'failed' => (int) ($overall->failed_count ?? 0),
            'percentage' => $totalExpected > 0 ? round(($completed / $totalExpected) * 100, 1) : 0,
            'by_category' => $byCategory->sortBy('category')->values(),
            'latest_check' => $latestCheck ? [
                'check_id' => $latestCheck->check_id,
                'cdm_table' => $latestCheck->cdm_table,
                'cdm_column' => $latestCheck->cdm_column,
                'passed' => $latestCheck->passed,
                'category' => $latestCheck->category,
            ] : null,
        ]);
    }

    /**
     * Get the most recent run summary for a source.
     */
    public function latest(Source $source): JsonResponse
    {
        $latestRunId = DqdResult::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->value('run_id');

        if (! $latestRunId) {
            return response()->json(['data' => [
                'total' => 0,
                'passed' => 0,
                'failed' => 0,
                'not_applicable' => 0,
                'categories' => [],
            ]]);
        }

        $summary = $this->engine->getSummary($latestRunId);

        // Add timing info
        $timing = DqdResult::where('run_id', $latestRunId)
            ->selectRaw('MIN(created_at) as started_at')
            ->selectRaw('MAX(created_at) as completed_at')
            ->selectRaw('SUM(execution_time_ms) as total_execution_time_ms')
            ->first();

        $summary['started_at'] = $timing->started_at;
        $summary['completed_at'] = $timing->completed_at;
        $summary['total_execution_time_ms'] = (int) $timing->total_execution_time_ms;

        return response()->json(['data' => $summary]);
    }

    /**
     * Delete all results for a specific run.
     */
    public function destroyRun(Source $source, string $runId): JsonResponse
    {
        $deleted = DqdResult::where('source_id', $source->id)
            ->where('run_id', $runId)
            ->delete();

        if ($deleted === 0) {
            return response()->json(['message' => 'Run not found'], 404);
        }

        return response()->json([
            'message' => 'Run deleted',
            'deleted_count' => $deleted,
        ]);
    }
}
