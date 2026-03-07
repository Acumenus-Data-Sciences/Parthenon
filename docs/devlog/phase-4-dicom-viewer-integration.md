# Phase 4: DICOM Viewer Integration

**Date:** 2026-03-07
**Status:** Complete
**Commit:** `bba75cb6` (pushed to `main`)

## Session Accomplishments

This session completed all Phase 4 deliverables plus a large-scale COVID DICOM import:

### 1. StudyBrowser — Grid View with Filtering
- `frontend/src/features/imaging/components/StudyBrowser.tsx` (NEW, ~250 lines)
- Grid of imaging study cards with thumbnail placeholders
- Modality filter dropdown with per-modality counts
- Date/modality sort toggle
- Hover overlay with Details link, OHIF viewer link, and Compare button
- Comparison selection mode: pick 2 studies → fires `onCompareSelect` callback
- Measurement count badges on cards

### 2. OHIF-to-Parthenon Measurement Bridge
- `docker/ohif/ohif-bridge.js` (NEW) — injected into OHIF via Dockerfile
  - IIFE that polls for OHIF's `MeasurementService` (up to 30s)
  - Subscribes to `MEASUREMENT_ADDED`, `MEASUREMENT_UPDATED`, `MEASUREMENT_REMOVED`
  - Sanitizes measurement data (removes circular refs) and posts to parent frame via `window.postMessage`
  - Sends `ohif:bridge:ready` when connected
- `frontend/src/features/imaging/components/OhifViewer.tsx` — full rewrite
  - `useEffect` listener for `ohif:measurement:*` postMessage events
  - Pending measurement queue tracked in React state
  - "Save N measurements" button overlaid on viewer
  - Maps OHIF measurement types to Parthenon types:
    - `length` → `longest_diameter` (mm)
    - `longestDiameter` → `longest_diameter` (mm, bidimensional)
    - `area` → `tumor_volume` (mm²)
    - `mean` → `density_hu` (HU)
  - Calls `imagingApi.createMeasurement()` with `algorithm_name: "ohif-viewer"` prefix
  - Bridge status indicator (green dot) and saved count display
  - New props: `studyId`, `personId`, `onMeasurementSaved`

### 3. Study-Patient Auto-Linking by Condition
- `ImagingTimelineService::linkStudiesToConditionPatients()` — new method
  - Groups unlinked studies by DICOM patient ID (`patient_id_dicom`)
  - Queries CDM `condition_occurrence` joined to `concept` for matching conditions (ILIKE)
  - Uses randomized selection (`ORDER BY RANDOM()`) for variety
  - Assigns each unique DICOM patient to a distinct CDM person
  - Returns `{linked, patients_used, errors}`
- `POST /api/v1/imaging/studies/link-by-condition` — new API endpoint
  - Validates `condition_pattern` (string, min:3) and optional `limit` (max:10000)
- **Bug fix:** PostgreSQL rejects `SELECT DISTINCT ... ORDER BY RANDOM()` — resolved by wrapping the DISTINCT query in a subquery via `fromSub()`

### 4. Viewer Polish — Dark Theme + Toolbar Customization
- `docker/ohif/parthenon-ohif.css` (NEW) — dark theme overrides
  - Background: #0E0E11, Surface: #151518, Borders: #232328
  - Active tool highlight with #2DD4BF teal
  - Custom scrollbar styling
  - Hidden investigational use warning banner
- `docker/ohif/app-config.js` — updated
  - White-labeling: `createLogoComponentFn` returns null (removes OHIF branding)
  - `dicomUploadComponent` in customizationService
  - `showCPUFallbackMessage: false`
- `docker/ohif/Dockerfile` — updated
  - `COPY` for ohif-bridge.js and parthenon-ohif.css
  - `sed` injection: CSS `<link>` in `<head>`, bridge `<script>` before `</body>`
- **Volume injection shortcut:** Instead of full OHIF rebuild (60+ min), used a temporary Alpine container to write directly to the `ohif-dist` named Docker volume

