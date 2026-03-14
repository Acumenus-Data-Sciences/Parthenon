<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('commons_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->string('original_name', 255);
            $table->string('stored_path', 500);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes');
            $table->timestamp('created_at')->useCurrent();

            $table->index('message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_attachments');
    }
};
