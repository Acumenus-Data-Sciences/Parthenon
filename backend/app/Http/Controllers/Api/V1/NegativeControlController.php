<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Analysis\NegativeControlService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Negative Controls', weight: 130)]
class NegativeControlController extends Controller
{
    public function __construct(
        private readonly NegativeControlService $service,
    ) {}

    /**
     * POST /v1/negative-controls/suggest
     *
     * Suggest negative control outcome concepts for a given exposure concept set.
     */
    public function suggest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exposure_concept_ids' => 'required|array|min:1',
            'exposure_concept_ids.*' => 'integer',
            'source_id' => 'required|integer|exists:sources,id',
            'exclude_concept_ids' => 'array',
            'exclude_concept_ids.*' => 'integer',
            'limit' => 'integer|min:1|max:200',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $suggestions = $this->service->suggestNegativeControls(
                $validated['exposure_concept_ids'],
                $source,
                $validated['limit'] ?? 50,
                $validated['exclude_concept_ids'] ?? [],
            );

            return response()->json(['data' => $suggestions]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to suggest negative controls', $e);
        }
    }

    /**
     * POST /v1/negative-controls/validate
     *
     * Validate candidate negative control concepts against exposure concepts.
     */
    public function validateCandidates(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exposure_concept_ids' => 'required|array|min:1',
            'exposure_concept_ids.*' => 'integer',
            'candidate_concept_ids' => 'required|array|min:1',
            'candidate_concept_ids.*' => 'integer',
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $results = $this->service->validateCandidates(
                $validated['exposure_concept_ids'],
                $validated['candidate_concept_ids'],
                $source,
            );

            return response()->json(['data' => $results]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to validate negative controls', $e);
        }
    }

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
