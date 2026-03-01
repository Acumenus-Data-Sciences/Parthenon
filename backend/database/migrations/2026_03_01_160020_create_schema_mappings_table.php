<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schema_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingestion_job_id')->constrained()->cascadeOnDelete();
            $table->string('source_table');
            $table->string('source_column');
            $table->string('cdm_table')->nullable();
            $table->string('cdm_column')->nullable();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->string('mapping_logic', 30)->nullable(); // direct, transform, concat, lookup, constant
            $table->jsonb('transform_config')->nullable();
            $table->boolean('is_confirmed')->default(false);
            $table->timestamps();
            $table->index('ingestion_job_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schema_mappings');
    }
};
