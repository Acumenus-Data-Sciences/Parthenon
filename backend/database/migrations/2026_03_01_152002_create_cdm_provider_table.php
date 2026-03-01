<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('provider', function (Blueprint $table) {
            $table->bigInteger('provider_id')->primary();
            $table->string('provider_name', 255)->nullable();
            $table->string('npi', 20)->nullable();
            $table->string('dea', 20)->nullable();
            $table->integer('specialty_concept_id')->nullable();
            $table->bigInteger('care_site_id')->nullable();
            $table->integer('year_of_birth')->nullable();
            $table->integer('gender_concept_id')->nullable();
            $table->string('provider_source_value', 50)->nullable();
            $table->string('specialty_source_value', 50)->nullable();
            $table->integer('specialty_source_concept_id')->default(0);
            $table->string('gender_source_value', 50)->nullable();
            $table->integer('gender_source_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('provider');
    }
};
