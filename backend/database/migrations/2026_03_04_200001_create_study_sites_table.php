<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_sites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('site_role', 30)->default('data_partner'); // coordinating_center, data_partner, analytics_node, observer
            $table->string('status', 30)->default('invited'); // invited, onboarding, irb_pending, irb_approved, executing, results_submitted, completed, withdrawn, declined

            // IRB tracking
            $table->string('irb_protocol_number', 100)->nullable();
            $table->date('irb_approval_date')->nullable();
            $table->date('irb_expiry_date')->nullable();
            $table->string('irb_type', 30)->nullable(); // full_board, expedited, exempt, waiver, not_required

            // Data Use Agreement
            $table->timestamp('dua_signed_at')->nullable();

            // Site contact
            $table->foreignId('site_contact_user_id')->nullable()->constrained('users')->nullOnDelete();

            // CDM metadata
            $table->string('cdm_version', 10)->nullable();
            $table->string('vocabulary_version', 50)->nullable();
            $table->date('data_freshness_date')->nullable();
            $table->bigInteger('patient_count_estimate')->nullable();

            // Results
            $table->jsonb('feasibility_results')->nullable();
            $table->jsonb('execution_log')->nullable();
            $table->timestamp('results_received_at')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['study_id', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_sites');
    }
};
