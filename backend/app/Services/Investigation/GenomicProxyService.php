<?php

namespace App\Services\Investigation;

use App\Models\App\EvidencePin;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GenomicProxyService
{
    /**
     * POST a GraphQL query to Open Targets platform API with Redis caching.
     *
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    public function queryOpenTargets(string $graphqlQuery, array $variables): array
    {
        $cacheKey = 'open_targets:' . md5($graphqlQuery . json_encode($variables));
        /** @var int $ttl */
        $ttl = (int) config('services.open_targets.cache_ttl', 86400);
        /** @var string $url */
        $url = (string) config('services.open_targets.url', 'https://api.platform.opentargets.org/api/v4/graphql');
        /** @var int $timeout */
        $timeout = (int) config('services.open_targets.timeout', 10);

        /** @var array<string, mixed> */
        return Cache::remember($cacheKey, $ttl, function () use ($url, $timeout, $graphqlQuery, $variables): array {
            try {
                $response = Http::timeout($timeout)
                    ->post($url, [
                        'query' => $graphqlQuery,
                        'variables' => $variables,
                    ]);

                if ($response->failed()) {
                    Log::warning('Open Targets API request failed', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);

                    return ['error' => 'Open Targets API returned ' . $response->status()];
                }

                return $response->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('Open Targets API exception', ['message' => $e->getMessage()]);

                return ['error' => $e->getMessage()];
            }
        });
    }

    /**
     * GET a GWAS Catalog REST endpoint with Redis caching.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function queryGwasCatalog(string $endpoint, array $params): array
    {
        $cacheKey = 'gwas_catalog:' . md5($endpoint . json_encode($params));
        /** @var int $ttl */
        $ttl = (int) config('services.gwas_catalog.cache_ttl', 86400);
        /** @var string $baseUrl */
        $baseUrl = (string) config('services.gwas_catalog.url', 'https://www.ebi.ac.uk/gwas/rest/api');
        /** @var int $timeout */
        $timeout = (int) config('services.gwas_catalog.timeout', 10);

        $url = rtrim($baseUrl, '/') . '/' . ltrim($endpoint, '/');

        /** @var array<string, mixed> */
        return Cache::remember($cacheKey, $ttl, function () use ($url, $timeout, $params): array {
            try {
                $response = Http::timeout($timeout)->get($url, $params);

                if ($response->failed()) {
                    Log::warning('GWAS Catalog API request failed', [
                        'status' => $response->status(),
                        'url' => $url,
                    ]);

                    return ['error' => 'GWAS Catalog API returned ' . $response->status()];
                }

                return $response->json() ?? [];
            } catch (\Throwable $e) {
                Log::warning('GWAS Catalog API exception', ['message' => $e->getMessage()]);

                return ['error' => $e->getMessage()];
            }
        });
    }

    /**
     * Resolve cross-links between evidence pins for an investigation.
     *
     * Builds indexes on concept_ids and gene_symbols, then returns a map of
     * pin_id => array of cross-link descriptors pointing to other pins that
     * share at least one concept_id or gene_symbol.
     *
     * @return array<int, array<int, array<string, mixed>>>
     */
    public function resolveCrossLinks(int $investigationId): array
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, EvidencePin> $pins */
        $pins = EvidencePin::where('investigation_id', $investigationId)->get();

        // Build inverted indexes
        /** @var array<int, list<int>> $conceptIndex concept_id => [pin_id, ...] */
        $conceptIndex = [];
        /** @var array<string, list<int>> $geneIndex gene_symbol => [pin_id, ...] */
        $geneIndex = [];

        foreach ($pins as $pin) {
            $conceptIds = is_array($pin->concept_ids) ? $pin->concept_ids : [];
            foreach ($conceptIds as $cid) {
                $intCid = (int) $cid;
                $conceptIndex[$intCid][] = $pin->id;
            }

            $geneSymbols = is_array($pin->gene_symbols) ? $pin->gene_symbols : [];
            foreach ($geneSymbols as $gene) {
                $sym = (string) $gene;
                $geneIndex[$sym][] = $pin->id;
            }
        }

        // Build the cross-link map
        /** @var array<int, array<int, array<string, mixed>>> $linkMap */
        $linkMap = [];

        foreach ($pins as $pin) {
            $links = [];

            $conceptIds = is_array($pin->concept_ids) ? $pin->concept_ids : [];
            foreach ($conceptIds as $cid) {
                $intCid = (int) $cid;
                foreach ($conceptIndex[$intCid] ?? [] as $otherId) {
                    if ($otherId !== $pin->id) {
                        $links[$otherId] = [
                            'pin_id' => $otherId,
                            'link_type' => 'concept_id',
                            'shared_value' => $intCid,
                        ];
                    }
                }
            }

            $geneSymbols = is_array($pin->gene_symbols) ? $pin->gene_symbols : [];
            foreach ($geneSymbols as $gene) {
                $sym = (string) $gene;
                foreach ($geneIndex[$sym] ?? [] as $otherId) {
                    if ($otherId !== $pin->id && ! isset($links[$otherId])) {
                        $links[$otherId] = [
                            'pin_id' => $otherId,
                            'link_type' => 'gene_symbol',
                            'shared_value' => $sym,
                        ];
                    }
                }
            }

            if (! empty($links)) {
                $linkMap[$pin->id] = array_values($links);
            }
        }

        return $linkMap;
    }
}
