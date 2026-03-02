<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('procedure_occurrence')) {
            return;
        }

        Schema::connection('cdm')->create('procedure_occurrence', function (Blueprint $table) {
            $table->bigInteger('procedure_occurrence_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('procedure_concept_id');
            $table->date('procedure_date');
            $table->timestamp('procedure_datetime')->nullable();
            $table->date('procedure_end_date')->nullable();
            $table->timestamp('procedure_end_datetime')->nullable();
            $table->integer('procedure_type_concept_id');
            $table->integer('modifier_concept_id')->default(0);
            $table->integer('quantity')->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('procedure_source_value', 50)->nullable();
            $table->integer('procedure_source_concept_id')->default(0);
            $table->string('modifier_source_value', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('procedure_occurrence');
    }
};
