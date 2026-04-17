<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Phase 14 (D-09, D-11, D-12, D-13 per
 * .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 *
 * Provisions {source}_gwas_results.summary_stats for a given CDM source.
 * Called by `php artisan finngen:prepare-source-variants` (D-12 — no lazy
 * creation at dispatch time).
 *
 * Index shape deviation from CONTEXT.md D-11:
 *   D-11 originally specified BRIN (chrom, pos).
 *   Per RESEARCH.md Pitfall 2, interleaved inserts from concurrent runs
 *   degrade pure (chrom, pos) BRIN. This phase ships BRIN
 *   (gwas_run_id, chrom, pos) composite — Manhattan queries are always
 *   scoped by gwas_run_id anyway, so the composite still satisfies
 *   GENOMICS-02 Success Criterion #4.
 *   Orchestrator auto-approved this deviation on 2026-04-17.
 *
 * Three-tier HIGHSEC grants (Pitfall 6):
 *   parthenon_app          — DML (PHP controller reads + writes)
 *   parthenon_finngen_rw   — DML (R worker writes summary_stats via COPY)
 *   parthenon_finngen_ro   — SELECT (Phase 16 read-only API)
 *
 * Threat T-14-11 (SQL injection on source_key): the regex allow-list below
 * throws InvalidArgumentException BEFORE any interpolation. Wave 0 Pest
 * test `it('rejects unsafe source_key values')` gates this.
 */
final class GwasSchemaProvisioner
{
    private const SAFE_SOURCE_REGEX = '/^[a-z][a-z0-9_]*$/';

    public function provision(string $sourceKey): void
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "GwasSchemaProvisioner: unsafe source_key '{$sourceKey}' "
                .'(expected /^[a-z][a-z0-9_]*$/ after lowercase).'
            );
        }

        $schema = "{$normalized}_gwas_results";

        DB::transaction(function () use ($schema) {
            DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema} AUTHORIZATION parthenon_migrator");

            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.summary_stats (
                    chrom                VARCHAR(4)       NOT NULL,
                    pos                  BIGINT           NOT NULL,
                    ref                  TEXT             NOT NULL,
                    alt                  TEXT             NOT NULL,
                    snp_id               TEXT             NULL,
                    af                   REAL             NULL,
                    beta                 REAL             NULL,
                    se                   REAL             NULL,
                    p_value              DOUBLE PRECISION NULL,
                    case_n               INTEGER          NULL,
                    control_n            INTEGER          NULL,
                    cohort_definition_id BIGINT           NOT NULL,
                    gwas_run_id          VARCHAR(26)      NOT NULL
                )
            ");

            DB::statement("
                COMMENT ON TABLE {$schema}.summary_stats IS
                'Phase 14 GENOMICS-02 per-source GWAS summary statistics. BRIN is (gwas_run_id, chrom, pos) composite per Pitfall 2 — Manhattan queries are always scoped by gwas_run_id so the composite satisfies the (chrom, pos) range-scan requirement without degrading on interleaved concurrent inserts.'
            ");

            DB::statement("
                CREATE INDEX IF NOT EXISTS summary_stats_run_chrom_pos_brin
                ON {$schema}.summary_stats
                USING BRIN (gwas_run_id, chrom, pos)
            ");

            DB::statement("
                CREATE INDEX IF NOT EXISTS summary_stats_cohort_p_btree
                ON {$schema}.summary_stats (cohort_definition_id, p_value)
            ");

            DB::statement("
                DO \$grants\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.summary_stats TO parthenon_app;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_rw;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.summary_stats TO parthenon_finngen_rw;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_ro;
                        GRANT SELECT ON {$schema}.summary_stats TO parthenon_finngen_ro;
                    END IF;
                END
                \$grants\$
            ");
        });
    }
}
