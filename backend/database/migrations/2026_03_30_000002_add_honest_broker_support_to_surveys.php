<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_campaigns', function (Blueprint $table) {
            $table->boolean('requires_honest_broker')->default(false)->after('description');
        });

        Schema::create('survey_honest_broker_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_campaign_id')->constrained('survey_campaigns')->cascadeOnDelete();
            $table->foreignId('survey_conduct_id')->nullable()->constrained('survey_conduct')->nullOnDelete();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->foreignId('cohort_generation_id')->nullable()->constrained('cohort_generations')->nullOnDelete();
            $table->string('blinded_participant_id', 64)->unique();
            $table->string('respondent_identifier_hash', 64);
            $table->text('respondent_identifier')->nullable();
            $table->string('match_status', 20)->default('registered');
            $table->timestamp('submitted_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['survey_campaign_id', 'respondent_identifier_hash'], 'survey_hb_campaign_identifier_unique');
            $table->index(['survey_campaign_id', 'person_id'], 'survey_hb_campaign_person_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_honest_broker_links');

        Schema::table('survey_campaigns', function (Blueprint $table) {
            $table->dropColumn('requires_honest_broker');
        });
    }
};
