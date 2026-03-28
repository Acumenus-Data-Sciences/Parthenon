<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->string('room_name')->unique();
            $table->string('call_type')->default('video');
            $table->string('status')->default('active');
            $table->foreignId('started_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['channel_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_calls');
    }
};
