<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('drug_exposure')) {
            return;
        }

        Schema::connection('cdm')->create('drug_exposure', function (Blueprint $table) {
            $table->bigInteger('drug_exposure_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('drug_concept_id');
            $table->date('drug_exposure_start_date');
            $table->timestamp('drug_exposure_start_datetime')->nullable();
            $table->date('drug_exposure_end_date');
            $table->timestamp('drug_exposure_end_datetime')->nullable();
            $table->date('verbatim_end_date')->nullable();
            $table->integer('drug_type_concept_id');
            $table->string('stop_reason', 20)->nullable();
            $table->integer('refills')->nullable();
            $table->decimal('quantity')->nullable();
            $table->integer('days_supply')->nullable();
            $table->text('sig')->nullable();
            $table->integer('route_concept_id')->default(0);
            $table->string('lot_number', 50)->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('drug_source_value', 50)->nullable();
            $table->integer('drug_source_concept_id')->default(0);
            $table->string('route_source_value', 50)->nullable();
            $table->string('dose_unit_source_value', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('drug_exposure');
    }
};
