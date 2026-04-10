<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Replace the initial COALESCE-based unique index on
     * lab_reference_range_curated with one that uses PG 15+'s
     * NULLS NOT DISTINCT clause. The COALESCE(age_low, 0) sentinel
     * would have collapsed NULL (no lower bound) and 0 (neonate)
     * into the same slot — caught in code review of Task 1.
     *
     * Idempotent: safe to run against any environment regardless
     * of which form of the index currently exists. Fresh installs
     * that ran the already-fixed migration will see the index,
     * drop it, and recreate it with identical definition — a no-op
     * in effect.
     */
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS lrr_curated_uniq');
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX lrr_curated_uniq
            ON lab_reference_range_curated (
                measurement_concept_id,
                unit_concept_id,
                sex,
                age_low,
                age_high
            )
            NULLS NOT DISTINCT
        SQL);
    }

    public function down(): void
    {
        // Forward-only fix: down() is a no-op rather than reverting
        // to the buggy COALESCE form.
    }
};
