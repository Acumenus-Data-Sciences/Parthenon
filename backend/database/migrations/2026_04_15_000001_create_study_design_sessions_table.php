<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained('studies')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->unsignedBigInteger('active_version_id')->nullable();
            $table->string('title', 255);
            $table->string('status', 40)->default('draft');
            $table->string('source_mode', 80)->default('study_designer');
            $table->jsonb('settings_json')->nullable();
            $table->timestamps();

            $table->index(['study_id', 'status']);
            $table->index('active_version_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_sessions');
    }
};
