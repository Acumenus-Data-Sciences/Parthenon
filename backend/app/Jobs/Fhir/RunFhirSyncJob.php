<?php

declare(strict_types=1);

namespace App\Jobs\Fhir;

use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Services\Fhir\FhirAuthService;
use App\Services\Fhir\FhirBulkExportService;
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
                'status'     => 'exporting',
                'started_at' => now(),
            ]);

            Log::info("FHIR sync started for {$conn->site_key}", ['run_id' => $run->id]);

            $pollingUrl = $exportService->startExport($conn, $run);
            $run->update(['export_url' => $pollingUrl]);

            // ── Step 2: Poll until complete ─────────────────────────────────
            $manifest = $this->pollUntilComplete($exportService, $conn, $pollingUrl);

            // Parse resource types from manifest
            $outputFiles = $manifest['output'] ?? [];
            $resourceTypes = array_unique(array_column($outputFiles, 'type'));
            $run->update([
                'status'         => 'downloading',
                'resource_types' => array_values($resourceTypes),
            ]);

            // ── Step 3: Download NDJSON files ───────────────────────────────
            $filesByType = $exportService->downloadNdjsonFiles($conn, $run, $manifest);

            if (empty($filesByType)) {
                $run->update([
                    'status'      => 'completed',
                    'finished_at' => now(),
                ]);
                $this->updateConnectionStatus($conn, $run, 'completed', 0);

                Log::info("FHIR sync completed (no data) for {$conn->site_key}");

                return;
            }

            // ── Step 4: Process NDJSON → OMOP CDM ───────────────────────────
            $run->update(['status' => 'processing']);

            $stats = $processor->processFiles($run, $filesByType, $conn->site_key);

            // ── Step 5: Finalize ────────────────────────────────────────────
            $run->update([
                'status'      => 'completed',
                'finished_at' => now(),
            ]);

            $totalRecords = $stats['written'];
            $this->updateConnectionStatus($conn, $run, 'completed', $totalRecords);

            // Cleanup downloaded files
            $exportService->cleanupFiles($conn, $run);

            Log::info("FHIR sync completed for {$conn->site_key}", [
                'run_id'    => $run->id,
                'extracted' => $stats['extracted'],
                'written'   => $stats['written'],
                'failed'    => $stats['failed'],
            ]);
        } catch (\Throwable $e) {
            Log::error("FHIR sync failed for {$conn->site_key}: {$e->getMessage()}", [
                'run_id'    => $run->id,
                'exception' => $e,
            ]);

            $run->update([
                'status'        => 'failed',
                'error_message' => substr($e->getMessage(), 0, 2000),
                'finished_at'   => now(),
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
                    "FHIR bulk export timed out after " . round($elapsed / 60) . " minutes"
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
     * Update the parent FhirConnection with the latest sync status.
     */
    private function updateConnectionStatus(
        FhirConnection $conn,
        FhirSyncRun $run,
        string $status,
        int $recordCount,
    ): void {
        $conn->update([
            'last_sync_at'      => $run->started_at,
            'last_sync_status'  => $status,
            'last_sync_records' => $recordCount,
        ]);
    }
}
