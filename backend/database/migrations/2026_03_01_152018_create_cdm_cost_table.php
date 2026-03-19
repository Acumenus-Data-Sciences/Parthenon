<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('cost')) {
            return;
        }

        Schema::connection('omop')->create('cost', function (Blueprint $table) {
            $table->bigInteger('cost_id')->primary();
            $table->bigInteger('person_id');
            $table->bigInteger('cost_event_id');
            $table->integer('cost_event_field_concept_id');
            $table->integer('cost_concept_id');
            $table->integer('cost_type_concept_id');
            $table->integer('currency_concept_id')->default(0);
            $table->decimal('cost')->nullable();
            $table->date('incurred_date');
            $table->date('billed_date')->nullable();
            $table->date('paid_date')->nullable();
            $table->integer('revenue_code_concept_id')->default(0);
            $table->integer('drg_concept_id')->default(0);
            $table->string('cost_source_value', 50)->nullable();
            $table->integer('cost_source_concept_id')->default(0);
            $table->string('revenue_code_source_value', 50)->nullable();
            $table->string('drg_source_value', 3)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('cost');
    }
};
