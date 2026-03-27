<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Deduplication service for incremental FHIR syncs.
 *
 * Tracks which FHIR resources have been written to which CDM rows,
 * enabling skip-if-unchanged and delete-then-reinsert for updated resources.
 *
 * Strategy:
 *   1. Before writing a row, check if we've seen this (site, type, id) before
 *   2. Hash the mapped data — if identical, skip (no change)
 *   3. If changed, delete the old CDM row and insert the new one
 *   4. Track the new CDM row ID
 */
class FhirDedupService
{
    /** @var array<string, array{cdm_table: string, cdm_row_id: int, content_hash: string}> */
    private array $cache = [];

    private bool $enabled = true;

    /**
     * Pre-load tracking data for a site into memory for fast lookups.
     */
    public function warmCache(string $siteKey): void
    {
        $rows = DB::table('fhir_dedup_tracking')
            ->where('site_key', $siteKey)
            ->select('fhir_resource_type', 'fhir_resource_id', 'cdm_table', 'cdm_row_id', 'content_hash')
            ->get();

        foreach ($rows as $row) {
            $key = "{$siteKey}|{$row->fhir_resource_type}|{$row->fhir_resource_id}";
            $this->cache[$key] = [
                'cdm_table' => $row->cdm_table,
                'cdm_row_id' => (int) $row->cdm_row_id,
                'content_hash' => $row->content_hash,
            ];
        }

        Log::debug("FHIR dedup cache warmed for {$siteKey}", [
            'entries' => count($rows),
        ]);
    }

    /**
     * Check if a resource has changed since last sync.
     *
     * Returns:
     *   - 'new'       → resource not seen before, insert normally
     *   - 'unchanged' → same content hash, skip
     *   - 'changed'   → different content, delete old and reinsert
     */
    public function checkStatus(
        string $siteKey,
        string $resourceType,
        string $resourceId,
        array $mappedData,
    ): string {
        if (! $this->enabled) {
            return 'new';
        }

        $key = "{$siteKey}|{$resourceType}|{$resourceId}";
        $hash = $this->hashData($mappedData);

        $existing = $this->cache[$key] ?? null;

        if ($existing === null) {
            // Check DB as fallback (shouldn't happen after warmCache, but be safe)
            $row = DB::table('fhir_dedup_tracking')
                ->where('site_key', $siteKey)
                ->where('fhir_resource_type', $resourceType)
                ->where('fhir_resource_id', $resourceId)
                ->first();

            if (! $row) {
                return 'new';
            }

            $existing = [
                'cdm_table' => $row->cdm_table,
                'cdm_row_id' => (int) $row->cdm_row_id,
                'content_hash' => $row->content_hash,
            ];
            $this->cache[$key] = $existing;
        }

        return $existing['content_hash'] === $hash ? 'unchanged' : 'changed';
    }

    /**
     * Delete the previously-written CDM row for a resource that has changed.
     */
    public function deleteOldRow(string $siteKey, string $resourceType, string $resourceId): void
    {
        $key = "{$siteKey}|{$resourceType}|{$resourceId}";
        $existing = $this->cache[$key] ?? null;

        if (! $existing) {
            return;
        }

        $pkColumn = $this->getPrimaryKeyColumn($existing['cdm_table']);

        try {
            DB::connection('omop')
                ->table($existing['cdm_table'])
                ->where($pkColumn, $existing['cdm_row_id'])
                ->delete();
        } catch (\Exception $e) {
            Log::warning('Failed to delete old CDM row for dedup', [
                'table' => $existing['cdm_table'],
                'row_id' => $existing['cdm_row_id'],
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Record that a FHIR resource was written to a CDM row.
     */
    public function track(
        string $siteKey,
        string $resourceType,
        string $resourceId,
        string $cdmTable,
        int $cdmRowId,
        array $mappedData,
    ): void {
        if (! $this->enabled) {
            return;
        }

        $hash = $this->hashData($mappedData);
        $now = now();

        DB::table('fhir_dedup_tracking')->upsert(
            [
                'site_key' => $siteKey,
                'fhir_resource_type' => $resourceType,
                'fhir_resource_id' => $resourceId,
                'cdm_table' => $cdmTable,
                'cdm_row_id' => $cdmRowId,
                'content_hash' => $hash,
                'last_synced_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            ['site_key', 'fhir_resource_type', 'fhir_resource_id'],
            ['cdm_table', 'cdm_row_id', 'content_hash', 'last_synced_at', 'updated_at'],
        );

        $key = "{$siteKey}|{$resourceType}|{$resourceId}";
        $this->cache[$key] = [
            'cdm_table' => $cdmTable,
            'cdm_row_id' => $cdmRowId,
            'content_hash' => $hash,
        ];
    }

    /**
     * Batch-track multiple rows at once (more efficient than one-by-one).
     *
     * @param  list<array{site_key: string, resource_type: string, resource_id: string, cdm_table: string, cdm_row_id: int, data: array}>  $records
     */
    public function trackBatch(array $records): void
    {
        if (! $this->enabled || empty($records)) {
            return;
        }

        $now = now();
        $rows = [];

        foreach ($records as $rec) {
            $hash = $this->hashData($rec['data']);
            $rows[] = [
                'site_key' => $rec['site_key'],
                'fhir_resource_type' => $rec['resource_type'],
                'fhir_resource_id' => $rec['resource_id'],
                'cdm_table' => $rec['cdm_table'],
                'cdm_row_id' => $rec['cdm_row_id'],
                'content_hash' => $hash,
                'last_synced_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // Update local cache
            $key = "{$rec['site_key']}|{$rec['resource_type']}|{$rec['resource_id']}";
            $this->cache[$key] = [
                'cdm_table' => $rec['cdm_table'],
                'cdm_row_id' => $rec['cdm_row_id'],
                'content_hash' => $hash,
            ];
        }

        // Upsert in chunks of 500
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('fhir_dedup_tracking')->upsert(
                $chunk,
                ['site_key', 'fhir_resource_type', 'fhir_resource_id'],
                ['cdm_table', 'cdm_row_id', 'content_hash', 'last_synced_at', 'updated_at'],
            );
        }
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function clearCache(): void
    {
        $this->cache = [];
    }

    /**
     * Get dedup stats for a site.
     */
    public function getStats(string $siteKey): array
    {
        return [
            'tracked_resources' => DB::table('fhir_dedup_tracking')
                ->where('site_key', $siteKey)
                ->count(),
            'cache_size' => count($this->cache),
        ];
    }

    private function hashData(array $data): string
    {
        // Sort keys for deterministic hashing
        ksort($data);

        return hash('sha256', json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    private function getPrimaryKeyColumn(string $cdmTable): string
    {
        return match ($cdmTable) {
            'person' => 'person_id',
            'visit_occurrence' => 'visit_occurrence_id',
            'condition_occurrence' => 'condition_occurrence_id',
            'drug_exposure' => 'drug_exposure_id',
            'procedure_occurrence' => 'procedure_occurrence_id',
            'measurement' => 'measurement_id',
            'observation' => 'observation_id',
            'device_exposure' => 'device_exposure_id',
            'specimen' => 'specimen_id',
            default => 'id',
        };
    }
}
