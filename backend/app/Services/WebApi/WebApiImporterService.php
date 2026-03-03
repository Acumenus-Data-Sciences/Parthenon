<?php

namespace App\Services\WebApi;

use App\Models\App\Source;
use App\Models\App\WebApiRegistry;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WebApiImporterService
{
    /**
     * Import sources from a legacy OHDSI WebAPI instance.
     *
     * @return array{imported: int, skipped: int, sources: array<int, array{source_key: string, source_name: string, status: string}>}
     */
    public function importFromUrl(
        string $baseUrl,
        string $authType = 'none',
        ?string $authCredentials = null,
    ): array {
        $baseUrl = rtrim($baseUrl, '/');
        $response = $this->fetchSources($baseUrl, $authType, $authCredentials);

        $imported = 0;
        $skipped = 0;
        $results = [];

        foreach ($response as $webApiSource) {
            $sourceKey = $webApiSource['sourceKey'] ?? null;
            $sourceName = $webApiSource['sourceName'] ?? null;

            if (! $sourceKey || ! $sourceName) {
                $skipped++;
                $results[] = [
                    'source_key' => $sourceKey ?? 'unknown',
                    'source_name' => $sourceName ?? 'unknown',
                    'status' => 'skipped_invalid',
                ];

                continue;
            }

            // Check if source_key already exists
            if (Source::withTrashed()->where('source_key', $sourceKey)->exists()) {
                $skipped++;
                $results[] = [
                    'source_key' => $sourceKey,
                    'source_name' => $sourceName,
                    'status' => 'skipped_exists',
                ];

                continue;
            }

            $dialect = $this->mapDialect($webApiSource['sourceDialect'] ?? 'postgresql');
            $connection = $webApiSource['sourceConnection'] ?? '';

            $source = Source::create([
                'source_name' => $sourceName,
                'source_key' => $sourceKey,
                'source_dialect' => $dialect,
                'source_connection' => $connection,
                'is_cache_enabled' => false,
                'imported_from_webapi' => $baseUrl,
            ]);

            // Import daimons
            $daimons = $webApiSource['daimons'] ?? [];
            foreach ($daimons as $daimon) {
                $daimonType = $this->mapDaimonType($daimon['daimonType'] ?? '');
                if (! $daimonType) {
                    continue;
                }

                $source->daimons()->create([
                    'daimon_type' => $daimonType,
                    'table_qualifier' => $daimon['tableQualifier'] ?? '',
                    'priority' => $daimon['priority'] ?? 0,
                ]);
            }

            $imported++;
            $results[] = [
                'source_key' => $sourceKey,
                'source_name' => $sourceName,
                'status' => 'imported',
            ];
        }

        return [
            'imported' => $imported,
            'skipped' => $skipped,
            'sources' => $results,
        ];
    }

    /**
     * Import sources and update the registry's last_synced_at timestamp.
     *
     * @return array{imported: int, skipped: int, sources: array<int, array{source_key: string, source_name: string, status: string}>}
     */
    public function importFromRegistry(WebApiRegistry $registry): array
    {
        $result = $this->importFromUrl(
            $registry->base_url,
            $registry->auth_type,
            $registry->auth_credentials,
        );

        $registry->update(['last_synced_at' => now()]);

        return $result;
    }

    /**
     * Fetch the source list from a WebAPI instance.
     *
     * @return array<int, mixed>
     */
    private function fetchSources(string $baseUrl, string $authType, ?string $credentials): array
    {
        $request = Http::timeout(30)->acceptJson();

        if ($authType === 'basic' && $credentials) {
            $parts = explode(':', $credentials, 2);
            $request = $request->withBasicAuth($parts[0] ?? '', $parts[1] ?? '');
        } elseif ($authType === 'bearer' && $credentials) {
            $request = $request->withToken($credentials);
        }

        $response = $request->get("{$baseUrl}/source/");

        if (! $response->successful()) {
            Log::warning('WebAPI import failed', [
                'url' => "{$baseUrl}/source/",
                'status' => $response->status(),
            ]);

            throw new \RuntimeException(
                "Failed to fetch sources from WebAPI: HTTP {$response->status()}"
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    /**
     * Map WebAPI dialect names to Parthenon dialect names.
     */
    private function mapDialect(string $webApiDialect): string
    {
        return match (Str::lower($webApiDialect)) {
            'postgresql', 'postgres', 'redshift' => 'postgresql',
            'oracle' => 'oracle',
            'bigquery' => 'bigquery',
            'spark', 'databricks' => 'postgresql', // best-effort
            default => 'postgresql',
        };
    }

    /**
     * Map WebAPI daimon type names to Parthenon DaimonType values.
     */
    private function mapDaimonType(string $webApiType): ?string
    {
        return match (Str::lower($webApiType)) {
            'cdm' => 'cdm',
            'vocabulary' => 'vocabulary',
            'results' => 'results',
            'temp' => 'temp',
            'evidence', 'estimation' => null,
            default => null,
        };
    }
}
