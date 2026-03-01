<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('execution_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('analysis_executions')->cascadeOnDelete();
            $table->string('level')->default('info');
            $table->text('message');
            $table->jsonb('context')->nullable();
            $table->timestamps();

            $table->index('execution_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('execution_logs');
    }
};
