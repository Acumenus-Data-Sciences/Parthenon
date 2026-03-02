<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('care_site')) {
            return;
        }

        Schema::connection('cdm')->create('care_site', function (Blueprint $table) {
            $table->bigInteger('care_site_id')->primary();
            $table->string('care_site_name', 255)->nullable();
            $table->integer('place_of_service_concept_id')->nullable();
            $table->bigInteger('location_id')->nullable();
            $table->string('care_site_source_value', 50)->nullable();
            $table->string('place_of_service_source_value', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('care_site');
    }
};
