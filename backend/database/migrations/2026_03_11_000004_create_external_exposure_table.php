<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.external_exposure', function (Blueprint $table) {
            $table->id('external_exposure_id');
            $table->bigInteger('person_id')->index();
            $table->bigInteger('exposure_concept_id')->index();
            $table->date('exposure_start_date');
            $table->date('exposure_end_date')->nullable();
            $table->float('value_as_number')->nullable();
            $table->string('value_as_string', 255)->nullable();
            $table->bigInteger('value_as_concept_id')->nullable();
            $table->string('unit_source_value', 50)->nullable();
            $table->bigInteger('unit_concept_id')->nullable();
            $table->bigInteger('location_id')->nullable();
            $table->bigInteger('boundary_id')->nullable();
            $table->bigInteger('qualifier_concept_id')->nullable();
            $table->bigInteger('exposure_type_concept_id')->nullable();
            $table->bigInteger('exposure_source_concept_id')->nullable();
            $table->string('exposure_source_value', 255)->nullable();
            $table->timestamps();

            $table->index(['exposure_start_date', 'exposure_end_date']);
            $table->index('boundary_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app.external_exposure');
    }
};
