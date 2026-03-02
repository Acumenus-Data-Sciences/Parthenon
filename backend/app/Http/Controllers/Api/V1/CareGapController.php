<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunCareGapEvaluationJob;
use App\Models\App\BundleOverlapRule;
use App\Models\App\CareGapEvaluation;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\Analysis\CareGapService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CareGapController extends Controller
{
    public function __construct(
        private readonly CareGapService $careGapService,
    ) {}

    /**
     * GET /v1/care-bundles
     *
     * List all condition bundles with latest evaluation summary.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ConditionBundle::with(['author:id,name,email'])
                ->orderBy('bundle_code');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('condition_name', 'ilike', "%{$search}%")
                        ->orWhere('bundle_code', 'ilike', "%{$search}%")
                        ->orWhere('disease_category', 'ilike', "%{$search}%");
                });
            }

            if ($request->filled('disease_category')) {
                $query->where('disease_category', $request->input('disease_category'));
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $bundles = $query->paginate($request->integer('per_page', 20));

            // Append latest evaluation info
            $bundles->getCollection()->transform(function (ConditionBundle $bundle) {
                $latestEvaluation = $bundle->evaluations()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'evaluated_at', 'person_count', 'compliance_summary']);

                $bundle->setAttribute('latest_evaluation', $latestEvaluation);
                $bundle->setAttribute('measure_count', $bundle->measures()->count());

                return $bundle;
            });

            return response()->json($bundles);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve care bundles', $e);
        }
    }

    /**
     * POST /v1/care-bundles
     *
     * Create a new condition bundle.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bundle_code' => 'required|string|max:20|unique:condition_bundles,bundle_code',
            'condition_name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icd10_patterns' => 'required|array|min:1',
            'icd10_patterns.*' => 'string',
            'omop_concept_ids' => 'required|array|min:1',
            'omop_concept_ids.*' => 'integer',
            'ecqm_references' => 'nullable|array',
            'ecqm_references.*' => 'string',
            'disease_category' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            $bundle = ConditionBundle::create([
                ...$validated,
                'author_id' => $request->user()->id,
                'bundle_size' => 0,
            ]);

            $bundle->load('author:id,name,email');

            return response()->json([
                'data' => $bundle,
                'message' => 'Condition bundle created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create condition bundle', $e);
        }
    }

    /**
     * GET /v1/care-bundles/{bundle}
     *
     * Show a condition bundle with its measures.
     */
    public function show(ConditionBundle $bundle): JsonResponse
    {
        try {
            $bundle->load([
                'author:id,name,email',
                'measures',
                'evaluations' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'evaluations.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $bundle,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve condition bundle', $e);
        }
    }

    /**
     * PUT /v1/care-bundles/{bundle}
     *
     * Update a condition bundle.
     */
    public function update(Request $request, ConditionBundle $bundle): JsonResponse
    {
        $validated = $request->validate([
            'bundle_code' => "sometimes|required|string|max:20|unique:condition_bundles,bundle_code,{$bundle->id}",
            'condition_name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'icd10_patterns' => 'sometimes|required|array|min:1',
            'icd10_patterns.*' => 'string',
            'omop_concept_ids' => 'sometimes|required|array|min:1',
            'omop_concept_ids.*' => 'integer',
            'ecqm_references' => 'nullable|array',
            'ecqm_references.*' => 'string',
            'disease_category' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        try {
            $bundle->update($validated);

            return response()->json([
                'data' => $bundle->fresh(['author:id,name,email', 'measures']),
                'message' => 'Condition bundle updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update condition bundle', $e);
        }
    }

    /**
     * DELETE /v1/care-bundles/{bundle}
     *
     * Soft delete a condition bundle.
     */
    public function destroy(ConditionBundle $bundle): JsonResponse
    {
        try {
            $bundle->delete();

            return response()->json([
                'message' => 'Condition bundle deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete condition bundle', $e);
        }
    }

    /**
     * GET /v1/care-bundles/{bundle}/measures
     *
     * List measures for a bundle.
     */
    public function measures(ConditionBundle $bundle): JsonResponse
    {
        try {
            $measures = $bundle->measures()
                ->orderBy('bundle_measures.ordinal')
                ->get();

            return response()->json([
                'data' => $measures,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve measures', $e);
        }
    }

    /**
     * POST /v1/care-bundles/{bundle}/measures
     *
     * Add a measure to a bundle.
     */
    public function addMeasure(Request $request, ConditionBundle $bundle): JsonResponse
    {
        $validated = $request->validate([
            'measure_code' => 'required|string|max:50',
            'measure_name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'measure_type' => 'required|string|in:preventive,chronic,behavioral',
            'domain' => 'required|string|in:condition,drug,procedure,measurement,observation',
            'concept_set_id' => 'nullable|integer|exists:concept_sets,id',
            'numerator_criteria' => 'nullable|array',
            'denominator_criteria' => 'nullable|array',
            'exclusion_criteria' => 'nullable|array',
            'frequency' => 'nullable|string|in:annually,semi-annually,every_visit',
            'ordinal' => 'nullable|integer|min:0',
        ]);

        try {
            $ordinal = $validated['ordinal'] ?? $bundle->measures()->count();
            unset($validated['ordinal']);

            $measure = QualityMeasure::firstOrCreate(
                ['measure_code' => $validated['measure_code']],
                $validated,
            );

            if ($bundle->measures()->where('measure_id', $measure->id)->exists()) {
                return response()->json([
                    'message' => 'Measure is already attached to this bundle.',
                ], 422);
            }

            $bundle->measures()->attach($measure->id, ['ordinal' => $ordinal]);

            // Update bundle_size
            $bundle->update(['bundle_size' => $bundle->measures()->count()]);

            return response()->json([
                'data' => $measure,
                'message' => 'Measure added to bundle.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add measure', $e);
        }
    }

    /**
     * DELETE /v1/care-bundles/{bundle}/measures/{measure}
     *
     * Remove a measure from a bundle.
     */
    public function removeMeasure(ConditionBundle $bundle, QualityMeasure $measure): JsonResponse
    {
        try {
            $bundle->measures()->detach($measure->id);

            // Update bundle_size
            $bundle->update(['bundle_size' => $bundle->measures()->count()]);

            return response()->json([
                'message' => 'Measure removed from bundle.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove measure', $e);
        }
    }

    /**
     * POST /v1/care-bundles/{bundle}/evaluate
     *
     * Dispatch a care gap evaluation job.
     */
    public function evaluate(Request $request, ConditionBundle $bundle): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'cohort_definition_id' => 'nullable|integer|exists:cohort_definitions,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            $evaluation = CareGapEvaluation::create([
                'bundle_id' => $bundle->id,
                'source_id' => $source->id,
                'cohort_definition_id' => $validated['cohort_definition_id'] ?? null,
                'status' => 'pending',
                'author_id' => $request->user()->id,
            ]);

            RunCareGapEvaluationJob::dispatch(
                $bundle,
                $source,
                $evaluation,
                $validated['cohort_definition_id'] ?? null,
            );

            return response()->json([
                'data' => $evaluation,
                'message' => 'Care gap evaluation queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue care gap evaluation', $e);
        }
    }

    /**
     * GET /v1/care-bundles/{bundle}/evaluations
     *
     * List evaluations for a bundle.
     */
    public function evaluations(ConditionBundle $bundle): JsonResponse
    {
        try {
            $evaluations = $bundle->evaluations()
                ->with(['source:id,source_name,source_key', 'author:id,name,email'])
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($evaluations);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve evaluations', $e);
        }
    }

    /**
     * GET /v1/care-bundles/{bundle}/evaluations/{evaluation}
     *
     * Show a specific evaluation with full results.
     */
    public function showEvaluation(
        ConditionBundle $bundle,
        CareGapEvaluation $evaluation,
    ): JsonResponse {
        if ((int) $evaluation->bundle_id !== (int) $bundle->id) {
            return response()->json([
                'message' => 'Evaluation does not belong to this bundle.',
            ], 404);
        }

        try {
            $evaluation->load([
                'source:id,source_name,source_key',
                'cohortDefinition:id,name',
                'author:id,name,email',
            ]);

            return response()->json([
                'data' => $evaluation,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve evaluation', $e);
        }
    }

    /**
     * GET /v1/care-bundles/overlap-rules
     *
     * List all overlap/deduplication rules.
     */
    public function overlapRules(): JsonResponse
    {
        try {
            $rules = BundleOverlapRule::orderBy('rule_code')->get();

            return response()->json([
                'data' => $rules,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve overlap rules', $e);
        }
    }

    /**
     * GET /v1/care-bundles/population-summary
     *
     * Population-level compliance summary across all bundles.
     */
    public function populationSummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::findOrFail($validated['source_id']);
            $summary = $this->careGapService->getPopulationSummary($source);

            return response()->json([
                'data' => $summary,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve population summary', $e);
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
