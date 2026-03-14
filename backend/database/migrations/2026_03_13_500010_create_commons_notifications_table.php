<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 50); // mention, dm, review_assigned, review_resolved, thread_reply
            $table->string('title', 255);
            $table->text('body')->nullable();
            $table->foreignId('channel_id')->nullable()->constrained('commons_channels')->nullOnDelete();
            $table->foreignId('message_id')->nullable()->constrained('commons_messages')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_notifications');
    }
};
