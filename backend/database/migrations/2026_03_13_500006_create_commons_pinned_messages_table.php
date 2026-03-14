<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_pinned_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('message_id')->constrained('commons_messages')->cascadeOnDelete();
            $table->foreignId('pinned_by')->constrained('users');
            $table->timestamp('pinned_at')->useCurrent();
            $table->unique(['channel_id', 'message_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_pinned_messages');
    }
};
