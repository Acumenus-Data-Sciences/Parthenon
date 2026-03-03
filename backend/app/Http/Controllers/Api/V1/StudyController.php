<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Services\Analysis\StudyService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Studies', weight: 150)]
class StudyController extends Controller
{
    public function __construct(
        private readonly StudyService $studyService,
    ) {}

    /**
     * GET /v1/studies
     *
     * List studies (paginated), with progress summary.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Study::with(['author:id,name,email'])
                ->orderByDesc('updated_at');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            }

            if ($request->filled('study_type')) {
                $query->where('study_type', $request->input('study_type'));
            }

            $studies = $query->paginate($request->integer('per_page', 20));

            // Append progress info to each study
            $studies->getCollection()->transform(function (Study $study) {
                $progress = $this->studyService->getProgress($study);
                $study->setAttribute('progress', $progress);

                return $study;
            });

            return response()->json($studies);
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
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'study_type' => 'required|string|max:100',
            'metadata' => 'nullable|array',
        ]);

        try {
            $study = Study::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'study_type' => $validated['study_type'],
                'author_id' => $request->user()->id,
                'status' => 'draft',
                'metadata' => $validated['metadata'] ?? null,
            ]);

            $study->load('author:id,name,email');

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
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'study_type' => 'sometimes|required|string|max:100',
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
