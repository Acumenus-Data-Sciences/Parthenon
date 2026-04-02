<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PatientSimilarityComputeRequest;
use App\Http\Requests\PatientSimilaritySearchRequest;
use App\Jobs\ComputePatientFeatureVectors;
use App\Models\App\SimilarityDimension;
use App\Models\App\Source;
use App\Services\PatientSimilarity\PatientSimilarityService;
use Illuminate\Http\JsonResponse;

/**
 * @group Patient Similarity Engine
 */
class PatientSimilarityController extends Controller
{
    public function __construct(
        private readonly PatientSimilarityService $service,
    ) {}

    /**
     * POST /v1/patient-similarity/search
     *
     * Find patients similar to a seed patient.
     */
    public function search(PatientSimilaritySearchRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Merge user-supplied weights with dimension defaults
            $dimensions = SimilarityDimension::active()->get();
            $weights = [];
            foreach ($dimensions as $dimension) {
                $weights[$dimension->key] = $validated['weights'][$dimension->key]
                    ?? $dimension->default_weight;
            }

            $mode = $validated['mode'] ?? 'interpretable';
            $limit = $validated['limit'] ?? 20;
            $minScore = $validated['min_score'] ?? 0.0;
            $filters = $validated['filters'] ?? [];

            $results = $this->service->search(
                personId: (int) $validated['person_id'],
                source: $source,
                mode: $mode,
                weights: $weights,
                limit: $limit,
                minScore: $minScore,
                filters: $filters,
            );

            // Tiered access: strip person-level details if user lacks profiles.view
            if (! $request->user()->can('profiles.view')) {
                $results = array_map(function (array $patient): array {
                    return [
                        'overall_score' => $patient['overall_score'] ?? null,
                        'dimension_scores' => $patient['dimension_scores'] ?? [],
                    ];
                }, $results);
            }

            return response()->json([
                'data' => $results,
                'meta' => [
                    'mode' => $mode,
                    'seed_person_id' => (int) $validated['person_id'],
                    'source_id' => $source->id,
                    'limit' => $limit,
                    'min_score' => $minScore,
                    'count' => count($results),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Patient similarity search failed', $e);
        }
    }

    /**
     * GET /v1/patient-similarity/dimensions
     *
     * List active similarity dimensions with their default weights.
     */
    public function dimensions(): JsonResponse
    {
        try {
            $dimensions = SimilarityDimension::active()->get();

            return response()->json([
                'data' => $dimensions,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve similarity dimensions', $e);
        }
    }

    /**
     * POST /v1/patient-similarity/compute
     *
     * Dispatch feature vector computation for a source.
     */
    public function compute(PatientSimilarityComputeRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $force = $validated['force'] ?? false;

            // Check staleness — skip dispatch if vectors are fresh and not forced
            if (! $force) {
                $status = $this->service->getStatus($source);
                if ($status['total_vectors'] > 0 && ! $status['staleness_warning']) {
                    return response()->json([
                        'message' => 'Feature vectors are up-to-date. Use force=true to recompute.',
                        'data' => $status,
                    ]);
                }
            }

            ComputePatientFeatureVectors::dispatch($source, $force);

            return response()->json([
                'message' => 'Feature vector computation queued.',
                'data' => [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'force' => $force,
                ],
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue feature vector computation', $e);
        }
    }

    /**
     * GET /v1/patient-similarity/status/{sourceId}
     *
     * Get feature vector computation status for a source.
     */
    public function status(int $sourceId): JsonResponse
    {
        try {
            $source = Source::findOrFail($sourceId);
            $status = $this->service->getStatus($source);

            return response()->json([
                'data' => $status,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve similarity status', $e);
        }
    }

    /**
     * Build a standardized error response for service failures.
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
