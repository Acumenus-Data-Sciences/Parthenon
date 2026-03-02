<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('population_risk_score_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('score_id', 10);        // 'RS001'
            $table->string('score_name', 255);
            $table->string('category', 100);
            $table->string('risk_tier', 50);       // low | intermediate | high | very_high | uncomputable
            $table->integer('patient_count')->default(0);
            $table->integer('total_eligible')->nullable();
            $table->decimal('mean_score', 10, 4)->nullable();
            $table->decimal('p25_score', 10, 4)->nullable();
            $table->decimal('median_score', 10, 4)->nullable();
            $table->decimal('p75_score', 10, 4)->nullable();
            $table->decimal('mean_confidence', 5, 4)->nullable();    // 0.0–1.0
            $table->decimal('mean_completeness', 5, 4)->nullable();  // 0.0–1.0
            $table->text('missing_components')->nullable();           // JSON: {"component": missing_count}
            $table->timestampTz('run_at');
            $table->timestamps();
        });

        Schema::table('population_risk_score_results', function (Blueprint $table) {
            $table->index(['source_id', 'score_id']);
            $table->index(['source_id', 'category']);
            $table->index(['source_id', 'risk_tier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('population_risk_score_results');
    }
};
