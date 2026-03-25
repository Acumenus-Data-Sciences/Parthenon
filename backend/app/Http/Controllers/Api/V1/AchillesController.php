<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\Achilles\RunAchillesJob;
use App\Jobs\Achilles\RunHeelJob;
use App\Models\App\Source;
use App\Models\Results\AchillesRun;
use App\Models\Results\AchillesRunStep;
use App\Services\Achilles\AchillesAnalysisRegistry;
use App\Services\Achilles\AchillesResultReaderService;
use App\Services\Achilles\Heel\AchillesHeelRuleRegistry;
use App\Services\Achilles\Heel\AchillesHeelService;
use App\Services\Solr\AnalysesSearchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

#[Group('Data Explorer', weight: 160)]
class AchillesController extends Controller
{
    public function __construct(
        private readonly AchillesResultReaderService $reader,
        private readonly AchillesHeelService $heel,
        private readonly AchillesHeelRuleRegistry $heelRegistry,
        private readonly AchillesAnalysisRegistry $analysisRegistry,
        private readonly AnalysesSearchService $analysesSearch,
    ) {}

    /**
     * GET /v1/sources/{source}/achilles/record-counts
     *
     * Returns record counts for all CDM tables.
     */
    public function recordCounts(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getRecordCounts($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve record counts', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/demographics
     *
     * Returns demographic distributions (gender, race, ethnicity, age, year of birth).
     */
    public function demographics(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getDemographics($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve demographics', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/observation-periods
     *
     * Returns observation period statistics and distributions.
     */
    public function observationPeriods(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getObservationPeriods($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve observation periods', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/domains/{domain}
     *
     * Returns domain summary with top concepts by prevalence.
     * Query param: limit (default 25)
     */
    public function domainSummary(Source $source, string $domain, Request $request): JsonResponse
    {
        if (! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid domain',
                'message' => 'Domain must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        $limit = (int) $request->input('limit', 25);
        $limit = max(1, min($limit, 1000));

        try {
            $data = $this->reader->getDomainSummary($source, $domain, $limit);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve domain summary for {$domain}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/domains/{domain}/concepts/{conceptId}
     *
     * Returns concept drilldown detail within a domain.
     */
    public function conceptDrilldown(Source $source, string $domain, int $conceptId): JsonResponse
    {
        if (! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid domain',
                'message' => 'Domain must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        try {
            $data = $this->reader->getConceptDrilldown($source, $domain, $conceptId);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve concept drilldown for concept {$conceptId}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/temporal-trends?domain={domain}
     *
     * Returns temporal trends (monthly counts) for a domain.
     */
    public function temporalTrends(Source $source, Request $request): JsonResponse
    {
        $domain = $request->input('domain');

        if (! $domain || ! in_array($domain, AchillesResultReaderService::ALLOWED_DOMAINS, true)) {
            return response()->json([
                'error' => 'Invalid or missing domain parameter',
                'message' => 'Domain query parameter is required and must be one of: '.implode(', ', AchillesResultReaderService::ALLOWED_DOMAINS),
            ], 422);
        }

        try {
            $data = $this->reader->getTemporalTrends($source, $domain);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve temporal trends for {$domain}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/analyses
     *
     * Returns list of available analyses that have results.
     */
    public function analyses(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getAvailableAnalyses($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve available analyses', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/performance
     *
     * Returns Achilles performance report (elapsed seconds per analysis).
     */
    public function performance(Source $source): JsonResponse
    {
        try {
            $data = $this->reader->getPerformanceReport($source);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve performance report', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/distributions/{analysisId}
     *
     * Returns distribution data (box plot values) for a given analysis.
     * Query param: stratum1 (optional filter)
     */
    public function distribution(Source $source, int $analysisId, Request $request): JsonResponse
    {
        $stratum1 = $request->input('stratum1');

        try {
            $data = $this->reader->getDistribution($source, $analysisId, $stratum1);

            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return $this->errorResponse("Failed to retrieve distribution for analysis {$analysisId}", $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/heel
     *
     * Returns Achilles Heel quality rule results grouped by severity.
     */
    public function heel(Source $source): JsonResponse
    {
        try {
            $data = $this->heel->getResults($source);

            return response()->json([
                'data' => $data,
                'summary' => [
                    'errors' => count($data['error']),
                    'warnings' => count($data['warning']),
                    'notifications' => count($data['notification']),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve Achilles Heel results', $e);
        }
    }

    /**
     * POST /v1/sources/{source}/achilles/heel/run
     *
     * Dispatches an async Achilles Heel run and returns the run_id for polling.
     */
    public function runHeel(Source $source): JsonResponse
    {
        try {
            $runId = (string) Str::uuid();

            RunHeelJob::dispatch($source, $runId);

            return response()->json([
                'run_id' => $runId,
                'total_rules' => $this->heelRegistry->count(),
                'message' => 'Heel run dispatched',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to dispatch Achilles Heel', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/heel/runs
     *
     * List all Heel runs for a source.
     */
    public function heelRuns(Source $source): JsonResponse
    {
        $runs = DB::table('achilles_heel_results')
            ->where('source_id', $source->id)
            ->whereNotNull('run_id')
            ->selectRaw('run_id, COUNT(*) as total_results, COUNT(DISTINCT rule_id) as rules_completed, MIN(created_at) as started_at, MAX(created_at) as completed_at')
            ->groupBy('run_id')
            ->orderByDesc('started_at')
            ->limit(20)
            ->get();

        $totalRules = $this->heelRegistry->count();

        return response()->json([
            'data' => $runs->map(fn ($run) => [
                'run_id' => $run->run_id,
                'rules_completed' => (int) $run->rules_completed,
                'total_rules' => $totalRules,
                'total_results' => (int) $run->total_results,
                'started_at' => $run->started_at,
                'completed_at' => $run->completed_at,
            ]),
        ]);
    }

    /**
     * GET /v1/sources/{source}/achilles/heel/runs/{runId}/progress
     *
     * Lightweight progress endpoint for 1s polling during a running Heel job.
     */
    public function heelProgress(Source $source, string $runId): JsonResponse
    {
        $totalRules = $this->heelRegistry->count();

        $overall = DB::table('achilles_heel_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->selectRaw('COUNT(DISTINCT rule_id) as rules_completed, COUNT(*) as total_results')
            ->first();

        $rulesCompleted = (int) ($overall->rules_completed ?? 0);
        $totalResults = (int) ($overall->total_results ?? 0);

        // Heel only stores violation rows — most rules produce 0 rows.
        // We cannot determine "running" by comparing rules_completed vs totalRules.
        // Use time-based staleness: if no new results in last 2 minutes, it's done.
        $lastResult = DB::table('achilles_heel_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->max('created_at');

        $lastAge = $lastResult
            ? abs(now()->diffInSeconds(Carbon::parse($lastResult)))
            : PHP_INT_MAX;

        if ($rulesCompleted === 0 && $totalResults === 0) {
            $status = $lastAge > 120 ? 'completed' : 'pending';
        } else {
            $status = $lastAge < 120 ? 'running' : 'completed';
        }

        $bySeverity = DB::table('achilles_heel_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->selectRaw('severity, COUNT(*) as count, COUNT(DISTINCT rule_id) as rules')
            ->groupBy('severity')
            ->get()
            ->map(fn ($row) => [
                'severity' => $row->severity,
                'count' => (int) $row->count,
                'rules' => (int) $row->rules,
            ]);

        // Ensure all severities present
        foreach (['error', 'warning', 'notification'] as $sev) {
            if (! $bySeverity->contains('severity', $sev)) {
                $bySeverity->push(['severity' => $sev, 'count' => 0, 'rules' => 0]);
            }
        }

        $latestResult = DB::table('achilles_heel_results')
            ->where('run_id', $runId)
            ->where('source_id', $source->id)
            ->orderByDesc('id')
            ->first(['rule_id', 'rule_name', 'severity']);

        return response()->json([
            'run_id' => $runId,
            'status' => $status,
            'rules_completed' => $rulesCompleted,
            'total_rules' => $totalRules,
            'total_results' => (int) ($overall->total_results ?? 0),
            'percentage' => $status === 'completed' ? 100.0 : ($status === 'pending' ? 0.0 : 50.0),
            'by_severity' => $bySeverity->sortBy('severity')->values(),
            'latest_rule' => $latestResult ? [
                'rule_id' => $latestResult->rule_id,
                'rule_name' => $latestResult->rule_name,
                'severity' => $latestResult->severity,
            ] : null,
        ]);
    }

    /**
     * POST /v1/sources/{source}/achilles/run
     *
     * Dispatches a full Achilles characterization job for the given source.
     */
    public function run(Request $request, Source $source): JsonResponse
    {
        try {
            // Prevent concurrent runs on the same source
            $activeRun = AchillesRun::where('source_id', $source->id)
                ->whereIn('status', ['pending', 'running'])
                ->first();

            if ($activeRun) {
                return response()->json([
                    'error' => 'An Achilles run is already active for this source.',
                    'active_run_id' => $activeRun->run_id,
                    'status' => $activeRun->status,
                    'started_at' => $activeRun->started_at,
                ], 409);
            }

            $runId = (string) Str::uuid();

            RunAchillesJob::dispatch(
                $source,
                $request->input('categories'),
                $request->input('analysis_ids'),
                $request->boolean('fresh', false),
                $runId,
            );

            return response()->json([
                'run_id' => $runId,
                'total_analyses' => $this->analysisRegistry->count(),
                'message' => 'Achilles run dispatched.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to dispatch Achilles run', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/achilles/runs
     *
     * List Achilles characterization runs for a source.
     */
    public function achillesRuns(Source $source): JsonResponse
    {
        $runs = AchillesRun::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn (AchillesRun $run) => [
                'run_id' => $run->run_id,
                'status' => $run->status,
                'total_analyses' => $run->total_analyses,
                'completed_analyses' => $run->completed_analyses,
                'failed_analyses' => $run->failed_analyses,
                'categories' => $run->categories,
                'started_at' => $run->started_at?->toISOString(),
                'completed_at' => $run->completed_at?->toISOString(),
            ]);

        return response()->json(['data' => $runs]);
    }

    /**
     * GET /v1/sources/{source}/achilles/runs/{runId}/progress
     *
     * Full progress for a specific Achilles run including all steps grouped by category.
     */
    public function achillesProgress(Source $source, string $runId): JsonResponse
    {
        $run = AchillesRun::where('run_id', $runId)
            ->where('source_id', $source->id)
            ->first();

        if (! $run) {
            return response()->json(['error' => 'Run not found'], 404);
        }

        $steps = AchillesRunStep::where('run_id', $runId)
            ->orderBy('analysis_id')
            ->get();

        // Compute actual counts from steps (authoritative, not the cached run row)
        $completedCount = $steps->where('status', 'completed')->count();
        $failedCount = $steps->where('status', 'failed')->count();
        $totalCount = $steps->count();

        // Stale run detection: if status is 'running' but no step has been
        // updated in 5+ minutes AND no step is currently executing, the queue
        // worker died. A step with status='running' means the job is alive
        // (some analyses like Measurement 1802 take 7+ minutes on real CDM data).
        $status = $run->status;
        $hasRunningStep = $steps->where('status', 'running')->count() > 0;

        if (($status === 'running' || $status === 'pending') && ! $hasRunningStep) {
            $lastActivity = $steps
                ->whereNotNull('completed_at')
                ->max('completed_at');

            $staleSince = $lastActivity
                ? abs(now()->diffInSeconds(Carbon::parse($lastActivity)))
                : ($run->started_at ? abs(now()->diffInSeconds($run->started_at)) : PHP_INT_MAX);

            if ($staleSince > 300 && ($completedCount + $failedCount) > 0) {
                // Mark orphaned steps as failed
                AchillesRunStep::where('run_id', $runId)
                    ->whereIn('status', ['pending', 'running'])
                    ->update([
                        'status' => 'failed',
                        'error_message' => 'Job interrupted — queue worker restarted',
                        'completed_at' => now(),
                    ]);

                // Recount after marking orphans
                $orphanedCount = $totalCount - $completedCount - $failedCount;
                $failedCount += $orphanedCount;

                // Finalize the run (use query builder to bypass $fillable exclusion of 'status')
                AchillesRun::where('run_id', $runId)->update([
                    'status' => 'failed',
                    'completed_analyses' => $completedCount,
                    'failed_analyses' => $failedCount,
                    'completed_at' => now(),
                ]);
                $status = 'failed';

                // Refresh steps from DB after orphan cleanup
                $steps = AchillesRunStep::where('run_id', $runId)
                    ->orderBy('analysis_id')
                    ->get();
            }
        }

        $mappedSteps = $steps->map(fn (AchillesRunStep $step) => [
            'analysis_id' => $step->analysis_id,
            'analysis_name' => $step->analysis_name,
            'category' => $step->category,
            'status' => $step->status,
            'elapsed_seconds' => $step->elapsed_seconds,
            'error_message' => $step->error_message,
            'started_at' => $step->started_at?->toISOString(),
            'completed_at' => $step->completed_at?->toISOString(),
        ]);

        $categories = $mappedSteps->groupBy('category')->map(fn ($catSteps, $category) => [
            'category' => $category,
            'total' => $catSteps->count(),
            'completed' => $catSteps->where('status', 'completed')->count(),
            'failed' => $catSteps->where('status', 'failed')->count(),
            'running' => $catSteps->where('status', 'running')->count(),
            'steps' => $catSteps->values(),
        ])->values();

        return response()->json([
            'run_id' => $run->run_id,
            'status' => $status,
            'total_analyses' => $run->total_analyses ?: $totalCount,
            'completed_analyses' => $completedCount,
            'failed_analyses' => $failedCount,
            'started_at' => $run->started_at?->toISOString(),
            'completed_at' => $run->completed_at?->toISOString(),
            'categories' => $categories,
        ]);
    }

    /**
     * GET /v1/analyses/search
     *
     * Search Achilles analyses across all sources via Solr.
     * Falls back to empty results when Solr is unavailable.
     */
    public function searchAnalyses(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        $sourceId = $request->integer('source_id') ?: null;
        $category = $request->input('category');
        $limit = min($request->integer('limit', 50), 200);
        $offset = $request->integer('offset', 0);

        if (! $this->analysesSearch->isAvailable()) {
            return response()->json([
                'data' => [],
                'total' => 0,
                'facets' => null,
                'engine' => 'unavailable',
            ]);
        }

        $result = $this->analysesSearch->search($query, [
            'source_id' => $sourceId,
            'category' => $category,
        ], $limit, $offset);

        if ($result === null) {
            return response()->json([
                'data' => [],
                'total' => 0,
                'facets' => null,
                'engine' => 'unavailable',
            ]);
        }

        return response()->json([
            'data' => $result['items'],
            'total' => $result['total'],
            'facets' => $result['facets'],
            'engine' => 'solr',
        ]);
    }

    /**
     * Build a standardized error response for database/service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
