<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.1 hot-fixes discovered during the dev cutover PANCREAS smoke-gen.
 *
 * Two defects in 2026_04_19_000100_isolate_finngen_schema.php were applied
 * manually to the dev DB during Plan 13.1-05 Task 4. This migration codifies
 * them so any fresh migrate:fresh (parthenon_testing, a re-provisioned dev
 * DB, or the eventual staging/prod cutover) picks them up.
 *
 * 1. finngen.endpoint_definitions.qualifying_event_spec was populated with
 *    only `expression_json->'source_codes'`, losing resolved_concepts and
 *    every other top-level key. EndpointBrowserController::generate reads
 *    $spec['resolved_concepts'] and fails with "no resolved concepts
 *    (likely CONTROL_ONLY)" for every endpoint. Fix: re-populate from the
 *    pre-phase13 snapshot which preserved the full expression_json.
 *
 * 2. finngen.endpoint_generations.cohort_definition_id was left NOT NULL
 *    (inherited from the pre-move column definition) even though D-07 in
 *    13.1-CONTEXT.md specifies that new generation rows populate
 *    finngen_endpoint_name with cohort_definition_id = NULL. Fix: DROP
 *    NOT NULL on cohort_definition_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        $finngenExists = DB::selectOne(
            "SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'"
        );
        if ($finngenExists === null) {
            return;
        }

        // Use jsonb_exists() function instead of the `?` operator — the
        // `?` is interpreted as a PDO placeholder by Laravel's binding
        // layer, producing SQLSTATE 42601 "syntax error at $1".
        DB::statement(<<<'SQL'
            UPDATE finngen.endpoint_definitions ed
               SET qualifying_event_spec = s.expression_json
              FROM finngen.endpoint_expressions_pre_phase13 s
             WHERE ed.name = s.name
               AND (
                   ed.qualifying_event_spec IS NULL
                   OR NOT jsonb_exists(ed.qualifying_event_spec, 'resolved_concepts')
               )
        SQL);

        DB::statement(
            'ALTER TABLE finngen.endpoint_generations '
            .'ALTER COLUMN cohort_definition_id DROP NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement(
            'ALTER TABLE finngen.endpoint_generations '
            .'ALTER COLUMN cohort_definition_id SET NOT NULL'
        );
    }
};
