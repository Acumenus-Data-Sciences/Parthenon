<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        try {
            // Ensure vector extension exists; it may live in a non-default schema.
            DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
        } catch (Throwable) {
            // Some test/CI databases do not allow extension creation.
        }

        $vectorSchema = null;
        try {
            $vectorSchema = DB::selectOne(
                "SELECT n.nspname
                 FROM pg_extension e
                 JOIN pg_namespace n ON e.extnamespace = n.oid
                 WHERE e.extname = 'vector'"
            );
        } catch (Throwable) {
            $vectorSchema = null;
        }

        if (! $vectorSchema) {
            return;
        }

        $vectorType = "{$vectorSchema->nspname}.vector";
        $vectorOps = "{$vectorSchema->nspname}.vector_cosine_ops";

        DB::statement(
            "ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding {$vectorType}(384)"
        );
        DB::statement(
            "ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding_model varchar(100) DEFAULT 'all-MiniLM-L6-v2'"
        );
        DB::statement(
            "CREATE INDEX IF NOT EXISTS idx_abby_messages_embedding ON app.abby_messages USING hnsw (embedding {$vectorOps})"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_abby_messages_embedding');
        DB::statement('ALTER TABLE app.abby_messages DROP COLUMN IF EXISTS embedding_model');
        DB::statement('ALTER TABLE app.abby_messages DROP COLUMN IF EXISTS embedding');
    }
};
