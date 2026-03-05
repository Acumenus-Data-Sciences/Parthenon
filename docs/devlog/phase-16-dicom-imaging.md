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

---

## §16.2 — Population Analytics UI ✅

**Completed:** 2026-03-05

Added **Population Analytics** tab to ImagingPage:
- Studies by modality: horizontal bar chart with unique_persons breakdown
- Studies by body part: top 15 body parts with bar visualization
- Top AI/NLP features: grid of feature name + type + count cards
- Requires source_id input to query — zero-state prompt when none entered

---

## §16.3 — Imaging Criteria in Cohort Builder ✅

**Completed:** 2026-03-05

**New types in `cohortExpression.ts`:**
- `ImagingCriteriaType` union: modality | anatomy | quantitative | ai_classification | dose
- `ImagingCriterion` interface with all type-specific fields + `exclude` flag

**New store actions in `cohortExpressionStore.ts`:**
- `addImagingCriterion(criterion)` — appends to `expression.ImagingCriteria`
- `removeImagingCriterion(index)` — removes by index

**`ImagingCriteriaPanel` component** (`features/imaging/components/ImagingCriteriaPanel.tsx`):
- Type selector: 5 types with icons and descriptions
- Modality: quick-select chip grid (CT/MR/PT/US/CR/DX/MG/XA/NM/RF) + custom text input
- Anatomy: common body part chip grid + custom text input
- Quantitative: feature name + operator selector (≥/>/≤/</=) + value + unit
- AI Classification: label text + confidence slider (0-100%)
- Dose: max Gy numeric input
- Exclude toggle + cyan "Add Criterion" button

**`CohortExpressionEditor` section 8** (`Imaging Criteria`):
- Collapsible section with `ScanLine` icon + cyan badge
- Criterion chips (cyan color scheme, type label, EXCLUDE badge)
- Dashed "Add Imaging Criterion" button → inline panel

### Pending

- §16.4: Radiology NLP UI (trigger + findings review in study detail page)
- §16.5: Orthanc Docker service (optional — system works without it via configurable endpoint)

---
