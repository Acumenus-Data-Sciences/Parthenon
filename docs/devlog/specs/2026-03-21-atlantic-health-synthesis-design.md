# AtlanticHealth Data Synthesis — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Select 3,250 richest patients from AtlanticHealth, prune the rest, synthesize missing MIMIC-standard tables using pattern-based generation

## Context

AtlanticHealth is a large semi-synthetic dataset (243,166 patients, Epic EHR origin) in the `atlantic_health` schema. It has massive volume in core tables (23M vitals, 13M prescriptions, 5M labs) but is missing 4 tables that MIMIC-IV has (`procedures_icd`, `microbiologyevents`, `inputevents`, `outputevents`) and 2 dictionary tables (`d_icd_diagnoses`, `d_icd_procedures`). Many patients are also very sparse — some have zero labs, zero diagnoses.

The goal is to create a curated, high-fidelity 3,250-patient dataset that satisfies the full MIMIC-IV table standard so every Morpheus feature works identically for both datasets.

## Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Patient selection | Clinical completeness floor + rank by total events | Every selected patient has meaningful data across all Morpheus tabs |
| Synthesis approach | Hybrid (MIMIC distributions + MIMIC templates) | Distributions control frequency; templates provide real clinical vocabulary |
| Dictionary tables | Copy MIMIC-IV d_icd_diagnoses and d_icd_procedures verbatim | Standard ICD reference data, not patient-specific |
| Lab/vital dictionaries | Keep AtlanticHealth's existing d_labitems and d_items | Already data-rich (5.2M labs, 23.2M vitals); synthesis focuses on absent tables |
| Execution tool | Python script with numpy/pandas | Purpose-built for statistical sampling and bulk data generation |

---

## Phase 1: Patient Selection & Pruning

### Selection Criteria (Clinical Completeness Floor)

All thresholds must be met:
- At least 1 admission
- At least 10 lab results
- At least 50 vital signs (chartevents)
- At least 5 prescriptions
- At least 3 diagnoses (diagnoses_icd)

Patients meeting all thresholds are ranked by total event count (sum of admissions + ICU stays + transfers + diagnoses + prescriptions + labs + vitals + services). Top 3,250 are selected.

### Pruning

After selection, all rows in every AtlanticHealth table referencing non-selected `subject_id` values are deleted:
- `patients`, `admissions`, `icustays`, `transfers`, `diagnoses_icd`, `prescriptions`, `labevents`, `chartevents`, `services`, `emar`, `problem_list`

The `inpatient_ext.morpheus_dataset` registry row for `atlantic_health` has its `patient_count` updated to 3,250.

### Safety

**Pruning is destructive and cannot be undone without a full schema reload.** Before pruning, the script:

1. Runs `pg_dump --schema=atlantic_health` to create a full backup file at `backups/atlantic_health_pre_synthesis.sql.gz`
2. Creates a subject ID list for audit: `CREATE TABLE atlantic_health._subject_ids_backup AS SELECT subject_id FROM atlantic_health.patients`

The full pg_dump is the only way to restore 23M vitals, 13M prescriptions, and 5M labs if needed.

### Pruning Performance

Deleting ~240K patients from large tables (23M chartevents, 13M prescriptions) is done in batches of 100K rows per `DELETE` to avoid excessive WAL growth and lock contention. The script:
1. Creates a temp table of subject_ids to KEEP (the 3,250 selected)
2. For each target table, runs batched deletes: `DELETE FROM atlantic_health.{table} WHERE ctid IN (SELECT ctid FROM atlantic_health.{table} WHERE subject_id NOT IN (SELECT subject_id FROM atlantic_health._selected_subjects) LIMIT 100000)`
3. Repeats until no rows are deleted
4. Runs `VACUUM ANALYZE` after each table is pruned

---

## Phase 2: Dictionary Tables (Verbatim Copy)

Copy MIMIC-IV reference dictionaries into `atlantic_health`:

```sql
CREATE TABLE atlantic_health.d_icd_diagnoses AS SELECT * FROM mimiciv.d_icd_diagnoses;
CREATE TABLE atlantic_health.d_icd_procedures AS SELECT * FROM mimiciv.d_icd_procedures;
CREATE INDEX ON atlantic_health.d_icd_diagnoses (icd_code, icd_version);
CREATE INDEX ON atlantic_health.d_icd_procedures (icd_code, icd_version);
```

MIMIC-IV has 109,775 diagnosis descriptions and 85,257 procedure descriptions — standard ICD-9/ICD-10 reference data.

---

## Phase 3: Extract MIMIC-IV Distributions

Before generating any synthetic data, the script queries MIMIC-IV to build statistical profiles stored as in-memory DataFrames:

### Distribution Tables Extracted

**procedures_icd distributions:**
- `proc_count_by_admission_type`: mean/std procedure count per admission, grouped by admission_type
- `proc_code_freq_by_dx_chapter`: procedure code probability distribution conditioned on primary diagnosis ICD chapter (first 3 chars)
- `proc_seq_timing`: distribution of `chartdate` offset from admission date (days into stay)

