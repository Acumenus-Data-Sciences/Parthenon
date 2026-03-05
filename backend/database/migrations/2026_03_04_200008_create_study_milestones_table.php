<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('milestone_type', 30); // protocol_finalized, irb_submitted, irb_approved, feasibility_complete, code_validated, execution_started, all_sites_complete, synthesis_complete, manuscript_submitted, published, custom
            $table->date('target_date')->nullable();
            $table->date('actual_date')->nullable();
            $table->string('status', 20)->default('pending'); // pending, in_progress, completed, overdue, skipped
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_milestones');
    }
};
