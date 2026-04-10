<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
            $table->timestamp('computed_at');
            $table->timestamps();

            $table->unique(
                ['source_id', 'measurement_concept_id', 'unit_concept_id'],
                'lrr_pop_uniq'
            );
            $table->index(['measurement_concept_id', 'unit_concept_id'], 'lrr_pop_concept_unit_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_reference_range_population');
    }
};
