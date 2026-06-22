<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Concerns\SourceAware;
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
    use SourceAware;

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
            $this->cdm()
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
     * Soft-delete a FHIR resource: remove its mapped CDM row (OMOP is
     * append-only, so "soft-delete" means physically removing the erroneous
     * clinical row) and stamp the tracking row with an audit trail.
     *
     * Queries fhir_dedup_tracking DIRECTLY — the bulk-deleted / entered-in-error
     * paths run with no warm cache, so this never relies on $this->cache.
     *
     * cdm_row_id caveat: batch inserts record cdm_row_id = 0 (placeholder); only
     * person/visit and the row-by-row fallback capture a real id. A placeholder
     * row cannot be pinpointed for deletion, so it is stamped for audit but
     * reported as unresolved (deleted=false) — never throws.
     *
     * @return array{resolved: bool, deleted: bool, cdm_table: string|null, cdm_row_id?: int, reason: string}
     */
    public function deleteByResource(
        string $siteKey,
        string $resourceType,
        string $resourceId,
        string $reason,
    ): array {
        $row = DB::table('fhir_dedup_tracking')
            ->where('site_key', $siteKey)
            ->where('fhir_resource_type', $resourceType)
            ->where('fhir_resource_id', $resourceId)
            ->first();

        if (! $row) {
            return [
                'resolved' => false,
                'deleted' => false,
                'cdm_table' => null,
                'reason' => $reason,
            ];
        }

        $cacheKey = "{$siteKey}|{$resourceType}|{$resourceId}";
        $cdmRowId = (int) $row->cdm_row_id;
        $alreadyDeleted = ($row->deleted_at ?? null) !== null;

        // Placeholder row id (batch insert) — cannot pinpoint the CDM row.
        if ($cdmRowId === 0) {
            $this->stampDeleted($siteKey, $resourceType, $resourceId, $reason);
            unset($this->cache[$cacheKey]);

            Log::warning('FHIR soft-delete: tracking row has placeholder cdm_row_id=0, cannot pinpoint CDM row', [
                'site_key' => $siteKey,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'cdm_table' => $row->cdm_table,
                'reason' => $reason,
            ]);

            return [
                'resolved' => false,
                'deleted' => false,
                'cdm_table' => $row->cdm_table,
                'cdm_row_id' => 0,
                'reason' => $reason,
            ];
        }

        $deleted = false;

        if (! $alreadyDeleted) {
            $pkColumn = $this->getPrimaryKeyColumn($row->cdm_table);

            try {
                $this->cdm()
                    ->table($row->cdm_table)
                    ->where($pkColumn, $cdmRowId)
                    ->delete();
                $deleted = true;
            } catch (\Exception $e) {
                Log::warning('FHIR soft-delete: failed to delete CDM row', [
                    'site_key' => $siteKey,
                    'resource_type' => $resourceType,
                    'resource_id' => $resourceId,
                    'cdm_table' => $row->cdm_table,
                    'cdm_row_id' => $cdmRowId,
                    'reason' => $reason,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->stampDeleted($siteKey, $resourceType, $resourceId, $reason);
        unset($this->cache[$cacheKey]);

        return [
            'resolved' => true,
            'deleted' => $deleted,
            'cdm_table' => $row->cdm_table,
            'cdm_row_id' => $cdmRowId,
            'reason' => $reason,
        ];
    }

    /**
     * Stamp deleted_at / deleted_reason on a tracking row (audit trail).
     */
    private function stampDeleted(string $siteKey, string $resourceType, string $resourceId, string $reason): void
    {
        DB::table('fhir_dedup_tracking')
            ->where('site_key', $siteKey)
            ->where('fhir_resource_type', $resourceType)
            ->where('fhir_resource_id', $resourceId)
            ->update([
                'deleted_at' => now(),
                'deleted_reason' => substr($reason, 0, 250),
                'updated_at' => now(),
            ]);
    }

    /**
     * True when a FHIR resource is marked entered-in-error and must be removed.
     *
     * Covers the three shapes Medgnosis parity requires:
     *   - top-level `status === 'entered-in-error'` (Observation, MedicationRequest, …)
     *   - Condition.verificationStatus.coding[*].code === 'entered-in-error'
     *   - AllergyIntolerance.verificationStatus.coding[*].code === 'entered-in-error'
     *
     * Static + pure: the processor already depends on FhirDedupService, so no
     * new class/dependency is needed, and unit tests can exercise it without
     * any DB or SourceContext setup.
     *
     * @param  array<string, mixed>  $resource
     */
    public static function isEnteredInError(array $resource): bool
    {
        if (($resource['status'] ?? null) === 'entered-in-error') {
            return true;
        }

        $verification = $resource['verificationStatus'] ?? null;
        if (is_array($verification)) {
            $codings = $verification['coding'] ?? [];
            if (is_array($codings)) {
                foreach ($codings as $coding) {
                    if (is_array($coding) && ($coding['code'] ?? null) === 'entered-in-error') {
                        return true;
                    }
                }
            }
        }

        return false;
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
            'visit_detail' => 'visit_detail_id',
            'condition_occurrence' => 'condition_occurrence_id',
            'drug_exposure' => 'drug_exposure_id',
            'procedure_occurrence' => 'procedure_occurrence_id',
            'measurement' => 'measurement_id',
            'observation' => 'observation_id',
            'device_exposure' => 'device_exposure_id',
            'specimen' => 'specimen_id',
            'note' => 'note_id',
            'death' => 'person_id',
            'payer_plan_period' => 'payer_plan_period_id',
            'location' => 'location_id',
            'care_site' => 'care_site_id',
            'provider' => 'provider_id',
            'care_plan' => 'care_plan_id',
            'care_goal' => 'care_goal_id',
            'care_team' => 'care_team_id',
            'care_team_member' => 'care_team_member_id',
            default => 'id',
        };
    }
}
