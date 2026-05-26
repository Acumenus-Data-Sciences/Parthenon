<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_agent_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_design_session_id')->constrained('study_design_sessions')->cascadeOnDelete();
            $table->foreignId('study_design_version_id')->nullable()->constrained('study_design_versions')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('anthropic_session_id')->nullable();
            $table->string('status', 32)->default('active'); // active|closed|error
            $table->decimal('cost_usd', 10, 4)->default(0);
            $table->unsignedBigInteger('tokens_in')->default(0);
            $table->unsignedBigInteger('tokens_out')->default(0);
            $table->unsignedBigInteger('token_id')->nullable(); // personal_access_tokens.id of the scoped token (for revocation)
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();
            $table->index(['study_design_session_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_agent_sessions');
    }
};
