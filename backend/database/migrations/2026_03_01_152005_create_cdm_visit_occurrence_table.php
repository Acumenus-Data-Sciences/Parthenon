<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('visit_occurrence')) {
            return;
        }

        Schema::connection('cdm')->create('visit_occurrence', function (Blueprint $table) {
            $table->bigInteger('visit_occurrence_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('visit_concept_id');
            $table->date('visit_start_date');
            $table->timestamp('visit_start_datetime')->nullable();
            $table->date('visit_end_date');
            $table->timestamp('visit_end_datetime')->nullable();
            $table->integer('visit_type_concept_id');
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('care_site_id')->nullable();
            $table->string('visit_source_value', 50)->nullable();
            $table->integer('visit_source_concept_id')->default(0);
            $table->integer('admitted_from_concept_id')->default(0);
            $table->string('admitted_from_source_value', 50)->nullable();
            $table->integer('discharged_to_concept_id')->default(0);
            $table->string('discharged_to_source_value', 50)->nullable();
            $table->bigInteger('preceding_visit_occurrence_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('visit_occurrence');
    }
};
