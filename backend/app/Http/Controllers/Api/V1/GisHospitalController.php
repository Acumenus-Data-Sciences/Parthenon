<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\HospitalAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisHospitalController extends Controller
{
    public function __construct(
        private readonly HospitalAccessService $hospitalService
    ) {}

    public function mapData(): JsonResponse
    {
        return response()->json(['data' => $this->hospitalService->mapData()]);
    }

    public function accessAnalysis(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->hospitalService->accessAnalysis(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function deserts(): JsonResponse
    {
        return response()->json(['data' => $this->hospitalService->deserts()]);
    }
}
