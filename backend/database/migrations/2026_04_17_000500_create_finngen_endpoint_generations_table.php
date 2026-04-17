<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Genomics #2 follow-on — track which FinnGen endpoints have been
 * materialized against which CDM sources. One row per
 * (endpoint_name, source_key) pair, upserted on dispatch and pointing at
 * the latest Run for that pair. Lets the browser show "Generated on:
 * PANCREAS / SYNPUF" badges per endpoint and short-circuit redundant
 * generations. The truth-of-cohort-rows still lives in
 * {source_results}.cohort; this is just an index over it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE app.finngen_endpoint_generations (
                id                    BIGSERIAL    PRIMARY KEY,
                endpoint_name         VARCHAR(120) NOT NULL,
                source_key            VARCHAR(64)  NOT NULL,
                cohort_definition_id  BIGINT       NOT NULL,
                run_id                VARCHAR(26)  NOT NULL,
                last_subject_count    INTEGER      NULL,
                last_status           VARCHAR(24)  NOT NULL DEFAULT \'queued\',
                created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ');

        DB::statement('CREATE UNIQUE INDEX finngen_endpoint_generations_unique ON app.finngen_endpoint_generations (endpoint_name, source_key)');
        DB::statement('CREATE INDEX finngen_endpoint_generations_endpoint_idx ON app.finngen_endpoint_generations (endpoint_name)');
        DB::statement('CREATE INDEX finngen_endpoint_generations_source_idx ON app.finngen_endpoint_generations (source_key)');
        DB::statement('CREATE INDEX finngen_endpoint_generations_run_idx ON app.finngen_endpoint_generations (run_id)');

        // Per project_parthenon_pg_roles: migrator owns the table; runtime
        // user (parthenon_app) needs explicit DML grants to read/write it.
        // Wrapped in a DO block so the migration is safe to run on stacks
        // that haven't created the parthenon_app role (Docker compose dev).
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_endpoint_generations TO parthenon_app;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_endpoint_generations_id_seq TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_endpoint_generations');
    }
};
