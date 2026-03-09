<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pacs_connections', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('type', 50);
            $table->text('base_url');
            $table->string('auth_type', 50)->default('none');
            $table->text('credentials')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->timestamp('last_health_check_at')->nullable();
            $table->string('last_health_status', 20)->nullable();
            $table->jsonb('metadata_cache')->nullable();
            $table->timestamp('metadata_cached_at')->nullable();
            $table->timestamps();
            $table->index('is_active');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pacs_connections');
    }
};
