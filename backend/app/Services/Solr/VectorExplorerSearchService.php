<?php

namespace App\Services\Solr;

class VectorExplorerSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Fetch pre-computed projection for a collection from Solr.
     *
     * Returns the same structure as the Python projection endpoint
     * so the frontend can use it interchangeably.
     *
     * @return array{points: list<array<string, mixed>>, clusters: list<array<string, mixed>>, quality: array<string, mixed>, stats: array<string, mixed>}|null
     */
    public function getProjection(
        string $collectionName,
        ?int $requestedSampleSize = null,
        int $dimensions = 3,
        ?string $colorField = null,
    ): ?array {
        if ($dimensions !== 3) {
            return null;
        }

        $core = config('solr.cores.vector_explorer', 'vector_explorer');

        // Fetch stats doc first to get metadata
        $statsResult = $this->solr->select($core, [
            'q' => '*:*',
            'fq' => [
                'collection_name:"'.addcslashes($collectionName, '"\\').'"',
                'is_stats_doc:true',
                'meta_i_projection_dimensions:'.$dimensions,
            ],
            'rows' => 1,
            'fl' => '*',
        ]);

        if ($statsResult === null) {
            return null;
        }

        $statsDocs = $statsResult['response']['docs'] ?? [];
        if (empty($statsDocs)) {
            return null;
        }

        $statsDoc = $statsDocs[0];
        $totalVectors = (int) ($statsDoc['total_vectors'] ?? 0);
        $sampled = (int) ($statsDoc['sampled'] ?? 0);

        if ($requestedSampleSize !== null) {
            $requestedEffectiveSample = $requestedSampleSize === 0
                ? $totalVectors
                : $requestedSampleSize;
            $matchesRequestedSample = $sampled > 0 && (
                ($requestedEffectiveSample >= $totalVectors && $sampled === $totalVectors)
                || $requestedEffectiveSample === $sampled
            );

            if (! $matchesRequestedSample) {
                return null;
            }
        }

        // Fetch all points (non-stats docs)
        $pointFields = [
            'chroma_id',
            'x',
            'y',
            'z',
            'cluster_id',
            'is_outlier',
            'is_orphan',
            'duplicate_of',
            'source',
            'doc_type',
            'category',
            'title',
        ];
        $dynamicColorFields = $this->resolveDynamicColorFields($colorField);
        $pointFields = [...$pointFields, ...$dynamicColorFields];
        for ($i = 0; $i < 5; $i++) {
            $pointFields[] = "meta_s_edge_{$i}_target";
            $pointFields[] = "meta_f_edge_{$i}_similarity";
        }
        $pointsResult = $this->solr->select($core, [
            'q' => '*:*',
            'fq' => [
                'collection_name:"'.addcslashes($collectionName, '"\\').'"',
                '-is_stats_doc:true',
            ],
            'rows' => 50000,
            'fl' => implode(',', $pointFields),
            'sort' => 'cluster_id asc',
        ]);

        if ($pointsResult === null) {
            return null;
        }

        $rawPoints = $pointsResult['response']['docs'] ?? [];

        // Transform Solr docs to projection format
        $points = [];
        $edges = [];
        $outlierIds = [];
        $orphanIds = [];
        $duplicatePairs = [];
        $seenDuplicates = [];
        $seenEdges = [];

        foreach ($rawPoints as $doc) {
            $chromaId = $doc['chroma_id'] ?? '';

            // Rebuild metadata from stored fields
            $metadata = [];
            if (isset($doc['source'])) {
                $metadata['source'] = $doc['source'];
            }
            if (isset($doc['doc_type'])) {
                $metadata['type'] = $doc['doc_type'];
            }
            if (isset($doc['category'])) {
                $metadata['category'] = $doc['category'];
            }
            if (isset($doc['title'])) {
                $metadata['title'] = $doc['title'];
            }
            if ($colorField !== null) {
                foreach ($dynamicColorFields as $dynamicColorField) {
                    if (isset($doc[$dynamicColorField])) {
                        $metadata[$colorField] = $doc[$dynamicColorField];
                        break;
                    }
                }
            }

            $points[] = [
                'id' => $chromaId,
                'x' => (float) ($doc['x'] ?? 0),
                'y' => (float) ($doc['y'] ?? 0),
                'z' => (float) ($doc['z'] ?? 0),
                'metadata' => $metadata,
                'cluster_id' => (int) ($doc['cluster_id'] ?? 0),
            ];

            // Quality flags
            if (! empty($doc['is_outlier'])) {
                $outlierIds[] = $chromaId;
            }
            if (! empty($doc['is_orphan'])) {
                $orphanIds[] = $chromaId;
            }
            if (! empty($doc['duplicate_of'])) {
                $dups = (array) $doc['duplicate_of'];
                foreach ($dups as $dupId) {
                    $pairKey = $chromaId < $dupId ? "{$chromaId}:{$dupId}" : "{$dupId}:{$chromaId}";
                    if (! isset($seenDuplicates[$pairKey])) {
                        $seenDuplicates[$pairKey] = true;
                        $duplicatePairs[] = [$chromaId, $dupId];
                    }
                }
            }

            for ($i = 0; $i < 5; $i++) {
                $target = $doc["meta_s_edge_{$i}_target"] ?? null;
                $similarity = $doc["meta_f_edge_{$i}_similarity"] ?? null;
                if (! is_string($target) || $target === '' || $similarity === null) {
                    continue;
                }

                $pairKey = $chromaId < $target ? "{$chromaId}:{$target}" : "{$target}:{$chromaId}";
                if (isset($seenEdges[$pairKey])) {
                    continue;
                }
                $seenEdges[$pairKey] = true;
                [$sourceId, $targetId] = $chromaId < $target ? [$chromaId, $target] : [$target, $chromaId];
                $edges[] = [
                    'source_id' => $sourceId,
                    'target_id' => $targetId,
                    'similarity' => (float) $similarity,
                ];
            }
        }

        // Rebuild clusters from stats doc dynamic fields
        $numClusters = (int) ($statsDoc['num_clusters'] ?? 0);
        $clusters = [];
        for ($i = 0; $i < $numClusters; $i++) {
            $label = $statsDoc["meta_s_cluster_{$i}_label"] ?? 'Unknown';
            $size = (int) ($statsDoc["meta_i_cluster_{$i}_size"] ?? 0);
            $cx = (float) ($statsDoc["meta_f_cluster_{$i}_cx"] ?? 0);
            $cy = (float) ($statsDoc["meta_f_cluster_{$i}_cy"] ?? 0);
            $cz = (float) ($statsDoc["meta_f_cluster_{$i}_cz"] ?? 0);

            $clusters[] = [
                'id' => $i,
                'label' => $label,
                'centroid' => [$cx, $cy, $cz],
                'size' => $size,
            ];
        }

        return [
            'points' => $points,
            'edges' => $edges,
            'clusters' => $clusters,
            'quality' => [
                'outlier_ids' => $outlierIds,
                'duplicate_pairs' => $duplicatePairs,
                'orphan_ids' => $orphanIds,
            ],
            'stats' => [
                'total_vectors' => $totalVectors ?: count($points),
                'sampled' => $sampled ?: count($points),
                'projection_time_ms' => (int) ($statsDoc['projection_time_ms'] ?? 0),
                'source' => 'solr',
                'dimensions' => (int) ($statsDoc['meta_i_projection_dimensions'] ?? $dimensions),
                'knn_neighbors' => (int) ($statsDoc['meta_i_knn_neighbors'] ?? 0),
                'num_edges' => (int) ($statsDoc['num_edges'] ?? count($edges)),
                'indexed_at' => $statsDoc['indexed_at'] ?? null,
            ],
        ];
    }

    /**
     * Fetch full metadata for a single projected point.
     *
     * @return array<string, mixed>|null
     */
    public function getPointDetails(string $collectionName, string $pointId): ?array
    {
        $core = config('solr.cores.vector_explorer', 'vector_explorer');

        $result = $this->solr->select($core, [
            'q' => '*:*',
            'fq' => [
                'collection_name:"'.addcslashes($collectionName, '"\\').'"',
                'chroma_id:"'.addcslashes($pointId, '"\\').'"',
                '-is_stats_doc:true',
            ],
            'rows' => 1,
            'fl' => '*',
        ]);

        if ($result === null) {
            return null;
        }

        $doc = $result['response']['docs'][0] ?? null;
        if (! is_array($doc)) {
            return null;
        }

        return [
            'id' => $doc['chroma_id'] ?? $pointId,
            'x' => (float) ($doc['x'] ?? 0),
            'y' => (float) ($doc['y'] ?? 0),
            'z' => (float) ($doc['z'] ?? 0),
            'cluster_id' => (int) ($doc['cluster_id'] ?? 0),
            'metadata' => $this->buildFullMetadata($doc),
        ];
    }

    /**
     * @return list<string>
     */
    private function resolveDynamicColorFields(?string $colorField): array
    {
        if ($colorField === null || $colorField === '') {
            return [];
        }

        if (! preg_match('/^[A-Za-z0-9_]+$/', $colorField)) {
            return [];
        }

        if (in_array($colorField, ['source', 'type', 'category', 'title'], true)) {
            return [];
        }

        return [
            "meta_s_{$colorField}",
            "meta_i_{$colorField}",
            "meta_f_{$colorField}",
            "meta_t_{$colorField}",
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildFullMetadata(array $doc): array
    {
        $metadata = array_filter([
            'source' => $doc['source'] ?? null,
            'type' => $doc['doc_type'] ?? null,
            'category' => $doc['category'] ?? null,
            'title' => $doc['title'] ?? null,
            'document' => $doc['document_text'] ?? null,
        ], static fn ($value) => $value !== null && $value !== '');

        $internalMetaFields = [
            'meta_i_projection_dimensions',
        ];

        foreach ($doc as $key => $value) {
            if (str_starts_with($key, 'meta_s_edge_') || str_starts_with($key, 'meta_f_edge_')) {
                continue;
            }

            if (! str_starts_with($key, 'meta_s_') && ! str_starts_with($key, 'meta_i_') && ! str_starts_with($key, 'meta_f_') && ! str_starts_with($key, 'meta_t_')) {
                continue;
            }

            if (in_array($key, $internalMetaFields, true)) {
                continue;
            }

            $originalKey = substr($key, 7);
            $metadata[$originalKey] = $value;
        }

        return $metadata;
    }

    /**
     * Check if a collection has been indexed.
     */
    public function hasProjection(string $collectionName): bool
    {
        $core = config('solr.cores.vector_explorer', 'vector_explorer');

        $result = $this->solr->select($core, [
            'q' => '*:*',
            'fq' => [
                'collection_name:"'.addcslashes($collectionName, '"\\').'"',
                'is_stats_doc:true',
            ],
            'rows' => 0,
        ]);

        return ($result['response']['numFound'] ?? 0) > 0;
    }

    /**
     * Search/filter points within a collection's projection.
     *
     * @param  array<string, mixed>  $filters
     * @return array{points: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>}|null
     */
    public function searchPoints(string $collectionName, string $query = '', array $filters = [], int $limit = 10000): ?array
    {
        $core = config('solr.cores.vector_explorer', 'vector_explorer');

        $params = [
            'q' => $query ?: '*:*',
            'fq' => [
                'collection_name:"'.addcslashes($collectionName, '"\\').'"',
                '-is_stats_doc:true',
            ],
            'rows' => $limit,
            'fl' => 'chroma_id,x,y,z,cluster_id,cluster_label,is_outlier,is_orphan,source,doc_type,category,title',
            'facet' => 'true',
            'facet.field' => ['cluster_label', 'source', 'doc_type', 'category'],
            'facet.mincount' => 1,
        ];

        // Apply filters
        if (! empty($filters['cluster_id'])) {
            $params['fq'][] = 'cluster_id:'.(int) $filters['cluster_id'];
        }
        if (! empty($filters['source'])) {
            $params['fq'][] = 'source:"'.addcslashes($filters['source'], '"\\').'"';
        }
        if (! empty($filters['doc_type'])) {
            $params['fq'][] = 'doc_type:"'.addcslashes($filters['doc_type'], '"\\').'"';
        }
        if (isset($filters['is_outlier'])) {
            $params['fq'][] = 'is_outlier:'.($filters['is_outlier'] ? 'true' : 'false');
        }
        if (isset($filters['is_orphan'])) {
            $params['fq'][] = 'is_orphan:'.($filters['is_orphan'] ? 'true' : 'false');
        }

        if ($query && $query !== '*:*') {
            $params['defType'] = 'edismax';
            $params['qf'] = 'title^3 document_text^1 source^1 category^1';
        }

        $result = $this->solr->select($core, $params);

        if ($result === null) {
            return null;
        }

        $docs = $result['response']['docs'] ?? [];
        $points = array_map(fn (array $doc) => [
            'id' => $doc['chroma_id'] ?? '',
            'x' => (float) ($doc['x'] ?? 0),
            'y' => (float) ($doc['y'] ?? 0),
            'z' => (float) ($doc['z'] ?? 0),
            'cluster_id' => (int) ($doc['cluster_id'] ?? 0),
            'cluster_label' => $doc['cluster_label'] ?? '',
            'is_outlier' => ! empty($doc['is_outlier']),
            'is_orphan' => ! empty($doc['is_orphan']),
            'metadata' => array_filter([
                'source' => $doc['source'] ?? null,
                'type' => $doc['doc_type'] ?? null,
                'category' => $doc['category'] ?? null,
                'title' => $doc['title'] ?? null,
            ]),
        ], $docs);

        return [
            'points' => $points,
            'total' => (int) ($result['response']['numFound'] ?? 0),
            'facets' => $this->parseFacets($result['facet_counts']['facet_fields'] ?? []),
        ];
    }

    /**
     * @param  array<string, array<int, string|int>>  $facetFields
     * @return array<string, array<string, int>>
     */
    private function parseFacets(array $facetFields): array
    {
        $facets = [];
        foreach ($facetFields as $field => $values) {
            $facets[$field] = [];
            for ($i = 0, $len = count($values); $i < $len; $i += 2) {
                $name = (string) $values[$i];
                $count = (int) ($values[$i + 1] ?? 0);
                if ($count > 0) {
                    $facets[$field][$name] = $count;
                }
            }
        }

        return $facets;
    }
}
