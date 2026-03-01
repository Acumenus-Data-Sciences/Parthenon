<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingestion_job_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_format', 20);
            $table->bigInteger('file_size');
            $table->integer('row_count')->nullable();
            $table->integer('column_count')->nullable();
            $table->jsonb('format_metadata')->nullable();
            $table->string('storage_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_profiles');
    }
};
