<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.consent_decisions (
                id                    BIGSERIAL PRIMARY KEY,
                run_id                UUID,
                person_source_value   TEXT NOT NULL,
                decision              VARCHAR(16) NOT NULL CHECK (decision IN ('permit', 'deny')),
                consent_id            VARCHAR(128) NOT NULL,
                recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(consent_id)
            )
        SQL);

        DB::statement(
            'CREATE INDEX idx_consent_decisions_person ON app.consent_decisions (person_source_value)'
        );
        DB::statement(
            "CREATE INDEX idx_consent_decisions_deny ON app.consent_decisions (person_source_value) WHERE decision = 'deny'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.consent_decisions');
    }
};
