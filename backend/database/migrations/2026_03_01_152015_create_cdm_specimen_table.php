<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('specimen', function (Blueprint $table) {
            $table->bigInteger('specimen_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('specimen_concept_id');
            $table->integer('specimen_type_concept_id');
            $table->date('specimen_date');
            $table->timestamp('specimen_datetime')->nullable();
            $table->decimal('quantity')->nullable();
            $table->integer('unit_concept_id')->default(0);
            $table->integer('anatomic_site_concept_id')->default(0);
            $table->integer('disease_status_concept_id')->default(0);
            $table->string('specimen_source_id', 50)->nullable();
            $table->string('specimen_source_value', 50)->nullable();
            $table->string('unit_source_value', 50)->nullable();
            $table->string('anatomic_site_source_value', 50)->nullable();
            $table->string('disease_status_source_value', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('specimen');
    }
};
