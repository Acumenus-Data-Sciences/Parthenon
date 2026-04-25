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

        // Pre-computed strata results per (run, measure, dimension, stratum).
        // Populated during materialization so the workbench's "Stratify"
        // expansion is instant — re-running the CTE on demand was 19+ minutes
        // on 394K-person runs because of the CDM table scans.
        //
        // dimension is one of: 'age_band', 'sex'
        Schema::create('care_bundle_measure_strata', function (Blueprint $table) {
            $table->id();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('quality_measure_id')
                ->constrained('quality_measures')
                ->cascadeOnDelete();
            $table->string('dimension', 32);
            $table->string('stratum', 64);
            $table->integer('sort_key')->default(0);
            $table->unsignedBigInteger('denominator_count')->default(0);
            $table->unsignedBigInteger('numerator_count')->default(0);
            $table->unsignedBigInteger('exclusion_count')->default(0);
            $table->decimal('rate', 6, 4)->nullable();
            $table->decimal('ci_lower', 6, 4)->nullable();
            $table->decimal('ci_upper', 6, 4)->nullable();
            $table->timestamp('computed_at')->useCurrent();

            $table->unique(
                ['care_bundle_run_id', 'quality_measure_id', 'dimension', 'stratum'],
                'uq_cbms_run_measure_dim_stratum',
            );
            $table->index(['care_bundle_run_id', 'quality_measure_id'], 'idx_cbms_run_measure');
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_measure_strata');
    }
};
