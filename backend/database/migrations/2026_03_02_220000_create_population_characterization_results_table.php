<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('population_characterization_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id')->index();
            $table->string('analysis_id', 10)->index();

            $table->string('stratum_1', 255)->default('');
            $table->string('stratum_2', 255)->default('');
            $table->string('stratum_3', 255)->default('');

            $table->bigInteger('count_value')->nullable();
            $table->bigInteger('total_value')->nullable();
            $table->decimal('ratio_value', 10, 6)->nullable();

            $table->timestampTz('run_at');
            $table->timestamps();

            $table->unique(
                ['analysis_id', 'source_id', 'stratum_1', 'stratum_2', 'stratum_3'],
                'pop_char_results_unique'
            );

            $table->index(['source_id', 'analysis_id'], 'pop_char_source_analysis_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('population_characterization_results');
    }
};
