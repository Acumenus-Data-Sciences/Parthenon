<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('device_exposure')) {
            return;
        }

        Schema::connection('omop')->create('device_exposure', function (Blueprint $table) {
            $table->bigInteger('device_exposure_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('device_concept_id');
            $table->date('device_exposure_start_date');
            $table->timestamp('device_exposure_start_datetime')->nullable();
            $table->date('device_exposure_end_date')->nullable();
            $table->timestamp('device_exposure_end_datetime')->nullable();
            $table->integer('device_type_concept_id');
            $table->string('unique_device_id', 255)->nullable();
            $table->string('production_id', 255)->nullable();
            $table->integer('quantity')->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('device_source_value', 50)->nullable();
            $table->integer('device_source_concept_id')->default(0);
            $table->integer('unit_concept_id')->default(0);
            $table->string('unit_source_value', 50)->nullable();
            $table->integer('unit_source_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('device_exposure');
    }
};
