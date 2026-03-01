<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sources', function (Blueprint $table) {
            $table->id();
            $table->string('source_name');
            $table->string('source_key')->unique();
            $table->string('source_dialect')->default('postgresql');
            $table->text('source_connection');
            $table->string('username')->nullable();
            $table->text('password')->nullable();
            $table->boolean('is_cache_enabled')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sources');
    }
};
