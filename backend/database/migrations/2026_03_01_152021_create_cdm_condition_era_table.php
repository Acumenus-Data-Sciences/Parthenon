<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('condition_era')) {
            return;
        }

        Schema::connection('cdm')->create('condition_era', function (Blueprint $table) {
            $table->bigInteger('condition_era_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('condition_concept_id');
            $table->date('condition_era_start_date');
            $table->date('condition_era_end_date');
            $table->integer('condition_occurrence_count')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('condition_era');
    }
};
