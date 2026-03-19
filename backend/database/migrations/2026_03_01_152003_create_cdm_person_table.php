<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('person')) {
            return;
        }

        Schema::connection('omop')->create('person', function (Blueprint $table) {
            $table->bigInteger('person_id')->primary();
            $table->integer('gender_concept_id');
            $table->integer('year_of_birth');
            $table->integer('month_of_birth')->nullable();
            $table->integer('day_of_birth')->nullable();
            $table->timestamp('birth_datetime')->nullable();
            $table->integer('race_concept_id');
            $table->integer('ethnicity_concept_id');
            $table->bigInteger('location_id')->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('care_site_id')->nullable();
            $table->string('person_source_value', 50)->nullable();
            $table->string('gender_source_value', 50)->nullable();
            $table->integer('gender_source_concept_id')->default(0);
            $table->string('race_source_value', 50)->nullable();
            $table->integer('race_source_concept_id')->default(0);
            $table->string('ethnicity_source_value', 50)->nullable();
            $table->integer('ethnicity_source_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('person');
    }
};
