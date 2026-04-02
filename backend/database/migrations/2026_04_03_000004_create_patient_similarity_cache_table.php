<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_similarity_cache', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->bigInteger('seed_person_id');
            $table->string('mode', 20);
            $table->string('weights_hash', 64);
            $table->jsonb('results');
            $table->timestampTz('computed_at')->useCurrent();
            $table->timestampTz('expires_at');
            $table->unique(['source_id', 'seed_person_id', 'mode', 'weights_hash'], 'psc_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_similarity_cache');
    }
};
