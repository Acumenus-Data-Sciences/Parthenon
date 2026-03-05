<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_cohorts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('cohort_definition_id');
            $table->string('role', 30); // target, comparator, outcome, exclusion, subgroup, event
            $table->string('label', 255);
            $table->text('description')->nullable();
            $table->text('sql_definition')->nullable();
            $table->jsonb('json_definition')->nullable();
            $table->jsonb('concept_set_ids')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('cohort_definition_id')
                ->references('id')
                ->on('cohort_definitions')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_cohorts');
    }
};
