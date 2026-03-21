# Morpheus — Phase A Foundation + v1 Frontend

**Date:** 2026-03-20
**Status:** Complete
**Sessions:** 2 (2026-03-19 evening + 2026-03-20)

---

## What Is Morpheus

Morpheus is the inpatient analytics workbench for Parthenon — an ICU-focused outcomes research tool that will eventually ingest real-world EHR data from any vendor (Epic, Cerner, Meditech) through an AI-powered honest broker (Abby) for de-identification. For v1, it operates on the MIMIC-IV demo dataset (100 de-identified ICU patients from PhysioNet).

The name references the god of dreams — appropriate for ICU care where sedation, delirium monitoring, and the ABCDEF Liberation Bundle (waking patients from sedation) are central concerns.

## Architecture

Three-service mesh design:
- **abby-hb** — AI Honest Broker for de-identification (Phase B, not yet built)
- **morpheus-ingest** — Python FastAPI ETL service (Phase A, complete)
- **Parthenon** — Laravel API + React frontend (v1 complete)

Morpheus is a **Workbench toolset** — launched from `/workbench`, not integrated into Parthenon's sidebar. It has its own shell (MorpheusLayout) with top-bar navigation, breadcrumbs, and tabs.

## Phase A: ETL Pipeline (morpheus-ingest)

Built a complete MIMIC-IV → OMOP CDM 5.4 mapping pipeline:

### Infrastructure
- **morpheus-ingest** FastAPI service on port 8004 (Docker)
- Three new database schemas on host PG 17 (`pgsql.acumenus.net`):
  - `inpatient` — OMOP CDM 5.4 clinical tables (39 tables)
  - `inpatient_staging` — Canonical staging layer (15 tables)
  - `inpatient_ext` — Morpheus extension tables (23 tables)
- MIMIC-IV demo loaded into `mimiciv` schema (31 tables, 100 patients, 800K+ records)
- Vocabulary shared from existing `omop.*` schema (7.2M concepts)
- Alembic migrations manage schema DDL
- Laravel `inpatient` database connection added (search_path: inpatient,inpatient_ext,omop)

### ETL Components (10 tasks)
1. **MimicAdapter** — Stages 6 clinical domains (patients, encounters, conditions, drugs, measurements, procedures) from MIMIC-IV CSVs into canonical staging tables
2. **Vocabulary Lookup** — concept_lookup.py + relationship_walker.py query omop.concept for source→standard mapping via "Maps to" relationships
3. **OMOP Mappers** — person, visit, condition, drug, measurement, procedure mappers transform staging → CDM using SQL-based vocabulary JOINs with DISTINCT ON deduplication
4. **Domain Router** — Logs unmapped source codes to concept_gap table for future Abby-assisted mapping
5. **Era Builder** — Generates observation_period, condition_era, drug_era from mapped CDM data
6. **Quality Gate** — Coverage checker (96.87% conditions, 99.86% procedures), integrity checker (zero orphans), pass/fail gate

### Key Fix: ICD Code Dot Formatting
MIMIC-IV stores ICD codes without dots (`I2510`) while OMOP vocabulary expects dots (`I25.10`). Dot insertion during staging improved condition coverage from **4.77% → 96.87%** — a single SQL change with 20x impact.

### End-to-End Results
```
Staging:    100 patients, 275 encounters, 776,589 measurements
Mapping:    100 persons, 275 visits, 4,506 conditions, 18,087 drugs, 776,589 measurements
Derived:    100 observation periods, 2,776 condition eras, 6,033 drug eras
Quality:    PASSED (96.87% condition coverage, zero referential integrity violations)
Tests:      28/28 passing (60s)
```

## v1 Frontend

### Population Dashboard (`/morpheus`)
- 6 headline KPI cards (total patients, admissions, ICU rate, mortality rate, avg LOS, avg ICU LOS)
- Monthly admission volume trend chart (SVG bar chart)
- Monthly mortality rate trend chart (SVG bar + line overlay)
- Top 10 diagnoses + Top 10 procedures (horizontal bar charts)
- Gender distribution (SVG donut chart) + Age distribution (SVG histogram)
- LOS distribution histogram + Mortality by admission type
- ICU utilization by care unit
- Quick action links to filtered patient list

### Patient Journey (`/morpheus/journey`)
- Smart filter bar: ICU toggle, mortality toggle, LOS range inputs, diagnosis search
- URL parameter sync (dashboard quick actions pre-populate filters)
- Sortable columns (click headers): Subject ID, Gender, Age, Admissions, ICU Stays, Total LOS, Longest ICU, Primary Dx
- Patient count indicator ("Showing 47 of 100 patients")

### Patient Detail (`/morpheus/journey/:id`)
- Location Track — color-coded unit transfer swim lane (ED/ICU/floor/PACU)
- Medication Timeline — top 20 drugs as horizontal duration bars
- 6 view tabs: Journey, Diagnoses, Medications, Labs, Vitals, Microbiology
- Diagnosis table with ICD code, description, and OMOP concept mapping status
- Microbiology table with specimen, organism, antibiotic, S/I/R interpretation

### Workbench Shell
- MorpheusLayout with top bar, Dashboard/Patient Journey tabs, breadcrumbs
- "Back to Workbench" link
- Morpheus card in Workbench launcher flipped from "Coming Soon" to "Available"
- Sidebar "Patient Journey" entry removed (Morpheus is workbench-only)

