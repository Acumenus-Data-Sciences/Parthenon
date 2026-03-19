<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('observation_period')) {
            return;
        }

        Schema::connection('omop')->create('observation_period', function (Blueprint $table) {
            $table->bigInteger('observation_period_id')->primary();
            $table->bigInteger('person_id');
            $table->date('observation_period_start_date');
            $table->date('observation_period_end_date');
            $table->integer('period_type_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('observation_period');
    }
};
