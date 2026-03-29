<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\RiskScoreAnalysis;
use App\Models\App\RiskScoreRunStep;
use App\Models\App\Source;
use App\Models\Results\RiskScorePatientResult;
use App\Services\PopulationRisk\RiskScoreExecutionService;
use App\Services\PopulationRisk\RiskScoreRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class RiskScoreAnalysisController extends Controller
{
    public function __construct(
        private readonly RiskScoreRecommendationService $recommender,
        private readonly RiskScoreExecutionService $executor,
    ) {}

    /**
     * Recommend applicable risk scores for a cohort.
     */
    public function recommend(Source $source, Request $request): JsonResponse
    {
        $cohortId = (int) $request->input('cohort_definition_id');

        $recommendations = $this->recommender->recommend($cohortId, $source);

        return response()->json([
            'data' => $recommendations,
        ]);
    }

    /**
     * Store a new risk score analysis definition.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortIds' => 'required|array|min:1',
            'design_json.scoreIds' => 'required|array|min:1',
        ]);

        $analysis = RiskScoreAnalysis::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'design_json' => $validated['design_json'],
            'author_id' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $analysis,
        ], 201);
    }

    /**
     * Show a risk score analysis with its executions.
     */
    public function show(RiskScoreAnalysis $analysis): JsonResponse
    {
        $analysis->load(['author', 'executions.source']);

        return response()->json([
            'data' => $analysis,
        ]);
    }

    /**
     * Execute a risk score analysis against a source.
     */
    public function execute(RiskScoreAnalysis $analysis, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        set_time_limit(300);

        $source = Source::findOrFail($validated['source_id']);

        /** @var AnalysisExecution $execution */
        $execution = $analysis->executions()->create([
            'analysis_type' => RiskScoreAnalysis::class,
            'source_id' => $source->id,
            'status' => ExecutionStatus::Pending,
        ]);

        $this->executor->execute($analysis, $source, $execution);

        $execution->refresh();

        $steps = RiskScoreRunStep::where('execution_id', $execution->id)->get();

        return response()->json([
            'execution_id' => $execution->id,
            'status' => $execution->status,
            'result' => $execution->result_json,
            'steps' => $steps,
        ]);
    }

    /**
     * Get execution detail with population-level summaries.
     */
    public function executionDetail(RiskScoreAnalysis $analysis, AnalysisExecution $execution): JsonResponse
    {
        $steps = RiskScoreRunStep::where('execution_id', $execution->id)->get();

        $summaries = RiskScorePatientResult::on('results')
            ->selectRaw(
                'score_id,
                 risk_tier,
                 COUNT(*) AS patient_count,
                 ROUND(AVG(score_value)::numeric, 4) AS mean_score,
                 ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS p25_score,
                 ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS median_score,
                 ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS p75_score,
                 ROUND(AVG(confidence)::numeric, 4) AS mean_confidence,
                 ROUND(AVG(completeness)::numeric, 4) AS mean_completeness'
            )
            ->where('execution_id', $execution->id)
            ->groupBy('score_id', 'risk_tier')
            ->get();

        return response()->json([
            'execution' => $execution,
            'steps' => $steps,
            'population_summaries' => $summaries,
        ]);
    }

    /**
     * List patient-level results for an execution, with optional filters.
     */
    public function patients(RiskScoreAnalysis $analysis, AnalysisExecution $execution, Request $request): JsonResponse
    {
        $query = RiskScorePatientResult::on('results')
            ->where('execution_id', $execution->id);

        if ($request->filled('score_id')) {
            $query->where('score_id', $request->query('score_id'));
        }

        if ($request->filled('risk_tier')) {
            $query->where('risk_tier', $request->query('risk_tier'));
        }

        $perPage = (int) $request->query('per_page', '25');
        $results = $query->paginate($perPage);

        return response()->json($results);
    }
}
