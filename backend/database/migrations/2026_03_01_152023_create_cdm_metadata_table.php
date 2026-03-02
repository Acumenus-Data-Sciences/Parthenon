<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('metadata')) {
            return;
        }

        Schema::connection('cdm')->create('metadata', function (Blueprint $table) {
            $table->bigIncrements('metadata_id');
            $table->integer('metadata_concept_id');
            $table->integer('metadata_type_concept_id');
            $table->string('name', 250);
            $table->string('value_as_string', 250)->nullable();
            $table->integer('value_as_concept_id')->nullable();
            $table->decimal('value_as_number')->nullable();
            $table->date('metadata_date')->nullable();
            $table->timestamp('metadata_datetime')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('metadata');
    }
};
