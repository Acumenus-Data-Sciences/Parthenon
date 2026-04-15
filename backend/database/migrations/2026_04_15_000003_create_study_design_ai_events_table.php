<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_ai_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('study_design_sessions')->cascadeOnDelete();
            $table->foreignId('version_id')->nullable()->constrained('study_design_versions')->nullOnDelete();
            $table->string('event_type', 80);
            $table->string('provider', 80);
            $table->string('model', 120)->nullable();
            $table->string('prompt_sha256', 64)->nullable();
            $table->jsonb('input_json')->nullable();
            $table->jsonb('output_json')->nullable();
            $table->jsonb('safety_json')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['session_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_ai_events');
    }
};
