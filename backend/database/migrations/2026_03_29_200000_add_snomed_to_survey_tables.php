<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_instruments', function (Blueprint $table) {
            $table->string('snomed_code', 20)->nullable()->after('loinc_panel_code');
            $table->boolean('has_snomed')->default(false)->after('omop_coverage');
        });

        Schema::table('survey_items', function (Blueprint $table) {
            $table->string('snomed_code', 20)->nullable()->after('loinc_code');
        });

        Schema::table('survey_answer_options', function (Blueprint $table) {
            $table->string('snomed_code', 20)->nullable()->after('loinc_la_code');
        });
    }

    public function down(): void
    {
        Schema::table('survey_instruments', function (Blueprint $table) {
            $table->dropColumn(['snomed_code', 'has_snomed']);
        });

        Schema::table('survey_items', function (Blueprint $table) {
            $table->dropColumn('snomed_code');
        });

        Schema::table('survey_answer_options', function (Blueprint $table) {
            $table->dropColumn('snomed_code');
        });
    }
};
