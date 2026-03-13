-- GIS Schema v2: Global support + import tracking
-- Run against local PG 17 (ohdsi database) as superuser

SET search_path TO gis, public, app;

-- 1. Expand location_type for international geographies
ALTER TABLE gis.geographic_location
    DROP CONSTRAINT IF EXISTS geographic_location_location_type_check;
ALTER TABLE gis.geographic_location
    ADD CONSTRAINT geographic_location_location_type_check
    CHECK (location_type IN (
        'census_tract', 'county', 'zip', 'zcta',
        'state', 'country', 'district', 'province',
        'nuts1', 'nuts2', 'nuts3',
        'custom'
    ));

-- 2. Make state_fips optional (non-US data won't have it)
ALTER TABLE gis.geographic_location
    ALTER COLUMN state_fips DROP NOT NULL,
    ALTER COLUMN state_fips DROP DEFAULT;

-- 3. Add import_id tracking columns
ALTER TABLE gis.geographic_location
    ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_geo_loc_import
    ON gis.geographic_location(import_id);

ALTER TABLE gis.external_exposure
    ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ext_exp_import
    ON gis.external_exposure(import_id);

-- 4. Create gis_point_feature table
CREATE TABLE IF NOT EXISTS gis.gis_point_feature (
    point_feature_id    BIGSERIAL PRIMARY KEY,
    import_id           BIGINT NOT NULL,
    feature_type        VARCHAR(100) NOT NULL,
    feature_name        VARCHAR(500),
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    geometry            GEOMETRY(Point, 4326) NOT NULL,
    properties          JSONB DEFAULT '{}',
    geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_feature_import
    ON gis.gis_point_feature(import_id);
CREATE INDEX IF NOT EXISTS idx_point_feature_type
    ON gis.gis_point_feature(feature_type);
CREATE INDEX IF NOT EXISTS idx_point_feature_geom
    ON gis.gis_point_feature USING GIST(geometry);
