<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 15 (GENOMICS-03 / GENOMICS-05) — GWAS dispatch tracking table +
 * generation-history expression index.
 *
 * Creates:
 *   1. finngen.endpoint_gwas_runs — one row per GWAS dispatch (step1+step2
 *      abstraction). Status mirrors the step-2 finngen.runs row with the
 *      extra 'superseded' terminal state (D-14). Self-referencing FK on
 *      superseded_by_tracking_id (ON DELETE SET NULL) supports the
 *      overwrite=true chain. NO FK on run_id → finngen.runs.id per D-13
 *      (ULID mismatch risk; observer enforces linkage at runtime).
 *
 *   2. finngen_runs_endpoint_name_idx — partial expression index on
 *      finngen.runs((params->>'endpoint_name'), analysis_type, source_key,
 *      created_at DESC) WHERE analysis_type IN ('endpoint.generate',
 *      'gwas.regenie.step1', 'gwas.regenie.step2'). Supports the D-18
 *      filtered generation-history query from EndpointBrowserController::show.
 *
 *   3. HIGHSEC §4.1 grants — parthenon_app / parthenon_finngen_rw get full
 *      DML; parthenon_finngen_ro gets SELECT. All guarded by pg_roles
 *      existence checks so the migration stays portable across dev / CI /
 *      prod where roles may not yet exist.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
 * throughout so re-running after partial failure does not error.
 */
return new class extends Migration
{
    public function up(): void
    {
        // D-12, D-13: tracking table lives in finngen.* (schema-isolated per Phase 13.1).
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS finngen.endpoint_gwas_runs (
                id                        BIGSERIAL    PRIMARY KEY,
                endpoint_name             TEXT         NOT NULL,
                source_key                TEXT         NOT NULL,
                control_cohort_id         BIGINT       NOT NULL,
                covariate_set_id          BIGINT       NOT NULL,
                run_id                    VARCHAR(26)  NOT NULL,
                step1_run_id              VARCHAR(26)  NULL,
                case_n                    INTEGER      NULL,
                control_n                 INTEGER      NULL,
                top_hit_p_value           DOUBLE PRECISION NULL,
                status                    TEXT         NOT NULL DEFAULT 'queued',
                superseded_by_tracking_id BIGINT       NULL REFERENCES finngen.endpoint_gwas_runs(id) ON DELETE SET NULL,
                created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                finished_at               TIMESTAMPTZ  NULL,
                CONSTRAINT finngen_endpoint_gwas_runs_status_chk
                    CHECK (status IN ('queued','running','succeeded','failed','canceled','superseded'))
            )
        SQL);

        // D-13: unique tuple allows superseded rows to coexist with the replacement.
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS finngen_endpoint_gwas_runs_unique_idx
                       ON finngen.endpoint_gwas_runs (endpoint_name, source_key, control_cohort_id, covariate_set_id, run_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS finngen_endpoint_gwas_runs_endpoint_source_idx
                       ON finngen.endpoint_gwas_runs (endpoint_name, source_key)');
        DB::statement('CREATE INDEX IF NOT EXISTS finngen_endpoint_gwas_runs_run_id_idx
                       ON finngen.endpoint_gwas_runs (run_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS finngen_endpoint_gwas_runs_step1_run_id_idx
                       ON finngen.endpoint_gwas_runs (step1_run_id) WHERE step1_run_id IS NOT NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS finngen_endpoint_gwas_runs_control_cohort_idx
                       ON finngen.endpoint_gwas_runs (control_cohort_id)');

        // D-19: partial expression index on finngen.runs supporting the D-18
        // filtered generation-history query in the endpoint detail drawer.
        // Partial (WHERE analysis_type IN (...)) so only the three relevant
        // analysis types contribute — keeps the index small on a growing
        // finngen.runs table.
        DB::statement(<<<'SQL'
            CREATE INDEX IF NOT EXISTS finngen_runs_endpoint_name_idx
                ON finngen.runs ((params->>'endpoint_name'), analysis_type, source_key, created_at DESC)
             WHERE analysis_type IN ('endpoint.generate','gwas.regenie.step1','gwas.regenie.step2')
        SQL);

        // HIGHSEC §4.1 — three-tier grants guarded by pg_roles existence so
        // the migration stays portable across dev / CI / prod. Mirrors the
        // Phase 14 finngen_source_variant_indexes grant block.
        DB::statement(<<<'SQL'
            DO $grants$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON finngen.endpoint_gwas_runs TO parthenon_app;
                    GRANT USAGE, SELECT ON SEQUENCE finngen.endpoint_gwas_runs_id_seq TO parthenon_app;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON finngen.endpoint_gwas_runs TO parthenon_finngen_rw;
                    GRANT USAGE, SELECT ON SEQUENCE finngen.endpoint_gwas_runs_id_seq TO parthenon_finngen_rw;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                    GRANT SELECT ON finngen.endpoint_gwas_runs TO parthenon_finngen_ro;
                END IF;
            END
            $grants$
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS finngen.finngen_runs_endpoint_name_idx');
        DB::statement('DROP TABLE IF EXISTS finngen.endpoint_gwas_runs CASCADE');
    }
};
