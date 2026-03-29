<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_score_analyses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->jsonb('design_json');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('risk_score_run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('analysis_executions')->cascadeOnDelete();
            $table->string('score_id', 10);
            $table->string('status', 20)->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('elapsed_ms')->nullable();
            $table->integer('patient_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['execution_id', 'score_id']);
        });

        Schema::create('risk_score_patient_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('analysis_executions')->cascadeOnDelete();
            $table->unsignedBigInteger('source_id');
            $table->unsignedBigInteger('cohort_definition_id');
            $table->unsignedBigInteger('person_id');
            $table->string('score_id', 10);
            $table->decimal('score_value', 10, 4)->nullable();
            $table->string('risk_tier', 20)->nullable();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->decimal('completeness', 5, 4)->nullable();
            $table->jsonb('missing_components')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['execution_id']);
            $table->index(['cohort_definition_id', 'person_id']);
            $table->index(['score_id', 'risk_tier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_score_patient_results');
        Schema::dropIfExists('risk_score_run_steps');
        Schema::dropIfExists('risk_score_analyses');
    }
};
