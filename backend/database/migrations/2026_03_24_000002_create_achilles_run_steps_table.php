<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_run_steps', function (Blueprint $table) {
            $table->id();
            $table->uuid('run_id');
            $table->unsignedInteger('analysis_id');
            $table->string('analysis_name');
            $table->string('category', 50);
            $table->string('status', 20)->default('pending');
            $table->float('elapsed_seconds')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('run_id');
            $table->index(['run_id', 'category']);
            $table->unique(['run_id', 'analysis_id']);
            $table->foreign('run_id')->references('run_id')->on('achilles_runs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_run_steps');
    }
};
