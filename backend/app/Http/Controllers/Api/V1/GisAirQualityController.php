<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\AirQualityAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisAirQualityController extends Controller
{
    public function __construct(
        private readonly AirQualityAnalysisService $airQualityService
    ) {}

    public function choropleth(Request $request): JsonResponse
    {
        $request->validate(['pollutant' => 'sometimes|in:pm25,ozone']);
        $data = $this->airQualityService->choropleth($request->input('pollutant', 'pm25'));
        return response()->json(['data' => $data]);
    }

    public function respiratoryOutcomes(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'pollutant' => 'sometimes|in:pm25,ozone',
        ]);

        $data = $this->airQualityService->respiratoryOutcomes(
            (int) $request->input('concept_id'),
            $request->input('pollutant', 'pm25')
        );

        return response()->json(['data' => $data]);
    }

    public function countyDetail(string $fips): JsonResponse
    {
        $data = $this->airQualityService->countyDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'County not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
