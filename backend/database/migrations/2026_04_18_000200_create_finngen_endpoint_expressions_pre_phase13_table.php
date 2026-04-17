<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 13 — rollback snapshot table for the FinnGen endpoint --overwrite re-import.
 *
 * Captures (cohort_definition_id, name, expression_json, coverage_bucket, created_at, snapshotted_at)
 * for every finngen-endpoint row IMMEDIATELY BEFORE the importer rewrites
 * expression_json. Persists for at least one milestone (through v1.0 ship).
 *
 * Recovery path:
 *   UPDATE app.cohort_definitions cd
 *      SET expression_json = s.expression_json
 *     FROM app.finngen_endpoint_expressions_pre_phase13 s
 *    WHERE cd.id = s.cohort_definition_id;
 *
 * Per CONTEXT.md D-13. HIGHSEC §4.1 grants per pattern.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.finngen_endpoint_expressions_pre_phase13', function (Blueprint $table): void {
            $table->bigInteger('cohort_definition_id')->primary();
            $table->string('name', 255);
            $table->jsonb('expression_json')->nullable();
            $table->string('coverage_bucket', 32)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('snapshotted_at')->useCurrent();
            $table->index('name', 'finngen_endpoint_expressions_pre_phase13_name_index');
        });

        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_endpoint_expressions_pre_phase13 TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('app.finngen_endpoint_expressions_pre_phase13');
    }
};
