<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('profile', 64);                              // e.g. study_design, publish
            $table->string('subject_type', 64);                         // e.g. study_design_session, publication_draft
            $table->unsignedBigInteger('subject_id');                   // PK of the subject row
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('anthropic_session_id')->nullable();         // Anthropic session id for resume
            $table->string('status', 32)->default('active');            // active|closed|error
            $table->decimal('cost_usd', 10, 4)->default(0);            // cumulative cost
            $table->unsignedBigInteger('tokens_in')->default(0);        // cumulative input tokens
            $table->unsignedBigInteger('tokens_out')->default(0);       // cumulative output tokens
            $table->unsignedBigInteger('token_id')->nullable();         // personal_access_tokens.id of scoped Sanctum token
            $table->jsonb('context_json')->nullable();                   // profile-specific context bag
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();

            $table->index(['profile', 'subject_type', 'subject_id']);
        });

        // ADDITIVE copy: migrate any existing study_design_agent_sessions rows.
        // Never drops the source table — leave it orphaned (empty on prod).
        if (Schema::hasTable('study_design_agent_sessions')) {
            DB::table('study_design_agent_sessions')->orderBy('id')->each(function ($row): void {
                DB::table('agent_sessions')->insert([
                    'profile' => 'study_design',
                    'subject_type' => 'study_design_session',
                    'subject_id' => $row->study_design_session_id,
                    'user_id' => $row->user_id,
                    'anthropic_session_id' => $row->anthropic_session_id,
                    'status' => $row->status,
                    'cost_usd' => $row->cost_usd,
                    'tokens_in' => $row->tokens_in,
                    'tokens_out' => $row->tokens_out,
                    'token_id' => $row->token_id,
                    'context_json' => json_encode(['version_id' => $row->study_design_version_id]),
                    'last_active_at' => $row->last_active_at,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ]);
            });
        }
    }

    public function down(): void
    {
        // Drop only the table this migration created — never touch study_design_agent_sessions.
        Schema::dropIfExists('agent_sessions');
    }
};
