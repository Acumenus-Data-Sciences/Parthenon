<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

/**
 * @group Admin — Solr
 */
class SolrAdminController extends Controller
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    /**
     * GET /v1/admin/solr/status
     *
     * Return per-core Solr status: document counts, availability, and last index info.
     */
    public function status(): JsonResponse
    {
        if (! $this->solr->isEnabled()) {
            return response()->json(['error' => 'Solr is not enabled'], 400);
        }

        $cores = config('solr.cores', []);
        $statuses = [];

        foreach ($cores as $name => $core) {
            $available = $this->solr->ping($core);
            $docCount = $available ? $this->solr->documentCount($core) : null;
            $lastIndexed = Cache::get("solr:last_indexed:{$name}");
            $lastDuration = Cache::get("solr:last_index_duration:{$name}");
            $indexing = Cache::get("solr:indexing:{$name}", false);

            $statuses[$name] = [
                'core' => $core,
                'available' => $available,
                'document_count' => $docCount,
                'last_indexed_at' => $lastIndexed,
                'last_index_duration_seconds' => $lastDuration,
                'indexing' => $indexing,
            ];
        }

        return response()->json(['data' => $statuses]);
    }

    /**
     * POST /v1/admin/solr/reindex/{core}
     *
     * Dispatch a reindex job for a specific core.
     */
    public function reindex(Request $request, string $core): JsonResponse
    {
        if (! $this->solr->isEnabled()) {
            return response()->json(['error' => 'Solr is not enabled'], 400);
        }

        $validCores = array_keys(config('solr.cores', []));
        if (! in_array($core, $validCores)) {
            return response()->json(['error' => "Unknown core: {$core}"], 404);
        }

        $fresh = $request->boolean('fresh', false);

        Cache::put("solr:indexing:{$core}", true, 3600);

        $startTime = microtime(true);

        $command = match ($core) {
            'vocabulary' => 'solr:index-vocabulary',
            'cohorts' => 'solr:index-cohorts',
            'analyses' => 'solr:index-analyses',
            'mappings' => 'solr:index-mappings',
            'clinical' => 'solr:index-clinical',
            default => null,
        };

        if (! $command) {
            Cache::forget("solr:indexing:{$core}");

            return response()->json(['error' => "No indexer available for core: {$core}"], 400);
        }

        $args = $fresh ? ['--fresh' => true] : [];

        try {
            Artisan::call($command, $args);
            $duration = round(microtime(true) - $startTime, 1);

            Cache::put("solr:last_indexed:{$core}", now()->toIso8601String(), 86400);
            Cache::put("solr:last_index_duration:{$core}", $duration, 86400);
            Cache::forget("solr:indexing:{$core}");

            return response()->json([
                'message' => "Reindex of '{$core}' completed.",
                'duration_seconds' => $duration,
                'document_count' => $this->solr->documentCount(config("solr.cores.{$core}", $core)),
            ]);
        } catch (\Throwable $e) {
            Cache::forget("solr:indexing:{$core}");

            return response()->json([
                'error' => "Reindex failed: {$e->getMessage()}",
            ], 500);
        }
    }

    /**
     * POST /v1/admin/solr/reindex-all
     *
     * Dispatch reindex for all cores sequentially.
     */
    public function reindexAll(Request $request): JsonResponse
    {
        if (! $this->solr->isEnabled()) {
            return response()->json(['error' => 'Solr is not enabled'], 400);
        }

        $fresh = $request->boolean('fresh', false);
        $results = [];

        $indexers = [
            'vocabulary' => 'solr:index-vocabulary',
            'cohorts' => 'solr:index-cohorts',
            'analyses' => 'solr:index-analyses',
            'mappings' => 'solr:index-mappings',
            'clinical' => 'solr:index-clinical',
        ];

        foreach ($indexers as $core => $command) {
            Cache::put("solr:indexing:{$core}", true, 3600);
            $startTime = microtime(true);

            try {
                $args = $fresh ? ['--fresh' => true] : [];
                Artisan::call($command, $args);
                $duration = round(microtime(true) - $startTime, 1);

                Cache::put("solr:last_indexed:{$core}", now()->toIso8601String(), 86400);
                Cache::put("solr:last_index_duration:{$core}", $duration, 86400);
                Cache::forget("solr:indexing:{$core}");

                $results[$core] = [
                    'status' => 'success',
                    'duration_seconds' => $duration,
                    'document_count' => $this->solr->documentCount(config("solr.cores.{$core}", $core)),
                ];
            } catch (\Throwable $e) {
                Cache::forget("solr:indexing:{$core}");
                $results[$core] = [
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'message' => 'Reindex-all completed.',
            'results' => $results,
        ]);
    }

    /**
     * POST /v1/admin/solr/clear/{core}
     *
     * Clear all documents from a core.
     */
    public function clear(string $core): JsonResponse
    {
        if (! $this->solr->isEnabled()) {
            return response()->json(['error' => 'Solr is not enabled'], 400);
        }

        $validCores = config('solr.cores', []);
        $coreName = $validCores[$core] ?? null;

        if (! $coreName) {
            return response()->json(['error' => "Unknown core: {$core}"], 404);
        }

        if ($this->solr->deleteAll($coreName)) {
            return response()->json(['message' => "Core '{$core}' cleared."]);
        }

        return response()->json(['error' => "Failed to clear core '{$core}'"], 500);
    }
}
