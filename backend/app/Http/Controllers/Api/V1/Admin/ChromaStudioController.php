<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Solr\VectorExplorerSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Proxy endpoints for ChromaDB Studio inspection UI.
 * All requests are forwarded to the Python AI service which is the sole
 * gateway to ChromaDB (browser never talks to Chroma directly).
 */
/**
 * @group Administration
 */
class ChromaStudioController extends Controller
{
    private function aiUrl(): string
    {
        return rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');
    }

    /** List all ChromaDB collections with counts. */
    public function collections(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiUrl()}/chroma/collections");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Failed to fetch collections.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Get collection overview: count, sample records, facets, metadata keys. */
    public function collectionOverview(Request $request, string $name): JsonResponse
    {
        $includeEmbeddings = $request->boolean('include_embeddings');
        $url = "{$this->aiUrl()}/chroma/collections/{$name}/overview"
            .($includeEmbeddings ? '?include_embeddings=true' : '');

        $response = Http::timeout(30)->get($url);

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Failed to load overview.'],
                $response->status(),
            );
        }

        return response()->json($response->json());
    }

    /** Semantic query against a named collection. */
    public function query(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'collectionName' => 'required|string',
            'queryText' => 'required|string|max:2000',
            'nResults' => 'integer|min:1|max:50',
            'where' => 'nullable|array',
            'whereDocument' => 'nullable|array',
        ]);

        $response = Http::timeout(30)
            ->post("{$this->aiUrl()}/chroma/query", $validated);

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Query failed.'],
                $response->status(),
            );
        }

        return response()->json($response->json());
    }

    /** Trigger doc ingestion into ChromaDB. */
    public function ingestDocs(): JsonResponse
    {
        $response = Http::timeout(120)->post("{$this->aiUrl()}/chroma/ingest-docs");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Ingestion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Trigger clinical concept ingestion. */
    public function ingestClinical(Request $request): JsonResponse
    {
        $limit = $request->integer('limit');
        $url = "{$this->aiUrl()}/chroma/ingest-clinical".($limit ? "?limit={$limit}" : '');

        $response = Http::timeout(300)->post($url);

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Clinical ingestion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Run FAQ promotion batch. */
    public function promoteFaq(Request $request): JsonResponse
    {
        $days = $request->integer('days', 7);
        $response = Http::timeout(60)->post("{$this->aiUrl()}/chroma/promote-faq?days={$days}");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'FAQ promotion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Trigger OHDSI research paper ingestion (PDFs). */
    public function ingestOhdsiPapers(): JsonResponse
    {
        $response = Http::timeout(600)->post("{$this->aiUrl()}/chroma/ingest-ohdsi-papers");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'OHDSI paper ingestion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Trigger OHDSI knowledge ingestion (Book, HADES, Forums). */
    public function ingestOhdsiKnowledge(): JsonResponse
    {
        $response = Http::timeout(600)->post("{$this->aiUrl()}/chroma/ingest-ohdsi-knowledge");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'OHDSI knowledge ingestion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /** Trigger medical textbook ingestion. */
    public function ingestTextbooks(): JsonResponse
    {
        $response = Http::timeout(600)->post("{$this->aiUrl()}/chroma/ingest-textbooks");

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Textbook ingestion failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }

    /**
     * Get 3D projection for a collection's embeddings.
     *
     * Tries pre-computed Solr index first (<500ms), falls back to
     * live PCA→UMAP computation via AI service (~8-10s).
     */
    public function projectCollection(Request $request, string $name, VectorExplorerSearchService $solrSearch): JsonResponse
    {
        $forceRefresh = $request->boolean('refresh');

        // Try Solr first (pre-computed, fast)
        if (! $forceRefresh && $solrSearch->isAvailable()) {
            $solrResult = $solrSearch->getProjection($name);
            if ($solrResult !== null) {
                return response()->json($solrResult);
            }
        }

        // Fall back to live computation via AI service
        $sampleSize = $request->integer('sample_size', 5000);

        if ($sampleSize !== 0 && ($sampleSize < 500 || $sampleSize > 100000)) {
            return response()->json(
                ['error' => 'sample_size must be 0 (all) or between 500 and 100000.'],
                422,
            );
        }

        $validated = $request->validate([
            'method' => 'required|string|in:pca-umap',
            'dimensions' => 'required|integer|in:2,3',
        ]);
        $validated['sample_size'] = $sampleSize;

        $response = Http::timeout(120)
            ->post("{$this->aiUrl()}/chroma/collections/{$name}/project", $validated);

        if (! $response->successful()) {
            return response()->json(
                ['error' => $response->json('detail') ?? 'Projection failed.'],
                $response->status() ?: 502,
            );
        }

        return response()->json($response->json());
    }
}
