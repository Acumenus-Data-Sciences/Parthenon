<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gis_datasets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('source');
            $table->string('source_version')->nullable();
            $table->string('source_url')->nullable();
            $table->string('data_type', 20);
            $table->string('geometry_type', 20)->nullable();
            $table->string('file_path')->nullable();
            $table->integer('feature_count')->default(0);
            $table->string('status', 20)->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamp('loaded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gis_datasets');
    }
};
