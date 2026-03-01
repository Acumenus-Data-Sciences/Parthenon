<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('visit_detail', function (Blueprint $table) {
            $table->bigInteger('visit_detail_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('visit_detail_concept_id');
            $table->date('visit_detail_start_date');
            $table->timestamp('visit_detail_start_datetime')->nullable();
            $table->date('visit_detail_end_date');
            $table->timestamp('visit_detail_end_datetime')->nullable();
            $table->integer('visit_detail_type_concept_id');
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('care_site_id')->nullable();
            $table->string('visit_detail_source_value', 50)->nullable();
            $table->integer('visit_detail_source_concept_id')->default(0);
            $table->integer('admitted_from_concept_id')->default(0);
            $table->integer('discharged_to_concept_id')->default(0);
            $table->bigInteger('preceding_visit_detail_id')->nullable();
            $table->bigInteger('parent_visit_detail_id')->nullable();
            $table->bigInteger('visit_occurrence_id');
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('visit_detail');
    }
};
