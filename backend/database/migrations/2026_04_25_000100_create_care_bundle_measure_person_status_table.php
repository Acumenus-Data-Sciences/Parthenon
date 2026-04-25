<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        // Per-person compliance status for one (run, measure). Populated by
        // CohortBasedMeasureEvaluator alongside strata. Powers Tier C
        // drill-down (non-compliant roster) and cohort export.
        //
        // For HTN on a 1M-person CDM: 6 measures × ~400K rows = ~2.4M rows.
        // Bounded — no person table scans at click time.
        Schema::create('care_bundle_measure_person_status', function (Blueprint $table) {
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('quality_measure_id')
                ->constrained('quality_measures')
                ->cascadeOnDelete();
            $table->bigInteger('person_id');
            $table->boolean('is_numer')->default(false);
            $table->boolean('is_excl')->default(false);

            $table->primary(
                ['care_bundle_run_id', 'quality_measure_id', 'person_id'],
                'pk_cbmps_run_measure_person',
            );
            $table->index(
                ['care_bundle_run_id', 'quality_measure_id', 'is_numer', 'is_excl'],
                'idx_cbmps_run_measure_flags',
            );
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_measure_person_status');
    }
};
