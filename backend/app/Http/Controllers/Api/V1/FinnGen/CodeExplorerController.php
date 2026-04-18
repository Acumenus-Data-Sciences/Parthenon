<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Code Explorer API — thin semantic facade over SP1 sync reads + async runs.
 *
 * Spec: docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md
 *
 * TTLs per §4.1 (tiered Q6 decision):
 *   /counts         →  1h (tracks stratified_code_counts freshness)
 *   /relationships  → 24h (vocab-only)
 *   /ancestors      → 24h (vocab-only; strips mermaid at controller layer)
 */
class CodeExplorerController extends Controller
{
    private const TTL_COUNTS = 3600;

    private const TTL_RELATIONSHIPS = 86400;

    private const TTL_ANCESTORS = 86400;

    private const MAX_DEPTH_CAP = 7;

    public function __construct(
        private readonly FinnGenClient $client,
        private readonly FinnGenSourceContextBuilder $sourceBuilder,
        private readonly FinnGenRunService $runs,
    ) {}

    public function counts(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');

        try {
            return $this->proxyWithCache(
                path: '/finngen/romopapi/code-counts',
                cacheTag: 'counts',
                sourceKey: $sourceKey,
                query: ['concept_id' => $conceptId],
                ttl: self::TTL_COUNTS,
                refresh: $request->boolean('refresh'),
            );
        } catch (FinnGenDarkstarRejectedException $e) {
            return $this->maybeEnrichCountsError($e, $sourceKey, $conceptId);
        }
    }

    /**
     * Scoped concept search — returns only concepts that have observations in the
     * given source's stratified_code_counts table. Powers ConceptSearchInput in the
     * Code Explorer UI so researchers can't pick concepts that have no data.
     */
    public function concepts(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $query = trim((string) $request->input('q', ''));
        $limit = min(50, max(1, (int) $request->input('limit', 15)));

        $source = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);
        $resultsSchema = $source['schemas']['results'];
        $vocabSchema = $source['schemas']['vocab'] ?? 'vocab';

        // Guard against SQL injection — schema names come from app.source_daimons
        // which is admin-controlled, but we quote defensively anyway.
        if (! preg_match('/^[a-zA-Z0-9_]+$/', $resultsSchema) || ! preg_match('/^[a-zA-Z0-9_]+$/', $vocabSchema)) {
            abort(422, 'invalid source schema');
        }

        $bindings = [];
        $where = '';
        if ($query !== '') {
            $where = 'WHERE (c.concept_name ILIKE ? OR CAST(c.concept_id AS TEXT) = ?)';
            $bindings = ['%'.$query.'%', $query];
        }

        $sql = sprintf(
            'SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id, c.concept_class_id,
                    c.standard_concept, c.concept_code, obs.n AS observation_count
             FROM (
               SELECT scc.concept_id, SUM(scc.record_counts)::int AS n
               FROM %s.stratified_code_counts scc
               GROUP BY scc.concept_id
             ) obs
             JOIN %s.concept c ON c.concept_id = obs.concept_id
             %s
             ORDER BY obs.n DESC NULLS LAST, c.concept_name
             LIMIT %d',
            $resultsSchema,
            $vocabSchema,
            $where,
            $limit,
        );

        $rows = DB::select($sql, $bindings);

