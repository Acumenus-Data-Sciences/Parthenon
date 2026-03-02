<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Models\Results\ClinicalCoherenceResult;
use App\Services\ClinicalCoherence\ClinicalCoherenceEngineService;
use Illuminate\Http\JsonResponse;

class ClinicalCoherenceController extends Controller
{
    public function __construct(
        private readonly ClinicalCoherenceEngineService $engine,
    ) {}

    /**
     * GET /api/v1/sources/{source}/clinical-coherence
     *
     * Returns stored results grouped by severity, with per-analysis summaries.
     */
    public function index(Source $source): JsonResponse
    {
        $grouped = $this->engine->getResults($source);
        $summary = $this->engine->getSummary($source);

        $lastRun = ClinicalCoherenceResult::where('source_id', $source->id)
            ->max('run_at');

        return response()->json([
            'source_id' => $source->id,
            'last_run'  => $lastRun,
            'summary'   => $summary,
            'results'   => $grouped,
        ]);
    }

    /**
     * POST /api/v1/sources/{source}/clinical-coherence/run
     *
     * Execute all clinical coherence analyses synchronously and return results.
     */
    public function run(Source $source): JsonResponse
    {
        $outcome = $this->engine->run($source);

        return response()->json([
            'source_id' => $source->id,
            'completed' => $outcome['completed'],
            'failed'    => $outcome['failed'],
            'flagged'   => $outcome['flagged'],
            'analyses'  => $outcome['results'],
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/clinical-coherence/{analysisId}
     *
     * Detailed results for a single analysis (e.g. 'CC001').
     */
    public function show(Source $source, string $analysisId): JsonResponse
    {
        $rows = ClinicalCoherenceResult::where('source_id', $source->id)
            ->where('analysis_id', strtoupper($analysisId))
            ->orderByDesc('count_value')
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'message' => "No results found for analysis {$analysisId}. Run the analysis first.",
            ], 404);
        }

        $first = $rows->first();

        return response()->json([
            'analysis_id'   => $first->analysis_id,
            'analysis_name' => $first->analysis_name,
            'category'      => $first->category,
            'severity'      => $first->severity,
            'run_at'        => $first->run_at,
            'flagged_count' => $rows->where('flagged', true)->count(),
            'rows'          => $rows->values(),
        ]);
    }
}
