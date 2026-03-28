<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * @group Hecate Semantic Search
 */
class HecateController extends Controller
{
    use SourceAware;

    private string $hecateUrl;

    public function __construct()
    {
        $this->hecateUrl = rtrim(config('services.hecate.url', 'http://hecate:8080'), '/');
    }

    /**
     * GET /api/v1/vocabulary/semantic/search
     *
     * Full-text + semantic search over OMOP vocabulary concepts.
     * Proxies to Hecate at GET /api/search.
     *
     * Query params: q, vocabulary_id, exclude_vocabulary_id, standard_concept,
     *               domain_id, concept_class_id, limit
     */
    public function search(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/search",
                $request->only([
                    'q',
                    'vocabulary_id',
                    'exclude_vocabulary_id',
                    'standard_concept',
                    'domain_id',
                    'concept_class_id',
                    'limit',
                ])
            );

            if ($response->failed()) {
                Log::warning('Hecate search failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Semantic search failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::search exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/search/standard
     *
     * Search restricted to standard concepts only.
     * Proxies to Hecate at GET /api/search_standard.
     *
     * Query params: q, vocabulary_id, exclude_vocabulary_id, standard_concept,
     *               domain_id, concept_class_id, limit
     */
    public function searchStandard(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/search_standard",
                $request->only([
                    'q',
                    'vocabulary_id',
                    'exclude_vocabulary_id',
                    'standard_concept',
                    'domain_id',
                    'concept_class_id',
                    'limit',
                ])
            );

            if ($response->failed()) {
                Log::warning('Hecate searchStandard failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Standard concept search failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::searchStandard exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/concepts/{id}/relationships
     *
     * Retrieve concept relationships for a given concept ID.
     * Proxies to Hecate at GET /api/concepts/{id}/relationships.
     */
    public function conceptRelationships(int $id): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/concepts/{$id}/relationships"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to retrieve concept relationships',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::conceptRelationships exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/concepts/{id}/phoebe
     *
     * Retrieve PHOEBE co-occurrence recommendations for a given concept ID.
     * Queries the vocab.phoebe table directly (OHDSI concept_recommended data).
     */
    public function conceptPhoebe(int $id): JsonResponse
    {
        try {
            $results = $this->vocab()->select('
                SELECT p.relationship_id,
                       c.concept_id,
                       c.concept_name,
                       c.vocabulary_id
                FROM vocab.phoebe p
                JOIN vocab.concept c ON p.concept_id_2 = c.concept_id
                WHERE p.concept_id_1 = ?
                ORDER BY p.relationship_id, c.vocabulary_id, c.concept_name
            ', [$id]);

            $data = array_map(fn ($row) => [
                'concept_id' => (int) $row->concept_id,
                'concept_name' => $row->concept_name,
                'score' => 1.0,
                'relationship_id' => $row->relationship_id,
                'vocabulary_id' => $row->vocabulary_id,
            ], $results);

            return response()->json(['data' => $data]);

        } catch (\Throwable $e) {
            Log::error('HecateController::conceptPhoebe exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'PHOEBE query failed',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/concepts/{id}/definition
     *
     * Retrieve the AI-generated definition for a given concept ID.
     * Proxies to Hecate at GET /api/concepts/{id}/definition.
     */
    public function conceptDefinition(int $id): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/concepts/{$id}/definition"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to retrieve concept definition',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::conceptDefinition exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/concepts/{id}/expand
     *
     * Expand a concept to its descendants / related concepts via Hecate.
     * Proxies to Hecate at GET /api/concepts/{id}/expand.
     */
    public function conceptExpand(int $id): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/concepts/{$id}/expand"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to expand concept',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::conceptExpand exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/vocabulary/semantic/autocomplete
     *
     * Autocomplete concept names for typeahead search.
     * Proxies to Hecate at GET /api/autocomplete.
     *
     * Query params: q
     */
    public function autocomplete(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(15)->get(
                "{$this->hecateUrl}/api/autocomplete",
                $request->only(['q'])
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Autocomplete request failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('HecateController::autocomplete exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Hecate service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
