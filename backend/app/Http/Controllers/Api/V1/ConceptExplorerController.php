<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Investigation\ConceptSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Concept Explorer
 */
class ConceptExplorerController extends Controller
{
    public function __construct(
        private readonly ConceptSearchService $service,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', '');
        $domain = $request->query('domain');
        $limit = min((int) $request->query('limit', '25'), 100);

        if (! is_string($query) || strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $results = $this->service->search(
            $query,
            is_string($domain) ? $domain : null,
            $limit,
        );

        return response()->json(['data' => $results]);
    }

    public function hierarchy(int $conceptId): JsonResponse
    {
        $results = $this->service->hierarchy($conceptId);

        return response()->json(['data' => $results]);
    }

    public function patientCount(int $conceptId): JsonResponse
    {
        $result = $this->service->patientCount($conceptId);

        return response()->json(['data' => $result]);
    }
}
