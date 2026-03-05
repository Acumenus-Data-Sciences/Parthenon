<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_executions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->foreignId('study_analysis_id')->constrained('study_analyses')->cascadeOnDelete();
            $table->foreignId('site_id')->nullable()->constrained('study_sites')->nullOnDelete();
            $table->string('status', 20)->default('queued'); // queued, running, completed, failed, cancelled, timeout
            $table->foreignId('submitted_by')->constrained('users');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('execution_engine', 30)->default('hades_r'); // hades_r, strategic_sql, python_fastapi, custom
            $table->jsonb('execution_params')->nullable();
            $table->text('log_output')->nullable();
            $table->text('error_message')->nullable();
            $table->string('result_hash', 64)->nullable(); // SHA-256
            $table->string('result_file_path', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_executions');
    }
};
