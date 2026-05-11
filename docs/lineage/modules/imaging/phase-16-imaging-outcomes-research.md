# Phase 16 — Imaging Outcomes Research (Phase 1: Longitudinal Timeline + Measurements)

**Date:** 2026-03-06
**Status:** Phase 1 complete, Phases 2-6 pending

## What Was Built

### Problem Statement
The imaging module was a DICOM file browser/viewer. For outcomes research, clinicians need to answer: "Did patients in Cohort A (treatment X) show better imaging outcomes than Cohort B (treatment Y)?" Examples:
- COVID-19: Compare Ivermectin+HCQ cohort vs standard of care using chest CT opacity scores
- Colon cancer: Compare standard chemo vs novel targeted therapy using solid tumor volumetrics and PET metastasis tracking

### Phase 1 Deliverables

#### Backend
1. **Migration** (`2026_03_07_000001`): Two new tables:
   - `imaging_measurements` — quantitative imaging biomarkers (tumor volume, SUVmax, opacity scores, diameters) per study, with RECIST target lesion tracking
   - `imaging_response_assessments` — treatment response classifications (CR/PR/SD/PD) with baseline/nadir comparisons

2. **Models**: `ImagingMeasurement`, `ImagingResponseAssessment` with relationships to `ImagingStudy`

3. **ImagingTimelineService** — Core longitudinal analysis:
   - Patient timeline builder (studies + drug exposures from OMOP + measurements + summary)
   - Drug exposure queries via `cdm` connection with ATC class lookup via `concept_ancestor`
   - Measurement trend time series
   - Auto-link studies to OMOP persons by matching `patient_id_dicom` → `person_source_value`

4. **ImagingAiService** — AI-powered measurement extraction:
   - MedGemma integration via Python AI service
   - Radiology report extraction from OMOP NOTE table
   - Template suggestion based on modality/body part (RECIST, COVID Lung CT, PET Lugano, Brain RANO)
   - Fallback regex extraction for percentages, SUV, size/diameter patterns

5. **ImagingTimelineController** — 20 new API endpoints covering patients, timelines, study linking, measurements CRUD, response assessments, AI extraction

#### Frontend
1. **PatientTimelineTab** — Search patients by person_id, auto-link studies, paginated patient list with study counts/modalities/date ranges

2. **PatientTimeline** — Visual longitudinal timeline:
   - Demographics + summary cards
   - Drug exposure bars on time axis
   - Study nodes color-coded by modality with measurement count badges
   - Measurement trend sparklines with percent change indicators
   - Expandable study and drug tables

3. **MeasurementPanel** — Study-level measurement management:
   - AI Auto-Extract button (MedGemma)
   - 4 template presets (RECIST, COVID Lung CT, PET Lugano, Tumor Volumetrics)
   - Manual measurement entry form with RECIST target lesion tracking
   - Existing measurements table with delete

4. **New tabs**: "Patient Timeline" on ImagingPage, "Measurements" on ImagingStudyPage

### Routes Added
31 total imaging routes (11 existing + 20 new outcomes research endpoints)

## Architecture Decisions
- Drug exposures queried from OMOP `drug_exposure` via `cdm` Laravel connection (not app DB)
- Measurements stored in app DB (Docker PG) since they're application-generated data
- AI extraction has graceful fallback: MedGemma → regex extraction → empty
- Study-person linking is bidirectional: manual per-study or batch auto-link

## Remaining Phases
- Phase 2: Enhanced measurement trend visualization (Recharts charts)
- Phase 3: Response Assessment Engine (automated RECIST 1.1, CT Severity, Deauville computation)
- Phase 4: Cohort Imaging Comparison Dashboard (the core A vs B outcomes question)
- Phase 5: Genomics-Imaging Integration (Radiogenomics)
- Phase 6: Population Analytics & Reporting

## Gotchas
- All 1000 imaging studies currently have `person_id = NULL` — auto-link or manual link needed
- Python AI service endpoint `POST /api/imaging/extract-measurements` not yet implemented — fallback regex works
- Drug exposure grouping limited to 50 drugs per patient to avoid query explosion
