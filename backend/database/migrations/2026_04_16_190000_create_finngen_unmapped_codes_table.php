<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Quick task 260416-qpg — FinnGen endpoint import sidecar.
 *
 * Records source codes from the FinnGen curated endpoint library that could
 * not be resolved against vocab.concept during import. Feeds the future
 * vocabulary-loading backlog (ICD-8 Finnish, ICDO3, KELA_REIMB, NOMESCO,
 * KELA_VNRO). Per-row traceability: which endpoint, which column, which
 * release — so the next vocab load knows exactly what to cover.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE app.finngen_unmapped_codes (
                id               BIGSERIAL    PRIMARY KEY,
                endpoint_name    VARCHAR(120) NOT NULL,
                source_code      VARCHAR(64)  NOT NULL,
                source_vocab     VARCHAR(32)  NOT NULL,
                release          VARCHAR(8)   NOT NULL,
                code_column      VARCHAR(32)  NOT NULL,
                observed_count   INTEGER      NOT NULL DEFAULT 1,
                created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        ');

        DB::statement('CREATE INDEX finngen_unmapped_endpoint_idx ON app.finngen_unmapped_codes (endpoint_name)');
        DB::statement('CREATE INDEX finngen_unmapped_vocab_idx ON app.finngen_unmapped_codes (source_vocab)');
        DB::statement('CREATE INDEX finngen_unmapped_release_idx ON app.finngen_unmapped_codes (release)');
        DB::statement('CREATE UNIQUE INDEX finngen_unmapped_unique ON app.finngen_unmapped_codes (endpoint_name, source_code, source_vocab, release)');

        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_unmapped_codes TO parthenon_app;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_unmapped_codes_id_seq TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_unmapped_codes');
    }
};
