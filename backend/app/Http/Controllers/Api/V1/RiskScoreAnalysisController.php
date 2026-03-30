<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\CohortDefinition;
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
    use SourceAware;

    public function __construct(
        private readonly RiskScoreRecommendationService $recommender,
        private readonly RiskScoreExecutionService $executor,
    ) {}

    /**
     * List risk score analyses with pagination, search, and filters.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', '20');
        $search = $request->query('search');
        $status = $request->query('status');

        $query = RiskScoreAnalysis::with([
            'author',
            'executions' => fn ($q) => $q->orderByDesc('id'),
        ])
            ->orderBy('updated_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        if ($status) {
            if ($status === 'draft') {
                $query->whereDoesntHave('executions');
            } else {
                $query->whereHas('executions', function ($q) use ($status) {
                    $q->whereIn('id', function ($sub) {
                        $sub->selectRaw('MAX(id)')
                            ->from('analysis_executions')
                            ->where('analysis_type', RiskScoreAnalysis::class)
                            ->groupBy('analysis_id');
                    })->where('status', $status);
                });
            }
        }

        $analyses = $query->paginate($perPage);

        // Build status facets
        $totalCount = RiskScoreAnalysis::count();
        $draftCount = RiskScoreAnalysis::whereDoesntHave('executions')->count();
        $completedCount = RiskScoreAnalysis::whereHas('executions', function ($q) {
            $q->where('status', ExecutionStatus::Completed);
        })->count();
        $runningCount = RiskScoreAnalysis::whereHas('executions', function ($q) {
            $q->whereIn('status', [ExecutionStatus::Pending, ExecutionStatus::Running]);
        })->count();
        $failedCount = RiskScoreAnalysis::whereHas('executions', function ($q) {
            $q->where('status', ExecutionStatus::Failed);
        })->count();

        $response = $analyses->toArray();
        $response['facets'] = [
            'status' => [
                'all' => $totalCount,
                'draft' => $draftCount,
                'completed' => $completedCount,
                'running' => $runningCount,
                'failed' => $failedCount,
            ],
        ];

        return response()->json($response);
    }

    /**
     * Aggregate stats for the hub stats bar.
     */
    public function stats(): JsonResponse
    {
        $total = RiskScoreAnalysis::count();

        $running = AnalysisExecution::where('analysis_type', RiskScoreAnalysis::class)
            ->whereIn('status', [ExecutionStatus::Pending, ExecutionStatus::Running])
            ->count();

        $completed = RiskScoreAnalysis::whereHas('executions', function ($q) {
            $q->where('status', ExecutionStatus::Completed);
        })->count();

        $patientsScored = RiskScorePatientResult::query()
            ->distinct('person_id')
            ->count('person_id');

        return response()->json([
            'data' => [
                'total' => $total,
                'running' => $running,
                'completed' => $completed,
                'patients_scored' => $patientsScored,
                'scores_available' => 20,
            ],
        ]);
    }

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
        $analysis->load([
            'author',
            'executions' => fn ($q) => $q->with('source')->orderByDesc('id'),
        ]);

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

        $summaries = RiskScorePatientResult::query()
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
        $query = RiskScorePatientResult::query()
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

    /**
     * Update a risk score analysis name/description.
     */
    public function update(Request $request, RiskScoreAnalysis $analysis): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $analysis->update($validated);

        $analysis->load(['author', 'executions']);

        return response()->json([
            'data' => $analysis->fresh(['author', 'executions']),
        ]);
    }

    /**
     * Soft delete a risk score analysis.
     */
    public function destroy(RiskScoreAnalysis $analysis): JsonResponse
    {
        $analysis->delete();

        return response()->json([
            'message' => 'Risk score analysis deleted.',
        ]);
    }

    /**
     * Create a cohort from risk score patient results.
     */
    public function createCohort(RiskScoreAnalysis $analysis, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'execution_id' => 'required|integer',
            'score_id' => 'required|string',
            'risk_tier' => 'nullable|string',
            'person_ids' => 'nullable|array',
            'person_ids.*' => 'integer',
        ]);

        if (! empty($validated['person_ids'])) {
            $personIds = $validated['person_ids'];
        } else {
            $query = RiskScorePatientResult::query()
                ->where('execution_id', $validated['execution_id'])
                ->where('score_id', $validated['score_id']);

            if (! empty($validated['risk_tier'])) {
                $query->where('risk_tier', $validated['risk_tier']);
            }

            $personIds = $query->pluck('person_id')->unique()->values()->toArray();
        }

        if (empty($personIds)) {
            return response()->json([
                'message' => 'No patients found matching the specified criteria.',
            ], 422);
        }

        $cohort = CohortDefinition::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'expression_json' => [
                'type' => 'risk_score_derived',
                'analysis_id' => $analysis->id,
                'execution_id' => $validated['execution_id'],
                'score_id' => $validated['score_id'],
                'risk_tier' => $validated['risk_tier'] ?? null,
                'patient_count' => count($personIds),
            ],
            'author_id' => $request->user()->id,
        ]);

        // Insert into results.cohort in chunks
        $today = now()->toDateString();
        $rows = array_map(fn (int $personId): array => [
            'cohort_definition_id' => $cohort->id,
            'subject_id' => $personId,
            'cohort_start_date' => $today,
            'cohort_end_date' => $today,
        ], $personIds);

        $execution = AnalysisExecution::findOrFail($validated['execution_id']);
        $source = Source::findOrFail($execution->source_id);
        SourceContext::forSource($source);

        foreach (array_chunk($rows, 500) as $chunk) {
            $this->results()->table('cohort')->insert($chunk);
        }

        return response()->json([
            'data' => $cohort,
            'patient_count' => count($personIds),
        ], 201);
    }
}
