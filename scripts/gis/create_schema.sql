-- GIS Explorer v3 Schema
-- Run against local PG 17 (ohdsi database) as superuser

-- Step 0: Ensure PostGIS types are visible (PostGIS installed in 'app' schema)
SET search_path TO public, app, topology;

-- Verify PostGIS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE EXTENSION postgis;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS gis;

-- geographic_location: census tracts, counties, ZIPs with PostGIS geometry
CREATE TABLE IF NOT EXISTS gis.geographic_location (
  geographic_location_id BIGSERIAL PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('census_tract', 'county', 'zip', 'zcta')),
  geographic_code VARCHAR(15) NOT NULL,
  state_fips CHAR(2) NOT NULL DEFAULT '42',
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

-- external_exposure: person-level geographic/environmental exposures
CREATE TABLE IF NOT EXISTS gis.external_exposure (
  external_exposure_id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  exposure_type VARCHAR(30) NOT NULL,
  exposure_date DATE NOT NULL,
  value_as_number NUMERIC,
  value_as_string VARCHAR(100),
  value_as_integer INTEGER,
  unit VARCHAR(30),
  geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
  source_dataset VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_ext_exp_person_type ON gis.external_exposure(person_id, exposure_type);
CREATE INDEX IF NOT EXISTS idx_ext_exp_geo ON gis.external_exposure(geographic_location_id);
CREATE INDEX IF NOT EXISTS idx_ext_exp_type_val ON gis.external_exposure(exposure_type, value_as_number);

-- location_geography: ZIP-to-tract/county crosswalk
CREATE TABLE IF NOT EXISTS gis.location_geography (
  id BIGSERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  zip_code VARCHAR(5),
  tract_fips VARCHAR(11),
  county_fips VARCHAR(5),
  tract_allocation_ratio NUMERIC(6,4),
  tract_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
  county_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id)
);

CREATE INDEX IF NOT EXISTS idx_loc_geo_location ON gis.location_geography(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_geo_zip ON gis.location_geography(zip_code);
CREATE INDEX IF NOT EXISTS idx_loc_geo_tract ON gis.location_geography(tract_fips);
CREATE INDEX IF NOT EXISTS idx_loc_geo_county ON gis.location_geography(county_fips);

-- gis_hospital: PA hospitals with PostGIS point geometry
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

-- geography_summary: pre-aggregated stats per geographic area per exposure type
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

-- patient_geography: materialized view for fast person-to-geography joins
-- Created AFTER load_crosswalk.py populates location_geography
-- See load_all.py Step 4 for CREATE MATERIALIZED VIEW