        return response()->json([
            'source_key' => $sourceKey,
            'query' => $query,
            'items' => $rows,
        ]);
    }

    public function relationships(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');

        return $this->proxyWithCache(
            path: '/finngen/romopapi/relationships',
            cacheTag: 'relationships',
            sourceKey: $sourceKey,
            query: ['concept_id' => $conceptId],
            ttl: self::TTL_RELATIONSHIPS,
            refresh: $request->boolean('refresh'),
        );
    }

    public function ancestors(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');
        $direction = (string) $request->input('direction', 'both');
        $maxDepth = min(self::MAX_DEPTH_CAP, max(1, (int) $request->input('max_depth', 3)));

        $response = $this->proxyWithCache(
            path: '/finngen/romopapi/ancestors',
            cacheTag: 'ancestors',
            sourceKey: $sourceKey,
            query: ['concept_id' => $conceptId, 'direction' => $direction, 'max_depth' => $maxDepth],
            ttl: self::TTL_ANCESTORS,
            refresh: $request->boolean('refresh'),
        );

        $payload = $response->getData(true);
        if (is_array($payload) && isset($payload['mermaid'])) {
            unset($payload['mermaid']);
            $response->setData($payload);
        }

        return $response;
    }

    public function sourceReadiness(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $source = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);

        $resultsSchema = $source['schemas']['results'];
        // Use pg_tables (system catalog) instead of information_schema.tables — the
        // default Laravel role (parthenon_app) has no grants on per-source results
        // schemas, so info_schema would filter the row out and falsely report ready=false.
        $row = DB::selectOne(
            'SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = ? AND tablename = ?) AS present',
            [$resultsSchema, 'stratified_code_counts']
        );
        $exists = (bool) ($row?->present ?? false);

        $setupRunId = DB::connection(config('finngen.connection', 'finngen'))->table('runs')
            ->where('source_key', $sourceKey)
            ->where('analysis_type', 'romopapi.setup')
            ->whereIn('status', ['queued', 'running'])
            ->orderByDesc('created_at')
            ->value('id');

        return response()->json([
            'source_key' => $sourceKey,
            'ready' => $exists,
            'missing' => $exists ? [] : ['stratified_code_counts'],
            'setup_run_id' => $setupRunId,
        ]);
    }

    public function createReport(Request $request): JsonResponse
    {
        $request->validate([
            'source_key' => ['required', 'string', 'max:64'],
            'concept_id' => ['required', 'integer', 'min:1'],
        ]);
        $run = $this->runs->create(
            userId: $request->user()->id,
            sourceKey: (string) $request->string('source_key'),
            analysisType: 'romopapi.report',
            params: ['concept_id' => (int) $request->input('concept_id')],
        );

        return response()->json($run, 201);
    }

    public function initializeSource(Request $request): JsonResponse
    {
        $request->validate([
            'source_key' => ['required', 'string', 'max:64'],
        ]);
        $run = $this->runs->create(
            userId: $request->user()->id,
            sourceKey: (string) $request->string('source_key'),
            analysisType: 'romopapi.setup',
            params: [],
        );

        return response()->json($run, 201);
    }

    private function requireSource(Request $request): string
    {
        $source = (string) $request->input('source', '');
        if ($source === '') {
            abort(response()->json([
                'error' => ['code' => 'FINNGEN_INVALID_PARAMS', 'message' => 'source is required'],
            ], 422));
        }

        return $source;
    }

    /**
     * @param  array<string, scalar|null>  $query
     */
    private function proxyWithCache(
        string $path,
        string $cacheTag,
        string $sourceKey,
        array $query,
        int $ttl,
        bool $refresh,
    ): JsonResponse {
        $cacheKey = sprintf(
            'finngen:sync:code-explorer:%s:%s:%s',
            $cacheTag, $sourceKey, md5((string) json_encode($query))
        );

        if (! $refresh && ($cached = Cache::get($cacheKey)) !== null) {
            return response()->json($cached);
        }

        $source = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);
        $result = $this->client->getSync($path, array_merge(['source' => json_encode($source)], $query));

        Cache::put($cacheKey, $result, $ttl);

        return response()->json($result);
    }

    private function maybeEnrichCountsError(FinnGenDarkstarRejectedException $e, string $sourceKey, int $conceptId): JsonResponse
    {
        $detail = $e->darkstarError ?? [];
        $category = $detail['category'] ?? '';
        $message = $detail['message'] ?? '';
        $messageStr = is_string($message) ? $message : '';

        // Setup not done — stratified_code_counts table doesn't exist.
        if ($category === 'DB_SCHEMA_MISMATCH' && str_contains($messageStr, 'stratified_code_counts')) {
            return response()->json([
                'error' => [
                    'code' => 'FINNGEN_SOURCE_NOT_INITIALIZED',
                    'message' => "Source '{$sourceKey}' needs one-time setup before code counts can be queried.",
                    'action' => ['type' => 'initialize_source', 'source_key' => $sourceKey],
                    'darkstar_error' => $detail,
                ],
            ], 422);
        }

        // Concept is in vocabulary but has no observations in this source.
        // ROMOPAPI::getCodeCounts throws "No family tree found for conceptId: N" in this case.
        if (str_contains($messageStr, 'No family tree found for conceptId')) {
            return response()->json([
                'error' => [
                    'code' => 'FINNGEN_CONCEPT_NOT_IN_SOURCE',
                    'message' => "Concept {$conceptId} has no observations in source '{$sourceKey}'.",
                    'action' => ['type' => 'pick_different_concept', 'source_key' => $sourceKey],
                    'darkstar_error' => $detail,
                ],
            ], 422);
        }

        return response()->json([
            'error' => [
                'code' => 'FINNGEN_DARKSTAR_REJECTED',
                'message' => $e->getMessage(),
                'darkstar_error' => $detail,
            ],
        ], $e->status ?: 422);
    }
}
