<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feasibility_assessment_results', function (Blueprint $table) {
            $table->unsignedTinyInteger('domain_score')->default(0)->after('overall_pass');
            $table->unsignedTinyInteger('concept_score')->default(0)->after('domain_score');
            $table->unsignedTinyInteger('visit_score')->default(0)->after('concept_score');
            $table->unsignedTinyInteger('date_score')->default(0)->after('visit_score');
            $table->unsignedTinyInteger('patient_score')->default(0)->after('date_score');
            $table->unsignedTinyInteger('composite_score')->default(0)->after('patient_score');
        });
    }

    public function down(): void
    {
        Schema::table('feasibility_assessment_results', function (Blueprint $table) {
            $table->dropColumn([
                'domain_score',
                'concept_score',
                'visit_score',
                'date_score',
                'patient_score',
                'composite_score',
            ]);
        });
    }
};
