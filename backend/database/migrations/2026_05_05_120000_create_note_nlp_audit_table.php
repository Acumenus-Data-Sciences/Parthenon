<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.note_nlp_audit (
                id                  BIGSERIAL PRIMARY KEY,
                note_nlp_id         BIGINT NOT NULL,
                model_name          VARCHAR(128) NOT NULL,
                prompt_version      VARCHAR(32) NOT NULL,
                token_offsets       JSONB NOT NULL,
                concept_mappings    JSONB NOT NULL,
                raw_input           TEXT,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ttl_at              TIMESTAMPTZ NOT NULL
            )
        SQL);

        DB::statement('CREATE INDEX idx_note_nlp_audit_note_nlp_id ON app.note_nlp_audit (note_nlp_id)');
        DB::statement('CREATE INDEX idx_note_nlp_audit_ttl ON app.note_nlp_audit (ttl_at) WHERE raw_input IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.note_nlp_audit');
    }
};
