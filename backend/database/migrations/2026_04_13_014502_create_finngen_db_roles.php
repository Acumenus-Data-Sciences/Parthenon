<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Create parthenon_finngen_ro / parthenon_finngen_rw Postgres roles.
 *
 * These roles support the FinnGen Runtime Foundation (SP1):
 *   - parthenon_finngen_ro : SELECT on CDM + vocab + results schemas for sync reads
 *   - parthenon_finngen_rw : RO grants + INSERT/UPDATE/DELETE on *_results for async writes
 *
 * Requires a role with CREATEROLE (or superuser) to run. In Parthenon this is
 * executed one-off via claude_dev (host PG17) — parthenon_migrator does NOT have
 * CREATEROLE by design.
 *
 * Passwords come from config('finngen.pg_ro_password') / pg_rw_password, which
 * read FINNGEN_PG_RO_PASSWORD / FINNGEN_PG_RW_PASSWORD from env.
 */
return new class extends Migration
{
    public function up(): void
    {
        $roPassword = (string) config('finngen.pg_ro_password');
        $rwPassword = (string) config('finngen.pg_rw_password');

        if ($roPassword === '' || $rwPassword === '') {
            throw new RuntimeException(
                'FINNGEN_PG_RO_PASSWORD and FINNGEN_PG_RW_PASSWORD must be set in .env before running this migration.'
            );
        }

        // Defensive escape of single quotes for the SQL literal. We control the
        // value (env-supplied) but belt-and-suspenders is cheap.
        $roEscaped = str_replace("'", "''", $roPassword);
        $rwEscaped = str_replace("'", "''", $rwPassword);

        // --- Create roles (idempotent) ---
        $roExists = DB::selectOne("SELECT 1 AS e FROM pg_roles WHERE rolname = 'parthenon_finngen_ro'");
        if ($roExists === null) {
            DB::unprepared("CREATE ROLE parthenon_finngen_ro WITH LOGIN PASSWORD '{$roEscaped}'");
        }

        $rwExists = DB::selectOne("SELECT 1 AS e FROM pg_roles WHERE rolname = 'parthenon_finngen_rw'");
        if ($rwExists === null) {
            DB::unprepared("CREATE ROLE parthenon_finngen_rw WITH LOGIN PASSWORD '{$rwEscaped}'");
        }

        // --- Schema-level grants ---
        $cdmSchemas = ['omop', 'synpuf', 'irsf', 'pancreas', 'inpatient', 'eunomia'];
        $vocabSchema = 'vocab';
        $resultsSchemas = ['results', 'synpuf_results', 'irsf_results', 'pancreas_results', 'eunomia_results'];

        // Helper: only grant on schemas that actually exist in this environment.
        // Some deployments have not yet provisioned every CDM source (e.g. inpatient,
        // eunomia). Skipping absent schemas keeps the migration idempotent and portable.
        $schemaExists = function (string $schema): bool {
            $row = DB::selectOne('SELECT 1 AS e FROM pg_namespace WHERE nspname = ?', [$schema]);

            return $row !== null;
        };

        // CDM + vocab: read-only for both roles
        foreach (array_merge($cdmSchemas, [$vocabSchema]) as $schema) {
            if (! $schemaExists($schema)) {
                continue;
            }
            DB::unprepared("GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_ro, parthenon_finngen_rw");
            DB::unprepared("GRANT SELECT ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_ro, parthenon_finngen_rw");
            DB::unprepared("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT ON TABLES TO parthenon_finngen_ro, parthenon_finngen_rw");
        }

        // Results schemas: RO reads; RW reads + writes + CREATE (for async sidecar tables)
        foreach ($resultsSchemas as $schema) {
            if (! $schemaExists($schema)) {
                continue;
            }
            DB::unprepared("GRANT USAGE, CREATE ON SCHEMA {$schema} TO parthenon_finngen_rw");
            DB::unprepared("GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_ro");
            DB::unprepared("GRANT SELECT ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_ro");
            DB::unprepared("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_rw");
            DB::unprepared("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT ON TABLES TO parthenon_finngen_ro");
            DB::unprepared("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parthenon_finngen_rw");
        }
    }

    public function down(): void
    {
        // NEVER drop in prod without explicit authorization (project rule).
        // Leave as a no-op; document in runbook if manual cleanup ever needed.
    }
};
