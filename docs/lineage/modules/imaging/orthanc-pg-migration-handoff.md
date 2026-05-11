# ORTHANC PACS DATABASE FIX — FULL CONTEXT HANDOFF

**Date:** 2026-03-23
**Status:** Phase 1 ready to execute
**Priority:** High — 99.9% of DICOM data invisible to Orthanc API

## Current Situation

Orthanc (v1.12.10) at `parthenon-orthanc` is running but its **PostgreSQL index is nearly empty** while the **SQLite index + file storage contain the full dataset**. This is a classic "switched backend but didn't migrate the index" problem.

### The Numbers

| Source | Patients | Studies | Series | Instances | Size |
|--------|----------|---------|--------|-----------|------|
| **SQLite index** (old, on disk) | 1,637 | 1,998 | 8,059 | 926,066 | 1.5GB index file |
| **PostgreSQL index** (active, current) | 3 | 3 | 5 | 990 | — |
| **File storage** (on disk) | — | — | — | ~926K | 395 GB |
| **Parthenon app DB** (`app.imaging_studies`) | 1 patient | 15 | 105 | 5,013 | — |

The PG index only has 3 PSMA test patients (990 instances). The SQLite index has the full 1,637 patients / 926K instances. The file storage at `/media/smudoshi/DATA/orthanc-data/` has all ~395GB of DICOM files intact. **No data has been lost — only the index is wrong.**

### Root Cause

The docker-compose.yml was recently updated to use PostgreSQL for the Orthanc index:
```yaml
# docker-compose.yml lines 622-630
- ORTHANC__POSTGRESQL__ENABLE_INDEX=true
- ORTHANC__POSTGRESQL__ENABLE_STORAGE=false  # files stay on disk
- ORTHANC__POSTGRESQL__HOST=${DB_HOST:-pgsql.acumenus.net}
- ORTHANC__POSTGRESQL__PORT=${DB_PORT:-5432}
- ORTHANC__POSTGRESQL__DATABASE=${DB_DATABASE:-parthenon}
- ORTHANC__POSTGRESQL__USERNAME=${DB_USERNAME:-smudoshi}
- ORTHANC__POSTGRESQL__PASSWORD=${DB_PASSWORD:-acumenus}
```

When Orthanc started with PG index enabled, it created a fresh PG schema (`public.resources`, `public.attachedfiles`, etc.) but the old SQLite index at `/var/lib/orthanc/db/index` (1.5GB) was not migrated. So Orthanc "sees" only the 990 instances that were added after the PG switch.

### Orthanc PG Index Tables (in `parthenon` DB, `public` schema)
- `public.resources` — 179 rows (3 patients + 3 studies + 5 series + 168 instances... growing)
- `public.attachedfiles` — 979 rows
- `public.maindicomtags` — DICOM tag metadata
- `public.dicomidentifiers` — patient/study/series identifiers
- `public.changes`, `public.metadata`, `public.exportedresources`, `public.globalproperties`, `public.serverproperties`

## Architecture

### File Paths
- **Orthanc data volume**: `/media/smudoshi/DATA/orthanc-data/` (bind-mounted via `ORTHANC_DATA_PATH` env var)
- **SQLite index**: `/media/smudoshi/DATA/orthanc-data/index` (1.5GB, the old full index)
- **DICOM files**: `/media/smudoshi/DATA/orthanc-data/{00-ff}/` (256 hash buckets, ~395GB total)
- **Docker compose**: `/home/smudoshi/Github/Parthenon/docker-compose.yml`
- **Migration script**: `/home/smudoshi/Github/Parthenon/scripts/migrate-orthanc-to-pg.sh` (ALREADY WRITTEN, ready to use)

### Credentials
- **Orthanc REST API**: `$ORTHANC_USER:$ORTHANC_PASSWORD` at `http://localhost:8042` (set in `backend/.env`)
- **PostgreSQL**: `$DB_USERNAME:$DB_PASSWORD` at `pgsql.acumenus.net:5432`, database `parthenon`
- **Nginx proxy**: `http://localhost:8082/orthanc/` proxies to Orthanc with auth header injected via envsubst

### Docker Config (orthanc service, docker-compose.yml lines 593-632)
- Container: `parthenon-orthanc`
- Image: `orthancteam/orthanc:latest`
- Port: 8042
- Volume: `${ORTHANC_DATA_PATH:-orthanc-data}:/var/lib/orthanc/db`
- PG index: enabled (5 connections, prepared statements)
- PG storage: disabled (files stay on local disk)
- DICOMweb: enabled at `/dicom-web/` and `/wado`
- Healthcheck: python3 HTTP check with Basic auth
- Concurrent jobs: 2
- Find limits: 100 results, 50 instances

