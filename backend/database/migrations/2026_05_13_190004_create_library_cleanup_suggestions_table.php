<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_cleanup_suggestions', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id');
            $table->string('item_type', 64);
            $table->unsignedBigInteger('item_id');
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamp('computed_at');

            $table->primary(['user_id', 'item_type', 'item_id']);
            $table->index('computed_at');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_cleanup_suggestions');
    }
};
