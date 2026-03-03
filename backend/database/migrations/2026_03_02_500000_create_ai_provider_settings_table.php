<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_provider_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider_type', 50)->unique();
            $table->string('display_name', 100);
            $table->boolean('is_enabled')->default(false);
            $table->boolean('is_active')->default(false);
            $table->string('model', 200)->default('');
            $table->text('settings')->nullable(); // encrypted:array (api_key, base_url, etc.)
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_provider_settings');
    }
};
