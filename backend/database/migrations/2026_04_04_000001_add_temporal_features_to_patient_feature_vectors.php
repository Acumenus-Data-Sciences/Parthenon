<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_feature_vectors', function (Blueprint $table) {
            $table->date('anchor_date')->nullable()->after('race_concept_id');
            $table->jsonb('recent_condition_concepts')->nullable()->after('condition_concepts');
            $table->jsonb('recent_drug_concepts')->nullable()->after('drug_concepts');
            $table->jsonb('recent_procedure_concepts')->nullable()->after('procedure_concepts');
        });
    }

    public function down(): void
    {
        Schema::table('patient_feature_vectors', function (Blueprint $table) {
            $table->dropColumn([
                'anchor_date',
                'recent_condition_concepts',
                'recent_drug_concepts',
                'recent_procedure_concepts',
            ]);
        });
    }
};
