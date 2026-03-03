<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Results\NetworkAnalysisResult;
use App\Services\Network\NetworkAnalysisEngineService;
use App\Services\Network\NetworkAnalysisRegistry;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Throwable;

#[Group('Network Analysis', weight: 180)]
class NetworkAnalysisController extends Controller
{
    public function __construct(
        private readonly NetworkAnalysisEngineService $engine,
        private readonly NetworkAnalysisRegistry $registry,
    ) {}

    /**
     * GET /api/v1/network/analyses
     * List all registered network analyses with last-run metadata.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => $this->engine->getSummary(),
        ]);
    }

    /**
     * GET /api/v1/network/analyses/{analysisId}
     * Cross-source results for a single analysis.
     * Returns per-source rows AND network aggregate rows separately.
     */
    public function show(string $analysisId): JsonResponse
    {
        try {
            $analysis = $this->registry->find($analysisId);
        } catch (Throwable) {
            return response()->json(['message' => "Analysis '{$analysisId}' not found."], 404);
        }

        $results = $this->engine->getResults($analysisId);

        return response()->json([
            'analysis' => [
                'id' => $analysis->analysisId(),
                'name' => $analysis->analysisName(),
                'category' => $analysis->category(),
                'description' => $analysis->description(),
            ],
            'network' => $results['network'],
            'per_source' => $results['per_source'],
        ]);
    }

    /**
     * POST /api/v1/network/run
     * Execute all network analyses across all active CDM sources.
     */
    public function run(): JsonResponse
    {
        $result = $this->engine->runAll();

        return response()->json([
            'message' => 'Network analyses completed.',
            'summary' => $result,
        ]);
    }

    /**
     * GET /api/v1/network/summary
     * High-level network health dashboard: coverage, density, heterogeneity leaders.
     */
    public function summary(): JsonResponse
    {
        // Domain coverage per source (from NA004)
        $coverage = NetworkAnalysisResult::where('analysis_id', 'NA004')
            ->whereNotNull('source_id')
            ->orderBy('source_id')
            ->orderBy('stratum_1')
            ->get(['source_id', 'stratum_1', 'ratio_value']);

        // Top 10 highest-heterogeneity conditions (from NA008 network rows)
        $heterogeneity = NetworkAnalysisResult::where('analysis_id', 'NA008')
            ->whereNull('source_id')
            ->orderByDesc('ratio_value')
            ->limit(10)
            ->get(['stratum_1', 'stratum_2', 'stratum_3', 'count_value', 'value_as_string']);

        // Source count contributing to each analysis
        $sourcesByAnalysis = NetworkAnalysisResult::whereNotNull('source_id')
            ->select('analysis_id')
            ->selectRaw('COUNT(DISTINCT source_id) AS source_count')
            ->groupBy('analysis_id')
            ->pluck('source_count', 'analysis_id');

        return response()->json([
            'domain_coverage' => $coverage->groupBy('source_id'),
            'top_heterogeneous' => $heterogeneity,
            'sources_by_analysis' => $sourcesByAnalysis,
            'total_analyses' => $this->registry->count(),
        ]);
    }
}
