<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('study_design_sessions')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('status', 40)->default('draft');
            $table->jsonb('intent_json')->nullable();
            $table->jsonb('normalized_spec_json')->nullable();
            $table->jsonb('provenance_json')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamps();

            $table->unique(['session_id', 'version_number']);
            $table->index(['session_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_versions');
    }
};
