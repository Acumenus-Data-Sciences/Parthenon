<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_review_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('commons_messages')->cascadeOnDelete();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('reviewer_id')->nullable()->constrained('users');
            $table->string('status', 20)->default('pending'); // pending, approved, changes_requested
            $table->text('comment')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('channel_id');
            $table->index(['message_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_review_requests');
    }
};
