<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('vocab')->create('concept_synonyms', function (Blueprint $table) {
            $table->id();
            $table->integer('concept_id');
            $table->string('concept_synonym_name', 1000);
            $table->integer('language_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_synonyms');
    }
};
