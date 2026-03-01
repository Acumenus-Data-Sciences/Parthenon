<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mapping_candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_mapping_id')->constrained()->cascadeOnDelete();
            $table->integer('target_concept_id');
            $table->string('concept_name');
            $table->string('domain_id', 20);
            $table->string('vocabulary_id', 20);
            $table->string('standard_concept', 1)->nullable();
            $table->decimal('score', 5, 4);
            $table->string('strategy', 30);
            $table->jsonb('strategy_scores')->nullable();
            $table->unsignedSmallInteger('rank');
            $table->timestamps();

            $table->index(['concept_mapping_id', 'rank']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mapping_candidates');
    }
};