**microbiologyevents distributions:**
- `culture_rate`: probability of culture order by (ICU status, LOS bucket)
- `specimen_type_dist`: specimen type probability distribution
- `organism_growth_rate`: positive culture rate by specimen type
- `organism_freq_by_specimen`: organism name frequency by specimen type
- `ab_panel_by_organism`: which antibiotics are tested per organism
- `sir_rate_by_org_ab`: S/I/R interpretation rates per organism-antibiotic pair
- `mic_dist_by_org_ab`: dilution_comparison and dilution_value distributions per organism-antibiotic pair

**inputevents distributions:**
- `input_rate_per_icu_day`: events per ICU day (mean/std)
- `item_freq`: item frequency distribution (from `d_items` joined to `inputevents`)
- `amount_dist_by_item`: amount and rate distributions per itemid
- `duration_dist_by_item`: duration (endtime - starttime) distribution per item category

**outputevents distributions:**
- `output_rate_per_icu_day`: events per ICU day
- `item_freq`: item frequency (Foley catheter ~70%, chest tube, etc.)
- `value_dist_by_item`: output value distribution per itemid

---

## Phase 4: Generate `procedures_icd` (~30K rows)

**For each AtlanticHealth admission:**

1. Look up admission_type → sample procedure count from `proc_count_by_admission_type`
2. Look up patient's primary ICD code chapter → sample procedure codes from `proc_code_freq_by_dx_chapter`
3. For each procedure:
   - Assign `seq_num` (1, 2, 3, ...)
   - Assign `chartdate` = admittime + sampled offset from `proc_seq_timing` (clamped to admission window)
   - Assign `icd_version` matching the procedure code source

**Columns generated:** `subject_id`, `hadm_id`, `seq_num`, `chartdate`, `icd_code`, `icd_version`

**Expected volume:** ~3,250 patients × ~3 admissions avg × ~3 procedures per admission = ~30,000 rows

---

## Phase 5: Generate `microbiologyevents` (~25K rows)

**For each AtlanticHealth admission:**

1. Determine culture probability based on ICU status and LOS → sample whether cultures are ordered
2. If yes, sample number of cultures (typically 1-3 per qualifying admission)
3. For each culture:
   - Sample `spec_type_desc` from `specimen_type_dist`
   - Determine growth (positive/negative) from `organism_growth_rate` for that specimen type
   - If positive: sample `org_name` from `organism_freq_by_specimen`
   - Sample `test_name` (always present: typically "CULTURE" or "SENSITIVITY")
   - `chartdate` = admittime + random 0-3 day offset (cultures ordered early in stay)
   - `charttime` = random time within that day
4. For positive cultures, generate sensitivity panel:
   - Look up `ab_panel_by_organism` → get list of antibiotics tested for this organism
   - For each antibiotic:
     - Sample `interpretation` (S/I/R) from `sir_rate_by_org_ab`
     - Sample `dilution_comparison` and `dilution_value` from `mic_dist_by_org_ab`
5. Assign sequential `microevent_id` values (starting from max existing + 1, or 1 if table is new)

**Columns generated:** `microevent_id`, `subject_id`, `hadm_id`, `chartdate`, `charttime`, `spec_type_desc`, `test_name`, `org_name`, `ab_name`, `dilution_comparison`, `dilution_value`, `interpretation`

**Expected volume:** ~3,250 patients × ~2 cultures avg × ~8 sensitivity rows per positive culture = ~25,000 rows

---

## Phase 6: Generate `inputevents` (~40K rows)

**Only for patients with ICU stays.**

**For each AtlanticHealth ICU stay:**

1. Calculate ICU LOS in days from existing `icustays` record
2. Sample event count from `input_rate_per_icu_day` × LOS
3. For each event:
   - Sample `itemid` from `item_freq` distribution
   - Look up item's `label` and `abbreviation` from MIMIC's `d_items` (the script carries this mapping in memory)
   - Sample `amount`/`amountuom` from `amount_dist_by_item` for that itemid
   - Sample `rate`/`rateuom` from same distribution
   - Generate `starttime` = ICU intime + random offset within stay
   - Generate `endtime` = starttime + sampled duration from `duration_dist_by_item`
   - Carry forward `ordercategoryname` and `statusdescription` from MIMIC templates

**Note:** AtlanticHealth's `d_items` table has only 37 items. The synthesizer will need to insert the MIMIC `d_items` entries for any itemids used in `inputevents` that don't already exist in AtlanticHealth's `d_items`. These are appended (not replaced) — existing d_items rows are preserved.

**Columns generated:** `subject_id`, `stay_id`, `hadm_id`, `starttime`, `endtime`, `itemid`, `amount`, `amountuom`, `rate`, `rateuom`, `ordercategoryname`, `statusdescription`, `patientweight`

**Expected volume:** ~500 ICU patients (subset of 3,250) × ~80 events per stay = ~40,000 rows

---

## Phase 7: Generate `outputevents` (~20K rows)

