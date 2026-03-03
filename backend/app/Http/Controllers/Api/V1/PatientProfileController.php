<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Analysis\PatientProfileService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Patient Profiles', weight: 190)]
class PatientProfileController extends Controller
{
    public function __construct(
        private readonly PatientProfileService $patientProfileService,
    ) {}

    /**
     * GET /v1/sources/{source}/profiles/{personId}
     *
     * Get the full clinical profile for a single person.
     */
    public function show(Source $source, int $personId): JsonResponse
    {
        try {
            $profile = $this->patientProfileService->getProfile($personId, $source);

            return response()->json([
                'data' => $profile,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve patient profile', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/cohorts/{cohortDefinitionId}/members
     *
     * Get paginated cohort members with basic demographics.
     */
    public function members(
        Request $request,
        Source $source,
        int $cohortDefinitionId,
    ): JsonResponse {
        try {
            $limit = $request->integer('limit', 100);
            $offset = $request->integer('offset', 0);

            // Clamp values to reasonable bounds
            $limit = max(1, min($limit, 1000));
            $offset = max(0, $offset);

            $result = $this->patientProfileService->getCohortMembers(
                $cohortDefinitionId,
                $source,
                $limit,
                $offset,
            );

            return response()->json([
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve cohort members', $e);
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
