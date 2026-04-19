<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Phase 14 (D-09, D-11, D-12, D-13 per
 * .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 * Phase 17 (D-09 per .planning/phases/17-pgs-prs/17-CONTEXT.md) — extended
 *   to also provision {source}_gwas_results.prs_subject_scores alongside
 *   summary_stats in the same transaction.
 *
 * Provisions the {source}_gwas_results schema + its two sibling tables
 * for a given CDM source:
 *   - summary_stats      (Phase 14 — regenie GWAS output)
 *   - prs_subject_scores (Phase 17 — plink2 --score PRS output)
 *
 * Called by `php artisan finngen:prepare-source-variants` (D-12 — no lazy
 * creation at dispatch time) and by test bootstrap / Plan 07 deploy runbook.
 *
 * Index shape deviation from CONTEXT.md D-11 (summary_stats):
 *   D-11 originally specified BRIN (chrom, pos).
 *   Per RESEARCH.md Pitfall 2, interleaved inserts from concurrent runs
 *   degrade pure (chrom, pos) BRIN. This phase ships BRIN
 *   (gwas_run_id, chrom, pos) composite — Manhattan queries are always
 *   scoped by gwas_run_id anyway, so the composite still satisfies
 *   GENOMICS-02 Success Criterion #4.
 *   Orchestrator auto-approved this deviation on 2026-04-17.
 *
 * Three-tier HIGHSEC grants (Pitfall 6):
 *   parthenon_app          — DML on both tables (PHP controller reads + writes)
 *   parthenon_finngen_rw   — DML on both tables (R worker writes via COPY)
 *   parthenon_finngen_ro   — SELECT on both tables (Phase 16 read-only API)
 *
 * Cross-schema FK (Phase 17 D-09):
 *   {source}_gwas_results.prs_subject_scores.score_id REFERENCES
 *   vocab.pgs_scores(score_id) ON DELETE CASCADE — natively supported by PG17
 *   per Phase 13.1 precedent; no schema-isolation violation since vocab is
 *   shared reference data.
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
            $hasOwnerRole = DB::selectOne("SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_migrator'");
            if ($hasOwnerRole) {
                DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema} AUTHORIZATION parthenon_migrator");
            } else {
                DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
            }

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

            // ─── Phase 17 D-09: prs_subject_scores ────────────────────────────
            // Per-subject polygenic risk scores written by the Darkstar
            // finngen.prs.compute R worker (plink2 --score wrapper).
            //
            // Cross-schema FK score_id → vocab.pgs_scores is natively supported
            // by PG17 (Phase 13.1 precedent). No FK on cohort_definition_id by
            // design — it accommodates both app.cohort_definitions.id (user
            // cohorts) and FinnGen generation keys offset by 100B per Phase
            // 13.2 D-01.
            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.prs_subject_scores (
                    score_id             TEXT              NOT NULL,
                    cohort_definition_id BIGINT            NOT NULL,
                    subject_id           BIGINT            NOT NULL,
                    raw_score            DOUBLE PRECISION  NOT NULL,
                    scored_at            TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    gwas_run_id          VARCHAR(26)       NULL,
                    PRIMARY KEY (score_id, cohort_definition_id, subject_id),
                    CONSTRAINT prs_subject_scores_pgs_fk
                        FOREIGN KEY (score_id) REFERENCES vocab.pgs_scores(score_id) ON DELETE CASCADE
                )
            ");

            DB::statement("
                COMMENT ON TABLE {$schema}.prs_subject_scores IS
                'Phase 17 D-09 — per-subject polygenic risk scores. Written by the Darkstar finngen.prs.compute R worker. cohort_definition_id keys on either app.cohort_definitions.id (user cohorts) or finngen.endpoint_generations.id + 100_000_000_000 (FinnGen cohorts, 100B offset per Phase 13.2 D-01). No FK on cohort_definition_id by design.'
            ");

            DB::statement("
                CREATE INDEX IF NOT EXISTS prs_subject_scores_cohort_score_idx
                ON {$schema}.prs_subject_scores (cohort_definition_id, score_id)
            ");

            DB::statement("
                DO \$prs_grants\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.prs_subject_scores TO parthenon_app;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.prs_subject_scores TO parthenon_finngen_rw;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                        GRANT SELECT ON {$schema}.prs_subject_scores TO parthenon_finngen_ro;
                    END IF;
                END
                \$prs_grants\$
            ");
        });
    }
}
