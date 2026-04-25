<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * VSAC + CareBundles prerequisite:
 *
 * Migration `2026_04_24_000500_create_vsac_omop_crosswalk_view.php` runs
 * `SET ROLE parthenon_owner` and then `CREATE MATERIALIZED VIEW
 * app.vsac_value_set_omop_concepts AS SELECT … FROM app.vsac_value_set_codes
 * JOIN vocab.concept …`. Building the materialized view WITH DATA needs
 * SELECT on `vocab.concept`, but `parthenon_owner` has no privileges on the
 * `vocab` schema by default — the schema is owned by the DBA (`smudoshi` /
 * `claude_dev`). On `parthenon_testing` (and any fresh dev DB) this fails
 * with: `SQLSTATE[42501]: permission denied for schema vocab`, which blocks
 * the entire CareBundle test suite.
 *
 * This migration grants USAGE on schema `vocab` and SELECT on the existing
 * vocabulary tables to `parthenon_owner`, plus default privileges so future
 * vocabulary tables are auto-granted. Mirrors the pattern in
 * `2026_04_25_000050_grant_vocab_create_to_migrator.php`: emit the GRANTs
 * defensively, then verify and throw with a remediation command if the
 * connecting role lacks grant authority (e.g. running as
 * `parthenon_migrator` on an env where the DBA hasn't pre-granted).
 *
 * Idempotent — re-running after a successful first pass is a no-op.
 *
 * Operator runbook (when verify fails on `./deploy.sh --db`):
 *   sudo -u postgres psql parthenon -c "GRANT USAGE ON SCHEMA vocab TO parthenon_owner;"
 *   sudo -u postgres psql parthenon -c "GRANT SELECT ON ALL TABLES IN SCHEMA vocab TO parthenon_owner;"
 *   sudo -u postgres psql parthenon -c "ALTER DEFAULT PRIVILEGES IN SCHEMA vocab GRANT SELECT ON TABLES TO parthenon_owner;"
 */
return new class extends Migration
{
    public function up(): void
    {
        $hasRole = DB::selectOne("SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner'");
        if (! $hasRole) {
            return;
        }

        // Emit the grants defensively. If the connecting role can't grant
        // (e.g. parthenon_migrator on a fresh env where vocab is owned by the
        // DBA without GRANT OPTION delegated), PG raises insufficient_privilege
        // and we fall through to the verify below. Idempotent: re-grants are
        // no-ops in PostgreSQL.
        try {
            DB::statement('GRANT USAGE ON SCHEMA vocab TO parthenon_owner');
        } catch (Throwable) {
            // Fall through to verify.
        }

        try {
            DB::statement('GRANT SELECT ON ALL TABLES IN SCHEMA vocab TO parthenon_owner');
        } catch (Throwable) {
            // Fall through to verify.
        }

        // Default privileges so any vocab tables created LATER (e.g. PGS
        // catalog tables in 2026_04_25_000100) are auto-granted to
        // parthenon_owner without another migration. Default privileges are
        // attached to the *grantor* role — they only apply to objects that
        // role creates afterward. The vocab schema owner (smudoshi/claude_dev)
        // and parthenon_migrator are the realistic creators; we set defaults
        // for both that exist.
        $runner = (string) DB::selectOne('SELECT current_user AS u')->u;
        try {
            DB::statement(
                "ALTER DEFAULT PRIVILEGES FOR ROLE {$runner} IN SCHEMA vocab "
                .'GRANT SELECT ON TABLES TO parthenon_owner'
            );
        } catch (Throwable) {
            // Some PG configs disallow ALTER DEFAULT PRIVILEGES across roles
            // — best-effort only.
        }

        $row = DB::selectOne(
            "SELECT has_schema_privilege('parthenon_owner', 'vocab', 'USAGE') AS u, "
            ."has_table_privilege('parthenon_owner', 'vocab.concept', 'SELECT') AS s"
        );
        $hasUsage = (bool) ($row?->u ?? false);
        $hasSelect = (bool) ($row?->s ?? false);

        if (! $hasUsage || ! $hasSelect) {
            throw new RuntimeException(sprintf(
                'CareBundles prerequisite: parthenon_owner lacks %s on schema vocab '
                .'(running as %s). Apply as DB superuser and re-run deploy: '
                .'`sudo -u postgres psql %s -c "GRANT USAGE ON SCHEMA vocab TO parthenon_owner; '
                .'GRANT SELECT ON ALL TABLES IN SCHEMA vocab TO parthenon_owner;"`',
                ! $hasUsage ? 'USAGE' : 'SELECT on vocab.concept',
                $runner,
                (string) DB::connection()->getDatabaseName()
            ));
        }
    }

    public function down(): void
    {
        // Intentional no-op: revoking vocab access from parthenon_owner would
        // break the VSAC crosswalk MV and any future cross-schema views owned
        // by parthenon_owner. Manual rollback if truly needed:
        //   REVOKE SELECT ON ALL TABLES IN SCHEMA vocab FROM parthenon_owner;
        //   REVOKE USAGE ON SCHEMA vocab FROM parthenon_owner;
    }
};
