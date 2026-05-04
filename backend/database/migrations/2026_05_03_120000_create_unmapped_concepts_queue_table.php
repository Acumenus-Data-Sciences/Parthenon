<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.unmapped_concepts_queue (
                id              BIGSERIAL PRIMARY KEY,
                run_id          UUID NOT NULL,
                source_system   TEXT NOT NULL,
                source_code     TEXT NOT NULL,
                source_display  TEXT,
                resource_type   VARCHAR(64) NOT NULL,
                resource_id     VARCHAR(128) NOT NULL,
                first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                reviewer_user_id BIGINT REFERENCES app.users(id),
                resolved_concept_id BIGINT,
                resolved_at     TIMESTAMPTZ,
                UNIQUE(run_id, source_system, source_code)
            )
        SQL);

        DB::statement('CREATE INDEX idx_unmapped_concepts_run_id ON app.unmapped_concepts_queue (run_id)');
        DB::statement('CREATE INDEX idx_unmapped_concepts_unresolved ON app.unmapped_concepts_queue (resolved_at) WHERE resolved_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.unmapped_concepts_queue');
    }
};
