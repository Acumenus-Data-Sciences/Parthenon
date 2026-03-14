<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->nullable()->constrained('commons_channels')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('body');
            $table->text('body_html')->nullable();
            $table->string('category', 50)->default('general'); // general, study_recruitment, data_update, milestone, policy
            $table->boolean('is_pinned')->default(false);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['channel_id', 'created_at']);
            $table->index('category');
        });

        Schema::create('commons_announcement_bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->constrained('commons_announcements')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['announcement_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_announcement_bookmarks');
        Schema::dropIfExists('commons_announcements');
    }
};
