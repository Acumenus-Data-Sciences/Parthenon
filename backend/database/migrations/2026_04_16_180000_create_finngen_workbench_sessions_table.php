<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * SP4 Phase A — Cohort Workbench session storage.
 *
 * Each session captures a researcher's in-flight cohort-operation tree, the
 * source they're working against, and any UI state needed to resume the
 * 6-step wizard exactly where they left off. Schema is intentionally thin
 * around session_state (jsonb) so SP4 phases B–F can iterate on the tree
 * shape without further migrations; schema_version lets us evolve safely.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE app.finngen_workbench_sessions (
                id              CHAR(26)     PRIMARY KEY,
                user_id         BIGINT       NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
                source_key      VARCHAR(64)  NOT NULL,
                name            VARCHAR(255) NOT NULL,
                description     TEXT,
                schema_version  INTEGER      NOT NULL DEFAULT 1,
                session_state   JSONB        NOT NULL DEFAULT '{}'::jsonb,
                last_active_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ");

        DB::statement('CREATE INDEX finngen_workbench_sessions_user_idx ON app.finngen_workbench_sessions (user_id, last_active_at DESC)');
        DB::statement('CREATE INDEX finngen_workbench_sessions_source_idx ON app.finngen_workbench_sessions (source_key)');

        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_workbench_sessions TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_workbench_sessions');
    }
};
