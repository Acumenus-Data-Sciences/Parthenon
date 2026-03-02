<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dqd_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->uuid('run_id')->index();
            $table->string('check_id');
            $table->string('category', 30);
            $table->string('subcategory', 60);
            $table->string('cdm_table');
            $table->string('cdm_column')->nullable();
            $table->string('severity', 10);
            $table->decimal('threshold', 5, 2)->default(0);
            $table->boolean('passed');
            $table->unsignedBigInteger('violated_rows')->default(0);
            $table->unsignedBigInteger('total_rows')->default(0);
            $table->decimal('violation_percentage', 8, 4)->nullable();
            $table->text('description');
            $table->jsonb('details')->nullable();
            $table->unsignedInteger('execution_time_ms')->nullable();
            $table->timestamps();

            $table->index(['run_id', 'category']);
            $table->index(['run_id', 'cdm_table']);
            $table->index(['source_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dqd_results');
    }
};
