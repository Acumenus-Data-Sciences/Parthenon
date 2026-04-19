<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('vocab')->hasTable('concept_synonym')) {
            return;
        }

        Schema::connection('vocab')->create('concept_synonym', function (Blueprint $table) {
            $table->id();
            $table->integer('concept_id');
            $table->string('concept_synonym_name', 1000);
            $table->integer('language_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_synonym');
    }
};
