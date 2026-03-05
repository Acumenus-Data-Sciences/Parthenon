<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vocabulary_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('status')->default('pending'); // pending, running, completed, failed
            $table->unsignedTinyInteger('progress_percentage')->default(0);
            $table->string('file_name');
            $table->string('storage_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->text('log_output')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedInteger('rows_loaded')->nullable();
            $table->string('target_schema')->nullable(); // resolved vocab schema (e.g. omop, eunomia)
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vocabulary_imports');
    }
};
