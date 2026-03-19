<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('concept')) {
            return;
        }

        Schema::connection('omop')->create('concept', function (Blueprint $table) {
            $table->integer('concept_id')->primary();
            $table->string('concept_name', 255);
            $table->string('domain_id', 20);
            $table->string('vocabulary_id', 20);
            $table->string('concept_class_id', 20);
            $table->string('standard_concept', 1)->nullable();
            $table->string('concept_code', 50);
            $table->date('valid_start_date');
            $table->date('valid_end_date');
            $table->string('invalid_reason', 1)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('concept');
    }
};
