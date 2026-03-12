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
use Illuminate\Support\Str;

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

        $source = $validated['source'];
        $levels = $validated['levels'] ?? ['ADM0'];
        $countryCodes = $validated['country_codes'] ?? null;

        $dataset = GisDataset::create([
            'name' => ucfirst($source).' '.implode('+', $levels),
            'slug' => Str::slug($source.'-'.implode('-', $levels).'-'.now()->timestamp),
            'source' => $source,
            'data_type' => 'boundary',
            'status' => 'pending',
            'levels_requested' => $levels,
            'user_id' => $request->user()?->id,
        ]);

        // Build the CLI command for host-side execution.
        // GIS data loads to local PG 17 (not Docker) via Python/geopandas.
        $levelsStr = implode(' ', $levels);
        $cliCommand = "python3 scripts/load-gis-boundaries.py --source {$source} --levels {$levelsStr} --dataset-id {$dataset->id}";

        $dataset->appendLog("Run on host: {$cliCommand}");

        return response()->json([
            'data' => $dataset,
            'cli_command' => $cliCommand,
        ]);
    }

    public function datasetStatus(int $id): JsonResponse
    {
        $dataset = GisDataset::findOrFail($id);

        return response()->json(['data' => $dataset]);
    }

    public function datasets(): JsonResponse
    {
        $datasets = GisDataset::orderBy('name')->get();

        return response()->json(['data' => $datasets]);
    }

    public function cdmChoropleth(Request $request): JsonResponse
    {
        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/cdm-spatial/choropleth", $request->all());
        if ($response->failed()) {
            return response()->json(['error' => 'CDM choropleth query failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function cdmTimePeriods(Request $request): JsonResponse
    {
        $params = $request->only(['metric', 'concept_id']);
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/cdm-spatial/time-periods", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch time periods'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function covidSummary(): JsonResponse
    {
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/summary", ['concept_id' => 37311061]);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch COVID summary'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function countyDetail(string $gadmGid, Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/county/{$gadmGid}", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'County not found'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function refreshCdmStats(Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/cdm-spatial/refresh?".http_build_query($params));
        if ($response->failed()) {
            return response()->json(['error' => 'Refresh failed'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function cdmConditions(Request $request): JsonResponse
    {
        $params = $request->only(['search', 'category', 'limit']);
        $response = Http::timeout(30)->get("{$this->aiServiceUrl}/cdm-spatial/conditions", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch conditions'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function cdmConditionCategories(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/cdm-spatial/conditions/categories");
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch categories'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function cdmSummary(Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/summary", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch summary'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function cdmReindexAll(): JsonResponse
    {
        $response = Http::timeout(10)->post("{$this->aiServiceUrl}/cdm-spatial/reindex-all");
        if ($response->failed()) {
            return response()->json(['error' => 'Reindex failed'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }
}
