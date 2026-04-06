<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::scalar("select to_regclass('app.abby_messages')");
        if ($exists) {
            return;
        }

        DB::statement(<<<'SQL'
            CREATE TABLE app.abby_messages (
                id bigserial PRIMARY KEY,
                conversation_id bigint NOT NULL REFERENCES app.abby_conversations(id) ON DELETE CASCADE,
                role varchar(16) NOT NULL,
                content text NOT NULL,
                metadata jsonb NULL,
                created_at timestamp NULL
            )
        SQL);

        DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_messages_conversation_id ON app.abby_messages (conversation_id)');

        $vectorTypeExists = DB::scalar("select to_regtype('vector') is not null");
        if ($vectorTypeExists) {
            DB::statement('ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding vector(384)');
            DB::statement("ALTER TABLE app.abby_messages ADD COLUMN IF NOT EXISTS embedding_model varchar(100) DEFAULT 'all-MiniLM-L6-v2'");
            DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_messages_embedding ON app.abby_messages USING hnsw (embedding vector_cosine_ops)');
        }
    }

    public function down(): void
    {
        // Corrective migration: do not drop a recovered production table on rollback.
    }
};
