<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_bundle_measure_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs')
                ->cascadeOnDelete();
            $table->foreignId('quality_measure_id')
                ->constrained('quality_measures');
            $table->unsignedBigInteger('denominator_count')->default(0);
            $table->unsignedBigInteger('numerator_count')->default(0);
            $table->unsignedBigInteger('exclusion_count')->default(0);
            $table->decimal('rate', 6, 4)->nullable();
            $table->foreignId('denominator_cohort_definition_id')
                ->nullable()
                ->constrained('cohort_definitions')
                ->nullOnDelete();
            $table->foreignId('numerator_cohort_definition_id')
                ->nullable()
                ->constrained('cohort_definitions')
                ->nullOnDelete();
            $table->timestamp('computed_at')->useCurrent();

            $table->unique(['care_bundle_run_id', 'quality_measure_id'], 'uq_cbmr_run_measure');
            $table->index('care_bundle_run_id', 'idx_cbmr_run');
            $table->index('quality_measure_id', 'idx_cbmr_measure');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_measure_results');
    }
};
