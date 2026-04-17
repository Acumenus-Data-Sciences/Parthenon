<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 14 (D-07 per .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 *
 * Tracks which CDM sources have had their aligned VCFs converted to PGEN +
 * top-20 PC TSVs by `php artisan finngen:prepare-source-variants`. Phase 15
 * dispatch checks this table and returns 422 if the target source has no
 * row (D-08).
 *
 * FLAG: under Phase 13.2 FinnGen schema isolation, this table is slated to
 * move from `app.finngen_source_variant_indexes` to
 * `finngen.source_variant_indexes`. Consumers should route through the
 * SourceVariantIndex Eloquent model rather than literal SQL so the rename
 * is a one-line model change.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE app.finngen_source_variant_indexes (
                id                BIGSERIAL    PRIMARY KEY,
                source_key        VARCHAR(64)  NOT NULL,
                format            VARCHAR(16)  NOT NULL DEFAULT \'pgen\',
                pgen_path         TEXT         NOT NULL,
                pc_tsv_path       TEXT         NULL,
                variant_count     BIGINT       NULL,
                sample_count      INTEGER      NULL,
                pc_count          INTEGER      NOT NULL DEFAULT 20,
                built_at          TIMESTAMPTZ  NULL,
                built_by_user_id  BIGINT       NULL REFERENCES app.users(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT finngen_source_variant_indexes_source_key_unique UNIQUE (source_key),
                CONSTRAINT finngen_source_variant_indexes_format_chk CHECK (format IN (\'pgen\'))
            )
        ');

        DB::statement('CREATE INDEX finngen_source_variant_indexes_built_at_idx ON app.finngen_source_variant_indexes (built_at)');

        // Three-tier HIGHSEC grants (per project_parthenon_pg_roles):
        //   parthenon_app         — runtime role for the Laravel app (DML).
        //   parthenon_finngen_rw  — async FinnGen writers (DML).
        //   parthenon_finngen_ro  — sync FinnGen readers (SELECT only).
        // Each block is guarded by a pg_roles existence check so dev stacks
        // that have not provisioned the FinnGen roles still apply cleanly.
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_source_variant_indexes TO parthenon_app;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_source_variant_indexes_id_seq TO parthenon_app;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_source_variant_indexes TO parthenon_finngen_rw;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_source_variant_indexes_id_seq TO parthenon_finngen_rw;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                    GRANT SELECT ON app.finngen_source_variant_indexes TO parthenon_finngen_ro;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_source_variant_indexes');
    }
};
