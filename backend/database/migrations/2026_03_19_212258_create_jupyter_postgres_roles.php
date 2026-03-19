<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $researcherPassword = config('services.jupyter.db_researcher_password', 'jupyter_researcher_pass');
        $adminPassword = config('services.jupyter.db_admin_password', 'jupyter_admin_pass');

        // Create researcher role (read-only)
        DB::unprepared("
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jupyter_researcher') THEN
                    EXECUTE format('CREATE ROLE jupyter_researcher LOGIN PASSWORD %L', '{$researcherPassword}');
                END IF;
            END
            \$\$;

            GRANT USAGE ON SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
            GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
            ALTER DEFAULT PRIVILEGES IN SCHEMA omop, results, eunomia, eunomia_results
                GRANT SELECT ON TABLES TO jupyter_researcher;
        ");

        // Create admin role (read + write results, selective app access)
        DB::unprepared("
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jupyter_admin') THEN
                    EXECUTE format('CREATE ROLE jupyter_admin LOGIN PASSWORD %L', '{$adminPassword}');
                END IF;
            END
            \$\$;

            GRANT USAGE ON SCHEMA omop, results, gis, eunomia, eunomia_results, app TO jupyter_admin;
            GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, gis, eunomia, eunomia_results TO jupyter_admin;
            GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA results TO jupyter_admin;
            REVOKE DELETE ON ALL TABLES IN SCHEMA results FROM jupyter_admin;
            ALTER DEFAULT PRIVILEGES IN SCHEMA results
                GRANT INSERT, UPDATE ON TABLES TO jupyter_admin;
        ");

        // Selective app schema access (exclude auth tables: users, personal_access_tokens, etc.)
        DB::unprepared("
            GRANT SELECT ON app.jupyter_audit_log, app.cohort_definitions, app.studies,
                app.sources, app.analysis_executions, app.concept_sets
                TO jupyter_admin;
        ");
    }

    public function down(): void
    {
        DB::unprepared("
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA omop, results, eunomia, eunomia_results FROM jupyter_researcher;
            REVOKE USAGE ON SCHEMA omop, results, eunomia, eunomia_results FROM jupyter_researcher;
            DROP ROLE IF EXISTS jupyter_researcher;

            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA omop, results, gis, eunomia, eunomia_results, app FROM jupyter_admin;
            REVOKE USAGE ON SCHEMA omop, results, gis, eunomia, eunomia_results, app FROM jupyter_admin;
            DROP ROLE IF EXISTS jupyter_admin;
        ");
    }
};
