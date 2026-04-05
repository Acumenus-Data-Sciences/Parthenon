# Devlog: Comprehensive Jobs Page — All Job Types Wired + Rich Detail Drawer

**Date:** 2026-04-05
**Commit:** `5e29c3a4e`
**Scope:** Backend (JobController), Frontend (Jobs feature), API route

---

## Problem

The Jobs monitoring page was only wired to 8 of the system's 13+ tracked job types. Achilles runs, FHIR Sync, Care Gap evaluations, GIS Boundary loads, and Poseidon ETL runs were invisible — they had tracking models and were dispatching via Horizon, but `JobController::index()` never queried them. Additionally, the detail drawer was blank for all non-analysis jobs because the `show` endpoint used `AnalysisExecution` route model binding, so clicking any cohort generation, ingestion, DQD, or other job type returned a 404.

Several pre-existing bugs compounded the visibility problem:
- Cohort generation's stale detection created a DB-filter/display-status mismatch (stale jobs appeared under the wrong status filter)
- FHIR Export returned raw `processing` status instead of normalizing to `running`
- N+1 `Source::find()` calls inside DQD, Heel, and Achilles `.map()` loops
- SCCS and Evidence Synthesis type filters returned all analysis types instead of scoping to the specific morph class

## Changes

### Backend — `JobController.php` (+979 lines)

**5 new job collectors** added to `index()`:
| # | Type | Model | Scope |
|---|------|-------|-------|
| 10 | `fhir_sync` | `FhirSyncRun` | System |
| 11 | `care_gap` | `CareGapEvaluation` | User |
| 12 | `gis_boundary` | `GisDataset` | User |
| 13 | `poseidon` | `PoseidonRun` | System |
| — | ~~`finngen`~~ | Removed — workbench app, not core job | — |

**Polymorphic `show` endpoint** — replaced `AnalysisExecution` route model binding with `show(Request $request, int $jobId)` that dispatches to 14 type-specific detail builders via `?type=` query param. Each builder returns the standard job fields plus a `details` object with type-specific data and a `timeline` array of execution log entries.

**Type-specific detail data:**
- **Achilles:** category breakdown (completed/failed/running per category), failed step list with error messages, full step-by-step timeline
- **DQD:** checks passed/failed/total, pass rate percentage, execution time, top 20 failing checks with severity/description/table
- **Heel:** rules triggered count, violation list with rule name, severity, record count
- **Analysis types:** analysis name/description, parameters JSON, execution log timeline
- **Cohort Generation:** person count, cohort description, stale warning flag
- **Ingestion:** pipeline stage, file info, record stats (total/processed/failed), mapping coverage
- **FHIR Sync:** resource types badges, full record flow (extracted→mapped→written→failed), coverage
- **Genomic:** filename, format, file size, variant/sample counts
- **GIS:** geometry type, feature count, boundary levels
- **Poseidon:** run type, Dagster run ID, stats JSON
- **Care Gap:** bundle name, person count, compliance summary

**Bug fixes:**
1. **Cohort stale detection** — When filtering by `status=failed`, the DB query now includes stale-eligible statuses (queued/running/pending) alongside genuinely failed jobs, then post-filters by computed display status. This ensures stale jobs show under "Failed" and don't ghost under "Queued".
2. **FHIR Export normalization** — Added `normalizeFhirExportStatus()` mapping `processing` → `running`, with reverse mapping for DB filter queries.
3. **N+1 elimination** — DQD, Heel, and Achilles collectors now pre-load all referenced sources in one `Source::whereIn()` query, keyed by ID, instead of calling `Source::find()` per row in the `.map()` loop.
4. **Analysis type scoping** — Added `analysisModelForType()` that maps filter strings to specific morph classes. When filtering by `sccs`, only `SccsAnalysis` executions are returned instead of all analysis types.

### Frontend

**`jobsApi.ts`** — `JobType` union expanded from 17 to 21 members. New `JobDetail` and `TimelineEntry` interfaces. `fetchJob()` now accepts `type` param.

**`useJobs.ts`** — `useJob()` replaced with `useJobDetail(id, type)` that passes both to the API.

**`JobsPage.tsx`** — 
- 21 type filter pills (was 13), organized by category: Research & Analysis, Data Quality, Data Pipeline, Integrations, GIS
- Icons for all types (HeartPulse for Care Gaps, Database for Poseidon, Layers for GIS Boundaries, etc.)
- Drawer replaced with `<JobDetailDrawer>` component

**`JobDetailDrawer.tsx`** (new, ~500 lines) — Renders:
1. Status badge + live progress bar
2. Overview metadata grid (7 fields)
3. Error alert (when failed)
4. Log output code block
5. Type-specific detail section (14 renderers)
6. Execution timeline (scrollable, last 30 entries)
7. Action buttons (Retry/Cancel)

Subcomponents: `MetaGrid`, `DetailSection`, `StatBar`, `TimelineView`, plus type-specific renderers (`AchillesDetails`, `DqdDetails`, `HeelDetails`, `IngestionDetails`, etc.)

### Route Change

`GET /jobs/{job}` → `GET /jobs/{jobId}` with `->whereNumber('jobId')` to bypass implicit model binding.

### Infrastructure

Created missing `app.gis_datasets` table (migration record existed but table was dropped) and granted permissions to `parthenon_app` role.

## Testing

Full matrix validated via artisan tinker:
- **21 type filters:** All pass (each returns only matching type, 0 cross-contamination)
- **6 status filters:** All pass (0 status mismatches including stale cohort jobs)
- **0 invalid statuses** across 250 jobs
- **14 show endpoints:** All return enriched detail with correct `details` keys and `timeline` entries

## Files Changed

| File | Lines |
|------|-------|
| `backend/app/Http/Controllers/Api/V1/JobController.php` | +979 |
| `backend/routes/api.php` | +1 -1 |
| `frontend/src/features/jobs/components/JobDetailDrawer.tsx` | +500 (new) |
| `frontend/src/features/jobs/pages/JobsPage.tsx` | +30 -97 |
| `frontend/src/features/jobs/api/jobsApi.ts` | +15 -4 |
| `frontend/src/features/jobs/hooks/useJobs.ts` | +6 -10 |
