<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('results')->hasTable('achilles_results_dist')) {
            return; // Table already exists — preserve data
        }

        Schema::connection('results')->create('achilles_results_dist', function (Blueprint $table) {
            $table->id();
            $table->integer('analysis_id');
            $table->string('stratum_1')->nullable();
            $table->string('stratum_2')->nullable();
            $table->string('stratum_3')->nullable();
            $table->string('stratum_4')->nullable();
            $table->string('stratum_5')->nullable();
            $table->bigInteger('count_value')->nullable();
            $table->decimal('min_value')->nullable();
            $table->decimal('max_value')->nullable();
            $table->decimal('avg_value')->nullable();
            $table->decimal('stdev_value')->nullable();
            $table->decimal('median_value')->nullable();
            $table->decimal('p10_value')->nullable();
            $table->decimal('p25_value')->nullable();
            $table->decimal('p75_value')->nullable();
            $table->decimal('p90_value')->nullable();

            $table->index('analysis_id', 'idx_achilles_dist_analysis');
        });
    }

    public function down(): void
    {
        // NEVER drop results.achilles_results_dist — contains computed analytics data.
    }
};
