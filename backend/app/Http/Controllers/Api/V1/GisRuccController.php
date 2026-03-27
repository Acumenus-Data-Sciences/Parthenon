<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\RuccAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group GIS Explorer
 */
class GisRuccController extends Controller
{
    public function __construct(
        private readonly RuccAnalysisService $ruccService
    ) {}

    public function choropleth(): JsonResponse
    {
        return response()->json(['data' => $this->ruccService->choropleth()]);
    }

    public function outcomeComparison(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->ruccService->outcomeComparison(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function countyDetail(string $fips): JsonResponse
    {
        $data = $this->ruccService->countyDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'County not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
