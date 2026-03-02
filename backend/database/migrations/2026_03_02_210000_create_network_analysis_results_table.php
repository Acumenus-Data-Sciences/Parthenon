<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_analysis_results', function (Blueprint $table) {
            $table->id();

            // NULL source_id = network-level aggregate row
            $table->unsignedBigInteger('source_id')->nullable()->index();
            $table->string('analysis_id', 10)->index();

            // Grouping dimensions (concept_id, category label, year, etc.)
            $table->string('stratum_1', 255)->default('');
            $table->string('stratum_2', 512)->default('');
            $table->string('stratum_3', 255)->default('');

            // Per-source: count_value / total_value = ratio
            // Network row: aggregated count; ratio = pooled proportion
            $table->bigInteger('count_value')->nullable();
            $table->bigInteger('total_value')->nullable();
            $table->decimal('ratio_value', 10, 6)->nullable();

            // Network rows carry JSON with {source_count, mean_ratio, sd_ratio,
            // min_ratio, max_ratio, heterogeneity_i2}
            $table->text('value_as_string')->nullable();

            $table->timestampTz('run_at');
            $table->timestamps();

            // One row per (analysis, source, strata combo)
            $table->unique(
                ['analysis_id', 'source_id', 'stratum_1', 'stratum_2', 'stratum_3'],
                'network_results_unique'
            );

            $table->index(['analysis_id', 'source_id'], 'network_analysis_source_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_analysis_results');
    }
};
