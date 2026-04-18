<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.2-08 follow-on: DROP NOT NULL on
 * `finngen.endpoint_generations.cohort_definition_id` per CONTEXT §D-07.
 *
 * Why: Phase 13.1 hot-fix migration (2026_04_18_021637_phase_13_1_data_hotfixes)
 * contains the DROP NOT NULL statement, but its timestamp (2026_04_18) sorts
 * BEFORE the isolate_finngen_schema migration (2026_04_19_000100). On fresh
 * `migrate:fresh` against `parthenon_testing`, the hot-fix runs first, detects
 * that the finngen schema doesn't exist yet, and early-returns — leaving the
 * NOT NULL constraint intact. DEV has it nullable because the statement was
 * applied manually in 13.1-05 Task 4.
 *
 * This migration codifies the dev-only manual fix with a later timestamp so
 * it runs after the schema exists. Idempotent via the `is_nullable` column
 * check.
 *
 * Closes: Phase 13.2-07 Checkpoint residuals #1-3 (EndpointGenerateCohortIdTest
 * cohort_definition_id NOT NULL failures on parthenon_testing).
 */
return new class extends Migration
{
    public function up(): void
    {
        $alreadyNullable = DB::selectOne(<<<'SQL'
            SELECT is_nullable
              FROM information_schema.columns
             WHERE table_schema = 'finngen'
               AND table_name = 'endpoint_generations'
               AND column_name = 'cohort_definition_id'
        SQL);

        if ($alreadyNullable === null || (string) $alreadyNullable->is_nullable === 'YES') {
            return;
        }

        DB::statement(
            'ALTER TABLE finngen.endpoint_generations '
            .'ALTER COLUMN cohort_definition_id DROP NOT NULL'
        );
    }

    public function down(): void
    {
        // Reasserting NOT NULL is safe only when no null rows exist;
        // would fail loudly if any FinnGen generation post-13.1 ran without
        // a legacy cohort_definition_id. Leaving down() as a no-op with this
        // docblock explaining why.
    }
};
