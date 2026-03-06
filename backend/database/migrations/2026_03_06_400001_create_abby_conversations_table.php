<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abby_conversations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('title', 500)->nullable();
            $table->string('page_context', 64)->default('general');
            $table->timestamps();

            $table->index('user_id');
        });

        Schema::create('abby_messages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('conversation_id')->constrained('abby_conversations')->onDelete('cascade');
            $table->string('role', 16);
            $table->text('content');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index('conversation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abby_messages');
        Schema::dropIfExists('abby_conversations');
    }
};
