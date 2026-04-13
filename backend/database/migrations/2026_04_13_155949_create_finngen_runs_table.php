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
            CREATE TABLE app.finngen_runs (
                id                  CHAR(26)    PRIMARY KEY,
                user_id             BIGINT      NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
                source_key          VARCHAR(64) NOT NULL,
                analysis_type       VARCHAR(64) NOT NULL,
                params              JSONB       NOT NULL,
                status              VARCHAR(16) NOT NULL DEFAULT 'queued',
                progress            JSONB,
                artifacts           JSONB       NOT NULL DEFAULT '{}'::jsonb,
                summary             JSONB,
                error               JSONB,
                pinned              BOOLEAN     NOT NULL DEFAULT FALSE,
                artifacts_pruned    BOOLEAN     NOT NULL DEFAULT FALSE,
                artifacts_pruned_at TIMESTAMPTZ,
                darkstar_job_id     VARCHAR(64),
                horizon_job_id      VARCHAR(64),
                reconciled_count    SMALLINT    NOT NULL DEFAULT 0,
                started_at          TIMESTAMPTZ,
                finished_at         TIMESTAMPTZ,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                CONSTRAINT finngen_runs_status_check CHECK (status IN
                    ('queued','running','canceling','succeeded','failed','canceled')),
                CONSTRAINT finngen_runs_terminal_requires_finished_at CHECK
                    (status NOT IN ('succeeded','failed','canceled') OR finished_at IS NOT NULL)
            )
        ");

        DB::statement('CREATE INDEX finngen_runs_user_created_idx ON app.finngen_runs (user_id, created_at DESC)');
        DB::statement("
            CREATE INDEX finngen_runs_status_idx ON app.finngen_runs (status)
            WHERE status IN ('queued','running','canceling')
        ");
        DB::statement('
            CREATE INDEX finngen_runs_gc_idx ON app.finngen_runs (finished_at)
            WHERE pinned = false AND finished_at IS NOT NULL
        ');
        DB::statement('CREATE INDEX finngen_runs_analysis_type_idx ON app.finngen_runs (analysis_type)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_runs');
    }
};
