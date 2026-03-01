<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analysis_executions', function (Blueprint $table) {
            $table->id();
            $table->string('analysis_type');
            $table->unsignedBigInteger('analysis_id');
            $table->foreignId('source_id')->constrained('sources');
            $table->string('status')->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->jsonb('result_json')->nullable();
            $table->text('fail_message')->nullable();
            $table->timestamps();

            $table->index(['analysis_type', 'analysis_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analysis_executions');
    }
};
