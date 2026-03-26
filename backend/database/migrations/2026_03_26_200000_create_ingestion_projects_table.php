<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingestion_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users');
            $table->integer('file_count')->default(0);
            $table->bigInteger('total_size_bytes')->default(0);
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingestion_projects');
    }
};
