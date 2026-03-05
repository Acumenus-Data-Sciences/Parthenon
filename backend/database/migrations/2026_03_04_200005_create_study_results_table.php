<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('study_executions')->cascadeOnDelete();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->foreignId('study_analysis_id')->constrained('study_analyses')->cascadeOnDelete();
            $table->foreignId('site_id')->nullable()->constrained('study_sites')->nullOnDelete();
            $table->string('result_type', 30); // cohort_count, characterization, incidence_rate, effect_estimate, prediction_performance, diagnostic, pathway, negative_control, attrition, custom
            $table->jsonb('summary_data'); // aggregate results only
            $table->jsonb('diagnostics')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_publishable')->default(false);
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_results');
    }
};
