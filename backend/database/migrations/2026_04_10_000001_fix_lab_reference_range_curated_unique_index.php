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
     * Safe-for-correctness on any environment regardless of which
     * form of the index currently exists: fresh installs see the
     * already-correct index from the Task 1 migration, the DROP
     * removes it, and the CREATE recreates an identical one.
     * Environments that ran the buggy form get corrected in place.
     *
     * Availability note: DROP INDEX and (non-CONCURRENT) CREATE
     * UNIQUE INDEX each acquire ACCESS EXCLUSIVE on the table for
     * their full duration. That's fine here because
     * lab_reference_range_curated is empty at first deploy and
     * small thereafter (~250 rows at full curation). If this
     * pattern is copied to a populated table, use CREATE INDEX
     * CONCURRENTLY and DROP INDEX CONCURRENTLY instead — and note
     * that those cannot run inside a migration transaction.
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
        // Forward-only fix: down() is a no-op. Rolling back to the
        // buggy COALESCE form would re-introduce the NULL/0 collision
        // the up() migration exists to correct. This codebase also
        // blocks `migrate:rollback` against the production database
        // via AppServiceProvider::guardDangerousConsoleCommands()
        // (see backend/app/Providers/AppServiceProvider.php ~line 378),
        // so any rollback path for this migration must be an explicit
        // forward-only follow-up migration rather than a down() call.
    }
};
