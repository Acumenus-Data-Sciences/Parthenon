# Roadmap: IRSF-NHS OMOP CDM Import

## Overview

This roadmap transforms the IRSF Natural History Study dataset (~1,860 Rett Syndrome patients across two RDCRN protocols) into a fully queryable OMOP CDM v5.4 source in Parthenon. The work follows the strict dependency chain dictated by OMOP FK constraints: shared utilities first, then person/visit foundation, then clinical domains (medications, conditions, measurements, observations) with custom vocabulary, then CDM loading in FK order, and finally validation with Achilles/DQD. Each phase produces inspectable artifacts (tested library modules, staging CSVs, validation reports) before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Setup and Source Data Profiling** - Python project scaffold in scripts/irsf-etl/ with pandera, plus automated profiling of all 60+ source CSVs (completed 2026-03-26)
- [x] **Phase 2: Shared Library - Date and ID Utilities** - Tested date assembly and cross-protocol ID reconciliation modules that all downstream scripts depend on (completed 2026-03-26)
- [x] **Phase 3: Shared Library - Vocabulary and Error Handling** - Vocabulary validator against current Athena load and structured error accumulation logger (completed 2026-03-26)
- [x] **Phase 4: Person and Demographics** - Person roster script producing ~1,860 unique persons with gender, race, ethnicity, DOB, and death records (completed 2026-03-26)
- [x] **Phase 5: Visit Derivation** - Visit occurrence script deriving visits from clinical table dates with outpatient/inpatient classification (completed 2026-03-26)
- [x] **Phase 6: Custom IRSF Vocabulary** - Custom vocabulary (concept_ids >= 2B) for CSS, MBA, genotype mutations, and Rett diagnostic categories (completed 2026-03-26)
- [ ] **Phase 7: Medications** - Drug exposure script transforming 44K medication records with RxNorm formatted-string parsing and source value preservation
- [x] **Phase 8: Conditions** - Condition occurrence script for chronic diagnoses, seizures, fractures, and infections with SNOMED mapping (completed 2026-03-26)
- [ ] **Phase 9: Measurements** - Measurement script with wide-to-long unpivot for growth, CSS, labs, and SF-36 data
- [ ] **Phase 10: Observations** - Observation script for MBA scores, genotype boolean mapping, and categorical clinical data
- [ ] **Phase 11: Data Loading and Observation Periods** - Upload staging CSVs to Parthenon in FK order, compute observation periods, populate CDM_SOURCE
- [ ] **Phase 12: Validation and Cohort Verification** - DQD checks, Achilles characterization, temporal integrity, Rett-specific plausibility, and cohort buildability

## Phase Details

### Phase 1: Project Setup and Source Data Profiling
**Goal**: Python ETL project is scaffolded and all source data is profiled before any transformation begins
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. Running `python -m scripts.irsf_etl` from the project root produces a help message showing available commands
  2. A profiling report exists for all 60+ source CSVs showing row counts, null rates, value distributions, and date format detection
  3. pandera is installed and importable in the ETL environment with a passing smoke test
**Plans**: 2 plans

Plans:
- [ ] 01-01: Project scaffold and dependency setup
- [ ] 01-02: Source data profiling automation

### Phase 2: Shared Library - Date and ID Utilities
**Goal**: Every downstream script can assemble valid dates from split columns and resolve any protocol ID to a unified person_id
**Depends on**: Phase 1
**Requirements**: FOUND-01, FOUND-02
**Success Criteria** (what must be TRUE):
  1. Date assembler correctly handles all edge cases from Final_Queries.sql (month text abbreviations, invalid days clamped, years outside 1900-2025 rejected) with >= 80% test coverage
  2. ID reconciliation maps all three ID systems (participant_id5201, participant_id5211, unified participant_id) to deterministic person_ids and produces person_id_map.csv
  3. Both modules are pure functions with no database dependency, importable by all ETL scripts
**Plans**: TBD

Plans:
- [ ] 02-01: Date assembly module ported from Final_Queries.sql
- [ ] 02-02: Cross-protocol ID reconciliation module

### Phase 3: Shared Library - Vocabulary and Error Handling
**Goal**: ETL scripts can validate concept_ids against current Athena vocabulary and accumulate errors without aborting
**Depends on**: Phase 1
**Requirements**: FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. Vocabulary validator queries omop.concept for standard/valid concepts and follows Maps-to chain for deprecated codes, reporting remapping decisions
  2. Error logger accumulates rejected/skipped records per table with reasons and produces a rejection summary report (not fail-fast)
  3. Pre-mapped RxNorm and SNOMED crosswalk files have been validated against current Athena load with a currency report showing how many codes are current vs deprecated vs unmapped
**Plans**: TBD

Plans:
- [ ] 03-01: Vocabulary validator with Maps-to chain resolution
- [ ] 03-02: Error accumulation logger and rejection reporting

