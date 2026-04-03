<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_feature_vectors', function (Blueprint $table) {
            $table->index(
                ['source_id', 'gender_concept_id', 'age_bucket'],
                'idx_pfv_source_gender_age'
            );
        });
    }

    public function down(): void
    {
        Schema::table('patient_feature_vectors', function (Blueprint $table) {
            $table->dropIndex('idx_pfv_source_gender_age');
        });
    }
};
