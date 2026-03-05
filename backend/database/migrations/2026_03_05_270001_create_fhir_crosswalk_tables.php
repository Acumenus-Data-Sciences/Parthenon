<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_patient_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('person_id');
            $table->string('site_key', 50);                   // matches fhir_connections.site_key
            $table->string('fhir_patient_id', 200);            // FHIR Patient.id
            $table->string('mrn_hash', 64)->nullable();        // SHA-256 of MRN for dedup
            $table->timestamps();

            $table->unique(['site_key', 'fhir_patient_id']);
            $table->index('mrn_hash');
        });

        Schema::create('fhir_encounter_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('visit_occurrence_id');
            $table->string('site_key', 50);
            $table->string('fhir_encounter_id', 200);          // FHIR Encounter.id
            $table->bigInteger('person_id');                    // resolved from patient crosswalk
            $table->timestamps();

            $table->unique(['site_key', 'fhir_encounter_id']);
            $table->index('person_id');
        });

        Schema::create('fhir_provider_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('provider_id');
            $table->string('site_key', 50);
            $table->string('fhir_practitioner_id', 200);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_practitioner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_provider_crosswalk');
        Schema::dropIfExists('fhir_encounter_crosswalk');
        Schema::dropIfExists('fhir_patient_crosswalk');
    }
};