### 5. Multi-Study Comparison Viewer
- `frontend/src/features/imaging/components/StudyComparisonViewer.tsx` (NEW, ~150 lines)
  - Side-by-side (`grid-cols-2`) or stacked layout toggle
  - Dual `<OhifViewer>` instances for baseline vs follow-up
  - Days interval calculation between studies
  - Swap button to switch baseline/follow-up
  - `StudyLabel` sub-component with color-coded indicators:
    - Baseline: blue (#60A5FA)
    - Follow-up: teal (#2DD4BF)
  - Modality badge, description, and date display

### 6. Harvard COVID-19 DICOM Import (Complete)
- **Upload:** 315,772 DICOM instances from `dicom_samples/harvard_covid19/` to Orthanc
  - Python upload script (`/tmp/upload_covid_orthanc.py`) with 8 worker threads
  - Processed all 1,000 subjects from the Harvard COVID-19 Imaging dataset
- **Final Orthanc stats:**
  | Metric | Count |
  |--------|-------|
  | Patients | 622 |
  | Studies | 635 |
  | Series | 3,199 |
  | Instances | 315,772 |
  | Disk usage | 158 GB |
- **Indexing:** All 635 studies indexed into Parthenon DB via `POST /imaging/studies/index-from-dicomweb`
  - Incremental indexing in 4 passes as upload progressed (369 → 108 → 61 → 36 → 14 → 34)
- **Linking:** All 635 studies linked to unique CDM patients with COVID-19 diagnosis
  - 81,694 COVID patients available in Acumenus CDM; 635 randomly selected
  - Each unique DICOM patient ID mapped to a distinct CDM person_id

### 7. Infrastructure & Deployment
- Frontend production build via `docker compose exec node sh -c "cd /app && npx vite build"`
- Full deploy via `./deploy.sh` (opcache clear, cache clear, OpenAPI spec export)
- Cleaned up stale comment in `ImagingTimelineController.php`

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| postMessage bridge (not direct OHIF API) | OHIF runs in iframe with cross-origin isolation; postMessage is the only safe communication channel |
| Condition-based linking (not exact patient ID match) | Harvard DICOM patient IDs are anonymized and don't match Acumenus CDM UUIDs |
| Volume injection (not full rebuild) | Full OHIF build from source takes 60+ min; Alpine temp container writes to named volume in seconds |
| Subquery for RANDOM() ordering | PostgreSQL requires ORDER BY expressions in SELECT list when using DISTINCT; subquery avoids this |
| Incremental index+link passes | Upload ran for ~45 min; periodic indexing ensured studies were available before upload completed |

## Files Changed (11 files, +852 lines)

**New files:**
- `docker/ohif/ohif-bridge.js` — postMessage measurement bridge
- `docker/ohif/parthenon-ohif.css` — dark theme CSS overrides
- `frontend/src/features/imaging/components/StudyBrowser.tsx` — grid study browser
- `frontend/src/features/imaging/components/StudyComparisonViewer.tsx` — side-by-side viewer
- `docs/devlog/phase-4-dicom-viewer-integration.md` — this devlog

**Modified files:**
- `docker/ohif/Dockerfile` — bridge + CSS injection via sed
- `docker/ohif/app-config.js` — white-labeling, CPU fallback
- `frontend/src/features/imaging/components/OhifViewer.tsx` — measurement bridge rewrite
- `frontend/src/features/imaging/pages/ImagingStudyPage.tsx` — pass studyId/personId to viewer
- `backend/app/Services/Imaging/ImagingTimelineService.php` — condition linking + SQL fix
- `backend/routes/api.php` — link-by-condition route

## Gotchas & Lessons Learned

1. **OHIF dist volume is read-only on nginx** — the `ohif-dist` volume is mounted `:ro` in the nginx container. Cannot `docker compose cp` into it. Must use the ohif-build container (slow) or a temporary Alpine container with RW mount (fast).

2. **PostgreSQL `SELECT DISTINCT + ORDER BY RANDOM()`** — fails with "ORDER BY expressions must appear in select list." Solution: wrap DISTINCT query as subquery, then ORDER BY RANDOM() on the outer query.

3. **PHP artisan tinker in Alpine container** — class resolution fails for `App\Models\User` via inline `-r` or even heredoc piping. Workaround: write a `.php` file, `docker compose cp` it in, execute directly.

4. **User model is `App\Models\User`** not `App\Models\App\User` — the memory file had incorrect namespace. Token generation script needed correction.

5. **Incremental indexing strategy** — for large uploads (300K+ DICOM files), running index+link in periodic batches during upload provides immediate usability rather than waiting for completion.

6. **OHIF `customizationService` crash** (`44fa38d2`) — the `dicomUploadComponent` string reference caused `TypeError: Cannot read properties of undefined (reading 'value')` in `CustomizationService.addReference()`. OHIF v3.9.2 expects objects with a `value` property, not plain strings. Fix: removed the invalid entry; DICOM upload works without it.

7. **OHIF loads all patient studies, not just the selected one** (`7da4a9fb`) — patients with multiple studies in Orthanc (e.g. patient 499504 with 13 studies) caused OHIF to prefetch and display all prior studies for the same DICOM patient ID. The console showed `StudyPrefetcher is not enabled` but the hanging protocol still matched across studies. Fix: added `studyPrefetcher: { enabled: false }` to `app-config.js` to ensure only the requested `StudyInstanceUID` is loaded.
