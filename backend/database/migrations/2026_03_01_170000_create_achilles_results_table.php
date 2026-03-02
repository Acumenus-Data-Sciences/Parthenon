<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('results')->hasTable('achilles_results')) {
            return; // Table already exists (e.g. from legacy Achilles run) — preserve data
        }

        Schema::connection('results')->create('achilles_results', function (Blueprint $table) {
            $table->id();
            $table->integer('analysis_id');
            $table->string('stratum_1')->nullable();
            $table->string('stratum_2')->nullable();
            $table->string('stratum_3')->nullable();
            $table->string('stratum_4')->nullable();
            $table->string('stratum_5')->nullable();
            $table->bigInteger('count_value')->nullable();

            $table->index('analysis_id', 'idx_achilles_results_analysis');
        });
    }

    public function down(): void
    {
        Schema::connection('results')->dropIfExists('achilles_results');
    }
};
