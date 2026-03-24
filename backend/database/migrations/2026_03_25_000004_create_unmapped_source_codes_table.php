<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unmapped_source_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('release_id')->constrained('source_releases')->cascadeOnDelete();
            $table->string('source_code');
            $table->string('source_vocabulary_id', 50);
            $table->string('cdm_table', 100);
            $table->string('cdm_field', 100);
            $table->bigInteger('record_count');
            $table->timestamp('created_at');
            $table->index(['source_id', 'release_id']);
            $table->index('cdm_table');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unmapped_source_codes');
    }
};
