<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
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

        // Ensure runtime role has DML access regardless of ownership. Conditional
        // so CI environments without parthenon_app role don't fail.
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_analysis_modules TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_analysis_modules');
    }
};
