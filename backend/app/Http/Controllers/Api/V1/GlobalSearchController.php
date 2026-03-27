<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Solr\GlobalSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Search
 */
class GlobalSearchController extends Controller
{
    public function __construct(
        private readonly GlobalSearchService $searchService,
    ) {}

    /**
     * GET /v1/search
     *
     * Search across vocabulary concepts, cohort definitions, and studies.
     * Returns grouped results from multiple Solr cores in parallel.
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        $types = (array) $request->input('types', []);
        $limit = $request->integer('limit', 10);

        if (trim($query) === '') {
            return response()->json([
                'data' => [
                    'results' => [],
                    'totals' => [],
                    'engine' => 'none',
                ],
            ]);
        }

        $result = $this->searchService->search($query, $types, min($limit, 50));

        if ($result === null) {
            return response()->json([
                'data' => [
                    'results' => [],
                    'totals' => [],
                    'engine' => 'unavailable',
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'results' => $result['results'],
                'totals' => $result['totals'],
                'engine' => 'solr',
            ],
        ]);
    }
}
