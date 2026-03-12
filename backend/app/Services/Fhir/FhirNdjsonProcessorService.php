<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Models\App\FhirSyncRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Processes NDJSON files from FHIR Bulk Export into OMOP CDM tables.
 *
 * Uses a two-pass strategy:
 *   Pass 1: Patient + Encounter resources → populate crosswalk tables + person/visit_occurrence
 *   Pass 2: All clinical resources → use crosswalks for person_id/visit_occurrence_id resolution
 *
 * This ensures referential integrity: clinical records always have valid person_id and
 * visit_occurrence_id references.
 */
class FhirNdjsonProcessorService
{
    private const BATCH_SIZE = 500;

    /** Resource types that must be processed first (order matters). */
    private const PASS_1_TYPES = ['Patient', 'Encounter'];

    private bool $incrementalMode = false;

    private string $siteKey = '';

    public function __construct(
        private readonly FhirBulkMapper $mapper,
        private readonly VocabularyLookupService $vocab,
        private readonly CrosswalkService $crosswalk,
        private readonly FhirDedupService $dedup,
    ) {}

    /**
     * Process downloaded NDJSON files: parse, map to OMOP CDM, and write.
     *
     * @param  array<string, string[]>  $filesByType  Resource type => array of local file paths
     * @return array{extracted: int, mapped: int, written: int, failed: int, skipped: int, updated: int, by_table: array<string, int>}
     */
    public function processFiles(FhirSyncRun $run, array $filesByType, string $siteKey, bool $incremental = false): array
    {
        $this->incrementalMode = $incremental;
        $this->siteKey = $siteKey;

        // Warm dedup cache for incremental syncs
        if ($incremental) {
            $this->dedup->warmCache($siteKey);
            Log::info('FHIR incremental mode enabled, dedup cache warmed', [
                'run_id' => $run->id,
                'stats' => $this->dedup->getStats($siteKey),
            ]);
        }

        $stats = [
            'extracted' => 0,
            'mapped' => 0,
            'written' => 0,
            'failed' => 0,
            'skipped' => 0,
            'updated' => 0,
            'by_table' => [],
        ];

        // ── Pass 1: Process Patient + Encounter files first ─────────────
        foreach (self::PASS_1_TYPES as $type) {
            if (! isset($filesByType[$type])) {
                continue;
            }

            $buffers = [];
            foreach ($filesByType[$type] as $filePath) {
                $this->processFile($filePath, $siteKey, $buffers, $stats);
            }
            $this->flushAllBuffers($buffers, $stats);
        }

        Log::info('FHIR Pass 1 complete: crosswalks populated', [
            'run_id' => $run->id,
            'extracted' => $stats['extracted'],
            'written' => $stats['written'],
        ]);

        // ── Pass 2: Process all other resource types ────────────────────
        $buffers = [];
        foreach ($filesByType as $type => $filePaths) {
            if (in_array($type, self::PASS_1_TYPES, true)) {
                continue; // Already processed
            }

            foreach ($filePaths as $filePath) {
                $this->processFile($filePath, $siteKey, $buffers, $stats);
            }
        }
        $this->flushAllBuffers($buffers, $stats);

        // Calculate mapping coverage
        $run->update([
            'records_extracted' => $stats['extracted'],
            'records_mapped' => $stats['mapped'],
            'records_written' => $stats['written'],
            'records_failed' => $stats['failed'],
            'mapping_coverage' => $stats['extracted'] > 0
                ? round(($stats['mapped'] / $stats['extracted']) * 100, 2)
                : null,
        ]);

        Log::info('FHIR NDJSON processing complete', [
            'run_id' => $run->id,
            'incremental' => $this->incrementalMode,
            'extracted' => $stats['extracted'],
            'mapped' => $stats['mapped'],
            'written' => $stats['written'],
            'skipped' => $stats['skipped'],
            'updated' => $stats['updated'],
            'failed' => $stats['failed'],
            'by_table' => $stats['by_table'],
            'vocab_cache' => $this->vocab->getCacheStats(),
            'dedup_stats' => $this->incrementalMode ? $this->dedup->getStats($this->siteKey) : null,
        ]);

        return $stats;
    }

    /**
     * Process a single NDJSON file line by line.
     *
     * @param  array<string, list<array<string, mixed>>>  &$buffers
     * @param  array{extracted: int, mapped: int, written: int, failed: int, by_table: array<string, int>}  &$stats
     */
    private function processFile(
        string $filePath,
        string $siteKey,
        array &$buffers,
        array &$stats,
    ): void {
        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            Log::error("Cannot open NDJSON file: {$filePath}");

            return;
        }

        $lineNum = 0;

