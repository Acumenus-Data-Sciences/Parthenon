<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Analysis\PatientProfileService;
use App\Services\Solr\ClinicalSearchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Patient Profiles', weight: 190)]
class PatientProfileController extends Controller
{
    public function __construct(
        private readonly PatientProfileService $patientProfileService,
        private readonly ClinicalSearchService $clinicalSearch,
    ) {}

    /**
     * GET /v1/clinical/search
     *
     * Search clinical events across patients and sources via Solr.
     */
    public function searchClinical(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        $filters = $request->only([
            'source_id', 'person_id', 'event_type', 'domain_id',
            'concept_id', 'date_from', 'date_to', 'value_min', 'value_max',
        ]);
        $limit = (int) $request->input('limit', 50);
        $offset = (int) $request->input('offset', 0);

        if ($this->clinicalSearch->isAvailable()) {
            $result = $this->clinicalSearch->search($query, $filters, $limit, $offset);
            if ($result !== null) {
                return response()->json([
                    'data' => $result['items'],
                    'total' => $result['total'],
                    'facets' => $result['facets'],
                    'engine' => 'solr',
                ]);
            }
        }

        return response()->json([
            'data' => [],
            'total' => 0,
            'facets' => [],
            'engine' => 'unavailable',
            'message' => 'Clinical search requires Solr. Direct patient profile queries available at /sources/{source}/profiles/{personId}.',
        ]);
    }

    /**
     * GET /v1/sources/{source}/persons/search?q=...&limit=...
     *
     * Search persons by person_id prefix or person_source_value (MRN) substring.
     */
    public function search(Request $request, Source $source): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $limit = max(1, min($request->integer('limit', 20), 100));

        if (mb_strlen($q) < 1) {
            return response()->json(['data' => []]);
        }

        try {
            $results = $this->patientProfileService->searchPersons($q, $source, $limit);

            return response()->json(['data' => $results]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to search persons', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/profiles/{personId}/stats
     *
     * Get per-domain total row counts for a person (fast UNION ALL count query).
     * Used by the frontend to show truncation banners when the 2000-row limit is hit.
     */
    public function stats(Source $source, int $personId): JsonResponse
    {
        try {
            $counts = $this->patientProfileService->getProfileStats($personId, $source);

            return response()->json(['data' => $counts]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve profile stats', $e);
        }
    }

    /**
     * GET /v1/sources/{source}/profiles/{personId}/notes
     *
     * Get clinical notes for a single person (paginated, max 100 per page).
     */
    public function notes(Request $request, Source $source, int $personId): JsonResponse
    {
        try {
            $page = max(1, $request->integer('page', 1));
            $perPage = max(1, min($request->integer('per_page', 50), 100));

            $result = $this->patientProfileService->getNotes($personId, $source, $page, $perPage);

            return response()->json($result);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve patient notes', $e);
        }
    }

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
            $page = max(1, $request->integer('page', 1));
            $perPage = max(1, min($request->integer('per_page', 15), 200));

            $result = $this->patientProfileService->getCohortMembers(
                $cohortDefinitionId,
                $source,
                $page,
                $perPage,
            );

            // Return {data: [...], meta: {...}} directly — no extra wrapper
            return response()->json($result);
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
