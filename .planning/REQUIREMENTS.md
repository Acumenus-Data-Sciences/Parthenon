# Requirements: IRSF-NHS OMOP CDM Import

**Defined:** 2026-03-26
**Core Value:** All ~1,860 Rett Syndrome patients queryable in Parthenon's OMOP CDM with accurate demographics, medications, conditions, measurements, and observations

## v1 Requirements

### Foundation

- [x] **FOUND-01**: ETL shared library provides tested date assembly from split columns (Month-text, Day-int, Year-int) with imputation rules matching Final_Queries.sql logic
- [x] **FOUND-02**: ETL shared library provides cross-protocol ID reconciliation mapping all three ID systems to unified person_id via Person_Characteristics crosswalk
- [x] **FOUND-03**: ETL shared library provides vocabulary validator that checks concept_ids against current Athena vocabulary and follows Maps-to chain for deprecated codes
- [x] **FOUND-04**: ETL shared library provides error accumulation logger that tracks rejected/skipped records per table with reasons and produces rejection summary reports
- [x] **FOUND-05**: All 60+ source CSV files are profiled with row counts, null rates, value distributions, and date format detection before any transformation begins
- [x] **FOUND-06**: Python ETL scripts live in `scripts/irsf-etl/` with shared `lib/` package, using pandera for DataFrame schema validation

### Person and Demographics

- [x] **PERS-01**: Person roster built from Person_Characteristics_5201_5211.csv produces ~1,860 unique persons with deterministic person_id assignment
- [x] **PERS-02**: Gender mapping correctly handles Rett population (~95% female) with concept_ids 8532 (Female) and 8507 (Male)
- [x] **PERS-03**: Race mapping converts multiple boolean race columns to single OMOP race_concept_id with multi-race mapped to concept_id 0 and flags preserved in race_source_value
- [x] **PERS-04**: Ethnicity mapping converts to standard OMOP concepts (38003563 Hispanic, 38003564 Non-Hispanic)
- [x] **PERS-05**: Date of birth assembled from split columns with year/month/day populated in person table
- [x] **PERS-06**: Death records imported from both protocols (5201: 73 rows, 5211: 94 rows) with deduplication on unified participant_id

### Visit Derivation

- [x] **VISIT-01**: Visit occurrences derived from unique (person_id, visit_date, visit_label) tuples across clinical tables
- [x] **VISIT-02**: Study visits classified as outpatient (concept_id 9202), hospitalizations from Hospitalizations_5211 classified as inpatient (concept_id 9201)
- [x] **VISIT-03**: Visit lookup map (visit_id_map.csv) produced for all clinical event scripts to reference

### Medications

- [x] **MED-01**: All 44K medication records from Medications_5201_5211.csv transformed to drug_exposure staging CSV
- [x] **MED-02**: MedRxNormCode formatted strings parsed via regex to extract clean RxNorm concept_ids
- [x] **MED-03**: Pre-mapped RxNorm codes validated against current Athena vocabulary with deprecated codes remapped via Maps-to relationships
- [x] **MED-04**: Drug exposure start/stop dates assembled from split date columns with stop_reason populated from ReasonForStoppin columns
- [ ] **MED-05**: Drug mapping coverage rate >= 90% (records with valid RxNorm concept)

### Conditions

- [x] **COND-01**: Chronic diagnoses, seizures, bone fractures, and infections from 5211 tables transformed to condition_occurrence staging CSV
- [x] **COND-02**: Pre-mapped SNOMED codes from SNOWMEDOutput columns validated against current vocabulary
- [x] **COND-03**: Condition mapping coverage rate >= 85% (records with valid SNOMED concept)

### Measurements

- [x] **MEAS-01**: Growth measurements (height, weight, BMI, head circumference) unpivoted from wide to long format with LOINC concept_ids (3036277, 3025315, 3038553, 3036832)
- [x] **MEAS-02**: Clinical Severity Scale (CSS) total score and individual items stored as separate measurement rows with custom IRSF concept_ids
- [ ] **MEAS-03**: Lab results from Labs_5211 mapped to LOINC concepts
- [ ] **MEAS-04**: SF-36 quality of life scores transformed to measurement rows
- [ ] **MEAS-05**: Measurement mapping coverage rate >= 95% for growth/lab measurements
- [x] **MEAS-06**: Wide-to-long unpivot filters NULL primary values to avoid row inflation

### Observations

- [x] **OBS-01**: Motor Behavioral Assessment (MBA) scores stored as observation rows with custom IRSF concept_ids
- [x] **OBS-02**: Genotype/mutation data (~50 boolean columns) mapped to structured observations with value=1 only emitted, using custom IRSF vocabulary concepts
- [ ] **OBS-03**: Rett features, developmental history, clinical assessments, allergies, nutrition, and other categorical data mapped to observation table
- [x] **OBS-04**: All observations carry observation_source_value preserving original column names and values

### Custom Vocabulary

- [x] **VOCAB-01**: Custom IRSF-NHS vocabulary created with vocabulary_id='IRSF-NHS' and concept_ids >= 2,000,000,000 per OHDSI convention
- [x] **VOCAB-02**: CSS total score and ~13 individual item concepts registered in custom vocabulary
- [x] **VOCAB-03**: MBA total score and item concepts registered in custom vocabulary
- [x] **VOCAB-04**: ~50 MECP2/CDKL5/FOXG1 mutation type concepts registered with groupings (missense, nonsense, large deletion, C-terminal truncation)
- [x] **VOCAB-05**: Rett diagnostic category concepts (classic Rett, atypical Rett, CDKL5 deficiency, FOXG1, MECP2 duplication) registered
- [x] **VOCAB-06**: All custom concepts registered in source_to_concept_map for ETL lookup

