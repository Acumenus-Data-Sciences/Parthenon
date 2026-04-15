<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('study_design_sessions')->cascadeOnDelete();
            $table->foreignId('version_id')->nullable()->constrained('study_design_versions')->nullOnDelete();
            $table->string('asset_type', 80);
            $table->string('role', 80)->nullable();
            $table->string('status', 40)->default('needs_review');
            $table->jsonb('draft_payload_json')->nullable();
            $table->string('canonical_type', 255)->nullable();
            $table->unsignedBigInteger('canonical_id')->nullable();
            $table->jsonb('provenance_json')->nullable();
            $table->string('verification_status', 32)->default('unverified');
            $table->jsonb('verification_json')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->decimal('rank_score', 6, 3)->nullable();
            $table->jsonb('rank_score_json')->nullable();
            $table->string('materialized_type', 128)->nullable();
            $table->unsignedBigInteger('materialized_id')->nullable();
            $table->timestamp('materialized_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['session_id', 'version_id', 'asset_type']);
            $table->index(['session_id', 'verification_status']);
            $table->index(['session_id', 'rank_score']);
            $table->index(['materialized_type', 'materialized_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_assets');
    }
};