### Parthenon App Integration
- **Imaging models**: `ImagingStudy`, `ImagingSeries`, `ImagingInstance` in `app` schema
- **DicomwebService**: `backend/app/Services/Imaging/DicomwebService.php` — talks to Orthanc via QIDO-RS/WADO-RS/STOW-RS
- **DicomFileService**: `backend/app/Services/Imaging/DicomFileService.php` — local DICOM file parsing
- **Import command**: `php artisan imaging:import-samples --dir=<path> --source=<id> --person-id=<id>`
- **Nginx DICOM proxy**: `/orthanc/` location block in `docker/nginx/default.conf` with 2GB cache, 300s timeout
- Currently 15 studies for patient 1005788 in `app.imaging_studies` but **none have `orthanc_study_id` set** (0 linked to Orthanc)

---

## PHASE 1: Migrate SQLite Index → PostgreSQL Index

A migration script already exists and is ready to run:

```bash
./scripts/migrate-orthanc-to-pg.sh          # Full migration
./scripts/migrate-orthanc-to-pg.sh --dry-run # Just show counts
```

### How the script works:
1. Verifies production Orthanc (PG-indexed) is running on :8042
2. Finds the SQLite index at `$ORTHANC_DATA_PATH/index`
3. Spins up a **temporary** Orthanc container (`orthanc-sqlite-migrator`) on port 8043 that:
   - Uses the same data volume (so it can read the DICOM files)
   - Uses the SQLite index (so it can enumerate all 926K instances)
   - Has a peer configured pointing to production PG-Orthanc
4. Iterates all studies in SQLite-Orthanc and sends each to PG-Orthanc via `store-peer`
5. Reports progress every 50 studies with rate/ETA
6. Verifies final counts match
7. Cleans up temp container

### Expected duration:
- 1,998 studies / ~926K instances at ~395GB
- Estimate: several hours (the files don't move — they're already on the same disk — but Orthanc re-indexes each instance into PG)

