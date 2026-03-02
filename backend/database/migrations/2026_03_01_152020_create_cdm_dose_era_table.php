<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('dose_era')) {
            return;
        }

        Schema::connection('cdm')->create('dose_era', function (Blueprint $table) {
            $table->bigInteger('dose_era_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('drug_concept_id');
            $table->integer('unit_concept_id');
            $table->decimal('dose_value');
            $table->date('dose_era_start_date');
            $table->date('dose_era_end_date');
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('dose_era');
    }
};
