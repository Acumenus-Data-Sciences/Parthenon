<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('drug_era')) {
            return;
        }

        Schema::connection('omop')->create('drug_era', function (Blueprint $table) {
            $table->bigInteger('drug_era_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('drug_concept_id');
            $table->date('drug_era_start_date');
            $table->date('drug_era_end_date');
            $table->integer('drug_exposure_count')->nullable();
            $table->integer('gap_days')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('drug_era');
    }
};
