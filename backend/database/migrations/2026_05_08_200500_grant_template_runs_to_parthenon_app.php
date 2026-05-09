<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant runtime DML privileges on app.template_runs to parthenon_app.
 *
 * The original 2026_05_02_100000_create_template_runs_table migration created
 * the table as parthenon_migrator but forgot to GRANT to the runtime role,
 * leaving the SPA unable to read or write runs ("permission denied for table
 * template_runs").
 *
 * Per HIGHSEC §4.1 / project_parthenon_pg_roles: parthenon_migrator owns DDL;
 * parthenon_app holds runtime DML only — needs explicit GRANT here.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.template_runs TO parthenon_app;
                    GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.template_runs_id_seq TO parthenon_app;
                END IF;
            END $$;
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    REVOKE SELECT, INSERT, UPDATE, DELETE ON app.template_runs FROM parthenon_app;
                    REVOKE USAGE, SELECT, UPDATE ON SEQUENCE app.template_runs_id_seq FROM parthenon_app;
                END IF;
            END $$;
        SQL);
    }
};
