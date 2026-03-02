<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::connection('vocab')->hasTable('concept_embeddings')) {
            Schema::connection('vocab')->create('concept_embeddings', function (Blueprint $table) {
                $table->integer('concept_id')->primary();
                $table->string('concept_name', 255);
            });
        }

        // Add pgvector column - must use raw SQL for vector type
        // Use schema-qualified type in case pgvector extension lives in a non-default schema
        if (! Schema::connection('vocab')->hasColumn('concept_embeddings', 'embedding')) {
            $vectorSchema = DB::connection('vocab')
                ->selectOne("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'vector'");

            $vectorType = $vectorSchema ? "{$vectorSchema->nspname}.vector" : 'vector';
            $table = Schema::connection('vocab')->hasTable('concept_embeddings')
                ? (str_contains(DB::connection('vocab')->getConfig('search_path'), 'vocab') ? 'vocab.concept_embeddings' : 'concept_embeddings')
                : 'concept_embeddings';

            DB::connection('vocab')->statement(
                "ALTER TABLE {$table} ADD COLUMN embedding {$vectorType}(768)"
            );
        }
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_embeddings');
    }
};
