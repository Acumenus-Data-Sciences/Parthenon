<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create as parthenon_owner so default privileges auto-grant DML to
        // parthenon_app (see project_parthenon_pg_roles memory, 2026-04-12).
        DB::statement('SET LOCAL ROLE parthenon_owner');

        DB::statement("
            CREATE TABLE app.finngen_analysis_modules (
                key               VARCHAR(64)  PRIMARY KEY,
                label             VARCHAR(128) NOT NULL,
                description       TEXT         NOT NULL,
                darkstar_endpoint VARCHAR(128) NOT NULL,
                enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
                min_role          VARCHAR(32)  NOT NULL DEFAULT 'researcher',
                settings_schema   JSONB,
                default_settings  JSONB,
                result_schema     JSONB,
                result_component  VARCHAR(64),
                created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_analysis_modules');
    }
};
