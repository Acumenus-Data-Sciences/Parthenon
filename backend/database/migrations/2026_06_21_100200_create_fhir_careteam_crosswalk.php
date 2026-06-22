<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Crosswalk for FHIR CareTeam resources. Like fhir_provider_crosswalk, the
 * table's auto-increment PK (care_team_id) IS the OMOP surrogate id supplied to
 * the emitted omop.care_team / care_team_member rows — so CareTeamMapper can link
 * members to their parent team in a single pass without a two-phase insert.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('fhir_careteam_crosswalk')) {
            return;
        }

        Schema::create('fhir_careteam_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('care_team_id');
            $table->string('site_key', 50);
            $table->string('fhir_care_team_id', 200);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_care_team_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_careteam_crosswalk');
    }
};
