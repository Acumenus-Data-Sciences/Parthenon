<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('similarity_dimensions', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->float('default_weight')->default(1.0);
            $table->boolean('is_active')->default(true);
            $table->jsonb('config')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('similarity_dimensions');
    }
};
