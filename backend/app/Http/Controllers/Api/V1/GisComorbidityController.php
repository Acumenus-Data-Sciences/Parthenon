<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\ComorbidityAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisComorbidityController extends Controller
{
    public function __construct(
        private readonly ComorbidityAnalysisService $comorbidityService
    ) {}

    public function choropleth(): JsonResponse
    {
        return response()->json(['data' => $this->comorbidityService->choropleth()]);
    }

    public function hotspots(Request $request): JsonResponse
    {
        $request->validate(['concept_id' => 'required|integer']);
        $data = $this->comorbidityService->hotspots((int) $request->input('concept_id'));

        return response()->json(['data' => $data]);
    }

    public function burdenScore(): JsonResponse
    {
        return response()->json(['data' => $this->comorbidityService->burdenScore()]);
    }
}
