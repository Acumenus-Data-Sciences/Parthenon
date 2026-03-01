<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('vocab')->create('source_to_concept_maps', function (Blueprint $table) {
            $table->id();
            $table->string('source_code', 50);
            $table->integer('source_concept_id');
            $table->string('source_vocabulary_id', 20);
            $table->string('source_code_description', 255)->nullable();
            $table->integer('target_concept_id');
            $table->string('target_vocabulary_id', 20);
            $table->date('valid_start_date');
            $table->date('valid_end_date');
            $table->string('invalid_reason', 1)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('source_to_concept_maps');
    }
};
