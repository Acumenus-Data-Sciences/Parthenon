<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('vocabulary')) {
            return;
        }

        Schema::connection('omop')->create('vocabulary', function (Blueprint $table) {
            $table->string('vocabulary_id', 20)->primary();
            $table->string('vocabulary_name', 255);
            $table->string('vocabulary_reference', 255)->nullable();
            $table->string('vocabulary_version', 255)->nullable();
            $table->integer('vocabulary_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('vocabulary');
    }
};
