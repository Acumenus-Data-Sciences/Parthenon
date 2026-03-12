<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Ariadne Concept Mapping', weight: 226)]
class AriadneController extends Controller
{
    private string $aiUrl;

    public function __construct()
    {
        $this->aiUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * POST /api/v1/ariadne/map
     *
     * Map free-text terms or source codes to standard OMOP concepts using
     * Ariadne's LLM-assisted concept mapping pipeline.
     * Proxies to the Python AI service at POST /ariadne/map.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function map(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(120)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/map");

            if ($response->failed()) {
                Log::warning('Ariadne map failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Concept mapping failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::map exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/ariadne/clean-terms
     *
     * Normalise and clean raw source terms before concept mapping.
     * Proxies to the Python AI service at POST /ariadne/clean-terms.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function cleanTerms(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(60)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/clean-terms");

            if ($response->failed()) {
                Log::warning('Ariadne cleanTerms failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Term cleaning failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::cleanTerms exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/ariadne/vector-search
     *
     * Vector similarity search over the OMOP concept embedding index.
     * Proxies to the Python AI service at POST /ariadne/vector-search.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function vectorSearch(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(30)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/vector-search");

            if ($response->failed()) {
                Log::warning('Ariadne vectorSearch failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Vector search failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::vectorSearch exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
