<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_synthesis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->foreignId('study_analysis_id')->nullable()->constrained('study_analyses')->nullOnDelete();
            $table->string('synthesis_type', 40); // fixed_effects_meta, random_effects_meta, bayesian_meta, forest_plot, heterogeneity_analysis, funnel_plot, evidence_synthesis, custom
            $table->jsonb('input_result_ids'); // array of study_result IDs
            $table->jsonb('method_settings');
            $table->jsonb('output')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->foreignId('generated_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_synthesis');
    }
};
