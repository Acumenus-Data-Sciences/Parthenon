-- Parthenon single-database schema initialization
-- All schemas live in one 'parthenon' database.
-- This runs once on first container creation (docker-entrypoint-initdb.d).

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Application schemas
CREATE SCHEMA IF NOT EXISTS app;           -- Business tables (users, cohorts, sources, studies)
CREATE SCHEMA IF NOT EXISTS omop;          -- OMOP CDM + Vocabulary
CREATE SCHEMA IF NOT EXISTS results;       -- Achilles/DQD output
CREATE SCHEMA IF NOT EXISTS gis;           -- Geospatial tables
CREATE SCHEMA IF NOT EXISTS eunomia;       -- GiBleed demo dataset
CREATE SCHEMA IF NOT EXISTS eunomia_results; -- Demo Achilles results
CREATE SCHEMA IF NOT EXISTS php;           -- Laravel internals (migrations, jobs, cache)
CREATE SCHEMA IF NOT EXISTS webapi;        -- Legacy OHDSI WebAPI (Atlas migration)

-- Grants
GRANT ALL ON SCHEMA app, omop, results, gis, eunomia, eunomia_results, php, webapi TO parthenon;
