<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\BundleOverlapRule;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Pure-SQL nightly refresh service for care gap materialized tables.
 *
 * Replaces the PHP-loop approach in CareGapService with three SQL UPSERT
 * operations per bundle:
 *   A) care_gap_patient_bundles  — denominator enrollment (1 query)
 *   B) care_gap_patient_measures — per-patient measure compliance (1 query/measure)
 *   C) care_gap_snapshots        — aggregate summary (1 query)
 *
 * Performance target: < 2 min for 1M patients × 10 bundles × 40 measures
 * with CDM indexes in place.
 */
class CareGapRefreshService
{
    /**
     * Refresh all active bundles for a single source.
     *
     * @return array{bundles: int, patients_total: int, duration_ms: int}
     */
    public function refreshSource(Source $source): array
    {
        $started = hrtime(true);

        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if ($cdmSchema === null) {
            Log::warning('CareGapRefresh: source missing CDM daimon — skipping', [
                'source_id' => $source->id,
            ]);

            return ['bundles' => 0, 'patients_total' => 0, 'duration_ms' => 0];
        }

        $bundles = ConditionBundle::where('is_active', true)
            ->with('measures')
            ->get();

        $totalPatients = 0;

        foreach ($bundles as $bundle) {
            $count = $this->refreshBundle($source, $bundle, $cdmSchema);
            $totalPatients += $count;
        }

        $durationMs = (int) round((hrtime(true) - $started) / 1_000_000);

        Log::info('CareGapRefresh: source complete', [
            'source_id' => $source->id,
            'bundles' => $bundles->count(),
            'patients_total' => $totalPatients,
            'duration_ms' => $durationMs,
        ]);

        return [
            'bundles' => $bundles->count(),
            'patients_total' => $totalPatients,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * Refresh a single bundle for a source.
     * Runs Steps A → B → C inside a single DB transaction.
     *
     * @return int enrolled patient count
     */
    public function refreshBundle(Source $source, ConditionBundle $bundle, string $cdmSchema): int
    {
        $bundleStarted = hrtime(true);

        $connectionName = $source->source_connection ?? 'omop';
        $appConn = DB::connection();  // parthenon app DB

        try {
            DB::transaction(function () use (
                $source, $bundle, $cdmSchema, $connectionName, $appConn
            ) {
                // Step A: enroll patients into bundle denominator
                $this->upsertPatientBundles($source, $bundle, $cdmSchema, $connectionName, $appConn);

                // Step B: evaluate compliance per measure
                $bundle->load('measures');
                foreach ($bundle->measures as $measure) {
                    $this->upsertPatientMeasure($source, $bundle, $measure, $cdmSchema, $connectionName, $appConn);
                }

                // Apply overlap deduplication flags
                $this->applyDeduplicationFlags($source, $bundle, $appConn);
            });

        } catch (\Throwable $e) {
            Log::error('CareGapRefresh: bundle failed', [
                'source_id' => $source->id,
                'bundle_id' => $bundle->id,
                'bundle' => $bundle->bundle_code,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        $durationMs = (int) round((hrtime(true) - $bundleStarted) / 1_000_000);

        // Step C: aggregate snapshot — written after timing is captured
        $this->upsertSnapshot($source, $bundle, $durationMs, $appConn);

        Log::info('CareGapRefresh: bundle complete', [
            'source_id' => $source->id,
            'bundle' => $bundle->bundle_code,
            'duration_ms' => $durationMs,
        ]);

        // Return enrolled patient count from materialized table
        return (int) DB::table('care_gap_patient_bundles')
            ->where('source_id', $source->id)
            ->where('bundle_id', $bundle->id)
            ->count();
    }

    // ── Step A ─────────────────────────────────────────────────────────────────

    /**
     * Upsert patient bundle enrollment from CDM condition_occurrence.
     * Single INSERT...SELECT on the CDM — no PHP-side patient loading.
     */
    private function upsertPatientBundles(
        Source $source,
        ConditionBundle $bundle,
        string $cdmSchema,
        string $connectionName,
        Connection $appConn,
    ): void {
        $conceptIds = $bundle->omop_concept_ids ?? [];

        if (empty($conceptIds)) {
            Log::warning('CareGapRefresh: bundle has no concept IDs', [
                'bundle' => $bundle->bundle_code,
            ]);

            return;
        }

        $placeholders = implode(',', array_fill(0, count($conceptIds), '?'));

        // First, remove patients who no longer have qualifying conditions
        $appConn->table('care_gap_patient_bundles')
            ->where('source_id', $source->id)
            ->where('bundle_id', $bundle->id)
            ->whereNotIn('person_id', function ($q) use ($cdmSchema, $conceptIds) {
                // Subquery is on the CDM connection — use raw cross-DB reference
                // For same-server PostgreSQL: use schema-qualified name directly
                $q->select('person_id')
                    ->fromRaw("\"{$cdmSchema}\".condition_occurrence")
                    ->whereIn('condition_concept_id', $conceptIds)
                    ->distinct();
            })
            ->delete();

        // Now upsert all currently-eligible patients
        // We use raw SQL to do the INSERT...SELECT across schema boundaries
        $sql = "
            INSERT INTO care_gap_patient_bundles
                (source_id, bundle_id, person_id, enrolled_at, refreshed_at)
            SELECT
                ?,
                ?,
                co.person_id,
                MIN(co.condition_start_date),
                NOW()
            FROM \"{$cdmSchema}\".condition_occurrence co
            WHERE co.condition_concept_id IN ({$placeholders})
            GROUP BY co.person_id
            ON CONFLICT (source_id, bundle_id, person_id) DO UPDATE SET
                enrolled_at  = LEAST(EXCLUDED.enrolled_at, care_gap_patient_bundles.enrolled_at),
                refreshed_at = NOW()
        ";

        $bindings = array_merge([$source->id, $bundle->id], $conceptIds);
        $appConn->statement($sql, $bindings);
    }

    // ── Step B ─────────────────────────────────────────────────────────────────

    /**
     * Upsert per-patient compliance status for a single quality measure.
     * Single INSERT...SELECT joining CDM event table to enrolled patients.
     */
    private function upsertPatientMeasure(
        Source $source,
        ConditionBundle $bundle,
        QualityMeasure $measure,
        string $cdmSchema,
        string $connectionName,
        Connection $appConn,
    ): void {
        $numerator = $measure->numerator_criteria;

        if ($numerator === null || empty($numerator['concept_ids'] ?? [])) {
            // No numerator — mark all enrolled patients as open
            $sql = "
                INSERT INTO care_gap_patient_measures
                    (source_id, bundle_id, measure_id, person_id, status,
                     last_service_date, due_date, days_overdue, is_deduplicated, refreshed_at)
                SELECT
                    source_id, bundle_id, ?, person_id,
                    'open', NULL, NULL, NULL, FALSE, NOW()
                FROM care_gap_patient_bundles
                WHERE source_id = ? AND bundle_id = ?
                ON CONFLICT (source_id, measure_id, person_id) DO UPDATE SET
                    status            = 'open',
                    last_service_date = NULL,
                    due_date          = NULL,
                    days_overdue      = NULL,
                    refreshed_at      = NOW()
            ";
            $appConn->statement($sql, [$measure->id, $source->id, $bundle->id]);

            return;
        }

        $conceptIds = $numerator['concept_ids'];
        $lookbackDays = (int) ($numerator['lookback_days'] ?? 365);
        $tableName = $this->resolveTableName($measure->domain);
        $conceptCol = $this->resolveConceptColumn($measure->domain);
        $dateCol = $this->resolveDateColumn($measure->domain);
        $conceptPh = implode(',', array_fill(0, count($conceptIds), '?'));

        // days_overdue uses enrolled_at from care_gap_patient_bundles (already materialized)
        // — avoids a correlated subquery back into condition_occurrence
        $sql = "
            INSERT INTO care_gap_patient_measures
                (source_id, bundle_id, measure_id, person_id, status,
                 last_service_date, due_date, days_overdue, is_deduplicated, refreshed_at)
            SELECT
                cgpb.source_id,
                cgpb.bundle_id,
                ?,
                cgpb.person_id,
                CASE WHEN MAX(t.{$dateCol}) IS NOT NULL THEN 'met' ELSE 'open' END,
                MAX(t.{$dateCol}),
                CASE WHEN MAX(t.{$dateCol}) IS NOT NULL
                     THEN MAX(t.{$dateCol}) + INTERVAL '{$lookbackDays} days'
                     ELSE NULL END,
                CASE WHEN MAX(t.{$dateCol}) IS NULL
                     THEN GREATEST(0, CURRENT_DATE - cgpb.enrolled_at - {$lookbackDays})
                     ELSE 0 END,
                FALSE,
                NOW()
            FROM care_gap_patient_bundles cgpb
            LEFT JOIN \"{$cdmSchema}\".{$tableName} t
                ON  t.person_id         = cgpb.person_id
                AND t.{$conceptCol}     IN ({$conceptPh})
                AND t.{$dateCol}        >= CURRENT_DATE - INTERVAL '{$lookbackDays} days'
            WHERE cgpb.source_id = ?
              AND cgpb.bundle_id = ?
            GROUP BY cgpb.source_id, cgpb.bundle_id, cgpb.person_id, cgpb.enrolled_at
            ON CONFLICT (source_id, measure_id, person_id) DO UPDATE SET
                status            = EXCLUDED.status,
                last_service_date = EXCLUDED.last_service_date,
                due_date          = EXCLUDED.due_date,
                days_overdue      = EXCLUDED.days_overdue,
                is_deduplicated   = FALSE,
                refreshed_at      = NOW()
        ";

        $bindings = array_merge([$measure->id], $conceptIds, [$source->id, $bundle->id]);
        $appConn->statement($sql, $bindings);
    }

    // ── Overlap deduplication ──────────────────────────────────────────────────

    /**
     * Mark is_deduplicated=TRUE for measures that are overlap-deduplicated per
     * the bundle's BundleOverlapRule entries.
     */
    private function applyDeduplicationFlags(
        Source $source,
        ConditionBundle $bundle,
        Connection $appConn,
    ): void {
        // Reset all to false first
        $appConn->table('care_gap_patient_measures')
            ->where('source_id', $source->id)
            ->where('bundle_id', $bundle->id)
            ->update(['is_deduplicated' => false]);

        // The overlap map from CareGapService — which measure code is deduplicated per bundle
        $overlapMap = [
            'DEDUP_BP_CONTROL' => ['HTN' => 'HTN-01', 'DM' => 'DM-05', 'CAD' => 'CAD-03', 'HF' => 'HF-03'],
            'DEDUP_LIPID_MGMT' => ['DM' => 'DM-06', 'CAD' => 'CAD-02'],
            'DEDUP_RENAL' => ['DM' => 'DM-04', 'CKD' => 'CKD-01', 'HF' => 'HF-06'],
        ];

        $activeRules = BundleOverlapRule::where('is_active', true)->pluck('rule_code');

        foreach ($activeRules as $ruleCode) {
            $ruleMap = $overlapMap[$ruleCode] ?? [];
            $measureCode = $ruleMap[$bundle->bundle_code] ?? null;

            if ($measureCode === null) {
                continue;
            }

            // Find the measure_id for this code
            $measure = $bundle->measures->firstWhere('measure_code', $measureCode);
            if ($measure === null) {
                continue;
            }

            // Mark all patients' rows for this measure as deduplicated
            $appConn->table('care_gap_patient_measures')
                ->where('source_id', $source->id)
                ->where('bundle_id', $bundle->id)
                ->where('measure_id', $measure->id)
                ->update(['is_deduplicated' => true]);
        }
    }

    // ── Step C ─────────────────────────────────────────────────────────────────

    /**
     * Upsert today's aggregate snapshot for a bundle.
     */
    private function upsertSnapshot(
        Source $source,
        ConditionBundle $bundle,
        int $durationMs,
        Connection $appConn,
    ): void {
        // Single-pass aggregation over per-patient stats using a CTE.
        // Avoids the O(N²) self-join of the previous approach.
        $sql = "
            WITH per_patient AS (
                SELECT
                    person_id,
                    SUM(CASE WHEN status = 'met' THEN 1 ELSE 0 END)       AS met_count,
                    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)      AS open_count,
                    SUM(CASE WHEN status = 'excluded' THEN 1 ELSE 0 END)  AS excl_count,
                    COUNT(*)                                                AS total_count
                FROM care_gap_patient_measures
                WHERE source_id = ? AND bundle_id = ? AND NOT is_deduplicated
                GROUP BY person_id
            )
            INSERT INTO care_gap_snapshots
                (source_id, bundle_id, cohort_definition_id, snapshot_date,
                 person_count, measures_met, measures_open, measures_excluded,
                 compliance_pct, risk_high_count, risk_medium_count, risk_low_count,
                 etl_duration_ms, computed_at)
            SELECT
                ?,
                ?,
                NULL,
                CURRENT_DATE,
                COALESCE(COUNT(*), 0),
                COALESCE(SUM(met_count), 0),
                COALESCE(SUM(open_count), 0),
                COALESCE(SUM(excl_count), 0),
                COALESCE(ROUND(
                    SUM(met_count)::NUMERIC /
                    NULLIF(SUM(met_count + open_count), 0) * 100,
                2), 0),
                COALESCE(COUNT(*) FILTER (WHERE met_count = 0), 0),
                COALESCE(COUNT(*) FILTER (WHERE met_count > 0 AND met_count < total_count), 0),
                COALESCE(COUNT(*) FILTER (WHERE met_count = total_count AND total_count > 0), 0),
                ?,
                NOW()
            FROM per_patient
            ON CONFLICT (source_id, bundle_id, snapshot_date, cohort_definition_id) DO UPDATE SET
                person_count      = EXCLUDED.person_count,
                measures_met      = EXCLUDED.measures_met,
                measures_open     = EXCLUDED.measures_open,
                measures_excluded = EXCLUDED.measures_excluded,
                compliance_pct    = EXCLUDED.compliance_pct,
                risk_high_count   = EXCLUDED.risk_high_count,
                risk_medium_count = EXCLUDED.risk_medium_count,
                risk_low_count    = EXCLUDED.risk_low_count,
                etl_duration_ms   = EXCLUDED.etl_duration_ms,
                computed_at       = NOW()
        ";

        // CTE params: (source_id, bundle_id), then INSERT params: (source_id, bundle_id, etl_duration_ms)
        $appConn->statement($sql, [
            $source->id, $bundle->id,
            $source->id, $bundle->id,
            $durationMs,
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function resolveTableName(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement',
            'drug' => 'drug_exposure',
            'procedure' => 'procedure_occurrence',
            'condition' => 'condition_occurrence',
            'observation' => 'observation',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    private function resolveConceptColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_concept_id',
            'drug' => 'drug_concept_id',
            'procedure' => 'procedure_concept_id',
            'condition' => 'condition_concept_id',
            'observation' => 'observation_concept_id',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    private function resolveDateColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_date',
            'drug' => 'drug_exposure_start_date',
            'procedure' => 'procedure_date',
            'condition' => 'condition_start_date',
            'observation' => 'observation_date',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }
}
