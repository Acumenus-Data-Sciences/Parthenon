<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.1 — The one authoritative FinnGen schema-isolation migration.
 *
 * Moves all FinnGen persistence out of `app.*` into a dedicated `finngen.*`
 * schema inside the `parthenon` DB. After this migration:
 *
 *   - `finngen` schema exists (owner: parthenon_owner; grants to
 *     parthenon_app / parthenon_finngen_ro / parthenon_finngen_rw per
 *     HIGHSEC §4.1).
 *   - 6 existing `app.finngen_*` tables live in `finngen.*` with the
 *     `finngen_` prefix stripped (analysis_modules, runs, workbench_sessions,
 *     unmapped_codes, endpoint_generations, endpoint_expressions_pre_phase13).
 *   - A new `finngen.endpoint_definitions` table holds the 5,161 FinnGen
 *     endpoints projected out of `app.cohort_definitions WHERE domain =
 *     'finngen-endpoint'` with purpose-built typed columns (CONTEXT.md D-04).
 *   - `app.cohort_definitions` loses its 5,161 FinnGen rows AND its
 *     FinnGen-specific `coverage_profile` column (CONTEXT.md D-06).
 *   - `finngen.endpoint_generations` gains a nullable `finngen_endpoint_name`
 *     TEXT FK (ON DELETE RESTRICT) alongside the legacy `cohort_definition_id`
 *     column (CONTEXT.md D-07). Historical rows keep their dangling bigint
 *     reference; new rows populate the name FK.
 *   - `app.cohort_definitions.expression_json` has a GIN index for the
 *     `finngen_match_promotion` JSONB lookup (CONTEXT.md D-14).
 *
 * Entire migration runs inside Laravel's auto-wrapped PG transaction (per
 * RESEARCH.md §Pitfall 9 + PostgresGrammar::$transactions = true). No
 * manual DB::beginTransaction() — double-wrapping is an anti-pattern.
 *
 * Pitfall 1 (RESEARCH.md): `coverage_profile` is VARCHAR(16), NOT a PG
 * enum. No `coverage_profile_enum` type exists in the cluster — app-layer
 * PHP enums (App\Enums\CoverageProfile / CoverageBucket) provide typing.
 *
 * Assumption A1: AUTHORIZATION is `parthenon_owner`, matching the `app`
 * schema ownership convention. `parthenon_migrator` is a member of
 * `parthenon_owner` so DDL authority is unchanged.
 *
 * Rollback (down()): restore coverage_profile column, rehydrate 5,161 rows
 * from the Phase 13 snapshot (`finngen.endpoint_expressions_pre_phase13`),
 * drop FK column + new table, rename + SET SCHEMA back to `app.*`, DROP
 * SCHEMA finngen. Author_id falls back to admin@acumenus.net per
 * Assumption A5 (snapshot has no author_id; all FinnGen rows are
 * admin-authored by ImportEndpointsCommand).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ------------------------------------------------------------------
        // Block 1: CREATE SCHEMA finngen
        // ------------------------------------------------------------------
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    CREATE SCHEMA IF NOT EXISTS finngen AUTHORIZATION parthenon_owner;
                ELSE
                    CREATE SCHEMA IF NOT EXISTS finngen;
                END IF;
            END
            \$\$
        ");

        // ------------------------------------------------------------------
        // Block 1b (Phase 13.2-04 idempotency guard): drop any residual
        // finngen.* tables from a prior successful run of this migration.
        //
        // Context: `migrate:fresh` on parthenon_testing (search_path =
        // app,php,public) drops tables only in app/php/public schemas; it
        // does NOT drop tables in the finngen schema. When migrations
        // re-run, the original `create_finngen_*_table` migrations
        // recreate the `app.finngen_*` tables, but this migration's
        // `ALTER TABLE ... SET SCHEMA finngen` fails with
        // SQLSTATE[42P07] "relation finngen_analysis_modules_pkey
        // already exists in schema finngen" because the pkey name from
        // a prior successful SET SCHEMA collides with the incoming one.
        //
        // This guard drops any pre-existing finngen.* tables so Blocks
        // 2-4 can proceed cleanly. Safe because:
        //   - On a truly fresh DB, the finngen schema won't have these
        //     tables yet (IF EXISTS clauses short-circuit).
        //   - On parthenon_testing re-entry, the residual tables are
        //     empty (migrate:fresh just dropped the source app.finngen_*
        //     data; no state is lost by dropping the empty stale
        //     finngen.* shells).
        //   - On DEV/prod, this migration has already run to completion
        //     and Laravel will not call up() again.
        // ------------------------------------------------------------------
        DB::statement(<<<'SQL'
DO $reset$
BEGIN
    DROP TABLE IF EXISTS finngen.endpoint_definitions              CASCADE;
    DROP TABLE IF EXISTS finngen.analysis_modules                  CASCADE;
    DROP TABLE IF EXISTS finngen.runs                              CASCADE;
    DROP TABLE IF EXISTS finngen.workbench_sessions                CASCADE;
    DROP TABLE IF EXISTS finngen.unmapped_codes                    CASCADE;
    DROP TABLE IF EXISTS finngen.endpoint_generations              CASCADE;
    DROP TABLE IF EXISTS finngen.endpoint_expressions_pre_phase13  CASCADE;
END
$reset$
SQL);

        // ------------------------------------------------------------------
        // Block 2: SET SCHEMA on the 6 existing FinnGen tables.
        // Metadata-only, fast. Associated indexes, constraints, and sequences
        // owned by moved-table columns move automatically (PG17 docs).
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE app.finngen_analysis_modules          SET SCHEMA finngen');
        DB::statement('ALTER TABLE app.finngen_runs                      SET SCHEMA finngen');
        DB::statement('ALTER TABLE app.finngen_workbench_sessions        SET SCHEMA finngen');
        DB::statement('ALTER TABLE app.finngen_unmapped_codes            SET SCHEMA finngen');
        DB::statement('ALTER TABLE app.finngen_endpoint_generations      SET SCHEMA finngen');
        DB::statement('ALTER TABLE app.finngen_endpoint_expressions_pre_phase13 SET SCHEMA finngen');

        // ------------------------------------------------------------------
        // Block 3: RENAME to drop the `finngen_` prefix inside the new schema.
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE finngen.finngen_analysis_modules              RENAME TO analysis_modules');
        DB::statement('ALTER TABLE finngen.finngen_runs                          RENAME TO runs');
        DB::statement('ALTER TABLE finngen.finngen_workbench_sessions            RENAME TO workbench_sessions');
        DB::statement('ALTER TABLE finngen.finngen_unmapped_codes                RENAME TO unmapped_codes');
        DB::statement('ALTER TABLE finngen.finngen_endpoint_generations          RENAME TO endpoint_generations');
        DB::statement('ALTER TABLE finngen.finngen_endpoint_expressions_pre_phase13 RENAME TO endpoint_expressions_pre_phase13');

        // ------------------------------------------------------------------
        // Block 4: CREATE TABLE finngen.endpoint_definitions — purpose-built
        // typed columns per CONTEXT.md D-04 / RESEARCH.md Code Example 1.
        // coverage_profile / coverage_bucket are VARCHAR(16) + CHECK (NOT PG
        // enums — see Pitfall 1).
        // ------------------------------------------------------------------
        DB::statement(<<<'SQL'
            CREATE TABLE finngen.endpoint_definitions (
                name                  TEXT        PRIMARY KEY,
                longname              TEXT        NULL,
                description           TEXT        NULL,
                release               TEXT        NOT NULL,
                coverage_profile      VARCHAR(16) NOT NULL CHECK (coverage_profile IN ('universal','partial','finland_only')),
                coverage_bucket       VARCHAR(16) NOT NULL CHECK (coverage_bucket  IN ('FULLY_MAPPED','PARTIAL','SPARSE','UNMAPPED','CONTROL_ONLY')),
                universal_pct         NUMERIC(5,2) NULL,
                total_tokens          INTEGER     NOT NULL DEFAULT 0,
                resolved_tokens       INTEGER     NOT NULL DEFAULT 0,
                tags                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
                qualifying_event_spec JSONB       NOT NULL DEFAULT '{}'::jsonb,
                created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        SQL);

        // ------------------------------------------------------------------
        // Block 5: Indexes on finngen.endpoint_definitions.
        // coverage_profile/bucket btree for filter queries; tags GIN for
        // containment search; FTS GIN for EndpointBrowser ILIKE fallback.
        // ------------------------------------------------------------------
        DB::statement('CREATE INDEX endpoint_definitions_coverage_profile_idx ON finngen.endpoint_definitions (coverage_profile)');
        DB::statement('CREATE INDEX endpoint_definitions_coverage_bucket_idx  ON finngen.endpoint_definitions (coverage_bucket)');
        DB::statement('CREATE INDEX endpoint_definitions_release_idx          ON finngen.endpoint_definitions (release)');
        DB::statement('CREATE INDEX endpoint_definitions_tags_gin             ON finngen.endpoint_definitions USING GIN (tags)');
        DB::statement("CREATE INDEX endpoint_definitions_name_longname_fts    ON finngen.endpoint_definitions USING GIN (to_tsvector('english', coalesce(longname,'') || ' ' || coalesce(description,'')))");

        // ------------------------------------------------------------------
        // Block 6: INSERT ... SELECT the 5,161 rows, projecting expression_json
        // → typed columns. COALESCE fallbacks handle any rows where the new
        // top-level columns are still null (older importer runs wrote the
        // bucket/profile only inside expression_json). `cd.tags` is already
        // JSONB per FinnGenEndpointImporter.
        // ------------------------------------------------------------------
        DB::statement(<<<'SQL'
            INSERT INTO finngen.endpoint_definitions
                (name, longname, description, release, coverage_profile, coverage_bucket,
                 universal_pct, total_tokens, resolved_tokens, tags, qualifying_event_spec,
                 created_at, updated_at)
            SELECT
                cd.name,
                cd.expression_json->>'longname',
                cd.description,
                COALESCE(cd.expression_json->>'release', 'df14'),
                COALESCE(cd.coverage_profile, cd.expression_json->>'coverage_profile'),
                COALESCE(cd.expression_json->>'coverage_bucket', (cd.expression_json->'coverage'->>'bucket')),
                (cd.expression_json->'coverage'->>'pct')::numeric * 100.0,
                (cd.expression_json->'coverage'->>'n_tokens_total')::int,
                (cd.expression_json->'coverage'->>'n_tokens_resolved')::int,
                COALESCE(cd.tags, '[]'::jsonb),
                cd.expression_json->'source_codes',
                cd.created_at, cd.updated_at
              FROM app.cohort_definitions cd
             WHERE cd.domain = 'finngen-endpoint'
        SQL);

        // ------------------------------------------------------------------
        // Block 7: DELETE the 5,161 source rows. Raw DELETE bypasses any
        // Eloquent model observers (CohortDefinition::deleting) that might
        // try to write audit rows during the migration window.
        // ------------------------------------------------------------------
        DB::statement("DELETE FROM app.cohort_definitions WHERE domain = 'finngen-endpoint'");

        // ------------------------------------------------------------------
        // Block 8: remove the Phase-13-added coverage_profile column from
        // app.cohort_definitions (CONTEXT.md D-06). It was FinnGen-only;
        // user cohorts never populated it. Dropping the index explicitly
        // first leaves a clean, explicit rollback trail.
        // ------------------------------------------------------------------
        DB::statement('DROP INDEX IF EXISTS app.cohort_definitions_coverage_profile_index');
        DB::statement('ALTER TABLE app.cohort_definitions DROP COLUMN coverage_profile');

        // ------------------------------------------------------------------
        // Block 9: GIN index on app.cohort_definitions.expression_json
        // (CONTEXT.md D-14). Supports the
        // `expression_json->'finngen_match_promotion'->>'run_id'` reverse
        // lookup used by WorkbenchSessionController::checkPreviousPromotion().
        // ------------------------------------------------------------------
        DB::statement('CREATE INDEX IF NOT EXISTS cohort_definitions_expression_json_gin ON app.cohort_definitions USING GIN (expression_json)');

        // ------------------------------------------------------------------
        // Block 10: FK split on finngen.endpoint_generations (CONTEXT.md
        // D-07). Add nullable `finngen_endpoint_name` TEXT with FK to
        // finngen.endpoint_definitions(name) ON DELETE RESTRICT. Legacy
        // `cohort_definition_id` column stays for historical rows.
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE finngen.endpoint_generations ADD COLUMN finngen_endpoint_name TEXT NULL REFERENCES finngen.endpoint_definitions(name) ON DELETE RESTRICT');
        DB::statement('CREATE INDEX endpoint_generations_finngen_endpoint_name_idx ON finngen.endpoint_generations (finngen_endpoint_name)');

        // ------------------------------------------------------------------
        // Block 11: HIGHSEC §4.1 grants — existence-guarded DO block so the
        // migration stays portable across dev / CI / prod (roles may not
        // exist on fresh Community Edition installs). Mirrors the pattern
        // from 2026_04_13_014502_create_finngen_db_roles.php.
        // ------------------------------------------------------------------
        DB::statement(<<<'SQL'
            DO $grants$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT USAGE, CREATE ON SCHEMA finngen TO parthenon_app;
                    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finngen TO parthenon_app;
                    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finngen TO parthenon_app;
                    ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA finngen
                        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parthenon_app;
                    ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA finngen
                        GRANT USAGE, SELECT ON SEQUENCES TO parthenon_app;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                    GRANT USAGE ON SCHEMA finngen TO parthenon_finngen_ro;
                    GRANT SELECT ON ALL TABLES IN SCHEMA finngen TO parthenon_finngen_ro;
                    ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA finngen
                        GRANT SELECT ON TABLES TO parthenon_finngen_ro;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                    GRANT USAGE, CREATE ON SCHEMA finngen TO parthenon_finngen_rw;
                    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finngen TO parthenon_finngen_rw;
                    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finngen TO parthenon_finngen_rw;
                    ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA finngen
                        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parthenon_finngen_rw;
                    ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA finngen
                        GRANT USAGE, SELECT ON SEQUENCES TO parthenon_finngen_rw;
                END IF;
            END
            $grants$
        SQL);
    }

    public function down(): void
    {
        // ------------------------------------------------------------------
        // Reverse Block 8: restore coverage_profile column on
        // app.cohort_definitions FIRST — the rehydrate INSERT below targets
        // this column, so it must exist before the INSERT runs.
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE app.cohort_definitions ADD COLUMN coverage_profile VARCHAR(16) NULL');
        DB::statement('CREATE INDEX cohort_definitions_coverage_profile_index ON app.cohort_definitions (coverage_profile)');

        // ------------------------------------------------------------------
        // Reverse Blocks 6+7: rehydrate 5,161 rows from the Phase 13 snapshot
        // (RESEARCH.md Pitfall 2 — the snapshot has the complete original
        // expression_json; JOIN against finngen.endpoint_definitions gives
        // us the typed-column values for `coverage_profile` + `tags` +
        // `description` that the snapshot does NOT carry).
        //
        // Assumption A5: the Phase 13 snapshot has no author_id; fall back
        // to admin@acumenus.net (all FinnGen endpoints are admin-authored
        // per ImportEndpointsCommand). Terminal fallback of 1 covers the
        // edge case where the admin user has been deleted.
        // ------------------------------------------------------------------
        DB::statement(<<<'SQL'
            INSERT INTO app.cohort_definitions
                (id, name, description, expression_json, author_id, is_public, version, tags, domain, quality_tier, coverage_profile, created_at, updated_at)
            SELECT
                s.cohort_definition_id, s.name, e.description,
                s.expression_json,
                COALESCE((SELECT id FROM app.users WHERE email='admin@acumenus.net'), 1),
                TRUE, 1, COALESCE(e.tags, '[]'::jsonb), 'finngen-endpoint', 'draft',
                e.coverage_profile,
                s.created_at, NOW()
              FROM finngen.endpoint_expressions_pre_phase13 s
              JOIN finngen.endpoint_definitions e ON e.name = s.name
        SQL);

        // ------------------------------------------------------------------
        // Reverse Block 10: drop the finngen_endpoint_name FK column.
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE finngen.endpoint_generations DROP COLUMN IF EXISTS finngen_endpoint_name');

        // ------------------------------------------------------------------
        // Reverse Blocks 4+5: drop finngen.endpoint_definitions and its
        // dependent indexes (CASCADE by ownership).
        // ------------------------------------------------------------------
        DB::statement('DROP TABLE IF EXISTS finngen.endpoint_definitions');

        // ------------------------------------------------------------------
        // Reverse Block 3: RENAME back to add the finngen_ prefix inside
        // the finngen schema (done before SET SCHEMA back so the name is
        // conflict-free when the table lands in app).
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE finngen.endpoint_expressions_pre_phase13 RENAME TO finngen_endpoint_expressions_pre_phase13');
        DB::statement('ALTER TABLE finngen.endpoint_generations             RENAME TO finngen_endpoint_generations');
        DB::statement('ALTER TABLE finngen.unmapped_codes                   RENAME TO finngen_unmapped_codes');
        DB::statement('ALTER TABLE finngen.workbench_sessions               RENAME TO finngen_workbench_sessions');
        DB::statement('ALTER TABLE finngen.runs                             RENAME TO finngen_runs');
        DB::statement('ALTER TABLE finngen.analysis_modules                 RENAME TO finngen_analysis_modules');

        // ------------------------------------------------------------------
        // Reverse Block 2: SET SCHEMA back to app on the 6 original tables.
        // ------------------------------------------------------------------
        DB::statement('ALTER TABLE finngen.finngen_endpoint_expressions_pre_phase13 SET SCHEMA app');
        DB::statement('ALTER TABLE finngen.finngen_endpoint_generations             SET SCHEMA app');
        DB::statement('ALTER TABLE finngen.finngen_unmapped_codes                   SET SCHEMA app');
        DB::statement('ALTER TABLE finngen.finngen_workbench_sessions               SET SCHEMA app');
        DB::statement('ALTER TABLE finngen.finngen_runs                             SET SCHEMA app');
        DB::statement('ALTER TABLE finngen.finngen_analysis_modules                 SET SCHEMA app');

        // ------------------------------------------------------------------
        // Reverse Block 1: drop the now-empty finngen schema.
        // ------------------------------------------------------------------
        DB::statement('DROP SCHEMA IF EXISTS finngen');

        // ------------------------------------------------------------------
        // Reverse Block 9: drop the expression_json GIN index added in up().
        // Ordered last so any down() failures before this point leave the
        // index in place for debugging.
        // ------------------------------------------------------------------
        DB::statement('DROP INDEX IF EXISTS app.cohort_definitions_expression_json_gin');
    }
};
