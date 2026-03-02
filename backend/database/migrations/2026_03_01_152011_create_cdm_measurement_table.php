<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('measurement')) {
            return;
        }

        Schema::connection('cdm')->create('measurement', function (Blueprint $table) {
            $table->bigInteger('measurement_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('measurement_concept_id');
            $table->date('measurement_date');
            $table->timestamp('measurement_datetime')->nullable();
            $table->string('measurement_time', 10)->nullable();
            $table->integer('measurement_type_concept_id');
            $table->integer('operator_concept_id')->default(0);
            $table->decimal('value_as_number')->nullable();
            $table->integer('value_as_concept_id')->default(0);
            $table->integer('unit_concept_id')->default(0);
            $table->decimal('range_low')->nullable();
            $table->decimal('range_high')->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('measurement_source_value', 50)->nullable();
            $table->integer('measurement_source_concept_id')->default(0);
            $table->string('unit_source_value', 50)->nullable();
            $table->integer('unit_source_concept_id')->default(0);
            $table->string('value_source_value', 50)->nullable();
            $table->bigInteger('measurement_event_id')->nullable();
            $table->integer('meas_event_field_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('measurement');
    }
};
