<?php

declare(strict_types=1);

namespace App\Observers\FinnGen;

use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\GwasRunService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Phase 15 (D-16, D-17) — backfill {@see EndpointGwasRun} tracking rows when
 * the associated {@see Run} transitions status.
 *
 * Observer contract:
 *   - Listens on Run::updated.
 *   - Early-return for non-GWAS analysis types (no-op on Phase 14 smoke-test
 *     Runs, endpoint-generate Runs, etc.).
 *   - Looks up the owning tracking row via run_id OR step1_run_id.
 *   - Backfills status / finished_at / case_n / control_n / top_hit_p_value.
 *
 * HIGHSEC posture (CLAUDE.md Gotcha #12 — transaction poisoning):
 *   Every DB operation is wrapped in try-catch. The observer NEVER re-throws.
 *   If a backfill fails, the tracking row stays at its prior state and the
 *   next status update retries. The Horizon job's Postgres transaction MUST
 *   NOT be poisoned by this observer.
 *
 * Cross-connection read (D-17):
 *   computeTopHitPValue() hits the per-source {source}_gwas_results.summary_stats
 *   table on the pgsql connection. The schema name is regex-allow-listed
 *   before interpolation (T-15-10 SQL injection mitigation).
 */
final class FinnGenGwasRunObserver
{
    /** @var array<int, string> */
    private const GWAS_ANALYSIS_TYPES = [
        GwasRunService::ANALYSIS_TYPE_STEP1,
        GwasRunService::ANALYSIS_TYPE_STEP2,
    ];

    public function updated(Run $run): void
    {
        if (! in_array($run->analysis_type, self::GWAS_ANALYSIS_TYPES, true)) {
            return;
        }

        try {
            /** @var EndpointGwasRun|null $tracking */
            $tracking = EndpointGwasRun::query()
                ->where('run_id', $run->id)
                ->orWhere('step1_run_id', $run->id)
                ->first();
        } catch (Throwable $e) {
            Log::warning('finngen.gwas_run_observer.lookup_failed', [
                'run_id' => $run->id,
                'analysis_type' => $run->analysis_type,
                'exception' => $e->getMessage(),
            ]);

            return;
        }

        if ($tracking === null) {
            return;
        }

        try {
            $this->backfillFrom($tracking, $run);
        } catch (Throwable $e) {
            Log::warning('finngen.gwas_run_observer.backfill_failed', [
                'run_id' => $run->id,
                'tracking_id' => $tracking->id,
                'analysis_type' => $run->analysis_type,
                'exception' => $e->getMessage(),
            ]);

            return;
        }
    }

    private function backfillFrom(EndpointGwasRun $tracking, Run $run): void
    {
        $isStep2 = $run->analysis_type === GwasRunService::ANALYSIS_TYPE_STEP2;
        $isStep1Failure = $run->analysis_type === GwasRunService::ANALYSIS_TYPE_STEP1
            && $run->status === Run::STATUS_FAILED;

        /** @var array<string, mixed> $attrs */
        $attrs = [];

        if ($isStep2) {
            $attrs['status'] = $run->status;

            if (in_array($run->status, Run::TERMINAL_STATUSES, true)) {
                $attrs['finished_at'] = $run->finished_at ?? now();
            }

            if (is_array($run->summary)) {
                if (isset($run->summary['case_n'])) {
                    $attrs['case_n'] = (int) $run->summary['case_n'];
                }
                if (isset($run->summary['control_n'])) {
                    $attrs['control_n'] = (int) $run->summary['control_n'];
                }
            }

            if ($run->status === Run::STATUS_SUCCEEDED) {
                $attrs['top_hit_p_value'] = $this->computeTopHitPValue(
                    (string) $tracking->source_key,
                    (string) $run->id,
                );
            }
        } elseif ($isStep1Failure) {
            $attrs['status'] = Run::STATUS_FAILED;
            $attrs['finished_at'] = $run->finished_at ?? now();
        }

        if ($attrs !== []) {
            $tracking->update($attrs);
        }
    }

    /**
     * D-16 top_hit_p_value rollup — bounded MIN(p_value) on the per-source summary_stats.
     *
     * Hits the existing (cohort_definition_id, p_value) BTREE on summary_stats — Index Scan.
     * Schema name is regex-allow-listed before interpolation (T-15-10).
     * Returns null (and logs warning) on any query failure.
     */
    private function computeTopHitPValue(string $sourceKey, string $gwasRunId): ?float
    {
        $schema = strtolower($sourceKey).'_gwas_results';

        // T-15-10: allow-list schema name before string interpolation.
        if (preg_match('/^[a-z][a-z0-9_]*$/', $schema) !== 1) {
            Log::warning('finngen.gwas_run_observer.schema_name_rejected', [
                'schema' => $schema,
                'source_key' => $sourceKey,
            ]);

            return null;
        }

        // CLAUDE.md Gotcha #12: PG transaction poisoning — if the MIN query fails
        // (e.g., {source}_gwas_results schema missing for a new source), the enclosing
        // PG transaction enters SQLSTATE 25P02 and ALL subsequent statements fail.
        // Wrap in a SAVEPOINT so a query error only rolls back THIS probe.
        $conn = DB::connection('pgsql');
        $conn->beginTransaction();
        try {
            $row = $conn->selectOne(
                sprintf('SELECT MIN(p_value) AS p FROM %s.summary_stats WHERE gwas_run_id = ?', $schema),
                [$gwasRunId],
            );
            $conn->commit();

            if ($row === null || $row->p === null) {
                return null;
            }

            return (float) $row->p;
        } catch (Throwable $e) {
            // Roll back the SAVEPOINT so the outer transaction stays alive.
            try {
                $conn->rollBack();
            } catch (Throwable) {
                // Best-effort; if the rollback itself fails we still don't re-throw.
            }
            Log::warning('finngen.gwas_run_observer.top_hit_query_failed', [
                'source_key' => $sourceKey,
                'gwas_run_id' => $gwasRunId,
                'exception' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
