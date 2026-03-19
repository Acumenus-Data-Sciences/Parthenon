<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('drug_strength')) {
            return;
        }

        Schema::connection('omop')->create('drug_strength', function (Blueprint $table) {
            $table->id();
            $table->integer('drug_concept_id');
            $table->integer('ingredient_concept_id');
            $table->decimal('amount_value', 20, 6)->nullable();
            $table->integer('amount_unit_concept_id')->nullable();
            $table->decimal('numerator_value', 20, 6)->nullable();
            $table->integer('numerator_unit_concept_id')->nullable();
            $table->decimal('denominator_value', 20, 6)->nullable();
            $table->integer('denominator_unit_concept_id')->nullable();
            $table->integer('box_size')->nullable();
            $table->date('valid_start_date');
            $table->date('valid_end_date');
            $table->string('invalid_reason', 1)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('drug_strength');
    }
};
