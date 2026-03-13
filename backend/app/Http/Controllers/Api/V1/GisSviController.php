<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\SviAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisSviController extends Controller
{
    public function __construct(
        private readonly SviAnalysisService $sviService
    ) {}

    public function choropleth(Request $request): JsonResponse
    {
        $request->validate([
            'level' => 'sometimes|in:tract,county',
            'theme' => 'sometimes|in:overall,1,2,3,4',
        ]);

        $data = $this->sviService->choropleth(
            $request->input('level', 'county'),
            $request->input('theme', 'overall')
        );

        return response()->json(['data' => $data]);
    }

    public function quartileAnalysis(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->sviService->quartileAnalysis(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function themeCorrelations(Request $request): JsonResponse
    {
        $request->validate(['concept_id' => 'required|integer']);

        $data = $this->sviService->themeCorrelations(
            (int) $request->input('concept_id')
        );

        return response()->json(['data' => $data]);
    }

    public function tractDetail(string $fips): JsonResponse
    {
        $data = $this->sviService->tractDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'Tract not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
