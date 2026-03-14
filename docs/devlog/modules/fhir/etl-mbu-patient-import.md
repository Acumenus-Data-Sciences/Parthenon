# Devlog: ETL — Dr. M.B. Udoshi Patient Record Import

**Date:** 2026-03-07
**Scope:** Single-patient ETL from unstructured clinical documents to OMOP CDM v5.4

## What Was Built

A Python ETL script (`installer/etl_mbu_patient.py`) that imports the complete 9-year oncology record of Dr. Mallikarjun B. Udoshi (Stage IV Metastatic Colon Carcinoma, Sigmoid) into the OHDSI Acumenus CDM.

### Source Data

Clinical documents from `docs/MBU/` and `docs/MBU-REVISED-CCR-V2.pdf` — a continuity of care record covering 2006–2015 including:
- Colonoscopy and surgical reports
- Chemotherapy regimens (FOLFOX, FOLFIRI, Avastin, Erbitux)
- CT/PET imaging studies
- Lab results and tumor markers (CEA)
- Molecular diagnostics (KRAS wild-type)
- Radiation and RFA procedures
- Death record

### Records Loaded

| OMOP Table | Records | Examples |
|------------|---------|---------|
| person | 1 | Male, born 1942, Asian Indian |
| observation_period | 1 | 2006-11-30 to 2015-08-28 |
| visit_occurrence | 30 | Outpatient visits, inpatient stays, ER |
| condition_occurrence | 9 | Adeno CA sigmoid, mucositis, lung mets, pleurisy |
| procedure_occurrence | 28 | Colonoscopies, sigmoid resection, port placement, chemo, radiation, RFA |
| drug_exposure | 8 | Oxaliplatin, 5-FU, leucovorin, irinotecan, bevacizumab, cetuximab |
| measurement | 18 | CEA levels, CBC, metabolic panels |
| observation | 1 | KRAS wild-type molecular result |
| note | 10 | Clinical notes from key encounters |
| death | 1 | 2015-08-28, Stage IV Metastatic Colon CA |
| **TOTAL** | **107** | |

Assigned `person_id = 1005788` (next available after existing 1M synthetic patients).

### Script Features

- `--dry-run` mode: validates all data without inserting
- `--rollback` mode: removes all records for this person_id
- Reads DB credentials from `backend/.env`
- OMOP concept IDs mapped via vocabulary search against the `omop.concept` table
- All source values truncated to 50 characters (OMOP CDM varchar constraints)

## Issues Encountered

### VARCHAR(50) Constraint Violations

The OMOP CDM enforces `varchar(50)` on all `*_source_value` fields. Several clinical descriptions exceeded this limit:

1. **condition_source_value** — e.g., "Adeno CA with slight submucosal invasion - sigmoid colon" (56 chars)
2. **procedure_source_value** — long procedure descriptions
3. **drug_source_value** — multi-drug regimen names
4. **measurement_source_value** — lab test descriptions
5. **death.cause_source_value** — "Stage IV Metastatic Colon Carcinoma of the Sigmoid Colon" (56 chars)

**Fix:** Truncated all source values to 50 characters. For the death record, manually shortened to "Stage IV Metastatic Colon CA Sigmoid" (36 chars) to preserve clinical meaning.

### Database Authentication

The local PostgreSQL instance (`pgsql.acumenus.net`) requires password auth. The ETL script reads credentials from `backend/.env` (the `DB_PASSWORD` field used by the `omop` connection).

## Verification

All 107 records confirmed present in the database with correct:
- Record counts per table
- Demographics (gender, birth year, race concepts)
- Observation period spanning full 9-year care timeline
- Chronologically ordered visits, procedures, and conditions
- Death date and cause matching source documents

## Lessons Learned

- OMOP CDM's strict field length constraints require careful data preparation — always truncate source values before insert
- Single-patient ETL from unstructured documents is labor-intensive but valuable for demonstrating real clinical narratives in the platform
- The `omop` schema convention (combined CDM + vocabulary) simplifies concept lookups during ETL
