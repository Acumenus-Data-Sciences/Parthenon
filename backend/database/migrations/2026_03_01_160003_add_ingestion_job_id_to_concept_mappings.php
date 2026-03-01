<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_mappings', function (Blueprint $table) {
            $table->foreignId('ingestion_job_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('source_table')->nullable();
            $table->string('source_column')->nullable();
            $table->unsignedInteger('source_frequency')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('concept_mappings', function (Blueprint $table) {
            $table->dropForeign(['ingestion_job_id']);
            $table->dropColumn(['ingestion_job_id', 'source_table', 'source_column', 'source_frequency']);
        });
    }
};
