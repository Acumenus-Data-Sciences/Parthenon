<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::connection('omop')->hasTable('concept_embeddings')) {
            Schema::connection('omop')->create('concept_embeddings', function (Blueprint $table) {
                $table->integer('concept_id')->primary();
                $table->string('concept_name', 255);
            });
        }

        // Add pgvector column - must use raw SQL for vector type
        // Use schema-qualified type in case pgvector extension lives in a non-default schema
        if (! Schema::connection('omop')->hasColumn('concept_embeddings', 'embedding')) {
            try {
                $vectorSchema = DB::connection('omop')
                    ->selectOne("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'vector'");

                $vectorType = $vectorSchema ? "{$vectorSchema->nspname}.vector" : 'vector';

                DB::connection('omop')->statement(
                    "ALTER TABLE concept_embeddings ADD COLUMN embedding {$vectorType}(768)"
                );
            } catch (Throwable) {
                // pgvector may not be installed in CI — skip silently
            }
        }
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('concept_embeddings');
    }
};
