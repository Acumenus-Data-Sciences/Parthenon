<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('note_nlp')) {
            return;
        }

        Schema::connection('cdm')->create('note_nlp', function (Blueprint $table) {
            $table->bigInteger('note_nlp_id')->primary();
            $table->bigInteger('note_id');
            $table->integer('section_concept_id')->default(0);
            $table->string('snippet', 250)->nullable();
            $table->string('offset', 50)->nullable();
            $table->string('lexical_variant', 250);
            $table->integer('note_nlp_concept_id')->default(0);
            $table->integer('note_nlp_source_concept_id')->default(0);
            $table->string('nlp_system', 250)->nullable();
            $table->date('nlp_date');
            $table->timestamp('nlp_datetime')->nullable();
            $table->string('term_exists', 1)->nullable();
            $table->string('term_temporal', 50)->nullable();
            $table->string('term_modifiers', 2000)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('note_nlp');
    }
};
