<?php

namespace App\Console\Commands;

use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SolrIndexVectorExplorer extends Command
{
    protected $signature = 'solr:index-vector-explorer
        {--collection= : Specific ChromaDB collection to index (default: all)}
        {--sample-size=5000 : Number of vectors to sample (0 = all)}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Run PCA→UMAP projection via AI service and index pre-computed points into Solr';

    private const SOLR_BATCH_SIZE = 500;

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.vector_explorer', 'vector_explorer');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $aiUrl = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');
        $sampleSize = (int) $this->option('sample-size');
        $targetCollection = $this->option('collection');

        // Fetch collection list
        $collectionsResponse = Http::timeout(10)->get("{$aiUrl}/chroma/collections");
        if (! $collectionsResponse->successful()) {
            $this->error('Failed to fetch ChromaDB collections from AI service.');

            return self::FAILURE;
        }

        $collections = $collectionsResponse->json();
        $totalIndexed = 0;
        $totalErrors = 0;
        $startTime = microtime(true);

        foreach ($collections as $col) {
            $name = $col['name'] ?? '';
            if (! $name) {
                continue;
            }
            if ($targetCollection && $name !== $targetCollection) {
                continue;
            }

            $this->info("Projecting collection '{$name}'...");

            // Delete existing docs for this collection (if not --fresh which already cleared all)
            if (! $this->option('fresh')) {
                $this->deleteCollectionDocs($solr, $core, $name);
            }

            // Call the projection endpoint on the AI service
            $projResponse = Http::timeout(900)->post("{$aiUrl}/chroma/collections/{$name}/project", [
                'sample_size' => $sampleSize,
                'method' => 'pca-umap',
                'dimensions' => 3,
            ]);

            if (! $projResponse->successful()) {
                $this->warn("  Failed to project '{$name}': ".$projResponse->body());
                $totalErrors++;

                continue;
            }

            $projection = $projResponse->json();
            $points = $projection['points'] ?? [];
            $clusters = $projection['clusters'] ?? [];
            $quality = $projection['quality'] ?? [];
            $stats = $projection['stats'] ?? [];

            if (empty($points)) {
                $this->warn("  No points returned for '{$name}', skipping.");

                continue;
            }

            // Build lookup maps for quality flags
            $outlierSet = array_flip($quality['outlier_ids'] ?? []);
            $orphanSet = array_flip($quality['orphan_ids'] ?? []);
            $duplicateMap = $this->buildDuplicateMap($quality['duplicate_pairs'] ?? []);
            $clusterLabelMap = [];
            foreach ($clusters as $c) {
                $clusterLabelMap[$c['id']] = $c['label'] ?? 'Unknown';
            }

            // Index points in batches
            $batch = [];
            $indexed = 0;

            foreach ($points as $point) {
                $chromaId = $point['id'];
                $doc = [
                    'point_id' => "{$name}:{$chromaId}",
                    'collection_name' => $name,
                    'chroma_id' => $chromaId,
                    'x' => $point['x'],
                    'y' => $point['y'],
                    'z' => $point['z'],
                    'cluster_id' => $point['cluster_id'] ?? 0,
                    'cluster_label' => $clusterLabelMap[$point['cluster_id'] ?? 0] ?? 'Unknown',
                    'is_outlier' => isset($outlierSet[$chromaId]),
                    'is_orphan' => isset($orphanSet[$chromaId]),
                ];

                // Duplicate references
                if (isset($duplicateMap[$chromaId])) {
                    $doc['duplicate_of'] = $duplicateMap[$chromaId];
                }

                // Map metadata to Solr fields
                $meta = $point['metadata'] ?? [];
                if (isset($meta['source'])) {
                    $doc['source'] = (string) $meta['source'];
                }
                if (isset($meta['type'])) {
                    $doc['doc_type'] = (string) $meta['type'];
                }
                if (isset($meta['category'])) {
                    $doc['category'] = (string) $meta['category'];
                }
                if (isset($meta['title'])) {
                    $doc['title'] = (string) $meta['title'];
                }
                if (isset($meta['document'])) {
                    $doc['document_text'] = (string) $meta['document'];
                }

                // Dynamic metadata fields
                foreach ($meta as $key => $value) {
                    if (in_array($key, ['source', 'type', 'category', 'title', 'document'], true)) {
                        continue;
                    }
                    if (is_string($value) && mb_strlen($value) < 200) {
                        $doc["meta_s_{$key}"] = $value;
                    } elseif (is_int($value)) {
                        $doc["meta_i_{$key}"] = $value;
                    } elseif (is_float($value)) {
                        $doc["meta_f_{$key}"] = $value;
                    }
                }

                $batch[] = $doc;

                if (count($batch) >= self::SOLR_BATCH_SIZE) {
                    if ($solr->addDocuments($core, $batch)) {
                        $indexed += count($batch);
                    } else {
                        $totalErrors += count($batch);
                    }
                    $batch = [];
                }
            }

            // Flush remaining
            if (! empty($batch)) {
                if ($solr->addDocuments($core, $batch)) {
                    $indexed += count($batch);
                } else {
                    $totalErrors += count($batch);
                }
            }

            // Index stats document for this collection
            $statsDoc = [
                'point_id' => "{$name}:__stats__",
                'collection_name' => $name,
                'is_stats_doc' => true,
                'total_vectors' => $stats['total_vectors'] ?? count($points),
                'sampled' => $stats['sampled'] ?? count($points),
                'projection_time_ms' => $stats['projection_time_ms'] ?? 0,
                'num_clusters' => count($clusters),
                'num_outliers' => count($quality['outlier_ids'] ?? []),
                'num_duplicates' => count($quality['duplicate_pairs'] ?? []),
                'num_orphans' => count($quality['orphan_ids'] ?? []),
                'indexed_at' => now()->toIso8601String(),
            ];

            // Store cluster data as dynamic fields on the stats doc
            foreach ($clusters as $c) {
                $cid = $c['id'];
                $statsDoc["meta_s_cluster_{$cid}_label"] = $c['label'] ?? 'Unknown';
                $statsDoc["meta_i_cluster_{$cid}_size"] = $c['size'] ?? 0;
                if (isset($c['centroid'])) {
                    $statsDoc["meta_f_cluster_{$cid}_cx"] = $c['centroid'][0] ?? 0.0;
                    $statsDoc["meta_f_cluster_{$cid}_cy"] = $c['centroid'][1] ?? 0.0;
                    $statsDoc["meta_f_cluster_{$cid}_cz"] = $c['centroid'][2] ?? 0.0;
                }
            }

            $solr->addDocuments($core, [$statsDoc]);

            $totalIndexed += $indexed;
            $this->info("  Indexed {$indexed} points + stats for '{$name}'");
        }

        // Commit
        $this->info('Committing...');
        $solr->commit($core);

        $elapsed = round(microtime(true) - $startTime, 1);
        $docCount = $solr->documentCount($core);

        $this->info("Total indexed: {$totalIndexed} | Errors: {$totalErrors} | Time: {$elapsed}s");
        $this->info("Solr document count: {$docCount}");

        if ($totalErrors > 0) {
            $this->warn("Completed with {$totalErrors} errors.");

            return self::FAILURE;
        }

        $this->info('Vector explorer indexing complete.');

        return self::SUCCESS;
    }

    private function deleteCollectionDocs(SolrClientWrapper $solr, string $core, string $collectionName): void
    {
        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);
        $url = "http://{$host}:{$port}/solr/{$core}/update?commit=true";

        try {
            Http::timeout(10)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, [
                    'delete' => ['query' => "collection_name:\"{$collectionName}\""],
                ]);
        } catch (\Throwable $e) {
            $this->warn("  Could not clear existing docs for '{$collectionName}': {$e->getMessage()}");
        }
    }

    /**
     * @param  array<int, array{0: string, 1: string}>  $pairs
     * @return array<string, list<string>>
     */
    private function buildDuplicateMap(array $pairs): array
    {
        $map = [];
        foreach ($pairs as $pair) {
            if (count($pair) === 2) {
                $map[$pair[0]][] = $pair[1];
                $map[$pair[1]][] = $pair[0];
            }
        }

        return $map;
    }
}
