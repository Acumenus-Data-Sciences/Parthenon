<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Solr\ClaimsSearchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Claims', weight: 12)]
class ClaimsSearchController extends Controller
{
    public function __construct(
        private readonly ClaimsSearchService $claimsSearch,
    ) {}

    /**
     * GET /v1/claims/search
     *
     * Search healthcare claims with full-text query, financial filters,
     * date ranges, and faceted navigation by status, type, and diagnosis.
     */
    public function search(Request $request): JsonResponse
    {
        if (! $this->claimsSearch->isAvailable()) {
            return response()->json([
                'data' => [
                    'items' => [],
                    'total' => 0,
                    'facets' => [],
                    'stats' => [],
                    'engine' => 'unavailable',
                ],
            ]);
        }

        $query = $request->input('q', '');
        $limit = min($request->integer('limit', 50), 200);
        $offset = max($request->integer('offset', 0), 0);

        $filters = array_filter([
            'patient_id' => $request->input('patient_id'),
            'claim_status' => $request->input('status'),
            'claim_type' => $request->input('type'),
            'place_of_service' => $request->input('place_of_service'),
            'diagnosis_code' => $request->input('diagnosis'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'min_charge' => $request->input('min_charge'),
            'max_charge' => $request->input('max_charge'),
            'has_outstanding' => $request->boolean('has_outstanding') ?: null,
        ]);

        $result = $this->claimsSearch->search($query, $filters, $limit, $offset);

        if ($result === null) {
            return response()->json([
                'data' => [
                    'items' => [],
                    'total' => 0,
                    'facets' => [],
                    'stats' => [],
                    'engine' => 'error',
                ],
            ], 503);
        }

        return response()->json([
            'data' => [
                'items' => $result['items'],
                'total' => $result['total'],
                'facets' => $result['facets'],
                'stats' => $result['stats'],
                'engine' => 'solr',
            ],
        ]);
    }
}
