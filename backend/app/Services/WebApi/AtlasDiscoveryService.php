<?php

namespace App\Services\WebApi;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AtlasDiscoveryService
{
    /**
     * Test connectivity to a WebAPI instance.
     *
     * @return array{success: bool, message: string, version: string|null, sources_count: int}
     */
    public function testConnection(
        string $baseUrl,
        string $authType = 'none',
        ?string $authCredentials = null,
    ): array {
        $baseUrl = rtrim($baseUrl, '/');
        $client = $this->buildClient($baseUrl, $authType, $authCredentials);

        try {
            $sourcesResponse = $client->get("{$baseUrl}/source/sources");

            if (! $sourcesResponse->successful()) {
                return [
                    'success' => false,
                    'message' => "WebAPI returned HTTP {$sourcesResponse->status()}",
                    'version' => null,
                    'sources_count' => 0,
                ];
            }

            $sources = $sourcesResponse->json();
            $sourcesCount = is_array($sources) ? count($sources) : 0;

            // Try to get version info
            $version = null;
            try {
                $infoResponse = $client->get("{$baseUrl}/info");
                if ($infoResponse->successful()) {
                    $info = $infoResponse->json();
                    $version = $info['version'] ?? $info['buildInfo']['version'] ?? null;
                }
            } catch (\Throwable) {
                // Version info is optional
            }

            return [
                'success' => true,
                'message' => "Connected successfully — {$sourcesCount} source(s) found",
                'version' => $version,
                'sources_count' => $sourcesCount,
            ];
        } catch (\Throwable $e) {
            Log::warning('Atlas connection test failed', [
                'url' => $baseUrl,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => "Connection failed: {$e->getMessage()}",
                'version' => null,
                'sources_count' => 0,
            ];
        }
    }

    /**
     * Discover all entity inventories from a WebAPI instance.
     *
     * @return array<string, array{count: int, items: array<int, array{id: int, name: string, description?: string}>}>
     */
    public function discover(
        string $baseUrl,
        string $authType = 'none',
        ?string $authCredentials = null,
    ): array {
        $baseUrl = rtrim($baseUrl, '/');

        $endpoints = [
            'sources' => '/source/sources',
            'concept_sets' => '/conceptset/',
            'cohort_definitions' => '/cohortdefinition',
            'incidence_rates' => '/ir/',
            'characterizations' => '/cohort-characterization',
            'pathways' => '/pathway-analysis',
            'estimations' => '/estimation/',
            'predictions' => '/prediction/',
        ];

        $responses = Http::pool(function ($pool) use ($baseUrl, $authType, $authCredentials, $endpoints) {
            foreach ($endpoints as $key => $path) {
                $request = $pool->as($key)->timeout(30)->acceptJson();
                $request = $this->applyAuth($request, $authType, $authCredentials);
                $request->get("{$baseUrl}{$path}");
            }
        });

        $inventory = [];

        foreach ($endpoints as $key => $path) {
            $response = $responses[$key] ?? null;

            if (! $response || ! $response->successful()) {
                $inventory[$key] = ['count' => 0, 'items' => []];

                continue;
            }

            $data = $response->json();

            // Some endpoints return paginated: { content: [...] }
            if (isset($data['content']) && is_array($data['content'])) {
                $data = $data['content'];
            }

            if (! is_array($data)) {
                $inventory[$key] = ['count' => 0, 'items' => []];

                continue;
            }

            $items = array_map(function ($item) use ($key) {
                return $this->normalizeEntity($key, $item);
            }, $data);

            $inventory[$key] = [
                'count' => count($items),
                'items' => array_values($items),
            ];
        }

        return $inventory;
    }

    /**
     * Normalize entity data from different WebAPI endpoint formats.
     *
     * @return array{id: int, name: string, description: string|null}
     */
    private function normalizeEntity(string $entityType, array $item): array
    {
        $idField = match ($entityType) {
            'sources' => 'sourceId',
            'concept_sets' => 'id',
            default => 'id',
        };

        $nameField = match ($entityType) {
            'sources' => 'sourceName',
            'concept_sets' => 'name',
            default => 'name',
        };

        return [
            'id' => (int) ($item[$idField] ?? $item['id'] ?? 0),
            'name' => (string) ($item[$nameField] ?? $item['name'] ?? 'Unnamed'),
            'description' => $item['description'] ?? null,
        ];
    }

    /**
     * Build an HTTP client with optional auth.
     */
    public function buildClient(string $baseUrl, string $authType, ?string $authCredentials): PendingRequest
    {
        $request = Http::timeout(60)->acceptJson();

        return $this->applyAuth($request, $authType, $authCredentials);
    }

    /**
     * Apply auth to a pool request or pending request.
     */
    private function applyAuth(mixed $request, string $authType, ?string $authCredentials): mixed
    {
        if ($authType === 'basic' && $authCredentials) {
            $parts = explode(':', $authCredentials, 2);
            $request = $request->withBasicAuth($parts[0] ?? '', $parts[1] ?? '');
        } elseif ($authType === 'bearer' && $authCredentials) {
            $request = $request->withToken($authCredentials);
        }

        return $request;
    }
}
