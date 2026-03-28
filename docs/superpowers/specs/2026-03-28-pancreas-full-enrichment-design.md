# Pancreatic Cancer Corpus — Full Patient Enrichment (Phase 2)

**Date:** 2026-03-28
**Status:** Approved
**Depends on:** `2026-03-28-pancreas-cdm-enrichment-design.md` (Phase 1 — complete)

## Goal

Fully enrich every patient in the pancreatic cancer corpus with DICOM imaging linkage, genomic mutation profiles, LLM-generated clinical notes, and expanded cohort coverage. After this phase, each patient has: clinical trajectory + imaging + genomics + notes — a complete multimodal research record.

## Current State (Phase 1 Complete)

- 189 patients (21 PANCREAS-CT + 168 CPTAC-PDA) with full clinical trajectories
- 12,096 measurements, 5,967 drug exposures, 702 conditions, 88 procedures, 140 deaths
- 4 pre-built cohort definitions with membership
- Achilles 128/128 passing
- DICOM in Orthanc: 23 PANCREAS-CT patients, 192 CPTAC-PDA patients (546K instances)
- TCGA-PAAD genomics: 3,424 files (8.3 GB) — MAF, copy number, miRNA, methylation

## Workstream 1: TCGA-PAAD Cohort Expansion (~185 patients)

### New Sub-Cohort

Add TCGA-PAAD as a third sub-cohort, bringing the corpus to ~374 patients.

- Care site: "NCI TCGA Pancreatic Adenocarcinoma (TCGA-PAAD)" (care_site_id = 3)
- Person records: Extract TCGA barcodes from MAF files as patient identifiers (format: TCGA-XX-XXXX)
- Demographics: Synthetic (same approach as PANCREAS-CT — random gender, age 55-75, seeded RNG)
- Subgroup stratification: Same distribution as existing cohort
- Full trajectory generation: Visits, labs, drugs, conditions, procedures, specimens, death, eras
- Observation periods covering all events

### Implementation

Extend `enrich_cdm.py`:
1. Scan TCGA-PAAD MAF files to extract unique TCGA patient barcodes
2. Create new person records (person_id starting at 190)
3. Run same trajectory generation pipeline
4. Regenerate eras
5. Update Achilles

## Workstream 2: DICOM Imaging Linkage

### Linking Orthanc Patients to CDM

For all patients with DICOM data in Orthanc:

1. Query Orthanc REST API: `POST /tools/find` to get all patients matching our cohort
2. For each Orthanc patient, get PatientID and StudyInstanceUIDs
3. Match PatientID to `pancreas.person.person_source_value`:
   - PANCREAS-CT: PatientID = "PANCREAS_XXXX" matches person_source_value
   - CPTAC-PDA: PatientID = "C3L-XXXXX" or "C3N-XXXXX" matches person_source_value
4. Create `app.imaging_studies` records:
   - `source_id = 58`
   - `person_id` from CDM
   - `study_instance_uid` from Orthanc
   - `orthanc_id` from Orthanc
   - `modality`, `study_date`, `study_description` from DICOM metadata
5. Run DICOM indexer to sync

### Orthanc Credentials

- URL: `http://localhost:8042`
- Auth: `parthenon` / `GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih`

### Implementation

New script: `scripts/pancreatic/link_dicom.py`

## Workstream 3: Genomic Mutation Profiles

### Real Data (TCGA-PAAD patients)

Parse MAF files from `/mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD/`:
- Files: `*.wxs.aliquot_ensemble_masked.maf.gz` (~10 files)
- Extract somatic mutations for the "big 4" PDAC drivers:
  - KRAS (Hugo_Symbol = "KRAS")
  - TP53 (Hugo_Symbol = "TP53")
  - SMAD4 (Hugo_Symbol = "SMAD4")
  - CDKN2A (Hugo_Symbol = "CDKN2A")
- Map GDC aliquot UUIDs → TCGA patient barcodes via MAF file `Tumor_Sample_Barcode` column
- Store as `pancreas.measurement` records

### Synthetic Assignment (Original 189 patients)

Based on published PDAC mutation frequencies (COSMIC/cBioPortal):

| Gene | Frequency | Common Variants |
|------|-----------|-----------------|
| KRAS | 93% | G12D (41%), G12V (32%), G12R (16%), Q61H (5%), other (6%) |
| TP53 | 72% | R175H (10%), R248W (8%), R273H (7%), other missense (75%) |
| SMAD4 | 32% | R361H (15%), various LOF (85%) |
| CDKN2A | 30% | Deletion (70%), R58* (10%), other (20%) |

Deterministic per-patient assignment using seeded RNG.

### OMOP Mapping

| Gene | Measurement Concept ID | Concept Name |
|------|----------------------|--------------|
| KRAS | 3012200 | KRAS gene mutations found [Identifier] in Blood or Tissue by Molecular genetics method |
| TP53 | 3009106 | TP53 gene mutations found [Identifier] in Blood or Tissue by Molecular genetics method |
| SMAD4 | 1988360 | SMAD4 gene mutations found [Identifier] in Blood or Tissue by Molecular genetics method |
| CDKN2A | 3026497 | CDKN2A gene deletion [Presence] in Blood or Tissue by Molecular genetics method |

