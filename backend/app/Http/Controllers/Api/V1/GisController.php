<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GisBoundaryRequest;
use App\Http\Requests\GisChoroplethRequest;
use App\Models\App\GisDataset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GisController extends Controller
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    public function boundaries(GisBoundaryRequest $request): JsonResponse
    {
        $response = Http::timeout(30)->get("{$this->aiServiceUrl}/gis/boundaries", $request->validated());

        if ($response->failed()) {
            Log::error('GIS boundary request failed', ['status' => $response->status(), 'body' => $response->body()]);
            return response()->json(['error' => 'Failed to fetch boundaries'], $response->status());
        }

        return response()->json($response->json());
    }

    public function boundaryDetail(int $id): JsonResponse
    {
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/gis/boundaries/{$id}");

        if ($response->failed()) {
            return response()->json(['error' => 'Boundary not found'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function stats(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/gis/stats");

        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch GIS stats'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function choropleth(GisChoroplethRequest $request): JsonResponse
    {
        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/gis/choropleth", $request->validated());

        if ($response->failed()) {
            return response()->json(['error' => 'Choropleth query failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function countries(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/gis/countries");

        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch countries'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function loadDataset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', 'string', 'in:gadm,geoboundaries'],
            'levels' => ['sometimes', 'array'],
            'levels.*' => ['string', 'in:ADM0,ADM1,ADM2,ADM3,ADM4,ADM5'],
            'country_codes' => ['sometimes', 'array'],
            'country_codes.*' => ['string', 'size:3'],
        ]);

        $response = Http::timeout(300)->post("{$this->aiServiceUrl}/gis/load", $validated);

        if ($response->failed()) {
            return response()->json(['error' => 'Dataset load failed', 'detail' => $response->body()], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function datasets(): JsonResponse
    {
        $datasets = GisDataset::orderBy('name')->get();
        return response()->json(['data' => $datasets]);
    }
}
