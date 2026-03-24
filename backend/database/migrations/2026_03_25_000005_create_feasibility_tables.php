<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feasibility_assessments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->jsonb('criteria');
            $table->integer('sources_assessed')->default(0);
            $table->integer('sources_passed')->default(0);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at');
        });

        Schema::create('feasibility_assessment_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assessment_id')->constrained('feasibility_assessments')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->boolean('domain_pass');
            $table->boolean('concept_pass');
            $table->boolean('visit_pass');
            $table->boolean('date_pass');
            $table->boolean('patient_pass');
            $table->boolean('overall_pass');
            $table->jsonb('details')->default('{}');
            $table->index('assessment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feasibility_assessment_results');
        Schema::dropIfExists('feasibility_assessments');
    }
};
