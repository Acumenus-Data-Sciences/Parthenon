<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('cdm_source')) {
            return;
        }

        Schema::connection('cdm')->create('cdm_source', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('cdm_source_name', 255);
            $table->string('cdm_source_abbreviation', 25);
            $table->string('cdm_holder', 255);
            $table->text('source_description')->nullable();
            $table->string('source_documentation_reference', 255)->nullable();
            $table->string('cdm_etl_reference', 255)->nullable();
            $table->date('source_release_date');
            $table->date('cdm_release_date');
            $table->string('cdm_version', 10)->nullable();
            $table->integer('cdm_version_concept_id');
            $table->string('vocabulary_version', 20);
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('cdm_source');
    }
};
