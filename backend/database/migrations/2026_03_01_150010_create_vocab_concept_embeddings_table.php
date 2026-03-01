<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('vocab')->create('concept_embeddings', function (Blueprint $table) {
            $table->integer('concept_id')->primary();
            $table->string('concept_name', 255);
        });

        // Add pgvector column - must use raw SQL for vector type
        DB::connection('vocab')->statement(
            'ALTER TABLE vocab.concept_embeddings ADD COLUMN embedding vector(768)'
        );
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_embeddings');
    }
};
