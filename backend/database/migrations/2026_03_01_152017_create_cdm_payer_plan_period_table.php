<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('payer_plan_period', function (Blueprint $table) {
            $table->bigInteger('payer_plan_period_id')->primary();
            $table->bigInteger('person_id');
            $table->date('payer_plan_period_start_date');
            $table->date('payer_plan_period_end_date');
            $table->integer('payer_concept_id')->default(0);
            $table->string('payer_source_value', 50)->nullable();
            $table->integer('payer_source_concept_id')->default(0);
            $table->integer('plan_concept_id')->default(0);
            $table->string('plan_source_value', 50)->nullable();
            $table->integer('plan_source_concept_id')->default(0);
            $table->integer('sponsor_concept_id')->default(0);
            $table->string('sponsor_source_value', 50)->nullable();
            $table->integer('sponsor_source_concept_id')->default(0);
            $table->string('family_source_value', 50)->nullable();
            $table->integer('stop_reason_concept_id')->default(0);
            $table->string('stop_reason_source_value', 50)->nullable();
            $table->integer('stop_reason_source_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('payer_plan_period');
    }
};
