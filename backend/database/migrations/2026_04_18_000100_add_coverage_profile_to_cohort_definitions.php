<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 13 — adds the `coverage_profile` typed column to app.cohort_definitions.
 *
 * The column complements the existing `expression_json->>'coverage_bucket'`
 * (per-source resolution metric) with a portability metric describing how
 * an endpoint resolves on non-Finnish OMOP CDMs:
 *   - 'universal'    — every qualifying-event vocab group resolves to a standard concept
 *   - 'partial'      — at least one group resolves, at least one is Finnish-only
 *   - 'finland_only' — no group resolves outside Finnish source vocabularies
 *
 * Populated by the FinnGenEndpointImporter starting in Plan 06; NULL until then.
 *
 * HIGHSEC §4.1: explicit GRANT to parthenon_app inside a pg_roles existence guard.
 * Per ADR-002 the only legal values are universal / partial / finland_only — enforced
 * by app code (Enums\CoverageProfile), not a DB CHECK, to keep the column nullable
 * during the rolling re-import window.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app.cohort_definitions', function ($table): void {
            // VARCHAR(16) leaves headroom for finland_only (12 chars).
            $table->string('coverage_profile', 16)->nullable()->after('quality_tier');
            $table->index('coverage_profile', 'cohort_definitions_coverage_profile_index');
        });

        // HIGHSEC §4.1 — re-grant on the table after column add. Idempotent.
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.cohort_definitions TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        Schema::table('app.cohort_definitions', function ($table): void {
            $table->dropIndex('cohort_definitions_coverage_profile_index');
            $table->dropColumn('coverage_profile');
        });
    }
};
