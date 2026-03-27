<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Services\Analysis\StudyService;
use App\Services\Analysis\StudyStatusStateMachine;
use App\Services\Solr\CohortSearchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Studies', weight: 150)]
class StudyController extends Controller
{
    public function __construct(
        private readonly StudyService $studyService,
        private readonly CohortSearchService $cohortSearch,
    ) {}

    /**
     * GET /v1/studies
     *
     * List studies (paginated), with progress summary.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $search = $request->input('search', '');
            $perPage = $request->integer('per_page', 20);
            $page = $request->integer('page', 1);
            $offset = ($page - 1) * $perPage;

            // Try Solr when search is active
            if ($search && $this->cohortSearch->isAvailable()) {
                $filters = array_filter([
                    'type' => 'study',
                    'status' => $request->input('status'),
                    'study_type' => $request->input('study_type'),
                    'study_design' => $request->input('study_design'),
                    'phase' => $request->input('phase'),
                    'priority' => $request->input('priority'),
                ]);

                $solrResult = $this->cohortSearch->search($search, $filters, $perPage, $offset);

                if ($solrResult !== null) {
                    $solrIds = collect($solrResult['items'])->pluck('id')
                        ->map(fn (string $id) => (int) str_replace('study_', '', $id))
                        ->all();

                    $studies = Study::with([
                        'author:id,name,email',
                        'principalInvestigator:id,name,email',
                    ])->whereIn('id', $solrIds)->get()->keyBy('id');

                    $ordered = collect($solrIds)
                        ->map(fn (int $id) => $studies->get($id))
                        ->filter()
                        ->map(function (Study $study) {
                            $progress = $this->studyService->getProgress($study);
                            $study->setAttribute('progress', $progress);

                            return $study;
                        })
                        ->values();

                    return response()->json([
                        'data' => $ordered,
                        'total' => $solrResult['total'],
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'last_page' => max(1, (int) ceil($solrResult['total'] / $perPage)),
                        'facets' => $solrResult['facets'] ?? null,
                        'engine' => 'solr',
                    ]);
                }
            }

            // PostgreSQL fallback
            $eagerLoads = [
                'author:id,name,email',
                'principalInvestigator:id,name,email',
            ];

            // Optional eager-load for publish/export workflows
            $includeAnalyses = $request->input('include') === 'analyses';
            if ($includeAnalyses) {
                $eagerLoads[] = 'analyses.analysis.executions';
            }

            $query = Study::with($eagerLoads)->orderByDesc('updated_at');

            if ($search) {
                $query->search($search);
            }

            if ($request->filled('study_type')) {
                $query->where('study_type', $request->input('study_type'));
            }

            if ($request->filled('study_design')) {
                $query->where('study_design', $request->input('study_design'));
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('phase')) {
                $query->where('phase', $request->input('phase'));
            }

            if ($request->filled('priority')) {
                $query->where('priority', $request->input('priority'));
            }

            if ($request->boolean('my_studies') && $request->user()) {
                $query->where('created_by', $request->user()->id);
            }

            $studies = $query->paginate($perPage);

            $studies->getCollection()->transform(function (Study $study) use ($includeAnalyses) {
                $progress = $this->studyService->getProgress($study);
                $study->setAttribute('progress', $progress);

                // Append latest_execution to each analysis for publish workflow
                if ($includeAnalyses && $study->relationLoaded('analyses')) {
                    $study->analyses->each(function (StudyAnalysis $sa) {
                        if ($sa->relationLoaded('analysis') && $sa->analysis) {
                            $latestExecution = $sa->analysis->executions
                                ->sortByDesc('created_at')
                                ->first();
                            $sa->analysis->setAttribute('latest_execution', $latestExecution);
                            $sa->analysis->unsetRelation('executions');
                        }
                    });
                }

                return $study;
            });

            $result = $studies->toArray();
            $result['engine'] = 'postgresql';

            return response()->json($result);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve studies', $e);
        }
    }

    /**
     * POST /v1/studies
     *
     * Create a new study.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'short_title' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'study_type' => 'required|string|max:100',
            'study_design' => 'nullable|string|max:50',
            'phase' => 'nullable|string|max:20',
            'priority' => 'nullable|string|max:20',
            'scientific_rationale' => 'nullable|string',
            'hypothesis' => 'nullable|string',
            'primary_objective' => 'nullable|string',
            'secondary_objectives' => 'nullable|array',
            'study_start_date' => 'nullable|date',
            'study_end_date' => 'nullable|date',
            'target_enrollment_sites' => 'nullable|integer|min:0',
            'funding_source' => 'nullable|string',
            'clinicaltrials_gov_id' => 'nullable|string|max:20',
            'tags' => 'nullable|array',
            'principal_investigator_id' => 'nullable|integer|exists:users,id',
            'lead_data_scientist_id' => 'nullable|integer|exists:users,id',
            'lead_statistician_id' => 'nullable|integer|exists:users,id',
            'metadata' => 'nullable|array',
        ]);

        try {
            $study = Study::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'status' => 'draft',
            ]);

            $study->load(['author:id,name,email', 'principalInvestigator:id,name,email']);

            return response()->json([
                'data' => $study,
                'message' => 'Study created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create study', $e);
        }
    }

    /**
     * GET /v1/studies/{study}
     *
     * Show study with all analyses and their latest execution status.
     */
    public function show(Study $study): JsonResponse
    {
        try {
            $study->load([
                'author:id,name,email',
                'principalInvestigator:id,name,email',
                'leadDataScientist:id,name,email',
                'leadStatistician:id,name,email',
                'analyses.analysis',
            ]);

            $progress = $this->studyService->getProgress($study);
            $study->setAttribute('progress', $progress);

            return response()->json([
                'data' => $study,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}
     *
     * Update study metadata.
     */
    public function update(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:500',
            'short_title' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'study_type' => 'sometimes|required|string|max:100',
            'study_design' => 'nullable|string|max:50',
            'phase' => 'nullable|string|max:20',
            'priority' => 'nullable|string|max:20',
            'scientific_rationale' => 'nullable|string',
            'hypothesis' => 'nullable|string',
            'primary_objective' => 'nullable|string',
            'secondary_objectives' => 'nullable|array',
            'study_start_date' => 'nullable|date',
            'study_end_date' => 'nullable|date',
            'target_enrollment_sites' => 'nullable|integer|min:0',
            'funding_source' => 'nullable|string',
            'clinicaltrials_gov_id' => 'nullable|string|max:20',
            'tags' => 'nullable|array',
            'principal_investigator_id' => 'nullable|integer|exists:users,id',
            'lead_data_scientist_id' => 'nullable|integer|exists:users,id',
            'lead_statistician_id' => 'nullable|integer|exists:users,id',
            'metadata' => 'nullable|array',
        ]);

        try {
            $study->update($validated);

            return response()->json([
                'data' => $study->fresh('author:id,name,email'),
                'message' => 'Study updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}
     *
     * Soft delete a study.
     */
    public function destroy(Study $study): JsonResponse
    {
        try {
            $study->delete();

            return response()->json([
                'message' => 'Study deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete study', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/execute
     *
     * Dispatch all analyses via StudyService.
     */
    public function executeAll(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            $this->studyService->executeAll($study, $source);

            return response()->json([
                'message' => 'Study execution started. All analyses have been queued.',
                'data' => $this->studyService->getProgress($study),
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to execute study', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/progress
     *
     * Get execution progress for a study.
     */
    public function progress(Study $study): JsonResponse
    {
        try {
            $progress = $this->studyService->getProgress($study);

            return response()->json([
                'data' => $progress,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study progress', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/analyses
     *
     * List study's analyses.
     */
    public function analyses(Study $study): JsonResponse
    {
        try {
            $analyses = $study->analyses()
                ->with('analysis')
                ->get();

            return response()->json([
                'data' => $analyses,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study analyses', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/analyses
     *
     * Add an analysis to the study.
     */
    public function addAnalysis(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'analysis_type' => 'required|string|in:characterization,incidence_rate,pathway,estimation,prediction',
            'analysis_id' => 'required|integer',
        ]);

        try {
            $studyAnalysis = $this->studyService->addAnalysis(
                $study,
                $validated['analysis_type'],
                $validated['analysis_id'],
            );

            $studyAnalysis->load('analysis');

            return response()->json([
                'data' => $studyAnalysis,
                'message' => 'Analysis added to study.',
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid analysis type.',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => 'Failed to add analysis.',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add analysis to study', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/transition
     *
     * Transition study to a new status using the state machine.
     */
    public function transition(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string',
        ]);

        try {
            $study = StudyStatusStateMachine::transition(
                $study,
                $validated['status'],
                $request->user()?->id,
                $request->ip(),
            );

            $study->load(['author:id,name,email', 'principalInvestigator:id,name,email']);

            return response()->json([
                'data' => $study,
                'message' => "Study transitioned to '{$validated['status']}'.",
                'allowed_transitions' => StudyStatusStateMachine::allowedTransitions($study->status),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid status transition.',
                'message' => $e->getMessage(),
                'allowed_transitions' => StudyStatusStateMachine::allowedTransitions($study->status),
            ], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to transition study status', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/allowed-transitions
     *
     * Get allowed status transitions for a study.
     */
    public function allowedTransitions(Study $study): JsonResponse
    {
        return response()->json([
            'data' => [
                'current_status' => $study->status,
                'allowed_transitions' => StudyStatusStateMachine::allowedTransitions($study->status),
            ],
        ]);
    }

    /**
     * DELETE /v1/studies/{study}/analyses/{studyAnalysis}
     *
     * Remove an analysis from the study.
     */
    public function removeAnalysis(Study $study, StudyAnalysis $studyAnalysis): JsonResponse
    {
        if ((int) $studyAnalysis->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Analysis does not belong to this study.'], 404);
        }

        try {
            $studyAnalysis->delete();

            return response()->json([
                'message' => 'Analysis removed from study.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove analysis from study', $e);
        }
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
