<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 19 Plan 02 (Wave 1) — gis schema deploy.
 *
 * Creates the dormant `gis` schema in the live `parthenon` database with:
 *   - 5 base tables: geographic_location, external_exposure, location_geography,
 *     gis_hospital, geography_summary
 *   - 1 materialized view: patient_geography (empty stub; Plan 03 fills the body)
 *
 * Decisions enforced (see 19-RESEARCH.md):
 *   D-01 — gis.external_exposure has source_id BIGINT NOT NULL REFERENCES
 *          app.sources(id) AND UNIQUE (source_id, person_id, exposure_type,
 *          exposure_date). Eliminates cross-source person_id collisions and
 *          enables UPSERT idempotency in Plan 03.
 *   D-02 — One shared gis.patient_geography matview keyed by
 *          (source_id, person_id). Empty stub now; Plan 03 owns the SELECT body.
 *   D-04 — PostGIS missing throws \RuntimeException loudly. Replaces the silent
 *          SAVEPOINT-swallow pattern from 2026_03_11_000001 that left
 *          gis_admin_boundaries half-deployed.
 *   D-05 — UNIQUE constraint shape (source_id, person_id, exposure_type,
 *          exposure_date) is the dedup key for ON CONFLICT UPSERT in Plan 03.
 *
 * HIGHSEC posture (see .claude/rules/HIGHSEC.spec.md §1, §6):
 *   - parthenon_app: GRANT USAGE on schema gis; GRANT SELECT/INSERT/UPDATE/
 *     DELETE on tables; explicit REVOKE CREATE on schema; explicit REVOKE
 *     TRUNCATE on tables. No DDL, no truncation rights.
 *   - parthenon_migrator: AUTHORIZATION on schema gis; owns DDL + DML.
 *
 * Run via: deploy.sh --db (which exports DB_USERNAME=parthenon_migrator) OR
 *   docker compose exec -T -e DB_USERNAME=parthenon_migrator \
 *     -e DB_PASSWORD=$DB_MIGRATION_PASSWORD php php artisan migrate --path=...
 *
 * Idempotent: every CREATE uses IF NOT EXISTS; re-running is a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        // -----------------------------------------------------------------
        // D-04: Fail loudly if PostGIS is not installed.
        //
        // The legacy migration 2026_03_11_000001 wraps CREATE EXTENSION in a
        // SAVEPOINT and only logs on failure, which let 2026_03_11_000002
        // ship gis_admin_boundaries WITHOUT the geometry column on hosts
        // missing PostGIS. Phase 19 explicitly refuses to do that — the gis
        // schema is unusable without PostGIS, so we abort the migration run.
        // -----------------------------------------------------------------
        $hasPostgis = DB::selectOne(
            "SELECT 1 AS ok FROM pg_extension WHERE extname = 'postgis'"
        );
        if (! $hasPostgis) {
            throw new RuntimeException(
                'PostGIS extension is required for Phase 19 gis schema. '
                .'Install with: sudo apt install postgresql-17-postgis-3 '
                .'&& psql -c "CREATE EXTENSION postgis;" parthenon. '
                .'D-04: this migration MUST NOT silently skip; legacy migration '
                .'2026_03_11_000001 used a SAVEPOINT pattern that masked '
                .'partial deploys of gis_admin_boundaries.'
            );
        }

        // -----------------------------------------------------------------
        // Make PostGIS types (geography, geometry) and the in-progress gis
        // schema visible during this migration. The default pgsql connection
        // search_path is 'app,php' which excludes both 'public' (where
        // PostGIS lives, verified via pg_type.typnamespace) and 'gis' (the
        // schema we are creating). Without this SET, GEOGRAPHY(MULTIPOLYGON,
        // 4326) column declarations fail with SQLSTATE[42704] "type
        // 'geography' does not exist". Scoped to the current session/
        // connection — no impact on other connections or future requests.
        //
        // PREREQUISITE (one-time DBA grant): parthenon_migrator MUST have
        //   GRANT USAGE ON SCHEMA public TO parthenon_migrator
        // applied by a superuser (smudoshi/postgres). Without this,
        // PostGIS type lookups fail with "permission denied for schema
        // public" even with the correct search_path. This is an
        // environmental prerequisite analogous to having PostGIS installed
        // — it must be done once per database, by a role that owns public
        // (parthenon_migrator does not). See 19-02-SUMMARY.md "Auto-fixed
        // Issues" for the original incident and grant timestamp.
        // -----------------------------------------------------------------
        DB::statement('SET search_path TO gis, public, app, php');

        // -----------------------------------------------------------------
        // CREATE SCHEMA owned by parthenon_migrator (HIGHSEC §1: least
        // privilege + project memory `project_parthenon_pg_roles.md`).
        //
        // Wrapped in DO block so the migration is portable across CI envs
        // where parthenon_migrator may not exist (default to current user).
        // -----------------------------------------------------------------
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_migrator') THEN
                    CREATE SCHEMA IF NOT EXISTS gis AUTHORIZATION parthenon_migrator;
                ELSE
                    CREATE SCHEMA IF NOT EXISTS gis;
                END IF;
            END
            $$;
        SQL);

        // -----------------------------------------------------------------
        // Schema-level GRANTs for parthenon_app (only if role exists).
        // Explicit REVOKE CREATE enforces HIGHSEC §1: parthenon_app cannot
        // add objects to the gis schema.
        // -----------------------------------------------------------------
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    EXECUTE 'GRANT USAGE ON SCHEMA gis TO parthenon_app';
                    EXECUTE 'REVOKE CREATE ON SCHEMA gis FROM parthenon_app';
                END IF;
            END
            $$;
        SQL);

        // -----------------------------------------------------------------
        // gis.geographic_location
        // Mirrors scripts/gis/create_schema.sql lines 18-36 with state_fips
        // default removed (multi-source, not PA-only).
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS gis.geographic_location (
              geographic_location_id BIGSERIAL PRIMARY KEY,
              location_name VARCHAR(255) NOT NULL,
              location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('census_tract', 'county', 'zip', 'zcta')),
              geographic_code VARCHAR(15) NOT NULL,
              state_fips CHAR(2) NOT NULL,
              county_fips CHAR(5),
              latitude NUMERIC(9,6),
              longitude NUMERIC(9,6),
              geometry GEOGRAPHY(MULTIPOLYGON, 4326),
              population INTEGER,
              area_sq_km NUMERIC(12,4),
              parent_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
              UNIQUE(geographic_code, location_type)
            );
            CREATE INDEX IF NOT EXISTS idx_geo_loc_geom ON gis.geographic_location USING GIST(geometry);
            CREATE INDEX IF NOT EXISTS idx_geo_loc_county ON gis.geographic_location(county_fips);
            CREATE INDEX IF NOT EXISTS idx_geo_loc_type ON gis.geographic_location(location_type);
        SQL);

        // -----------------------------------------------------------------
        // gis.external_exposure
        // D-01: source_id BIGINT NOT NULL REFERENCES app.sources(id)
        // D-05: UNIQUE (source_id, person_id, exposure_type, exposure_date)
        //       enables ON CONFLICT UPSERT in Plan 03 loaders.
        // Adds created_at/updated_at for audit; defaults via NOW().
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS gis.external_exposure (
              external_exposure_id BIGSERIAL PRIMARY KEY,
              source_id BIGINT NOT NULL REFERENCES app.sources(id),
              person_id BIGINT NOT NULL,
              exposure_type VARCHAR(30) NOT NULL,
              exposure_date DATE NOT NULL,
              value_as_number NUMERIC,
              value_as_string VARCHAR(100),
              value_as_integer INTEGER,
              unit VARCHAR(30),
              geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
              source_dataset VARCHAR(80),
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              CONSTRAINT uq_external_exposure_source_person_type_date
                UNIQUE (source_id, person_id, exposure_type, exposure_date)
            );
            CREATE INDEX IF NOT EXISTS idx_ext_exp_person_type ON gis.external_exposure(source_id, person_id, exposure_type);
            CREATE INDEX IF NOT EXISTS idx_ext_exp_geo ON gis.external_exposure(geographic_location_id);
            CREATE INDEX IF NOT EXISTS idx_ext_exp_type_val ON gis.external_exposure(exposure_type, value_as_number);
        SQL);

        // -----------------------------------------------------------------
        // gis.location_geography (ZIP→tract/county crosswalk)
        // Diverges from scripts/gis/create_schema.sql lines 57-71: adds
        //   - source_id BIGINT NOT NULL REFERENCES app.sources(id)
        //   - UNIQUE(source_id, location_id, tract_fips)
        // Same multi-source isolation rationale as gis.external_exposure
        // (location_id is per-source — colliding values across sources
        // would otherwise pollute the matview join).
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS gis.location_geography (
              id BIGSERIAL PRIMARY KEY,
              source_id BIGINT NOT NULL REFERENCES app.sources(id),
              location_id INTEGER NOT NULL,
              zip_code VARCHAR(5),
              tract_fips VARCHAR(11),
              county_fips VARCHAR(5),
              tract_allocation_ratio NUMERIC(6,4),
              tract_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
              county_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
              UNIQUE (source_id, location_id, tract_fips)
            );
            CREATE INDEX IF NOT EXISTS idx_loc_geo_source ON gis.location_geography(source_id);
            CREATE INDEX IF NOT EXISTS idx_loc_geo_location ON gis.location_geography(source_id, location_id);
            CREATE INDEX IF NOT EXISTS idx_loc_geo_zip ON gis.location_geography(zip_code);
            CREATE INDEX IF NOT EXISTS idx_loc_geo_tract ON gis.location_geography(tract_fips);
            CREATE INDEX IF NOT EXISTS idx_loc_geo_county ON gis.location_geography(county_fips);
        SQL);

        // -----------------------------------------------------------------
        // gis.gis_hospital (PA hospitals with PostGIS point geometry)
        // Verbatim from scripts/gis/create_schema.sql lines 73-91.
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS gis.gis_hospital (
              hospital_id SERIAL PRIMARY KEY,
              cms_provider_id VARCHAR(10),
              hospital_name VARCHAR(255) NOT NULL,
              address VARCHAR(255),
              city VARCHAR(100),
              county_fips VARCHAR(5),
              zip_code VARCHAR(5),
              latitude NUMERIC(9,6),
              longitude NUMERIC(9,6),
              point GEOGRAPHY(POINT, 4326),
              hospital_type VARCHAR(50),
              has_emergency BOOLEAN DEFAULT false,
              bed_count INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_hospital_point ON gis.gis_hospital USING GIST(point);
            CREATE INDEX IF NOT EXISTS idx_hospital_county ON gis.gis_hospital(county_fips);
        SQL);

        // -----------------------------------------------------------------
        // gis.geography_summary (pre-aggregated stats per area per exposure)
        // Verbatim from scripts/gis/create_schema.sql lines 93-103.
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS gis.geography_summary (
              geographic_location_id BIGINT NOT NULL,
              exposure_type VARCHAR(30) NOT NULL,
              patient_count INTEGER,
              avg_value NUMERIC,
              median_value NUMERIC,
              min_value NUMERIC,
              max_value NUMERIC,
              PRIMARY KEY (geographic_location_id, exposure_type)
            );
        SQL);

        // -----------------------------------------------------------------
        // gis.patient_geography materialized view (empty stub).
        //
        // D-02: shared matview keyed by (source_id, person_id). Plan 03's
        // loader_common module will replace this stub via DROP + CREATE
        // with the actual SELECT body that joins per-source person/location
        // tables to gis.location_geography for tract/county allocation.
        //
        // The unique index on (source_id, person_id) enforces the per-tuple
        // uniqueness contract AND enables future REFRESH MATERIALIZED VIEW
        // CONCURRENTLY once the matview is non-empty.
        //
        // WHERE FALSE + WITH NO DATA produces an empty matview that still
        // declares all columns Plan 03 will populate.
        // -----------------------------------------------------------------
        DB::unprepared(<<<'SQL'
            CREATE MATERIALIZED VIEW IF NOT EXISTS gis.patient_geography AS
            SELECT
              NULL::BIGINT       AS source_id,
              NULL::BIGINT       AS person_id,
              NULL::INTEGER      AS location_id,
              NULL::VARCHAR(5)   AS zip_code,
              NULL::VARCHAR(11)  AS tract_fips,
              NULL::VARCHAR(5)   AS county_fips,
              NULL::BIGINT       AS tract_location_id,
              NULL::BIGINT       AS county_location_id,
              NULL::NUMERIC(6,4) AS tract_allocation_ratio
            WHERE FALSE
            WITH NO DATA;

            CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_source_person
              ON gis.patient_geography(source_id, person_id);
        SQL);

        // -----------------------------------------------------------------
        // Final HIGHSEC GRANT block (only if parthenon_app role exists).
        //
        // Granted: USAGE on schema, SELECT/INSERT/UPDATE/DELETE on all
        //   existing tables, USAGE+SELECT on sequences, SELECT on matview.
        // Defaults: future tables created by parthenon_migrator inherit
        //   the same DML grants automatically.
        // Revoked: TRUNCATE on all tables (defense-in-depth — PG default
        //   already excludes it from GRANT INSERT/UPDATE/DELETE but make
        //   the absence audit-visible for HIGHSEC §6 verification).
        // -----------------------------------------------------------------
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA gis TO parthenon_app';
                    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA gis TO parthenon_app';
                    EXECUTE 'GRANT SELECT ON gis.patient_geography TO parthenon_app';
                    EXECUTE 'REVOKE TRUNCATE ON ALL TABLES IN SCHEMA gis FROM parthenon_app';
                END IF;
            END
            $$;
        SQL);

        // Default privileges for FUTURE objects in gis created by
        // parthenon_migrator. Wrapped separately because ALTER DEFAULT
        // PRIVILEGES requires the FOR ROLE clause to reference an existing
        // role.
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_migrator')
                   AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA gis '
                          ||'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parthenon_app';
                    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator IN SCHEMA gis '
                          ||'GRANT USAGE, SELECT ON SEQUENCES TO parthenon_app';
                END IF;
            END
            $$;
        SQL);
    }

    public function down(): void
    {
        // Drop in reverse-dependency order. Each step is wrapped in IF
        // EXISTS so down() is safe on a partially-deployed schema (e.g.,
        // if up() failed mid-way before the last GRANT block).
        try {
            DB::unprepared('DROP MATERIALIZED VIEW IF EXISTS gis.patient_geography');
        } catch (Throwable) {
            // ignore — matview may not exist
        }

        $tables = [
            'gis.external_exposure',
            'gis.location_geography',
            'gis.gis_hospital',
            'gis.geography_summary',
            'gis.geographic_location',
        ];
        foreach ($tables as $tbl) {
            try {
                DB::unprepared("DROP TABLE IF EXISTS {$tbl} CASCADE");
            } catch (Throwable) {
                // ignore — table may not exist
            }
        }

        try {
            DB::unprepared('DROP SCHEMA IF EXISTS gis CASCADE');
        } catch (Throwable) {
            // ignore — schema may not exist
        }
    }
};