### Phase 4: Person and Demographics
**Goal**: All ~1,860 unique Rett Syndrome patients exist as person records with accurate demographics and death records
**Depends on**: Phase 2, Phase 3
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06
**Success Criteria** (what must be TRUE):
  1. staging/person.csv contains approximately 1,860 unique persons with deterministic person_id assignment (no duplicates, no orphans across protocols)
  2. Gender distribution is approximately 95% female (concept_id 8532), matching known Rett population characteristics
  3. Race, ethnicity, and date of birth fields are populated with correct OMOP concept_ids (multi-race mapped to concept_id 0 with flags in race_source_value)
  4. staging/death.csv contains deduplicated death records from both protocols (73 from 5201, 94 from 5211) with at most one death per person
**Plans**: TBD

Plans:
- [ ] 04-01: Person roster builder from Person_Characteristics
- [ ] 04-02: Demographics mapping (gender, race, ethnicity, DOB)
- [ ] 04-03: Death record extraction and deduplication

### Phase 5: Visit Derivation
**Goal**: Every clinical event has a visit_occurrence to reference, with correct visit type classification
**Depends on**: Phase 4
**Requirements**: VISIT-01, VISIT-02, VISIT-03
**Success Criteria** (what must be TRUE):
  1. staging/visit_occurrence.csv contains visits derived from unique (person_id, visit_date, visit_label) tuples across all clinical tables
  2. Study visits are classified as outpatient (concept_id 9202) and Hospitalizations_5211 records as inpatient (concept_id 9201)
  3. visit_id_map.csv lookup file is produced and usable by all clinical event scripts to resolve visit references
**Plans**: TBD

Plans:
- [ ] 05-01: Visit derivation from clinical table dates
- [ ] 05-02: Visit type classification and lookup map generation

### Phase 6: Custom IRSF Vocabulary
**Goal**: All Rett-specific concepts (CSS, MBA, genotype mutations, diagnostic categories) are registered as custom vocabulary entries queryable in Parthenon
**Depends on**: Phase 3
**Requirements**: VOCAB-01, VOCAB-02, VOCAB-03, VOCAB-04, VOCAB-05, VOCAB-06
**Success Criteria** (what must be TRUE):
  1. Custom vocabulary with vocabulary_id='IRSF-NHS' exists with all concept_ids in the >= 2,000,000,000 range per OHDSI convention
  2. CSS total score, ~13 individual CSS items, MBA total score, and MBA items each have registered custom concepts
  3. ~50 MECP2/CDKL5/FOXG1 mutation concepts are registered with groupings (missense, nonsense, large deletion, C-terminal truncation)
  4. Rett diagnostic category concepts (classic Rett, atypical Rett, CDKL5 deficiency, FOXG1, MECP2 duplication) are registered
  5. All custom concepts are registered in source_to_concept_map for ETL lookup
**Plans**: TBD

Plans:
- [ ] 06-01: Custom vocabulary design and concept ID assignment
- [ ] 06-02: CSS and MBA concept registration
- [ ] 06-03: Genotype mutation and diagnostic category concept registration
- [ ] 06-04: source_to_concept_map population

### Phase 7: Medications
**Goal**: All 44K medication records are transformed to drug_exposure staging CSV with validated RxNorm mappings and full source traceability
**Depends on**: Phase 4, Phase 5, Phase 3
**Requirements**: MED-01, MED-02, MED-03, MED-04, MED-05, SRC-01, SRC-02
**Success Criteria** (what must be TRUE):
  1. staging/drug_exposure.csv contains all 44K medication records with drug_exposure_start_date assembled from split columns
  2. MedRxNormCode formatted strings are parsed via regex extracting clean RxNorm concept_ids, with deprecated codes remapped via Maps-to
  3. Drug mapping coverage rate is >= 90% (records with valid, current RxNorm concept_id)
  4. Every mapped record carries original source code/text in drug_source_value and pre-mapped concept_id in drug_source_concept_id
  5. stop_reason is populated from ReasonForStoppin columns where available
**Plans**: 3 plans

Plans:
- [ ] 07-01: RxNorm parser module and drug_exposure pandera schema
- [ ] 07-02: Drug exposure builder with vocabulary validation and source value preservation
- [ ] 07-03: Medication ETL orchestrator, CLI integration, and real-data validation

### Phase 8: Conditions
**Goal**: Chronic diagnoses, seizures, fractures, and infections are transformed to condition_occurrence staging CSV with validated SNOMED mappings
**Depends on**: Phase 4, Phase 5, Phase 3
**Requirements**: COND-01, COND-02, COND-03
**Success Criteria** (what must be TRUE):
  1. staging/condition_occurrence.csv contains condition records from all relevant 5211 tables (chronic diagnoses, seizures, bone fractures, infections)
  2. Pre-mapped SNOMED codes from SNOWMEDOutput columns are validated against current vocabulary with deprecated codes remapped
  3. Condition mapping coverage rate is >= 85% (records with valid, current SNOMED concept_id)
**Plans**: 2 plans

Plans:
- [ ] 08-01: Condition extraction from 5211 tables
- [ ] 08-02: SNOMED mapping validation and staging CSV assembly