Storage in `pancreas.measurement`:
- `measurement_concept_id`: Gene-specific LOINC concept
- `value_as_concept_id`: Positive/negative (4181412 = Present, 4132135 = Absent)
- `value_source_value`: HGVS notation (e.g., "p.G12D") or "wild-type"
- `measurement_date`: Biopsy/specimen date
- `visit_occurrence_id`: Linked to diagnostic workup visit
- `measurement_type_concept_id`: 32817 (EHR)

### Implementation

New script: `scripts/pancreatic/enrich_genomics.py`

## Workstream 4: LLM-Generated Clinical Notes

### Engine

MedGemma 1.5 4B via Ollama (local, `MedAIBase/MedGemma1.5:4b`)

### Note Types

| Note Type | note_type_concept_id | note_class_concept_id | When | Patients |
|-----------|---------------------|-----------------------|------|----------|
| Initial consultation | 32831 (EHR note) | 44814640 (Outpatient note) | Diagnostic workup visit | All ~374 |
| Pathology report | 32835 (EHR Pathology report) | 44814642 (Pathology report) | Biopsy specimen date | All ~374 |
| Operative note | 32831 (EHR note) | 44814639 (Inpatient note) | Surgery visit | ~160 surgical |
| Progress note | 32834 (EHR outpatient note) | 44814640 (Outpatient note) | First chemo visit | All ~374 |

~1,260 notes total.

### Generation Process

For each patient + note type:
1. **Assemble context packet** from CDM data:
   - Demographics (age, sex)
   - Diagnosis date, tumor location, staging (resectable/borderline/metastatic)
   - Comorbidities (from condition_occurrence)
   - Labs at the relevant visit (from measurement)
   - Current medications (from drug_exposure)
   - Procedure details (for operative notes)
   - Genomic findings (KRAS/TP53/SMAD4/CDKN2A status)
   - Survival status

2. **Send to MedGemma** with note-type-specific system prompt:
   - **Initial consultation**: Medical oncologist, HPI/PMH/meds/ROS/PE/A&P format
   - **Pathology report**: Pathologist, gross/microscopic/diagnosis/staging format
   - **Operative note**: Surgeon, procedure/findings/EBL/specimens/complications format
   - **Progress note**: Medical oncologist, interval history/labs/toxicities/plan format

3. **Store in `pancreas.note`**:
   - `note_id`, `person_id`, `note_date`, `note_datetime`
   - `note_type_concept_id`, `note_class_concept_id`
   - `note_title` (e.g., "Initial Oncology Consultation")
   - `note_text` (LLM-generated content)
   - `encoding_concept_id`: 0
   - `language_concept_id`: 4180186 (English)
   - `visit_occurrence_id`: Linked to appropriate visit
   - `note_source_value`: "medgemma-generated"

### Idempotency & Resumability

- Before generating, check if a note already exists for (person_id, note_type_concept_id, note_class_concept_id)
- Skip existing notes — allows resuming after interruption
- Full regeneration via `--force` flag that clears existing notes first

### Batching & Rate

- Sequential generation (MedGemma is local, single GPU)
- Progress bar with ETA
- Estimated: ~2 seconds per note × 1,260 notes = ~42 minutes

### Validation

- All notes linked to valid visits
- Note length: 200-800 words (reject and regenerate if outside range)
- Spot-check 10 notes for clinical accuracy

### Implementation

New script: `scripts/pancreatic/generate_notes.py`

## Workstream 5: Post-Enrichment

### Cohort Updates

- Re-run `pancreas:seed-cohorts` to update membership counts (now ~374 patients)
- Add a 5th cohort: "KRAS Mutant PDAC" (measurement-based, ~93% of corpus)

### Achilles Re-run

- Re-run Achilles on source 58 — all 128 analyses should pass
- Note-related analyses should now produce results

### Verification

- Every patient has: person + visits + conditions + procedures + measurements + drugs + specimens + obs_period
- Every patient with DICOM: imaging_study records linked
- Every patient: genomic mutation profile (4 genes)
- Every patient: 3-4 clinical notes
- Achilles 128/128 green

## Implementation Order

1. **Workstream 1**: TCGA-PAAD cohort expansion (extend enrich_cdm.py)
2. **Workstream 3**: Genomic mutation profiles (depends on TCGA-PAAD persons existing)
3. **Workstream 2**: DICOM linkage (independent, can parallel with genomics)
4. **Workstream 4**: Clinical notes (depends on all other data being in place for context packets)
5. **Workstream 5**: Post-enrichment (cohorts, Achilles, verification)

## Out of Scope

- TCGA-PAAD diagnostic slide ingestion to Orthanc (separate — downloading)
- PanTS NIfTI→DICOM conversion
- FHIR export
- Note NLP / concept extraction from generated notes
- TMB/MSI scoring (future genomics phase)
