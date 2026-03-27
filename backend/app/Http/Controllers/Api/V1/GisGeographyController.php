<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\GeographyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group GIS Explorer
 */
class GisGeographyController extends Controller
{
    public function __construct(
        private readonly GeographyService $geographyService
    ) {}

    public function layers(): JsonResponse
    {
        return response()->json(['data' => $this->geographyService->layers()]);
    }

    public function counties(): JsonResponse
    {
        return response()->json(['data' => $this->geographyService->counties()]);
    }

    public function tracts(Request $request): JsonResponse
    {
        $request->validate(['county' => 'required|string|size:5']);
        $tracts = $this->geographyService->tractsByCounty($request->input('county'));

        return response()->json(['data' => $tracts]);
    }
}
