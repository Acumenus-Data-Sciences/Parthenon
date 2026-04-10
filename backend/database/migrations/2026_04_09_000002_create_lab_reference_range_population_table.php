<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Use the default connection (pgsql in prod, pgsql_testing in Pest).
        // Hardcoding ->connection('pgsql') bypasses the testing override and
        // causes migrate:fresh to hit the real parthenon database during tests.
        Schema::create('lab_reference_range_population', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->unsignedInteger('measurement_concept_id');
            $table->unsignedInteger('unit_concept_id');
            $table->decimal('range_low', 12, 4);          // P2.5
            $table->decimal('range_high', 12, 4);         // P97.5
            $table->decimal('median', 12, 4)->nullable(); // P50, informational
            $table->unsignedBigInteger('n_observations');
            $table->timestamp('computed_at')->useCurrent();
            $table->timestamps();

            $table->unique(
                ['source_id', 'measurement_concept_id', 'unit_concept_id'],
                'lrr_pop_uniq'
            );
            $table->index(['measurement_concept_id', 'unit_concept_id'], 'lrr_pop_concept_unit_idx');
        });

        // Data-integrity guards. The compute command (labs:compute-reference-ranges)
        // should never insert a row that fails any of these, but DB-level checks
        // are cheap insurance against a miscoded SQL percentile or a direct insert
        // that bypasses the command.
        DB::statement(
            'ALTER TABLE lab_reference_range_population
             ADD CONSTRAINT lrr_pop_n_obs_positive CHECK (n_observations > 0)'
        );
        DB::statement(
            'ALTER TABLE lab_reference_range_population
             ADD CONSTRAINT lrr_pop_range_order CHECK (range_low <= range_high)'
        );
        DB::statement(
            'ALTER TABLE lab_reference_range_population
             ADD CONSTRAINT lrr_pop_median_in_range
             CHECK (median IS NULL OR (median >= range_low AND median <= range_high))'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_reference_range_population');
    }
};
