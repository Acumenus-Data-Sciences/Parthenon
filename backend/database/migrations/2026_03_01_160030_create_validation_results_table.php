<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('validation_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingestion_job_id')->constrained()->cascadeOnDelete();
            $table->string('check_name');
            $table->string('check_category', 30); // completeness, conformance, plausibility
            $table->string('cdm_table');
            $table->string('cdm_column')->nullable();
            $table->string('severity', 10); // error, warning, info
            $table->boolean('passed');
            $table->unsignedInteger('violated_rows')->default(0);
            $table->unsignedInteger('total_rows')->default(0);
            $table->decimal('violation_percentage', 5, 2)->nullable();
            $table->text('description');
            $table->jsonb('details')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('validation_results');
    }
};