### SVG Chart Components (no dependencies)
Built 5 reusable chart components using inline SVG (matching existing PatientLabPanel sparkline pattern):
- MetricCard, HorizontalBarChart, DistributionChart, TrendChart, DonutChart

## Backend API

### Dashboard Endpoints (8)
```
GET /api/v1/morpheus/dashboard/metrics
GET /api/v1/morpheus/dashboard/trends
GET /api/v1/morpheus/dashboard/top-diagnoses
GET /api/v1/morpheus/dashboard/top-procedures
GET /api/v1/morpheus/dashboard/demographics
GET /api/v1/morpheus/dashboard/los-distribution
GET /api/v1/morpheus/dashboard/icu-units
GET /api/v1/morpheus/dashboard/mortality-by-type
```

### Patient Journey Endpoints (16)
```
GET /api/v1/morpheus/patients
GET /api/v1/morpheus/patients/search
GET /api/v1/morpheus/patients/{id}
GET /api/v1/morpheus/patients/{id}/admissions
GET /api/v1/morpheus/patients/{id}/transfers
GET /api/v1/morpheus/patients/{id}/icu-stays
GET /api/v1/morpheus/patients/{id}/diagnoses
GET /api/v1/morpheus/patients/{id}/procedures
GET /api/v1/morpheus/patients/{id}/medications
GET /api/v1/morpheus/patients/{id}/lab-results
GET /api/v1/morpheus/patients/{id}/vitals
GET /api/v1/morpheus/patients/{id}/input-events
GET /api/v1/morpheus/patients/{id}/output-events
GET /api/v1/morpheus/patients/{id}/microbiology
GET /api/v1/morpheus/patients/{id}/services
GET /api/v1/morpheus/patients/{id}/event-counts
```

## Bugs Found and Fixed

1. **PostgreSQL numeric string serialization** — `ROUND()` returns `numeric` type which PDO serializes as strings. Added `castNumericFields()` helper + `Number()` frontend safety. Fixed in both backend service and dashboard page.

2. **ICD code format mismatch** — MIMIC stores codes without dots, OMOP expects dots. Fixed with SQL `left(icd_code, 3) || '.' || substring(icd_code from 4)` during staging.

3. **apiClient import** — Default export, not named. Fixed `{ apiClient }` → `apiClient`.

## Test Results

```
Dashboard API:      8/8  endpoints ✓
Patient List API:   8/8  filter combos ✓
Patient Detail API: 16/16 endpoints ✓
Data Quality:       6/6  checks ✓
Python Pipeline:    28/28 tests ✓
TypeScript:         0 errors ✓
Production Build:   success ✓
Auth Guard:         401 on unauth ✓
```

## What's Next

- **Phase B:** Abby Honest Broker service (de-identification for real PHI)
- **Phase C:** FHIR R4 Bulk Export adapter
- **Phase D:** HL7v2 ADT real-time feed
- **Phase E:** Core analytics workbench (ICU stay derivation, bundle compliance, patient flow)
- **v1.1:** Labs sparkline panel, vitals time-series chart (data already loaded, just needs visualization)

## Files Created/Modified

### New Files
```
morpheus-ingest/                          — Complete Python FastAPI service
  app/adapters/mimic_adapter.py
  app/mapper/{person,visit,condition,drug,measurement,procedure}_mapper.py
  app/mapper/{era_builder,domain_router}.py
  app/vocabulary/{concept_lookup,relationship_walker}.py
  app/quality/{coverage_checker,integrity_checker,gate}.py
  app/orchestrator/batch_runner.py
  app/routers/{health,ingest}.py
  tests/ (28 tests)
  alembic/ (2 migrations)

frontend/src/features/morpheus/
  pages/MorpheusDashboardPage.tsx
  pages/PatientJourneyPage.tsx
  components/{MorpheusLayout,MetricCard,HorizontalBarChart,DistributionChart,TrendChart,DonutChart}.tsx
  components/{LocationTrack,AdmissionPicker,EventCountBar,DiagnosisList,MedicationTimeline,FilterBar}.tsx
  api.ts

backend/app/Services/Morpheus/
  MorpheusDashboardService.php
  MorpheusPatientService.php
backend/app/Http/Controllers/Api/V1/
  MorpheusDashboardController.php
  MorpheusPatientController.php
```

### Modified Files
```
docker-compose.yml                        — Added morpheus-ingest service
backend/config/database.php               — Added inpatient connection
backend/routes/api.php                    — Added 24 Morpheus routes
frontend/src/app/router.tsx               — Morpheus routes with MorpheusLayout
frontend/src/features/workbench/toolsets.ts — Flipped Morpheus to available
frontend/src/components/layout/Sidebar.tsx — Removed Patient Journey entry
```

## Design Documents
- Architecture spec: `docs/superpowers/specs/2026-03-19-morpheus-v2-architecture-design.md`
- v1 Frontend spec: `docs/superpowers/specs/2026-03-20-morpheus-v1-frontend-design.md`
- Phase A plan: `docs/superpowers/plans/2026-03-19-morpheus-phase-a-foundation.md`
- v1 Frontend plan: `docs/superpowers/plans/2026-03-20-morpheus-v1-frontend.md`
- Checklist: `docs/inpatient/Morpheus-v2-Checklist.md`
