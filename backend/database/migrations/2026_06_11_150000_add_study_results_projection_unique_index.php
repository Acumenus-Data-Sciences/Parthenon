<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Back the StudyResultProjector's idempotency with a real constraint. The
 * projector upserts one curated row per (study, study analysis, result type)
 * for locally-projected results (site_id IS NULL); a partial unique index makes
 * concurrent completions (observer + backfill, or two workers) unable to create
 * duplicates rather than relying on read-then-write serialization.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS study_results_projection_unique '
            .'ON study_results (study_id, study_analysis_id, result_type) WHERE site_id IS NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS study_results_projection_unique');
    }
};
