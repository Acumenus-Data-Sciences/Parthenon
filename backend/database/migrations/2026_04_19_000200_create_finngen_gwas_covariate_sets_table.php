<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 14 (D-17 per .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 *
 * Registry of reusable GWAS covariate sets. Each set declares its columns
 * as a JSONB array of descriptors (e.g.
 * `{"source":"person.year_of_birth → age","column_name":"age"}`).
 *
 * `covariate_columns_hash` is SHA-256 hex of the canonical JSON of
 * `covariate_columns` — denormalized per RESEARCH §Open Questions Q5 so the
 * cache-key hasher (Wave 2) can read it in O(1) without re-hashing the
 * JSONB on every dispatch. Maintained by a saving Eloquent observer
 * (`GwasCovariateSet::saving`) added in Wave 2.
 *
 * Default set is seeded by FinnGenGwasCovariateSetSeeder (D-18):
 * "Default (age + sex + 10 PCs)".
 *
 * FLAG: under Phase 13.2 FinnGen schema isolation, slated to move to
 * `finngen.gwas_covariate_sets`. Wave 2 Eloquent models should declare
 * `protected $table` so the rename is a one-line change.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE app.finngen_gwas_covariate_sets (
                id                      BIGSERIAL    PRIMARY KEY,
                name                    VARCHAR(200) NOT NULL,
                description             TEXT         NULL,
                owner_user_id           BIGINT       NULL REFERENCES app.users(id) ON DELETE SET NULL,
                covariate_columns       JSONB        NOT NULL,
                covariate_columns_hash  CHAR(64)     NOT NULL,
                is_default              BOOLEAN      NOT NULL DEFAULT false,
                created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT finngen_gwas_covariate_sets_name_unique UNIQUE (name)
            )
        ');

        // BTREE on the hash — used as a cache-key input by the Wave 2
        // GwasCacheKeyHasher so it can look up a covariate set by hash in O(1).
        DB::statement('CREATE INDEX finngen_gwas_covariate_sets_hash_idx ON app.finngen_gwas_covariate_sets (covariate_columns_hash)');

        // Partial unique index enforces exactly one row can have is_default=true
        // at any given moment. Prevents "who is the default?" ambiguity.
        DB::statement('CREATE UNIQUE INDEX finngen_gwas_covariate_sets_one_default ON app.finngen_gwas_covariate_sets ((is_default)) WHERE is_default = true');

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
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_gwas_covariate_sets TO parthenon_app;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_gwas_covariate_sets_id_seq TO parthenon_app;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_gwas_covariate_sets TO parthenon_finngen_rw;
                    GRANT USAGE, SELECT ON SEQUENCE app.finngen_gwas_covariate_sets_id_seq TO parthenon_finngen_rw;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                    GRANT SELECT ON app.finngen_gwas_covariate_sets TO parthenon_finngen_ro;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_gwas_covariate_sets');
    }
};