### Data Loading

- [ ] **LOAD-01**: Staging CSVs uploaded to Parthenon ingestion pipeline in strict FK dependency order: person -> visit -> death -> drug -> condition -> measurement -> observation
- [ ] **LOAD-02**: Observation periods computed post-load from all event table date ranges via Parthenon's ObservationPeriodCalculator
- [ ] **LOAD-03**: 100% of loaded persons have at least one observation period
- [ ] **LOAD-04**: CDM_SOURCE table populated with IRSF-NHS metadata

### Validation

- [ ] **VAL-01**: DQD checks pass at >= 80% rate on populated tables
- [ ] **VAL-02**: Achilles characterization runs successfully and produces reports in results schema
- [ ] **VAL-03**: Zero events recorded before birth or after death (temporal integrity)
- [ ] **VAL-04**: Rett-specific plausibility checks pass: ~95% female, MECP2 mutation in ~95%, age at first visit typically 0-10 years
- [ ] **VAL-05**: At least 3 cohort definitions buildable in Parthenon's cohort builder (all Rett, seizure subgroup, medication exposure)
- [ ] **VAL-06**: Rejection rate < 5% for all high-priority tables

### Source Value Preservation

- [x] **SRC-01**: Every mapped record carries original source code/text in *_source_value columns
- [x] **SRC-02**: Pre-mapped concept_ids stored in *_source_concept_id columns

## v2 Requirements

### Reusable Framework

- **FWK-01**: Extract composable Python modules (DateAssembler, PersonRoster, WideToLong) into a reusable rare disease ETL framework
- **FWK-02**: Parameterize registry-specific values via YAML config files per registry

### Additional Clinical Data

- **CLIN-01**: EKG data from 5201 mapped to measurement table
- **CLIN-02**: AdditionalEEGInfo_5211 mapped to measurement table
- **CLIN-03**: Sibling_5211 mapped as family history observations
- **CLIN-04**: Pregnancy_5211 mapped as maternal observations

### Cross-Protocol Deduplication

- **DEDUP-01**: Automated detection and resolution of duplicate events from patients enrolled in both protocols

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time / incremental ETL | One-time historical import; design for idempotent re-runs |
| De-identification pipeline | Data already de-identified per RDCRN protocols |
| Generic configurable ETL UI | Aqueduct already exists; IRSF transforms too idiosyncratic |
| FHIR intermediary conversion | CSV-to-CDM direct; FHIR service is for HL7 bundles |
| Multi-CDM-version support | Parthenon targets v5.4 exclusively |
| FilesUpload_5211 | File metadata, not clinical data |
| ContactRegistryEnrollment_5211 | Administrative, not clinical |
| Other_Research_5211 | External study references |
| Eligibility_5211 | Study admin, not clinical observations |
| Custom Achilles implementation | Use existing Parthenon R runtime + HADES |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 2 | Complete |
| FOUND-02 | Phase 2 | Complete |
| FOUND-03 | Phase 3 | Complete |
| FOUND-04 | Phase 3 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| PERS-01 | Phase 4 | Complete |
| PERS-02 | Phase 4 | Complete |
| PERS-03 | Phase 4 | Complete |
| PERS-04 | Phase 4 | Complete |
| PERS-05 | Phase 4 | Complete |
| PERS-06 | Phase 4 | Complete |
| VISIT-01 | Phase 5 | Complete |
| VISIT-02 | Phase 5 | Complete |
| VISIT-03 | Phase 5 | Complete |
| MED-01 | Phase 7 | Complete |
| MED-02 | Phase 7 | Complete |
| MED-03 | Phase 7 | Complete |
| MED-04 | Phase 7 | Complete |
| MED-05 | Phase 7 | Pending |
| COND-01 | Phase 8 | Complete |
| COND-02 | Phase 8 | Complete |
| COND-03 | Phase 8 | Complete |
| MEAS-01 | Phase 9 | Complete |
| MEAS-02 | Phase 9 | Complete |
| MEAS-03 | Phase 9 | Pending |
| MEAS-04 | Phase 9 | Pending |
| MEAS-05 | Phase 9 | Pending |
| MEAS-06 | Phase 9 | Complete |
| OBS-01 | Phase 10 | Complete |
| OBS-02 | Phase 10 | Complete |
| OBS-03 | Phase 10 | Pending |
| OBS-04 | Phase 10 | Complete |
| VOCAB-01 | Phase 6 | Complete |
| VOCAB-02 | Phase 6 | Complete |
| VOCAB-03 | Phase 6 | Complete |
| VOCAB-04 | Phase 6 | Complete |
| VOCAB-05 | Phase 6 | Complete |
| VOCAB-06 | Phase 6 | Complete |
| LOAD-01 | Phase 11 | Pending |
| LOAD-02 | Phase 11 | Pending |
| LOAD-03 | Phase 11 | Pending |
| LOAD-04 | Phase 11 | Pending |
| VAL-01 | Phase 12 | Pending |
| VAL-02 | Phase 12 | Pending |
| VAL-03 | Phase 12 | Pending |
| VAL-04 | Phase 12 | Pending |
| VAL-05 | Phase 12 | Pending |
| VAL-06 | Phase 12 | Pending |
| SRC-01 | Phase 7 | Complete |
| SRC-02 | Phase 7 | Complete |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation -- all 51 v1 requirements mapped to 12 phases*
