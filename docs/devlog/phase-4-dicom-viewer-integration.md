# Phase 4: DICOM Viewer Integration

**Date:** 2026-03-07
**Status:** Complete

## What Was Built

### 1. StudyBrowser — Grid View with Filtering
- `frontend/src/features/imaging/components/StudyBrowser.tsx` — grid of imaging study cards
- Modality filter dropdown with counts, date/modality sort toggle
- Hover overlay with Details, OHIF, and Compare buttons
- Comparison selection mode: pick 2 studies → fires `onCompareSelect` callback

### 2. OHIF-to-Parthenon Measurement Bridge
- `docker/ohif/ohif-bridge.js` — injected into OHIF via Dockerfile
  - Polls for OHIF's `MeasurementService`, subscribes to ADDED/UPDATED/REMOVED events
  - Sanitizes and relays measurement data via `window.postMessage`
  - Sends `ohif:bridge:ready` when connected
- `frontend/src/features/imaging/components/OhifViewer.tsx` — rewritten
  - Listens for `ohif:measurement:*` postMessage events
  - Tracks pending measurements in state, shows "Save N measurements" button
  - Maps OHIF types (length, bidimensional, area, HU probe) to Parthenon measurement types
  - Calls `imagingApi.createMeasurement()` with `algorithm_name: "ohif-viewer"`
  - Shows bridge status indicator and saved count

### 3. Study-Patient Auto-Linking by Condition
- `ImagingTimelineService::linkStudiesToConditionPatients()` — new method
  - Groups unlinked studies by DICOM patient ID
  - Queries CDM for patients with matching condition (ILIKE, randomized)
  - Assigns each unique DICOM patient to a distinct CDM person
- `POST /api/v1/imaging/studies/link-by-condition` — new API endpoint
- Fixed PostgreSQL `SELECT DISTINCT + ORDER BY RANDOM()` conflict via subquery

### 4. Viewer Polish — Dark Theme + Toolbar
- `docker/ohif/parthenon-ohif.css` — dark theme overrides
  - Base: #0E0E11, Surface: #151518, Borders: #232328
  - Active tool highlight with #2DD4BF teal
  - Custom scrollbar, hidden investigational use warning
- `docker/ohif/app-config.js` — white-labeling (logo removed), CPU fallback hidden
- Injection via Dockerfile `sed` commands into OHIF's index.html

### 5. Multi-Study Comparison
- `frontend/src/features/imaging/components/StudyComparisonViewer.tsx`
  - Side-by-side or stacked OHIF viewers for baseline vs follow-up
  - Days interval calculation, swap button, layout toggle
  - Color-coded baseline (blue) / follow-up (teal) labels

### 6. COVID DICOM Import (1000 Harvard Studies)
- Uploaded ~317K DICOM files from `dicom_samples/harvard_covid19/` to Orthanc
- Indexed 490+ studies into Parthenon DB via DICOMweb
- Linked all studies to CDM patients with COVID diagnosis (81K+ candidates in Acumenus)
- Upload script: `/tmp/upload_covid_orthanc.py` (8 worker threads)

## Key Decisions

- **postMessage bridge** instead of direct OHIF API: iframe cross-origin isolation requires message passing
- **Condition-based linking** instead of exact patient ID match: DICOM patient IDs from Harvard dataset don't match Acumenus CDM UUIDs
- **Volume injection** for OHIF customizations: faster than full OHIF rebuild (60min) — used temp alpine container to write to named volume

## Files Changed
- `docker/ohif/Dockerfile` — bridge + CSS injection
- `docker/ohif/ohif-bridge.js` — NEW
- `docker/ohif/parthenon-ohif.css` — NEW
- `docker/ohif/app-config.js` — white-labeling
- `frontend/src/features/imaging/components/OhifViewer.tsx` — measurement bridge
- `frontend/src/features/imaging/components/StudyBrowser.tsx` — NEW
- `frontend/src/features/imaging/components/StudyComparisonViewer.tsx` — NEW
- `frontend/src/features/imaging/pages/ImagingStudyPage.tsx` — pass studyId/personId
- `backend/app/Http/Controllers/Api/V1/ImagingTimelineController.php` — linkByCondition
- `backend/app/Services/Imaging/ImagingTimelineService.php` — condition linking + SQL fix

## Gotchas
- OHIF dist volume is read-only on nginx — must write via ohif-build container or temp alpine
- PostgreSQL rejects `SELECT DISTINCT ... ORDER BY RANDOM()` — wrap in subquery
- Tinker in Alpine PHP container has class resolution issues — use `docker compose cp` + temp PHP script