**Only for patients with ICU stays.**

**For each AtlanticHealth ICU stay:**

1. Calculate ICU LOS
2. Sample event count from `output_rate_per_icu_day` × LOS
3. For each event:
   - Sample `itemid` from `item_freq`
   - Sample `value`/`valueuom` from `value_dist_by_item`
   - `charttime` = evenly distributed across ICU stay (output measured every 1-4 hours) with random jitter

**Same `d_items` augmentation rule as inputevents** — append any missing itemids.

**Columns generated:** `subject_id`, `stay_id`, `hadm_id`, `charttime`, `itemid`, `value`, `valueuom`

**Expected volume:** ~500 ICU patients × ~40 events per stay = ~20,000 rows

---

## Phase 8: Indexing & Cleanup

After all synthesis:

```sql
-- Indexes on new tables
CREATE INDEX ON atlantic_health.procedures_icd (subject_id);
CREATE INDEX ON atlantic_health.procedures_icd (hadm_id);
CREATE INDEX ON atlantic_health.microbiologyevents (subject_id);
CREATE INDEX ON atlantic_health.microbiologyevents (hadm_id);
CREATE INDEX ON atlantic_health.inputevents (subject_id);
CREATE INDEX ON atlantic_health.inputevents (stay_id);
CREATE INDEX ON atlantic_health.outputevents (subject_id);
CREATE INDEX ON atlantic_health.outputevents (stay_id);

-- Update dataset registry
UPDATE inpatient_ext.morpheus_dataset SET patient_count = 3250 WHERE schema_name = 'atlantic_health';

-- Metadata marker
CREATE TABLE atlantic_health._synthesis_metadata (
    synthesized_at TIMESTAMPTZ DEFAULT NOW(),
    mimic_source_schema TEXT DEFAULT 'mimiciv',
    patient_count INT DEFAULT 3250,
    script_version TEXT DEFAULT '1.0'
);

-- Analyze for query planner
VACUUM ANALYZE atlantic_health.procedures_icd;
VACUUM ANALYZE atlantic_health.microbiologyevents;
VACUUM ANALYZE atlantic_health.inputevents;
VACUUM ANALYZE atlantic_health.outputevents;
```

**Cache invalidation:** After synthesis, the script connects to Redis and deletes the SchemaIntrospector cache keys:
```
DEL morpheus_schema_tables:atlantic_health
DEL morpheus_schema_cols:atlantic_health:patients
DEL morpheus_schema_cols:atlantic_health:admissions
```
This ensures `SchemaIntrospector.hasTable()` immediately sees the new tables without waiting for the 1-hour TTL. Alternatively, if Redis is not directly accessible, the script prints a reminder to run `php artisan cache:clear`.

**d_items collision check:** Before appending MIMIC d_items entries, the script runs:
```sql
SELECT itemid FROM atlantic_health.d_items INTERSECT SELECT itemid FROM mimiciv.d_items
```
Any overlapping itemids are skipped (the existing AtlanticHealth entry is preserved).

---

## Script Architecture

**Location:** `scripts/synthesize_atlantic_health.py`

**Dependencies:** `psycopg2`, `numpy`, `pandas`

**Execution:**
```bash
python scripts/synthesize_atlantic_health.py              # full run
python scripts/synthesize_atlantic_health.py --dry-run    # report what would be generated
python scripts/synthesize_atlantic_health.py --force      # re-run (drops and recreates synthetic tables)
python scripts/synthesize_atlantic_health.py --phase 1    # run only one phase
```

**Connection:** Reads `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` from `backend/.env` (same database as all Laravel connections — single `parthenon` DB, schema-isolated), or accepts `--dsn` argument.

**Design properties:**
- **Deterministic:** `numpy.random.seed(42)` — reproducible output
- **Batch inserts:** `psycopg2.extras.execute_values` for speed
- **Transaction safety:** Each phase in its own transaction with savepoint
- **Idempotent:** Checks `_synthesis_metadata` table; skips if already run (use `--force` to re-run)
- **Progress logging:** Per-phase and per-500-patient progress output

---

## Expected Total Synthesis Volume

| Table | Rows | Source |
|-------|------|--------|
| d_icd_diagnoses | 109,775 | Copied from MIMIC |
| d_icd_procedures | 85,257 | Copied from MIMIC |
| procedures_icd | ~30,000 | Synthesized |
| microbiologyevents | ~25,000 | Synthesized |
| inputevents | ~40,000 | Synthesized |
| outputevents | ~20,000 | Synthesized |
| d_items (appended) | ~200-500 | MIMIC items referenced by input/output events |
| **Total new rows** | **~310,000** | |

## Out of Scope

- Synthesizing additional lab or vital data (already data-rich)
- WISCA/syndromic antibiogram views (future feature)
- Changing AtlanticHealth's `subject_id` format (stays as 18-digit bigint)
- Synthesizing `emar` or `problem_list` data
- Adding `anchor_age`/`anchor_year` columns to patients table (age derived from `dob` at runtime via SchemaIntrospector)
