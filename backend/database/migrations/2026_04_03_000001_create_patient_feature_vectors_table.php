<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS vector');

        Schema::create('patient_feature_vectors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->bigInteger('person_id');
            $table->smallInteger('age_bucket')->nullable();
            $table->integer('gender_concept_id')->nullable();
            $table->integer('race_concept_id')->nullable();
            $table->jsonb('condition_concepts')->nullable();
            $table->integer('condition_count')->default(0);
            $table->jsonb('lab_vector')->nullable();
            $table->integer('lab_count')->default(0);
            $table->jsonb('drug_concepts')->nullable();
            $table->jsonb('procedure_concepts')->nullable();
            $table->jsonb('variant_genes')->nullable();
            $table->integer('variant_count')->default(0);
            $table->jsonb('dimensions_available');
            $table->timestampTz('computed_at')->useCurrent();
            $table->smallInteger('version')->default(1);
            $table->unique(['source_id', 'person_id']);
            $table->index('source_id');
            $table->foreign('source_id')->references('id')->on('sources')->cascadeOnDelete();
        });

        DB::statement('ALTER TABLE patient_feature_vectors ADD COLUMN embedding public.vector(512)');
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_feature_vectors');
    }
};
