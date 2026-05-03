<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.template_runs (
                id              BIGSERIAL PRIMARY KEY,
                template_id     VARCHAR(128) NOT NULL,
                template_version VARCHAR(32) NOT NULL,
                parameters      JSONB NOT NULL,
                status          VARCHAR(32) NOT NULL
                                CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
                progress        REAL NOT NULL DEFAULT 0.0
                                CHECK (progress >= 0 AND progress <= 1),
                current_node    VARCHAR(128),
                prefect_run_id  UUID,
                error_message   TEXT,
                post_conditions JSONB,
                artifacts_path  TEXT,
                submitted_by    BIGINT NOT NULL REFERENCES app.users(id),
                submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at      TIMESTAMPTZ,
                finished_at     TIMESTAMPTZ,
                correlation_id  UUID NOT NULL DEFAULT gen_random_uuid(),
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        SQL);

        DB::statement('CREATE INDEX idx_template_runs_template_id   ON app.template_runs (template_id)');
        DB::statement('CREATE INDEX idx_template_runs_status        ON app.template_runs (status)');
        DB::statement('CREATE INDEX idx_template_runs_submitted_by  ON app.template_runs (submitted_by)');
        DB::statement('CREATE INDEX idx_template_runs_submitted_at  ON app.template_runs (submitted_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.template_runs');
    }
};
