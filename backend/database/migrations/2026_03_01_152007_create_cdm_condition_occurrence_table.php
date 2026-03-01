<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('condition_occurrence', function (Blueprint $table) {
            $table->bigInteger('condition_occurrence_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('condition_concept_id');
            $table->date('condition_start_date');
            $table->timestamp('condition_start_datetime')->nullable();
            $table->date('condition_end_date')->nullable();
            $table->timestamp('condition_end_datetime')->nullable();
            $table->integer('condition_type_concept_id');
            $table->integer('condition_status_concept_id')->default(0);
            $table->string('stop_reason', 20)->nullable();
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('condition_source_value', 50)->nullable();
            $table->integer('condition_source_concept_id')->default(0);
            $table->string('condition_status_source_value', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('condition_occurrence');
    }
};
