<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('observation')) {
            return;
        }

        Schema::connection('cdm')->create('observation', function (Blueprint $table) {
            $table->bigInteger('observation_id')->primary();
            $table->bigInteger('person_id');
            $table->integer('observation_concept_id');
            $table->date('observation_date');
            $table->timestamp('observation_datetime')->nullable();
            $table->integer('observation_type_concept_id');
            $table->decimal('value_as_number')->nullable();
            $table->string('value_as_string', 60)->nullable();
            $table->integer('value_as_concept_id')->default(0);
            $table->integer('qualifier_concept_id')->default(0);
            $table->integer('unit_concept_id')->default(0);
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('observation_source_value', 50)->nullable();
            $table->integer('observation_source_concept_id')->default(0);
            $table->string('unit_source_value', 50)->nullable();
            $table->string('qualifier_source_value', 50)->nullable();
            $table->string('value_source_value', 50)->nullable();
            $table->bigInteger('observation_event_id')->nullable();
            $table->integer('obs_event_field_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('observation');
    }
};
