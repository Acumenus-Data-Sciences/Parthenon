<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dqd_deltas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('current_release_id')->constrained('source_releases')->cascadeOnDelete();
            $table->foreignId('previous_release_id')->nullable()->constrained('source_releases')->nullOnDelete();
            $table->string('check_id', 100);
            $table->string('delta_status', 20);
            $table->boolean('current_passed');
            $table->boolean('previous_passed')->nullable();
            $table->timestamp('created_at');
            $table->index('current_release_id');
            $table->index(['source_id', 'current_release_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dqd_deltas');
    }
};
