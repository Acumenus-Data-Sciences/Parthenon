<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_message_reactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('message_id');
            $table->unsignedBigInteger('user_id');
            $table->string('emoji', 20);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('message_id')
                ->references('id')->on('commons_messages')
                ->onDelete('cascade');
            $table->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade');

            $table->unique(['message_id', 'user_id', 'emoji'], 'reactions_unique');
            $table->index('message_id', 'reactions_message_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_message_reactions');
    }
};
