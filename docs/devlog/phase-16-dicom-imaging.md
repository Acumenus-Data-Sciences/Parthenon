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

## §16.6 — Imaging UX Alignment (Post-ship polish, March 5, 2026)

**What was built:**

All 3 imaging frontend files comprehensively revised to match the Parthenon design system.

### Problem severity
Imaging was in worse shape than Genomics. `ImagingPage.tsx` and `ImagingStudyPage.tsx` used a completely different legacy CSS framework — abstract class names (`card`, `btn`, `badge`, `data-table`, `input`, `text-muted`, `bg-surface`, `text-accent`, `bg-accent`, `page-container`, `page-header`, `page-title`, `tabs`, `tab`, `tab-active`, `alert alert-success`) that don't resolve to any defined Tailwind classes. These rendered as essentially unstyled HTML in production. `ImagingCriteriaPanel.tsx` was partially aligned but used `cyan-700/cyan-500` instead of `#2DD4BF`, and wrong container/label/button tokens.

Additionally, modality badges used light-mode colors (`bg-blue-100 text-blue-800`) — completely broken in dark mode.

### Files revised (3)

**ImagingPage.tsx** — complete rewrite from legacy CSS framework to design system
- Removed `page-container` → `space-y-6`; header → standard h1/subtitle pattern with icon-in-circle (blue `#60A5FA` domain accent)
- `StatsBar`: redesigned to match `CohortStatsBar` — horizontal tiles, IBM Plex Mono numbers, icon circles; blue/violet/teal domain accents
- Modality badges: full dark-mode redesign — CT `bg-blue-400/15 text-blue-400`, MR `bg-[#A78BFA]/15`, PT orange, US teal, CR/DX neutral, MG pink
- Study status badges: teal for processed, red for error, neutral for all others
- Tab bar: `border-[#2DD4BF]` active, `text-[#5A5650] hover:text-[#8A857D]` inactive
- All inputs/selects: `bg-[#151518] border-[#232328] focus:border-[#2DD4BF]` with proper labels
- All tables: `rounded-lg border border-[#232328] bg-[#151518]`, header text-[10px] uppercase, row dividers `divide-[#1E1E23]`
- Index success alert: `bg-[#2DD4BF]/10 border-[#2DD4BF]/30 text-[#2DD4BF]`
- Confidence bar: teal (≥80%), amber (≥60%), red (<60%)
- Criteria delete: icon `Trash2` with danger hover instead of `btn btn-danger`
- Analytics: teal bars for modality, blue for body part; top features use IBM Plex Mono + violet

**ImagingStudyPage.tsx** — complete rewrite
- Removed `page-container` → `space-y-6`; back nav → `ArrowLeft` with `text-[#8A857D] hover:text-[#F0EDE8]`
- Header: icon-in-circle (blue) + h1 + UID as monospace subtitle
- "Index Series" → secondary button; "Extract NLP" → teal primary (per action hierarchy)
- Loading/not-found states: spinner uses `text-[#2DD4BF]`, no rogue background wrapper
- Success banners: teal design-system style
- Metadata card, series table, features table: all standard tokens

**ImagingCriteriaPanel.tsx** — targeted alignment
- Container: `border-[#232328] bg-[#151518]` (was `border-cyan-700/40 bg-[#1A1A1E]`)
- Panel title: `text-[#F0EDE8]` with blue ScanLine icon (was `text-cyan-300`)
- Active type button: `border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]` (was cyan-500/900)
- Modality chips: teal active (was `bg-cyan-700`)
- Anatomy chips: teal active (was `bg-green-700`)
- All inputs/selects: `focus:border-[#2DD4BF]` (was `focus:border-cyan-500`)
- Labels: `text-[#8A857D]`; cancel: `text-[#5A5650] hover:text-[#8A857D]`
- Add button: `bg-[#2DD4BF] text-[#0E0E11]` (was `bg-cyan-700 text-white`)
- Range slider: `accent-[#2DD4BF]`

### Domain accent colors (Imaging)
- **Blue (`#60A5FA`)** — ScanLine/section icon, modality analytics bars, study detail header
- **Violet (`#A78BFA`)** — Brain/AI features icon and IBM Plex Mono numbers
- **Teal (`#2DD4BF`)** — primary action, persons stat, processed status, interactive elements, criteria add button

### Gotchas
- The legacy CSS class names (`card`, `btn`, `badge`, etc.) were not Tailwind utilities and produced no styles. The pages were rendering as near-unstyled HTML in production.
- `ImagingCriteriaPanel` is embedded inside the Cohort Builder dark panel — its design tokens must match that context exactly, not stand alone.

---
