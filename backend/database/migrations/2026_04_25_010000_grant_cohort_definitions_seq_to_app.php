<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // The cohort_definitions table was historically owned by
        // parthenon_migrator (pre-2026-04-12 role-split), so its sequence
        // never received the runtime DML grants that flow through
        // parthenon_owner's default privileges. Result: any INSERT into
        // cohort_definitions from the runtime user fails with
        // "permission denied for sequence cohort_definitions_id_seq" —
        // discovered when MeasureCohortExportService tried to save a
        // care-bundle roster as a cohort.
        //
        // Re-own the table (sequence follows) and explicitly grant the
        // runtime user the privileges it should have had all along.
        // Idempotent: safe to re-run, no-op if roles are absent.
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    EXECUTE 'ALTER TABLE app.cohort_definitions OWNER TO parthenon_owner';
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.cohort_definitions_id_seq TO parthenon_app';
                END IF;
            END
            \$\$
        ");
    }

    public function down(): void
    {
        // Intentional no-op: revoking these would re-break the runtime.
    }
};
