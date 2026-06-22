<?php

declare(strict_types=1);

namespace App\Jobs\Fhir;

use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Services\Fhir\FhirBulkExportService;
use App\Services\Fhir\FhirDedupService;
use App\Services\Fhir\FhirNdjsonProcessorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrates a full FHIR Bulk Data sync run:
 *   1. Authenticate via SMART Backend Services
 *   2. Kick off $export bulk data request
 *   3. Poll until export completes (with exponential backoff)
 *   4. Download NDJSON files
 *   5. Parse + map to OMOP CDM + write to DB
 *   6. Update sync run and connection status
 */
class RunFhirSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Allow up to 4 hours for large exports. */
    public int $timeout = 14400;

    public int $tries = 1;

    /** Maximum time to wait for export completion (2 hours). */
    private const MAX_POLL_SECONDS = 7200;

    /** Initial poll interval in seconds. */
    private const INITIAL_POLL_INTERVAL = 10;

    /** Maximum poll interval in seconds. */
    private const MAX_POLL_INTERVAL = 120;

    public function __construct(
        public readonly FhirConnection $fhirConnection,
        public readonly FhirSyncRun $syncRun,
        public readonly bool $forceFull = false,
    ) {
        $this->onQueue('default');
    }

    public function handle(
        FhirBulkExportService $exportService,
        FhirNdjsonProcessorService $processor,
    ): void {
        $run = $this->syncRun;
        $conn = $this->fhirConnection;

        try {
            // ── Step 1: Start export ────────────────────────────────────────
            $run->update([
                'status' => 'exporting',
                'started_at' => now(),
            ]);

            $isIncremental = $conn->incremental_enabled && ! $this->forceFull && $conn->last_sync_at;

            Log::info("FHIR sync started for {$conn->site_key}", [
                'run_id' => $run->id,
                'incremental' => $isIncremental,
                'force_full' => $this->forceFull,
            ]);

            $pollingUrl = $exportService->startExport($conn, $run, $this->forceFull);
            $run->update(['export_url' => $pollingUrl]);

            // ── Step 2: Poll until complete ─────────────────────────────────
            $manifest = $this->pollUntilComplete($exportService, $conn, $pollingUrl);

            // Parse resource types from manifest
            $outputFiles = $manifest['output'] ?? [];
            $resourceTypes = array_unique(array_column($outputFiles, 'type'));
            $run->update([
                'status' => 'downloading',
                'resource_types' => array_values($resourceTypes),
            ]);

            // ── Step 3: Download NDJSON files ───────────────────────────────
            $filesByType = $exportService->downloadNdjsonFiles($conn, $run, $manifest);

            $dedup = app(FhirDedupService::class);

            if (empty($filesByType)) {
                // No `output`, but a `deleted` manifest may still be present
                // (e.g. an incremental export with only soft-deletes).
                $deletionTally = $this->processBulkDeletions($conn, $run, $manifest, $dedup);

                $run->update([
                    'status' => 'completed',
                    'finished_at' => now(),
                ]);
                $this->updateConnectionStatus($conn, $run, 'completed', 0);

                Log::info("FHIR sync completed (no data) for {$conn->site_key}", [
                    'bulk_deletions' => $deletionTally,
                ]);

                return;
            }

            // ── Step 4: Process NDJSON → OMOP CDM ───────────────────────────
            $run->update(['status' => 'processing']);

            $stats = $processor->processFiles($run, $filesByType, $conn->site_key, $isIncremental);

            // ── Step 4b: Process Bulk Data `deleted` manifest ───────────────
            // Resources the source flagged as deleted/erroneous (FHIR Bulk Data
            // `deleted` sibling of `output`). Soft-deletes their mapped CDM rows.
            $deletionTally = $this->processBulkDeletions($conn, $run, $manifest, $dedup);

            // ── Step 5: Finalize ────────────────────────────────────────────
            $run->update([
                'status' => 'completed',
                'finished_at' => now(),
            ]);

            $totalRecords = $stats['written'];
            $this->updateConnectionStatus($conn, $run, 'completed', $totalRecords);

            // Cleanup downloaded files
            $exportService->cleanupFiles($conn, $run);

            Log::info("FHIR sync completed for {$conn->site_key}", [
                'run_id' => $run->id,
                'extracted' => $stats['extracted'],
                'written' => $stats['written'],
                'failed' => $stats['failed'],
                'deleted' => $stats['deleted'],
                'entered_in_error' => $stats['entered_in_error'],
                'bulk_deletions' => $deletionTally,
            ]);
        } catch (\Throwable $e) {
            Log::error("FHIR sync failed for {$conn->site_key}: {$e->getMessage()}", [
                'run_id' => $run->id,
                'exception' => $e,
            ]);

            $run->update([
                'status' => 'failed',
                'error_message' => substr($e->getMessage(), 0, 2000),
                'finished_at' => now(),
            ]);

            $this->updateConnectionStatus($conn, $run, 'failed', 0);

            throw $e;
        }
    }

    /**
     * Poll the export status URL with exponential backoff until completion or timeout.
     */
    private function pollUntilComplete(
        FhirBulkExportService $exportService,
        FhirConnection $conn,
        string $pollingUrl,
    ): array {
        $startTime = time();
        $interval = self::INITIAL_POLL_INTERVAL;

        while (true) {
            $elapsed = time() - $startTime;
            if ($elapsed > self::MAX_POLL_SECONDS) {
                throw new \RuntimeException(
                    'FHIR bulk export timed out after '.round($elapsed / 60).' minutes'
                );
            }

            sleep($interval);

            $manifest = $exportService->pollExportStatus($conn, $pollingUrl);

            if ($manifest !== null) {
                return $manifest;
            }

            // Exponential backoff: 10s → 15s → 22s → 33s → ... → max 120s
            $interval = min((int) ($interval * 1.5), self::MAX_POLL_INTERVAL);
        }
    }

    /**
     * Process the FHIR Bulk Data `deleted` manifest: download each deleted-Bundle
     * NDJSON file, parse every transaction Bundle entry whose
     * `request.method === 'DELETE'`, and soft-delete the mapped CDM row via
     * FhirDedupService::deleteByResource.
     *
     * Per-file fetch errors and unresolved resources are tallied, never fatal.
     *
     * @param  array<string, mixed>  $manifest
     * @return array{files: int, processed: int, deleted: int, unresolved: int}
     */
    public function processBulkDeletions(
        FhirConnection $conn,
        FhirSyncRun $run,
        array $manifest,
        FhirDedupService $dedup,
    ): array {
        $tally = ['files' => 0, 'processed' => 0, 'deleted' => 0, 'unresolved' => 0];

        $deletedManifest = $manifest['deleted'] ?? [];
        if (! is_array($deletedManifest) || $deletedManifest === []) {
            return $tally;
        }

        $exportService = app(FhirBulkExportService::class);
        $files = $exportService->downloadDeletedFiles($conn, $run, $manifest);

        foreach ($files as $filePath) {
            $tally['files']++;

            $handle = @fopen($filePath, 'r');
            if ($handle === false) {
                Log::error("Cannot open FHIR deleted manifest file: {$filePath}");

                continue;
            }

            while (($line = fgets($handle)) !== false) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }

                $bundle = json_decode($line, true);
                if (json_last_error() !== JSON_ERROR_NONE || ! is_array($bundle)) {
                    Log::warning('Invalid JSON in FHIR deleted manifest line', ['file' => $filePath]);

                    continue;
                }

                foreach (($bundle['entry'] ?? []) as $entry) {
                    if (! is_array($entry)) {
                        continue;
                    }
                    $request = $entry['request'] ?? [];
                    if (! is_array($request) || ($request['method'] ?? null) !== 'DELETE') {
                        continue;
                    }

                    $relativeUrl = (string) ($request['url'] ?? '');
                    if (! str_contains($relativeUrl, '/')) {
                        continue;
                    }

                    [$type, $id] = explode('/', $relativeUrl, 2);
                    if ($type === '' || $id === '') {
                        continue;
                    }

                    $tally['processed']++;
                    $result = $dedup->deleteByResource($conn->site_key, $type, $id, 'bulk-deleted');

                    if ($result['deleted']) {
                        $tally['deleted']++;
                    } else {
                        $tally['unresolved']++;
                    }
                }
            }

            fclose($handle);
        }

        Log::info('FHIR bulk deletions processed', [
            'connection' => $conn->site_key,
            'run_id' => $run->id,
            'tally' => $tally,
        ]);

        return $tally;
    }

    /**
     * Update the parent FhirConnection with the latest sync status.
     */
    private function updateConnectionStatus(
        FhirConnection $conn,
        FhirSyncRun $run,
        string $status,
        int $recordCount,
    ): void {
        $conn->update([
            'last_sync_at' => $run->started_at,
            'last_sync_status' => $status,
            'last_sync_records' => $recordCount,
        ]);
    }
}