### Phase 9: Measurements
**Goal**: Growth data, clinical severity scores, labs, and quality-of-life scores are unpivoted to OMOP measurement rows with correct concept mappings
**Depends on**: Phase 4, Phase 5, Phase 6, Phase 3
**Requirements**: MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06
**Success Criteria** (what must be TRUE):
  1. Growth measurements (height, weight, BMI, head circumference) are unpivoted from wide to long format with correct LOINC concept_ids (3036277, 3025315, 3038553, 3036832)
  2. CSS total score and individual items are stored as separate measurement rows using custom IRSF concept_ids from Phase 6
  3. Lab results from Labs_5211 are mapped to LOINC concepts, and SF-36 scores are transformed to measurement rows
  4. Measurement mapping coverage rate is >= 95% for growth and lab measurements
  5. Wide-to-long unpivot filters NULL primary values to avoid row inflation (growth: ~25K rows, not ~52K)
**Plans**: TBD

Plans:
- [ ] 09-01: Growth measurement unpivot with LOINC mapping
- [ ] 09-02: CSS clinical severity score decomposition
- [ ] 09-03: Lab results and SF-36 quality-of-life mapping

### Phase 10: Observations
**Goal**: MBA scores, genotype data, and categorical clinical observations are captured as structured observation rows
**Depends on**: Phase 4, Phase 5, Phase 6, Phase 3
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. MBA scores are stored as observation rows with custom IRSF concept_ids from Phase 6
  2. Genotype/mutation data (~50 boolean columns) produces observations only for value=1 entries (~1,860-3,000 rows, not ~93,000) using custom IRSF vocabulary concepts
  3. Rett features, developmental history, clinical assessments, allergies, nutrition, and other categorical data are mapped to observation rows
  4. All observations carry observation_source_value preserving original column names and values
**Plans**: TBD

Plans:
- [x] 10-01: MBA score transformation
- [ ] 10-02: Genotype boolean mapping to observations
- [ ] 10-03: Categorical clinical data observation mapping

### Phase 11: Data Loading and Observation Periods
**Goal**: All staging CSVs are loaded into Parthenon's OMOP CDM in correct FK order with observation periods computed for every patient
**Depends on**: Phase 4, Phase 5, Phase 7, Phase 8, Phase 9, Phase 10
**Requirements**: LOAD-01, LOAD-02, LOAD-03, LOAD-04
**Success Criteria** (what must be TRUE):
  1. Staging CSVs are uploaded to Parthenon ingestion pipeline in strict FK order: person -> visit -> death -> drug -> condition -> measurement -> observation
  2. Observation periods computed post-load cover the true date range per person (from earliest to latest event across all clinical tables)
  3. 100% of loaded persons have at least one observation period (person count in omop.person = person count in omop.observation_period)
  4. CDM_SOURCE table is populated with IRSF-NHS metadata (source name, description, vocabulary version, ETL reference)
**Plans**: TBD

Plans:
- [ ] 11-01: FK-ordered staging CSV upload to Parthenon
- [ ] 11-02: Observation period computation and CDM_SOURCE population

### Phase 12: Validation and Cohort Verification
**Goal**: The loaded IRSF-NHS data passes quality checks, produces Achilles characterization, and supports cohort-based research queries
**Depends on**: Phase 11
**Requirements**: VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06
**Success Criteria** (what must be TRUE):
  1. DQD checks pass at >= 80% rate on populated tables (excluding trivially empty tables from the denominator)
  2. Achilles characterization runs successfully and produces reports viewable in Parthenon's results explorer
  3. Zero clinical events are recorded before birth or after death (temporal integrity verified)
  4. Rett-specific plausibility checks pass: approximately 95% female, MECP2 mutation present in approximately 95%, age at first visit typically 0-10 years
  5. At least 3 cohort definitions are buildable in Parthenon's cohort builder (all Rett patients, seizure subgroup, medication exposure subgroup)
**Plans**: TBD

Plans:
- [ ] 12-01: DQD execution and threshold verification
- [ ] 12-02: Achilles characterization and temporal integrity checks
- [ ] 12-03: Rett-specific plausibility checks and cohort buildability verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12
Note: Phases 2 and 3 can run in parallel. Phases 7, 8, 9, 10 can run in parallel (after their dependencies are met). Phase 6 can run in parallel with Phases 4 and 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Setup and Source Data Profiling | 2/2 | Complete    | 2026-03-26 |
| 2. Shared Library - Date and ID Utilities | 0/2 | Complete    | 2026-03-26 |
| 3. Shared Library - Vocabulary and Error Handling | 0/2 | Complete    | 2026-03-26 |
| 4. Person and Demographics | 1/3 | Complete    | 2026-03-26 |
| 5. Visit Derivation | 2/2 | Complete    | 2026-03-26 |
| 6. Custom IRSF Vocabulary | 2/2 | Complete    | 2026-03-26 |
| 7. Medications | 1/3 | In progress | - |
| 8. Conditions | 2/2 | Complete   | 2026-03-26 |
| 9. Measurements | 1/3 | In progress | - |
| 10. Observations | 1/3 | In progress | - |
| 11. Data Loading and Observation Periods | 0/2 | Not started | - |
| 12. Validation and Cohort Verification | 0/3 | Not started | - |
