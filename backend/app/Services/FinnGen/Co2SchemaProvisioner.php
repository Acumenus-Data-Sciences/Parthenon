<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Phase 18 D-09 per
 * .planning/phases/18-risteys-style-endpoint-dashboard/18-CONTEXT.md.
 *
 * Provisions the {source}_co2_results schema + its four sibling tables on the
 * first Risteys-style profile-compute dispatch for a given CDM source:
 *   - endpoint_profile_summary       (one row per endpoint × source × expression_hash)
 *   - endpoint_profile_km_points     (KM step-function points)
 *   - endpoint_profile_comorbidities (top-50 phi-ranked co-occurring endpoints)
 *   - endpoint_profile_drug_classes  (top-10 ATC3 classes in the 90d pre-index window)
 *
 * Mirrors backend/app/Services/FinnGen/GwasSchemaProvisioner.php (Phase 14 / 17):
 *   - Single DB::transaction wraps all DDL (T-18-04 — partial-failure safety)
 *   - CREATE SCHEMA / CREATE TABLE IF NOT EXISTS makes re-runs idempotent
 *   - Three-tier HIGHSEC §4.1 grants inside DO $grants$ blocks with
 *     `pg_roles` existence guards so the provisioner is portable across
 *     dev / CI / prod where the finngen RW / RO roles may or may not exist.
 *
 * Threat T-18-03 mitigation (SQL injection via source_key): the
 * SAFE_SOURCE_REGEX allow-list below throws InvalidArgumentException BEFORE
 * any string interpolation into the schema name. Wave 0 Pest test
 * `it('rejects unsafe source_key values …')` gates this.
 *
 * Threat T-18-04 mitigation (partial-provision DoS): the whole DDL sequence
 * is wrapped in DB::transaction so any failure rolls back — no half-created
 * schema is left for Plan 18-04 dispatch to trip over. Wave 0 Pest test
 * `it('is idempotent …')` asserts re-run safety.
 */
final class Co2SchemaProvisioner
{
    private const SAFE_SOURCE_REGEX = '/^[a-z][a-z0-9_]*$/';

    public function provision(string $sourceKey): void
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "Co2SchemaProvisioner: unsafe source_key '{$sourceKey}' "
                .'(expected /^[a-z][a-z0-9_]*$/ after lowercase).'
            );
        }

        $schema = "{$normalized}_co2_results";

        DB::transaction(function () use ($schema): void {
            $hasOwnerRole = DB::selectOne("SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_migrator'");
            if ($hasOwnerRole) {
                DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema} AUTHORIZATION parthenon_migrator");
            } else {
                DB::statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
            }

            // ── endpoint_profile_summary ──
            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.endpoint_profile_summary (
                    endpoint_name          TEXT             NOT NULL,
                    source_key             TEXT             NOT NULL,
                    expression_hash        CHAR(64)         NOT NULL,
                    subject_count          INTEGER          NOT NULL,
                    death_count            INTEGER          NOT NULL,
                    median_survival_days   DOUBLE PRECISION NULL,
                    age_at_death_mean      DOUBLE PRECISION NULL,
                    age_at_death_median    DOUBLE PRECISION NULL,
                    age_at_death_bins      JSONB            NOT NULL DEFAULT '[]'::jsonb,
                    universe_size          INTEGER          NOT NULL DEFAULT 0,
                    min_subjects           INTEGER          NOT NULL DEFAULT 20,
                    source_has_death_data  BOOLEAN          NOT NULL,
                    source_has_drug_data   BOOLEAN          NOT NULL,
                    run_id                 VARCHAR(26)      NOT NULL,
                    computed_at            TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (endpoint_name, source_key, expression_hash)
                )
            ");

            DB::statement("
                COMMENT ON TABLE {$schema}.endpoint_profile_summary IS
                'Phase 18 D-09 — one row per (endpoint_name, source_key, expression_hash). Cache invalidation is keyed on expression_hash per D-10: when the endpoint expression is re-resolved and its SHA-256 changes, the Plan 18-04 read path returns status=needs_compute and the frontend auto-dispatches a fresh compute.'
            ");

            // ── endpoint_profile_km_points ──
            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.endpoint_profile_km_points (
                    endpoint_name   TEXT             NOT NULL,
                    source_key      TEXT             NOT NULL,
                    expression_hash CHAR(64)         NOT NULL,
                    time_days       DOUBLE PRECISION NOT NULL,
                    survival_prob   DOUBLE PRECISION NOT NULL,
                    at_risk         INTEGER          NOT NULL,
                    events          INTEGER          NOT NULL,
                    PRIMARY KEY (endpoint_name, source_key, expression_hash, time_days)
                )
            ");
            DB::statement("CREATE INDEX IF NOT EXISTS epkm_endpoint_source_idx ON {$schema}.endpoint_profile_km_points (endpoint_name, source_key)");

            // ── endpoint_profile_comorbidities ──
            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.endpoint_profile_comorbidities (
                    index_endpoint     TEXT             NOT NULL,
                    source_key         TEXT             NOT NULL,
                    expression_hash    CHAR(64)         NOT NULL,
                    comorbid_endpoint  TEXT             NOT NULL,
                    phi_coef           DOUBLE PRECISION NOT NULL,
                    odds_ratio         DOUBLE PRECISION NOT NULL,
                    or_ci_low          DOUBLE PRECISION NULL,
                    or_ci_high         DOUBLE PRECISION NULL,
                    co_count           INTEGER          NOT NULL,
                    rank               SMALLINT         NOT NULL,
                    PRIMARY KEY (index_endpoint, source_key, expression_hash, comorbid_endpoint)
                )
            ");
            DB::statement("CREATE INDEX IF NOT EXISTS epcom_rank_idx ON {$schema}.endpoint_profile_comorbidities (index_endpoint, source_key, rank)");

            // ── endpoint_profile_drug_classes ──
            DB::statement("
                CREATE TABLE IF NOT EXISTS {$schema}.endpoint_profile_drug_classes (
                    endpoint_name    TEXT             NOT NULL,
                    source_key       TEXT             NOT NULL,
                    expression_hash  CHAR(64)         NOT NULL,
                    atc3_code        VARCHAR(8)       NOT NULL,
                    atc3_name        TEXT             NULL,
                    subjects_on_drug INTEGER          NOT NULL,
                    subjects_total   INTEGER          NOT NULL,
                    pct_on_drug      DOUBLE PRECISION NOT NULL,
                    rank             SMALLINT         NOT NULL,
                    PRIMARY KEY (endpoint_name, source_key, expression_hash, atc3_code)
                )
            ");

            // ── Three-tier HIGHSEC §4.1 grants with role-existence guards ──
            DB::statement("
                DO \$grants\$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_summary       TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_km_points     TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_comorbidities TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_drug_classes  TO parthenon_app;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_rw;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_summary       TO parthenon_finngen_rw;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_km_points     TO parthenon_finngen_rw;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_comorbidities TO parthenon_finngen_rw;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON {$schema}.endpoint_profile_drug_classes  TO parthenon_finngen_rw;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                        GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_ro;
                        GRANT SELECT ON {$schema}.endpoint_profile_summary       TO parthenon_finngen_ro;
                        GRANT SELECT ON {$schema}.endpoint_profile_km_points     TO parthenon_finngen_ro;
                        GRANT SELECT ON {$schema}.endpoint_profile_comorbidities TO parthenon_finngen_ro;
                        GRANT SELECT ON {$schema}.endpoint_profile_drug_classes  TO parthenon_finngen_ro;
                    END IF;
                END
                \$grants\$
            ");
        });
    }
}
