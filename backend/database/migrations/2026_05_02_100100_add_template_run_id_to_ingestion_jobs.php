<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE app.ingestion_jobs
                ADD COLUMN template_run_id BIGINT NULL
                    REFERENCES app.template_runs(id) ON DELETE SET NULL,
                ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'upload'
                    CHECK (kind IN ('upload','fhir','template'))
        SQL);

        DB::statement('CREATE INDEX idx_ingestion_jobs_kind            ON app.ingestion_jobs (kind)');
        DB::statement('CREATE INDEX idx_ingestion_jobs_template_run_id ON app.ingestion_jobs (template_run_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_ingestion_jobs_template_run_id');
        DB::statement('DROP INDEX IF EXISTS app.idx_ingestion_jobs_kind');
        DB::statement('ALTER TABLE app.ingestion_jobs DROP COLUMN IF EXISTS kind');
        DB::statement('ALTER TABLE app.ingestion_jobs DROP COLUMN IF EXISTS template_run_id');
    }
};
