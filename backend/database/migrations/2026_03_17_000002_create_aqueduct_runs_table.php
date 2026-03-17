<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aqueduct_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->nullable()->constrained('aqueduct_sessions')->nullOnDelete();
            $table->string('service_name', 80);
            $table->string('status', 20)->default('ok');
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('source_snapshot')->nullable();
            $table->jsonb('request_payload')->nullable();
            $table->jsonb('result_payload')->nullable();
            $table->jsonb('runtime_payload')->nullable();
            $table->jsonb('artifact_index')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['service_name', 'source_id']);
            $table->index('session_id');
            $table->index('submitted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aqueduct_runs');
    }
};
