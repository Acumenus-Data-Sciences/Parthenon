<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 GENOMICS-06 D-07/D-08/D-18 — create vocab.pgs_scores +
 * vocab.pgs_score_variants for PGS Catalog ingestion (`php artisan
 * parthenon:load-pgs-catalog --score-id=PGSxxxxxxx`, shipped in Plan 02).
 *
 * Prerequisite: migration 2026_04_25_000050_grant_vocab_create_to_migrator
 * must have run first (grants CREATE on schema vocab to
 * parthenon_migrator). A belt-and-suspenders `has_schema_privilege` check
 * throws early with the exact remediation command if the grant is missing.
 *
 * HIGHSEC §4.1 grants (D-18):
 *   - Owner: parthenon_migrator (receives CREATE via 000050)
 *   - parthenon_app:          SELECT only (read via /api/v1/pgs-catalog/scores)
 *   - parthenon_finngen_rw:   SELECT only (R worker reads weights TSV)
 *   - parthenon_finngen_ro:   SELECT only (Phase 16 read-only API)
 *   Ingestion writes (INSERT/UPDATE) are performed by parthenon_migrator
 *   via the Artisan command's DB_MIGRATION_* credentials.
 *
 * Idempotent via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
 * Re-running drops no data; the down() removes both tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Preflight: verify the 000050 prerequisite was applied. If missing,
        // fail loudly with the operator remediation rather than emit an
        // opaque "permission denied for schema vocab" from CREATE TABLE.
        $row = DB::selectOne(
            "SELECT has_schema_privilege(?, 'vocab', 'CREATE') AS c",
            [DB::connection()->getConfig('username')]
        );
        if (! (bool) ($row?->c ?? false)) {
            throw new RuntimeException(
                'Phase 17 migration vocab.pgs_scores requires CREATE on schema vocab. '
                .'Run the prerequisite migration 2026_04_25_000050_grant_vocab_create_to_migrator.php '
                .'first (must be applied by DB superuser or vocab schema owner).'
            );
        }

        DB::statement('
            CREATE TABLE IF NOT EXISTS vocab.pgs_scores (
                score_id              TEXT PRIMARY KEY,
                pgs_name              TEXT           NULL,
                trait_reported        TEXT           NULL,
                trait_efo_ids         TEXT[]         NULL,
                variants_number       INTEGER        NULL,
                ancestry_distribution JSONB          NULL,
                publication_doi       TEXT           NULL,
                license               TEXT           NULL,
                weights_file_url      TEXT           NULL,
                harmonized_file_url   TEXT           NULL,
                genome_build          VARCHAR(16)    NULL,
                loaded_at             TIMESTAMPTZ    NULL,
                created_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ');

        DB::statement("
            COMMENT ON TABLE vocab.pgs_scores IS
            'Phase 17 D-07 — PGS Catalog score metadata. One row per PGS000NNN. Populated by `php artisan parthenon:load-pgs-catalog --score-id=PGSxxxxxxx`.'
        ");

        DB::statement('
            CREATE TABLE IF NOT EXISTS vocab.pgs_score_variants (
                score_id                TEXT             NOT NULL,
                rsid                    TEXT             NULL,
                chrom                   VARCHAR(4)       NOT NULL,
                pos_grch38              BIGINT           NOT NULL,
                pos_grch37              BIGINT           NULL,
                effect_allele           VARCHAR(512)     NOT NULL,
                other_allele            VARCHAR(512)     NULL,
                effect_weight           DOUBLE PRECISION NOT NULL,
                frequency_effect_allele DOUBLE PRECISION NULL,
                allele_frequency        DOUBLE PRECISION NULL,
                created_at              TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (score_id, chrom, pos_grch38, effect_allele),
                CONSTRAINT pgs_score_variants_score_fk
                    FOREIGN KEY (score_id) REFERENCES vocab.pgs_scores(score_id) ON DELETE CASCADE
            )
        ');

        DB::statement('
            CREATE INDEX IF NOT EXISTS pgs_score_variants_score_idx
            ON vocab.pgs_score_variants (score_id)
        ');

        DB::statement("
            COMMENT ON TABLE vocab.pgs_score_variants IS
            'Phase 17 D-08 — per-variant weights for PGS Catalog scores. Composite PK (score_id, chrom, pos_grch38, effect_allele) handles multi-allelic + strand-flipped duplicates and enables ON CONFLICT DO NOTHING idempotent ingestion. Both GRCh37 and GRCh38 positions stored for source-build flexibility.'
        ");

        // HIGHSEC §4.1 grants (D-18). vocab.pgs_* is read-only from the
        // Laravel app's perspective — writes happen via the Artisan command
        // running as parthenon_migrator. Three-role guard pattern mirrors
        // 2026_04_19_000200_create_finngen_gwas_covariate_sets_table.php.
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT USAGE ON SCHEMA vocab TO parthenon_app;
                    GRANT SELECT ON vocab.pgs_scores TO parthenon_app;
                    GRANT SELECT ON vocab.pgs_score_variants TO parthenon_app;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                    GRANT USAGE ON SCHEMA vocab TO parthenon_finngen_rw;
                    GRANT SELECT ON vocab.pgs_scores TO parthenon_finngen_rw;
                    GRANT SELECT ON vocab.pgs_score_variants TO parthenon_finngen_rw;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                    GRANT USAGE ON SCHEMA vocab TO parthenon_finngen_ro;
                    GRANT SELECT ON vocab.pgs_scores TO parthenon_finngen_ro;
                    GRANT SELECT ON vocab.pgs_score_variants TO parthenon_finngen_ro;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS vocab.pgs_score_variants');
        DB::statement('DROP TABLE IF EXISTS vocab.pgs_scores');
    }
};
