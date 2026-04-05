<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_similarity_cache', function (Blueprint $table) {
            $table->string('query_hash', 64)
                ->default(hash('sha256', json_encode([
                    'filters' => [],
                    'limit' => 20,
                    'min_score' => 0.0,
                ], JSON_THROW_ON_ERROR)))
                ->after('weights_hash');

            $table->dropUnique('psc_unique');
            $table->unique(
                ['source_id', 'seed_person_id', 'mode', 'weights_hash', 'query_hash'],
                'psc_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('patient_similarity_cache', function (Blueprint $table) {
            $table->dropUnique('psc_unique');
            $table->unique(['source_id', 'seed_person_id', 'mode', 'weights_hash'], 'psc_unique');
            $table->dropColumn('query_hash');
        });
    }
};
