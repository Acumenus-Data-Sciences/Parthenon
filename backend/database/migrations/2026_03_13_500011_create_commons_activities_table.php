<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->nullable()->constrained('commons_channels')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 50); // member_joined, message_pinned, review_created, review_resolved, channel_created, file_shared
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('referenceable_type', 50)->nullable();
            $table->unsignedBigInteger('referenceable_id')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['channel_id', 'created_at']);
            $table->index('event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_activities');
    }
};
