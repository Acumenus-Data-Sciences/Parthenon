<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add data-integrity guards to lab_reference_range_population that
     * were missed in the initial Task 2 migration:
     *   - n_observations > 0
     *   - range_low <= range_high
     *   - median IS NULL OR median BETWEEN range_low AND range_high
     *   - computed_at default CURRENT_TIMESTAMP
     *
     * Idempotent: DO blocks with EXCEPTION handlers skip CHECKs that
     * already exist. Safe to run on environments that ran the
     * already-fixed Task 2 migration (constraints pre-exist → no-op)
     * and on environments that ran the original Task 2 migration
     * without the constraints (they get added here).
     *
     * The ALTER TABLE for the computed_at default uses SET DEFAULT
     * which is naturally idempotent (setting an already-set default
     * is a harmless no-op at the SQL level).
     */
    public function up(): void
    {
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                ALTER TABLE lab_reference_range_population
                    ADD CONSTRAINT lrr_pop_n_obs_positive CHECK (n_observations > 0);
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        SQL);

        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                ALTER TABLE lab_reference_range_population
                    ADD CONSTRAINT lrr_pop_range_order CHECK (range_low <= range_high);
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        SQL);

        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                ALTER TABLE lab_reference_range_population
                    ADD CONSTRAINT lrr_pop_median_in_range
                    CHECK (median IS NULL OR (median >= range_low AND median <= range_high));
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        SQL);

        DB::statement(
            'ALTER TABLE lab_reference_range_population
             ALTER COLUMN computed_at SET DEFAULT CURRENT_TIMESTAMP'
        );
    }

    public function down(): void
    {
        // Forward-only: rolling these constraints back would re-open the
        // data-integrity gaps this migration exists to close. The codebase
        // also blocks `migrate:rollback` against the production database
        // via AppServiceProvider::guardDangerousConsoleCommands(), so any
        // revert path must be an explicit follow-up migration.
    }
};
