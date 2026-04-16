<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_phenotype_validations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_definition_id')->constrained('cohort_definitions')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources');
            $table->string('mode', 40);
            $table->string('status', 40)->default('draft');
            $table->string('review_state', 40)->default('not_started');
            $table->jsonb('settings_json')->nullable();
            $table->jsonb('result_json')->nullable();
            $table->jsonb('counts_json')->nullable();
            $table->jsonb('metrics_json')->nullable();
            $table->text('notes')->nullable();
            $table->text('fail_message')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();

            $table->index(['cohort_definition_id', 'source_id']);
            $table->index(['cohort_definition_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_phenotype_validations');
    }
};
