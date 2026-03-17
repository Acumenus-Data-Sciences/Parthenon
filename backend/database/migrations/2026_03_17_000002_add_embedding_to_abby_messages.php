<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure vector extension exists; it may live in 'omop' schema on production hosts
        DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
        // Include omop in search_path so the vector type is resolvable regardless of which
        // schema the extension was installed into
        DB::statement('SET search_path TO app,omop,public');
        DB::statement('ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding vector(384)');
        DB::statement("ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding_model varchar(100) DEFAULT 'all-MiniLM-L6-v2'");
        DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_messages_embedding ON app.abby_messages USING hnsw (embedding vector_cosine_ops)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_abby_messages_embedding');
        DB::statement('ALTER TABLE app.abby_messages DROP COLUMN IF EXISTS embedding_model');
        DB::statement('ALTER TABLE app.abby_messages DROP COLUMN IF EXISTS embedding');
    }
};
