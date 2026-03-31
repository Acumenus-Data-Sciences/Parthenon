<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_honest_broker_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_honest_broker_link_id')->unique()->constrained('survey_honest_broker_links')->cascadeOnDelete();
            $table->string('preferred_channel', 20)->default('email');
            $table->text('delivery_email')->nullable();
            $table->text('delivery_phone')->nullable();
            $table->string('destination_hash', 64)->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('destination_hash', 'survey_hb_contacts_destination_index');
        });

        Schema::create('survey_honest_broker_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_campaign_id')->constrained('survey_campaigns')->cascadeOnDelete();
            $table->foreignId('survey_honest_broker_link_id')->constrained('survey_honest_broker_links')->cascadeOnDelete();
            $table->foreignId('survey_honest_broker_contact_id')->nullable()->constrained('survey_honest_broker_contacts')->nullOnDelete();
            $table->string('delivery_channel', 20)->default('email');
            $table->string('destination_hash', 64);
            $table->string('one_time_token_hash', 64)->unique();
            $table->string('token_last_four', 8);
            $table->string('delivery_status', 20)->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->text('last_error')->nullable();
            $table->string('message_subject', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['survey_campaign_id', 'delivery_status'], 'survey_hb_invitation_campaign_status_index');
            $table->index(['survey_honest_broker_link_id', 'created_at'], 'survey_hb_invitation_link_created_index');
        });

        Schema::create('survey_honest_broker_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_campaign_id')->nullable()->constrained('survey_campaigns')->nullOnDelete();
            $table->foreignId('survey_honest_broker_link_id')->nullable()->constrained('survey_honest_broker_links')->nullOnDelete();
            $table->foreignId('survey_honest_broker_invitation_id')->nullable()->constrained('survey_honest_broker_invitations')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 80);
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['survey_campaign_id', 'occurred_at'], 'survey_hb_audit_campaign_time_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_honest_broker_audit_logs');
        Schema::dropIfExists('survey_honest_broker_invitations');
        Schema::dropIfExists('survey_honest_broker_contacts');
    }
};
