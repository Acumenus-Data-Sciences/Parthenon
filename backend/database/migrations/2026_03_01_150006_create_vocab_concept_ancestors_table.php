<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('vocab')->hasTable('concept_ancestor')) {
            return;
        }

        Schema::connection('vocab')->create('concept_ancestor', function (Blueprint $table) {
            $table->integer('ancestor_concept_id');
            $table->integer('descendant_concept_id');
            $table->integer('min_levels_of_separation');
            $table->integer('max_levels_of_separation');

            $table->primary(['ancestor_concept_id', 'descendant_concept_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_ancestor');
    }
};
