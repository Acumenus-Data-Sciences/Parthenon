# Phase 16 — DICOM & Medical Imaging

**Version target:** 1.2.0
**Devlog started:** March 5, 2026

## Plan

Per ROADMAP.md:
- §16.1: App-layer imaging tables (image_occurrences, image_features, orthanc_series) + models
- §16.2: DICOM metadata ETL service (DICOMweb QIDO-RS → OMOP Image_occurrence)
- §16.3: Imaging criteria in cohort builder (modality, anatomy, AI-derived classification, dose)
- §16.4: Radiology report NLP (LLM pipeline: RadLex/SNOMED extraction → Image_feature records)
- §16.5: Imaging analytics (federated radiomic feature distributions, population-level dose optimization)

Orthanc Docker service is not yet running — §16.1 and §16.2 will use the DICOMweb API protocol
with a configurable endpoint (can point to any Orthanc instance including production).

---

## §16.1 — Data Layer, DICOMweb Client, and Frontend Module ✅

**Completed:** 2026-03-05

### Backend

**Migration** `2026_03_05_160001_create_imaging_tables.php` — 4 tables:

| Table | Purpose |
|---|---|
| `imaging_studies` | Study-level DICOM metadata (UID, modality, body part, date, person_id linkage) |
| `imaging_series` | Series within a study (modality, description, num_images, slice_thickness_mm) |
| `imaging_features` | AI/NLP-extracted structured features (RadLex/SNOMED-mapped) |
| `imaging_cohort_criteria` | Saved imaging criteria definitions for cohort builder |

**Models:** ImagingStudy, ImagingSeries, ImagingFeature, ImagingCohortCriterion

**Services:**
- `DicomwebService` — QIDO-RS (IHE RAD.66) study/series query from any DICOMweb PACS. Parses DICOMweb JSON+DICOM hex-tag attribute format. `indexStudies()`, `indexSeriesForStudy()`, `getStudyMetadata()`, `getWadorsUri()`. DICOM date (YYYYMMDD → ISO) and PN VR formatting. Configurable via `DICOMWEB_BASE_URL`, `DICOMWEB_USERNAME`, `DICOMWEB_PASSWORD`.
- `RadiologyNlpService` — Fetches OMOP NOTE records for a person, sends to Abby AI service for structured finding extraction, maps to SNOMED via vocabulary ILIKE lookup, writes ImagingFeature records (`algorithm_name = 'Abby/Ollama-NLP'`, `confidence = 0.75`).

**Controller:** `ImagingController` — 11 endpoints covering stats, study CRUD + DICOMweb indexing, series indexing, NLP extraction, features, criteria CRUD, population analytics.

**Config:** Fixed duplicate `services.ai` key in `config/services.php` (PHP silently uses the last of duplicate keys — consolidated to single entry).

**API Routes** `backend/routes/api.php` — Phase 16 group added with all 11 imaging endpoints.

### Frontend

**Feature module** `frontend/src/features/imaging/`:
- `types/index.ts` — TypeScript interfaces (ImagingStudy, ImagingSeries, ImagingFeature, ImagingCohortCriterion, ImagingStats, PopulationAnalytics, PaginatedResponse)
- `api/imagingApi.ts` — Axios client wrapping all endpoints
- `hooks/useImaging.ts` — TanStack Query hooks for all data + mutations
- `pages/ImagingPage.tsx` — 3-tab layout: Studies (filterable table, DICOMweb index button, modality badges), AI Features (type filter, confidence bars, OMOP concept IDs), Imaging Criteria (JSON preview, delete)
- `pages/ImagingStudyPage.tsx` — Study detail: metadata grid, series table, AI features table, Index Series + Extract NLP action buttons

**Sidebar:** Added `ScanLine` icon import, `/imaging` nav item.

**Router:** `/imaging` index + `/imaging/studies/:id` lazy routes.

### Gotchas

- `apiClient` is a default export, not named: `import apiClient from "@/lib/api-client"`
- Axios `baseURL` is already `/api/v1` — route paths must omit the `/v1` prefix
- Duplicate `services.ai` PHP key: second definition silently overwrites first; fixed by merging into one

### Pending

- §16.2: Orthanc Docker service + automated study → OMOP `image_occurrence` ETL
- §16.3: Imaging criteria panel in cohort builder
- §16.4: Radiology NLP UI (trigger + findings review)
- §16.5: Population imaging analytics charts

---
