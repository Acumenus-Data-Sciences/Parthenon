<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_location_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('location_id');
            $table->string('site_key', 100);
            $table->string('fhir_location_id', 255);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_location_id']);
        });

        Schema::create('fhir_caresite_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('care_site_id');
            $table->string('site_key', 100);
            $table->string('fhir_organization_id', 255);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_organization_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_caresite_crosswalk');
        Schema::dropIfExists('fhir_location_crosswalk');
    }
};