        while (($line = fgets($handle)) !== false) {
            $lineNum++;
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $resource = json_decode($line, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::warning("Invalid JSON at line {$lineNum} in {$filePath}");
                $stats['failed']++;

                continue;
            }

            $stats['extracted']++;

            // Map FHIR resource to OMOP CDM row(s)
            $mappedRows = $this->mapper->mapResource($resource, $siteKey);
            if ($mappedRows === []) {
                continue;
            }

            // Process each mapped row (typically one, but some resources produce multiple)
            foreach ($mappedRows as $mapped) {
            $cdmTable = $mapped['cdm_table'];
            $data = $mapped['data'];
            $fhirType = $mapped['fhir_resource_type'] ?? '';
            $fhirId = $mapped['fhir_resource_id'] ?? '';

            // Track whether this resource got a meaningful concept mapping
            if ($this->hasMappedConcept($data)) {
                $stats['mapped']++;
            }

            // Incremental dedup check
            if ($this->incrementalMode && $fhirId !== '') {
                $dedupStatus = $this->dedup->checkStatus($siteKey, $fhirType, $fhirId, $data);

                if ($dedupStatus === 'unchanged') {
                    $stats['skipped']++;

                    continue;
                }

                if ($dedupStatus === 'changed') {
                    $this->dedup->deleteOldRow($siteKey, $fhirType, $fhirId);
                    $stats['updated']++;
                }
            }

            // Add to buffer with FHIR metadata for tracking
            $buffers[$cdmTable] = $buffers[$cdmTable] ?? [];
            $buffers[$cdmTable][] = [
                'data' => $data,
                'fhir_type' => $fhirType,
                'fhir_id' => $fhirId,
            ];

            // Flush if buffer is full
            if (count($buffers[$cdmTable]) >= self::BATCH_SIZE) {
                $written = $this->flushBuffer($cdmTable, $buffers[$cdmTable]);
                $stats['written'] += $written;
                $stats['failed'] += count($buffers[$cdmTable]) - $written;
                $stats['by_table'][$cdmTable] = ($stats['by_table'][$cdmTable] ?? 0) + $written;
                $buffers[$cdmTable] = [];
            }
            } // end foreach mappedRows
        }

        fclose($handle);
    }

    /**
     * Check if a mapped row has at least one non-zero concept_id (excluding type concepts).
     */
    private function hasMappedConcept(array $data): bool
    {
        foreach ($data as $key => $value) {
            if (str_ends_with($key, '_concept_id')
                && ! str_ends_with($key, '_type_concept_id')
                && ! str_ends_with($key, '_source_concept_id')
                && is_int($value)
                && $value > 0
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Flush all remaining buffers.
     */
    private function flushAllBuffers(array &$buffers, array &$stats): void
    {
        foreach ($buffers as $table => $rows) {
            if (! empty($rows)) {
                $written = $this->flushBuffer($table, $rows);
                $stats['written'] += $written;
                $stats['failed'] += count($rows) - $written;
                $stats['by_table'][$table] = ($stats['by_table'][$table] ?? 0) + $written;
            }
        }
        $buffers = [];
    }

    /**
     * Flush a batch of buffered entries to the CDM database. Returns the number successfully written.
     *
     * Each entry is: {data: array, fhir_type: string, fhir_id: string}
     *
     * @param  list<array{data: array<string, mixed>, fhir_type: string, fhir_id: string}>  $entries
     */
    private function flushBuffer(string $table, array $entries): int
    {
        if (empty($entries)) {
            return 0;
        }

        $dataRows = array_column($entries, 'data');

        try {
            DB::connection('cdm')->table($table)->insert($dataRows);
            $written = count($dataRows);

            // Track for dedup if incremental mode
            if ($this->incrementalMode) {
                $this->trackWrittenRows($table, $entries);
            }

            return $written;
        } catch (\Exception $e) {
            Log::error("FHIR CDM write error for table {$table}: {$e->getMessage()}", [
                'table' => $table,
                'row_count' => count($dataRows),
            ]);

            // Try row-by-row fallback
            return $this->insertRowByRow($table, $entries);
        }
    }

    /**
     * Fallback: insert rows one at a time, skipping failures.
     *
     * @param  list<array{data: array<string, mixed>, fhir_type: string, fhir_id: string}>  $entries
     */
    private function insertRowByRow(string $table, array $entries): int
    {
        $written = 0;

        foreach ($entries as $entry) {
            try {
                $id = DB::connection('cdm')->table($table)->insertGetId($entry['data']);
                $written++;

                if ($this->incrementalMode && $entry['fhir_id'] !== '') {
                    $this->dedup->track(
                        $this->siteKey,
                        $entry['fhir_type'],
                        $entry['fhir_id'],
                        $table,
                        (int) $id,
                        $entry['data'],
                    );
                }
            } catch (\Exception $e) {
                Log::debug("Skipped bad row in {$table}: {$e->getMessage()}");
            }
        }

        return $written;
    }

    /**
     * Track successfully written rows for dedup.
     *
     * For batch inserts we don't have individual row IDs, so we use 0 as placeholder.
     * The content_hash is what matters for skip-if-unchanged detection.
     *
     * @param  list<array{data: array<string, mixed>, fhir_type: string, fhir_id: string}>  $entries
     */
    private function trackWrittenRows(string $table, array $entries): void
    {
        $records = [];

        foreach ($entries as $entry) {
            if ($entry['fhir_id'] === '') {
                continue;
            }

            // For person/visit tables, the PK is in the data itself
            $pkColumn = match ($table) {
                'person' => 'person_id',
                'visit_occurrence' => 'visit_occurrence_id',
                default => null,
            };
            $rowId = $pkColumn ? ($entry['data'][$pkColumn] ?? 0) : 0;

            $records[] = [
                'site_key' => $this->siteKey,
                'resource_type' => $entry['fhir_type'],
                'resource_id' => $entry['fhir_id'],
                'cdm_table' => $table,
                'cdm_row_id' => (int) $rowId,
                'data' => $entry['data'],
            ];
        }

        if (! empty($records)) {
            $this->dedup->trackBatch($records);
        }
    }
}
