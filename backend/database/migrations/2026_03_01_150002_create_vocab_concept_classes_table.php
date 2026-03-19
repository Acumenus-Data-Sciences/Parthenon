<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('concept_class')) {
            return;
        }

        Schema::connection('omop')->create('concept_class', function (Blueprint $table) {
            $table->string('concept_class_id', 20)->primary();
            $table->string('concept_class_name', 255);
            $table->integer('concept_class_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('concept_class');
    }
};
