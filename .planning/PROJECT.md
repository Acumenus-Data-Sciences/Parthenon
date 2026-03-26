# IRSF-NHS OMOP CDM Import

## What This Is

An ETL pipeline to import the IRSF (International Rett Syndrome Foundation) Natural History Study dataset into Parthenon as a new OMOP CDM v5.4 source called "IRSF-NHS". The dataset spans two RDCRN protocols (5201 and 5211) covering ~1,860 unique Rett Syndrome patients with longitudinal clinical observations. The import uses Parthenon's AI-powered ingestion pipeline supplemented by pre-processing scripts to handle the dataset's unique characteristics.

## Core Value

All ~1,860 Rett Syndrome patients from the IRSF Natural History Study are queryable in Parthenon's OMOP CDM with accurate demographics, medications, conditions, measurements, and observations — enabling cohort-based outcomes research on this rare disease population.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pre-processing scripts transform raw IRSF data into Parthenon-ingestible CSVs
- [ ] Person roster built from Person_Characteristics with cross-protocol ID reconciliation
- [ ] Date assembly handles split columns (Month-text, Day-int, Year-int) with validation
- [ ] 44K medication records map to RxNorm concepts via pre-mapped codes
- [ ] Conditions map to SNOMED concepts from pre-mapped codes + AI mapping
- [ ] Growth measurements unpivoted to OMOP measurement rows with LOINC concepts
- [ ] Rett-specific clinical instruments (CSS, MBA) mapped to measurement/observation
- [ ] Genotype/mutation data captured as observations with custom IRSF vocabulary
- [ ] Visit occurrences derived from clinical table visit dates
- [ ] Observation periods computed per person from earliest to latest events
- [ ] Death records imported from both protocols
- [ ] Achilles characterization runs successfully on loaded data
- [ ] DQD checks pass at >=80% rate
- [ ] At least 3 cohort definitions buildable in Parthenon

### Out of Scope

- FilesUpload_5211 (file metadata, not clinical data)
- ContactRegistryEnrollment_5211 (administrative, not clinical)
- Other_Research_5211 (external study references)
- Eligibility_5211 (study admin, not clinical observations)
- Real-time data feeds (this is a one-time historical import)
- De-identification (data is already de-identified per RDCRN protocols)

## Context

**Source data location:** `external/2023 IRSF/` — contains Protocol 5201 CSVs, Protocol 5211 Custom Extracts, reference files, data dictionaries, and prior SQL ETL work.

**Prior ETL work (2022-2023):** `Final_Queries.sql` (4,738 lines) contains complete SQL for date assembly, age calculation, and data prep. The date-handling logic and table DDLs from prior work should be adapted, not rewritten.

**Pre-mapped vocabularies:** `RXNORM_5201.csv` and `SNOMED_5201.csv` provide pre-built concept crosswalks. `Medications_5201_5211.csv` includes `MedRxNormCode` columns. These should be validated against current OMOP vocabulary before use.

**Key data challenges:**
1. Split date columns (Month text abbreviation, Day int, Year int) across most tables
2. Three ID systems requiring reconciliation via Person_Characteristics crosswalk
3. ~50 boolean genotype columns with no standard OMOP concepts
4. Rett-specific clinical instruments (CSS, MBA) needing custom vocabulary
5. Wide measurement tables requiring unpivot to OMOP long format

**Target schema:** `omop.*` in the existing Parthenon database, registered as a new CDM source "IRSF-NHS".

## Constraints

- **Tech stack**: Python 3.12 for pre-processing scripts (consistent with Parthenon AI service)
- **Database**: Must use existing `parthenon` database with `omop` schema — no separate database
- **Vocabulary**: Must validate against loaded Athena vocabulary; pre-mapped codes may be outdated
- **Ingestion pipeline**: Use Parthenon's existing ingestion UI/API for the actual CDM loading
- **Data volume**: Largest table is Medications at 44K rows — batch uploads needed
- **Timeline**: 3-4 weeks estimated for full ETL with validation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Person_Characteristics as authoritative person roster | Contains cross-protocol ID reconciliation already done | — Pending |
| Python pre-processing scripts (not direct SQL ETL) | Parthenon ingestion pipeline expects CSV uploads; Python gives validation + error handling | — Pending |
| Custom IRSF vocabulary for Rett-specific concepts | CSS, MBA, genotype mutations have no standard OMOP mapping | — Pending |
| Batch import in dependency order (person first) | Foreign key constraints require person_id before clinical events | — Pending |
| Adapt prior SQL logic, don't rewrite | 4,738 lines of tested date assembly and data prep exist | — Pending |

---
*Last updated: 2026-03-26 after initialization from PRD*