### Pre-flight checklist:
- [ ] Production Orthanc is running and healthy: `curl -u $ORTHANC_USER:$ORTHANC_PASSWORD http://localhost:8042/system`
- [ ] SQLite index exists: `ls -lh /media/smudoshi/DATA/orthanc-data/index` (should be ~1.5GB)
- [ ] Enough disk space for temp operations (the migration doesn't copy files, just re-indexes)
- [ ] No active DICOM imports running (check `curl -u $ORTHANC_USER:$ORTHANC_PASSWORD http://localhost:8042/jobs`)

### Post-migration verification:
```bash
# Should show ~926K instances, ~1998 studies, ~1637 patients
curl -s -u $ORTHANC_USER:$ORTHANC_PASSWORD http://localhost:8042/statistics

# Should find Udoshi
curl -s -u $ORTHANC_USER:$ORTHANC_PASSWORD http://localhost:8042/tools/find \
  -d '{"Level":"Patient","Query":{"PatientName":"*UDOSHI*"}}'

# DICOMweb should work
curl -s -u $ORTHANC_USER:$ORTHANC_PASSWORD -H "Accept: application/dicom+json" \
  http://localhost:8042/dicom-web/studies?limit=5
```

### If migration is too slow (peer transfer overhead):
Alternative approach — Orthanc can reconstruct the PG index from files on disk:
```bash
# Stop Orthanc, clear PG tables, restart with SQLite temporarily,
# then switch back to PG and let Orthanc re-index
# This is more complex but potentially faster for 926K instances
```

---

## PHASE 2: Link Parthenon Imaging Records to Orthanc

After Phase 1, Orthanc's PG index will have all studies. Now link them to Parthenon's `app.imaging_studies`:

### Goal:
Set `orthanc_study_id` and `wadors_uri` on every `imaging_studies` row so the frontend can fetch DICOM data via WADO-RS.

### Approach:
1. Query Orthanc's `/tools/find` for each study by `StudyInstanceUID` (stored in `app.imaging_studies.study_instance_uid`)
2. Update `orthanc_study_id` and `wadors_uri` on the matched Parthenon record
3. This enables the OHIF viewer integration and DICOM downloads in the Patient Profile

```php
// Pseudocode for the linkage
$studies = ImagingStudy::whereNull('orthanc_study_id')->get();
foreach ($studies as $study) {
    $result = DicomwebService::findStudy($study->study_instance_uid);
    if ($result) {
        $study->update([
            'orthanc_study_id' => $result['ID'],
            'wadors_uri' => "/dicom-web/studies/{$study->study_instance_uid}",
        ]);
    }
}
```

This could be a new artisan command (`imaging:link-orthanc`) or added to the existing `DicomwebService::syncStudies()`.

### Verification:
```sql
SELECT count(*) FROM app.imaging_studies WHERE orthanc_study_id IS NOT NULL;
-- Should be 15 (for patient 1005788) plus any other imported studies
```

---

## PHASE 3: Enable Downloads & Viewer in Patient Profile

### 3a. WADO-RS Downloads
With `orthanc_study_id` populated, the nginx proxy at `/orthanc/` handles downloads:
- Study-level: `GET /orthanc/dicom-web/studies/{uid}`
- Series-level: `GET /orthanc/dicom-web/studies/{uid}/series/{seriesUid}`
- Instance-level: `GET /orthanc/dicom-web/studies/{uid}/series/{seriesUid}/instances/{sopUid}`
- Rendered: `GET /orthanc/dicom-web/studies/{uid}/series/{seriesUid}/instances/{sopUid}/rendered`

The nginx config already has caching (2GB, 1h TTL) and auth header injection.

### 3b. OHIF Viewer Integration
- OHIF config: `docker/ohif/app-config.js`
- Bridge script: `docker/ohif/ohif-bridge.js`
- The viewer component is at `frontend/src/features/imaging/components/OhifViewer.tsx`
- Once `orthanc_study_id` is set, the viewer can load studies from Orthanc via DICOMweb

### 3c. Bulk Download (ZIP)
Not yet implemented. Orthanc supports `GET /studies/{id}/archive` to download a study as a ZIP. This could be exposed via:
- A new API route: `GET /api/v1/imaging/studies/{id}/download`
- Controller proxies to Orthanc, streams the ZIP back to the browser
- Auth required (existing `auth:sanctum` + `permission:imaging.view` middleware)

---

## PHASE 4: Import New DICOM Files (Future)

### 4a. Local DICOM Import Flow (existing)
```bash
# 1. Mount DICOM directory into PHP container (docker-compose.yml volume)
# 2. Run import command
php artisan imaging:import-samples --dir=<path> --source=47 --person-id=<id>
# 3. DicomFileService parses DICOM headers, creates imaging_studies/series/instances records
# 4. DicomwebService::stowInstances() pushes files to Orthanc via STOW-RS
```

### 4b. Current issue with STOW
When importing from host PHP, STOW fails because it can't resolve `orthanc` hostname. Must run inside Docker container. The `DicomwebService` config uses `http://orthanc:8042` (Docker service name).

Config location: `backend/config/services.php` → `dicomweb.base_url` (defaults to `http://localhost:8042`, should be `http://orthanc:8042` for in-container use).

### 4c. Recommended improvement
Add `DICOMWEB_BASE_URL=http://orthanc:8042` to `backend/.env` so it resolves correctly inside Docker. The `DicomwebService` constructor already reads from `config('services.dicomweb.base_url')`.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` (lines 593-632) | Orthanc service definition |
| `docker/nginx/default.conf` | Nginx proxy for `/orthanc/` with caching |
| `scripts/migrate-orthanc-to-pg.sh` | SQLite → PG migration script (ready to run) |
| `backend/app/Services/Imaging/DicomwebService.php` | QIDO/WADO/STOW client |
| `backend/app/Services/Imaging/DicomFileService.php` | Local DICOM file parser |
| `backend/app/Services/Imaging/ImagingTimelineService.php` | Patient imaging timeline builder |
| `backend/app/Models/App/ImagingStudy.php` | Study model (has `orthanc_study_id`, `wadors_uri`) |
| `backend/app/Console/Commands/ImportDicomSamples.php` | `imaging:import-samples` command |
| `backend/app/Console/Commands/SeedMbuPatient.php` | `mbu:seed-genomics` (restores patient 1005788 genomics) |
| `frontend/src/features/imaging/components/OhifViewer.tsx` | OHIF DICOM viewer component |
| `frontend/src/features/imaging/components/PatientTimeline.tsx` | Patient imaging timeline UI |

## Critical Rules (from CLAUDE.md / HIGHSEC)

- **NEVER** run destructive DB operations without backup first
- **NEVER** target Docker PostgreSQL (port 5480) — use `pgsql.acumenus.net:5432` (host PG 17)
- **NEVER** disable Orthanc authentication
- Medical imaging endpoints require `auth:sanctum` — no unauthenticated DICOM retrieval
- Orthanc credentials: `$ORTHANC_USER:$ORTHANC_PASSWORD` (NOT the default `orthanc:orthanc`)
- The `public` schema in `parthenon` DB is shared between Orthanc PG index tables and other uses — do NOT drop/truncate `public.*` tables without checking what they are
