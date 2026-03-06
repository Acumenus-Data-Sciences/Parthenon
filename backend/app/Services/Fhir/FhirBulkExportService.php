<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class FhirBulkExportService
{
    public function __construct(
        private readonly FhirAuthService $auth,
    ) {}

    /**
     * Kick off a FHIR Bulk Data $export and return the polling URL.
     */
    public function startExport(FhirConnection $connection, FhirSyncRun $run, bool $forceFull = false): string
    {
        $token = $this->auth->getAccessToken($connection);
        $accessToken = $token['access_token'];

        $baseUrl = rtrim($connection->fhir_base_url, '/');

        // Build export URL — prefer Group export if group_id is set, else Patient-level
        $exportUrl = $connection->group_id
            ? "{$baseUrl}/Group/{$connection->group_id}/\$export"
            : "{$baseUrl}/Patient/\$export";

        // Build query parameters
        $params = [];

        // Resource types
        $resourceTypes = $connection->export_resource_types
            ?: 'Patient,Condition,Encounter,MedicationRequest,Observation,Procedure,Immunization,AllergyIntolerance,DiagnosticReport';
        $params['_type'] = $resourceTypes;

        // Incremental: use _since if enabled and we have a last sync timestamp (unless forced full)
        if (! $forceFull && $connection->incremental_enabled && $connection->last_sync_at) {
            $params['_since'] = $connection->last_sync_at->toIso8601String();
            $run->update(['since_param' => $connection->last_sync_at]);
        }

        $params['_outputFormat'] = 'application/fhir+ndjson';

        $response = Http::timeout(30)
            ->withHeaders([
                'Authorization' => "Bearer {$accessToken}",
                'Accept' => 'application/fhir+json',
                'Prefer' => 'respond-async',
            ])
            ->get($exportUrl, $params);

        if ($response->status() !== 202) {
            throw new RuntimeException(
                "Bulk export request failed: HTTP {$response->status()} — ".substr($response->body(), 0, 500)
            );
        }

        $pollingUrl = $response->header('Content-Location');
        if (empty($pollingUrl)) {
            throw new RuntimeException('Bulk export accepted (202) but no Content-Location header returned');
        }

        Log::info('FHIR bulk export started', [
            'connection' => $connection->site_key,
            'polling_url' => $pollingUrl,
        ]);

        return $pollingUrl;
    }

    /**
     * Poll the export status URL. Returns null if still in progress, or the manifest on completion.
     *
     * @return array|null The export manifest (with 'output' array of file URLs) or null if pending.
     */
    public function pollExportStatus(FhirConnection $connection, string $pollingUrl): ?array
    {
        $token = $this->auth->getAccessToken($connection);

        $response = Http::timeout(30)
            ->withHeaders([
                'Authorization' => "Bearer {$token['access_token']}",
                'Accept' => 'application/json',
            ])
            ->get($pollingUrl);

        if ($response->status() === 202) {
            // Still processing — check progress header
            $progress = $response->header('X-Progress');
            Log::debug('FHIR export still in progress', [
                'connection' => $connection->site_key,
                'progress' => $progress,
            ]);

            return null;
        }

        if ($response->status() === 200) {
            return $response->json();
        }

        throw new RuntimeException(
            "Export poll failed: HTTP {$response->status()} — ".substr($response->body(), 0, 500)
        );
    }

    /**
     * Download all NDJSON files from the export manifest to local storage.
     *
     * @param  array  $manifest  The export manifest with 'output' array.
     * @return array<string, string[]> Resource type => array of local file paths.
     */
    public function downloadNdjsonFiles(
        FhirConnection $connection,
        FhirSyncRun $run,
        array $manifest,
    ): array {
        $token = $this->auth->getAccessToken($connection);

        $outputFiles = $manifest['output'] ?? [];
        if (empty($outputFiles)) {
            Log::warning('FHIR export manifest has no output files', [
                'connection' => $connection->site_key,
            ]);

            return [];
        }

        // Create storage directory: fhir-exports/{site_key}/{run_id}/
        $storageDir = "fhir-exports/{$connection->site_key}/{$run->id}";

        $downloadedByType = [];
        $fileCount = 0;

        foreach ($outputFiles as $file) {
            $type = $file['type'] ?? 'Unknown';
            $url = $file['url'] ?? '';

            if (empty($url)) {
                continue;
            }

            $fileName = $type.'-'.($fileCount + 1).'.ndjson';
            $filePath = "{$storageDir}/{$fileName}";

            // Stream download to disk
            $response = Http::timeout(300)
                ->withHeaders([
                    'Authorization' => "Bearer {$token['access_token']}",
                    'Accept' => 'application/fhir+ndjson',
                ])
                ->get($url);

            if ($response->failed()) {
                Log::error('Failed to download NDJSON file', [
                    'url' => $url,
                    'type' => $type,
                    'status' => $response->status(),
                ]);

                continue;
            }

            Storage::put($filePath, $response->body());

            $downloadedByType[$type] = $downloadedByType[$type] ?? [];
            $downloadedByType[$type][] = Storage::path($filePath);
            $fileCount++;
        }

        $run->update(['files_downloaded' => $fileCount]);

        Log::info('FHIR NDJSON files downloaded', [
            'connection' => $connection->site_key,
            'run_id' => $run->id,
            'files' => $fileCount,
            'types' => array_keys($downloadedByType),
        ]);

        return $downloadedByType;
    }

    /**
     * Clean up downloaded NDJSON files for a sync run.
     */
    public function cleanupFiles(FhirConnection $connection, FhirSyncRun $run): void
    {
        $storageDir = "fhir-exports/{$connection->site_key}/{$run->id}";
        Storage::deleteDirectory($storageDir);
    }
}
