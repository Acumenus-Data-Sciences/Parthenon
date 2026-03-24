# Phase 18 — Orthanc PG Migration & HIGHSEC Hardening

**Date:** 2026-03-24
**Status:** In progress (import running)

## Summary

Migrated Orthanc PACS (926K instances / 395 GB / 1,637 patients) from SQLite index to PostgreSQL index on host PG 17. Applied HIGHSEC credential hardening across all Orthanc-related configuration and scripts.

## Problem

Orthanc with SQLite index was completely non-functional at 926K instances:
- DICOMweb queries hung indefinitely
- Native REST API with `limit=5` timed out
- Even `POST /tools/find` with `Limit: 3` never returned
- Single-writer lock blocked all queries during imports

## What We Tried

### Approach 1: Direct SQL migration (failed)
Exported all 19.6M rows from SQLite index into PG tables via `COPY`. Completed in 8 minutes but Orthanc refused to start — PG plugin v10 schema is structurally different from SQLite v6 (different column names, missing tables like `PatientRecyclingOrder`, different `GlobalProperties` keys). Setting the schema version to 10 caused cascading upgrade errors.

### Approach 2: Peer transfer (failed)
Ran temp SQLite-indexed Orthanc alongside PG-indexed Orthanc, attempted `store-peer` for all 1,998 studies. Failed with HTTP 404 because both shared the same storage volume — Orthanc couldn't re-store files already on disk.

### Approach 3: Instance-level REST transfer (too slow)
Downloaded DICOM from SQLite Orthanc, POSTed to PG Orthanc. Rate: ~2 instances/sec = 5+ days for 926K instances.

### Approach 4: Fresh PG import from disk (working)
- Created new storage directory at `/media/smudoshi/DATA/orthanc-data-pg/`
- Mounted old storage read-only at `/old-data` inside container
- Script walks old storage hex buckets, reads each DICOM file, POSTs to localhost:8042
- Rate: ~20 instances/sec with 8 parallel workers
- ETA: ~12 hours (overnight)

## Changes

### Orthanc Configuration (docker-compose.yml)
- Memory: 1 GB → 4 GB
- `LIMIT_FIND_RESULTS=100`, `LIMIT_FIND_INSTANCES=50`
- `STUDIES_METADATA=MainDicomTags` (was `Full`)
- `CONCURRENT_JOBS=4`
- PostgreSQL index enabled (5 connections, prepared statements)
- Storage: new directory `/media/smudoshi/DATA/orthanc-data-pg/`
- Old storage mounted read-only at `/old-data` for migration

### HIGHSEC Credential Hardening
- **CRITICAL fix:** Removed hardcoded base64 Orthanc password from nginx config
- Switched nginx config to `envsubst` template pattern (`default.conf.template`)
- `ORTHANC_PASSWORD` and `ORTHANC_AUTH_HEADER` externalized to `backend/.env`
- Healthcheck reads credentials from container env vars at runtime
- All 4 migration scripts read from `ORTHANC_PASSWORD` env var (fail if not set)
- Handoff doc scrubbed of all literal credentials
- New password generated and stored in `.env` only

### Orthanc Healthcheck Fix
- Added Basic auth to healthcheck (was failing due to credential mismatch)
- Increased retries to 5, start_period to 60s for large datasets

### Nginx Proxy Auth Fix
- Added `Authorization` header injection for Orthanc proxy
- Fixes OHIF viewer 401 errors on DICOMweb endpoints
- Credential injected via `envsubst` from `ORTHANC_AUTH_HEADER` env var

## Migration Scripts Created
- `scripts/migrate-orthanc-to-pg.sh` — Shell-based peer transfer (v1, failed)
- `scripts/migrate-orthanc-to-pg.py` — Python instance-level transfer (v2, too slow)
- `scripts/migrate-orthanc-index-direct.py` — Direct SQL migration (v3, schema mismatch)
- `scripts/orthanc-import-from-old-storage.py` — Fresh import from disk (v4, working)

## Post-Migration Tasks
- [ ] Verify final instance count matches 926,066
- [ ] Test DICOMweb queries with PG index
- [ ] Remove `/old-data` volume mount from docker-compose.yml
- [ ] Delete old SQLite storage after verification
- [ ] Rotate Orthanc password (restart containers with new `.env`)
- [ ] Link Parthenon `imaging_studies` records to Orthanc via `orthanc_study_id`
