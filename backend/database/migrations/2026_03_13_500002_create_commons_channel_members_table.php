<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_channel_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 20)->default('member');
            $table->string('notification_preference', 20)->default('mentions');
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('joined_at')->useCurrent();

            $table->unique(['channel_id', 'user_id']);
            $table->index('user_id');
            $table->index('channel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_channel_members');
    }
};
