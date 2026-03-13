<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('commons_messages')->cascadeOnDelete();
            $table->text('body');
            $table->text('body_html')->nullable();
            $table->boolean('is_edited')->default(false);
            $table->timestamp('edited_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        DB::statement('CREATE INDEX idx_messages_channel_created ON commons_messages (channel_id, created_at DESC)');
        DB::statement('CREATE INDEX idx_messages_parent ON commons_messages (parent_id) WHERE parent_id IS NOT NULL');
        DB::statement("CREATE INDEX idx_messages_search ON commons_messages USING gin(to_tsvector('english', body))");
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_messages');
    }
};
