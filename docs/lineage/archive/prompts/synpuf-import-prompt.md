# SynPUF Import Task — Pre-ETL'd OMOP CDM Data Available on Local Drive

## Context

We have the full **CMS DE-SynPUF 2.3M patient dataset already ETL'd into OMOP CDM format** on a local backup drive. The ETL was run on 2023-12-05 using the OHDSI ETL-CMS pipeline against OMOP Vocabulary v5. This means we can skip the raw-data download and ETL entirely — we just need to load the pre-transformed CSVs into PostgreSQL.

The `synpuf` loader at `datasets/loaders/synpuf.py` is currently a stub. This task is to implement it.

## Data Location

```
/media/smudoshi/DATA/Old Backup Data/ETL-CMS/data/output/
```

## Dataset Scale

**2,326,876 synthetic Medicare beneficiaries** across 20 shards. Total row counts:

| OMOP Table | Rows | Sharded Files |
|---|---|---|
| person | 2,326,876 | person_1.csv … person_20.csv |
| visit_occurrence | 111,637,590 | visit_occurrence_1.csv … _20.csv |
| condition_occurrence | 302,971,584 | condition_occurrence_1.csv … _20.csv |
| procedure_occurrence | 231,453,095 | procedure_occurrence_1.csv … _20.csv |
| drug_exposure | 127,637,494 | drug_exposure_1.csv … _20.csv |
| measurement_occurrence | 69,816,582 | measurement_occurrence_1.csv … _20.csv |
| observation | 41,455,821 | observation_1.csv … _20.csv |
| procedure_cost | 548,351,514 | procedure_cost_1.csv … _20.csv |
| drug_cost | 111,085,989 | drug_cost_1.csv … _20.csv |
| visit_cost | (not in stats — check files) | visit_cost_1.csv … _20.csv |
| device_cost | (not in stats — check files) | device_cost_1.csv … _20.csv |
| device_exposure | 5,267,983 | device_exposure_1.csv … _20.csv |
| payer_plan_period | 7,789,532 | payer_plan_period_1.csv … _20.csv |
| observation_period | 2,098,535 | observation_period_1.csv … _20.csv |
| death | 107,664 | death_1.csv … _20.csv |
| provider | 905,512 | provider_1.csv … _20.csv |
| care_site | 320,565 | care_site_1.csv … _20.csv |
| location | 3,191 | location_1.csv … _20.csv |

There are also non-sharded versions of each file (e.g., `person.csv`, `care_site.csv`) — these appear to be empty or just headers. Use the `_N.csv` sharded files.

Additional files to ignore: `beneficiary_dump_*.txt`, `etl_stats.txt_*`, `concept_debug_log.txt`, `concept_relationship_debug_log.txt`, `specimen*.csv` (empty).

## CSV Column Headers (OMOP CDM v5.x format)

**person:** person_id, gender_concept_id, year_of_birth, month_of_birth, day_of_birth, time_of_birth, race_concept_id, ethnicity_concept_id, location_id, provider_id, care_site_id, person_source_value, gender_source_value, gender_source_concept_id, race_source_value, race_source_concept_id, ethnicity_source_value, ethnicity_source_concept_id

**visit_occurrence:** visit_occurrence_id, person_id, visit_concept_id, visit_start_date, visit_start_time, visit_end_date, visit_end_time, visit_type_concept_id, provider_id, care_site_id, visit_source_value, visit_source_concept_id

**condition_occurrence:** condition_occurrence_id, person_id, condition_concept_id, condition_start_date, condition_end_date, condition_type_concept_id, stop_reason, provider_id, visit_occurrence_id, condition_source_value, condition_source_concept_id

**drug_exposure:** drug_exposure_id, person_id, drug_concept_id, drug_exposure_start_date, drug_exposure_end_date, drug_type_concept_id, stop_reason, refills, quantity, days_supply, sig, route_concept_id, effective_drug_dose, dose_unit_concept_id, lot_number, provider_id, visit_occurrence_id, drug_source_value, drug_source_concept_id, route_source_value, dose_unit_source_value

**drug_cost:** drug_cost_id, drug_exposure_id, currency_concept_id, paid_copay, paid_coinsurance, paid_toward_deductible, paid_by_payer, paid_by_coordination_of_benefits, total_out_of_pocket, total_paid, ingredient_cost, dispensing_fee, average_wholesale_price, payer_plan_period_id

**visit_cost:** visit_cost_id, visit_occurrence_id, currency_concept_id, paid_copay, paid_coinsurance, paid_toward_deductible, paid_by_payer, paid_by_coordination_benefits, total_out_of_pocket, total_paid, payer_plan_period_id

**procedure_cost:** procedure_cost_id, procedure_occurrence_id, currency_concept_id, paid_copay, paid_coinsurance, paid_toward_deductible, paid_by_payer, paid_by_coordination_benefits, total_out_of_pocket, total_paid, revenue_code_concept_id, payer_plan_period_id, revenue_code_source_value

**device_cost:** device_cost_id, device_exposure_id, currency_concept_id, paid_copay, paid_coinsurance, paid_toward_deductible, paid_by_payer, paid_by_coordination_benefits, total_out_of_pocket, total_paid, payer_plan_period_id

## Critical: CDM Version Mismatch (v5.x → v5.4)

This data was ETL'd into OMOP CDM v5.x (pre-5.3). Parthenon uses **CDM v5.4**. Key differences to handle:

### 1. Cost Table Consolidation (MOST IMPORTANT)
CDM v5.4 merged `drug_cost`, `visit_cost`, `procedure_cost`, and `device_cost` into a single **`cost`** table. The loader must:
- Map all four legacy cost tables into `omop.cost`
- Generate a unified `cost_id` sequence
- Map `cost_domain_id` appropriately: `'Drug'` for drug_cost, `'Visit'` for visit_cost, `'Procedure'` for procedure_cost, `'Device'` for device_cost
- Map the foreign key: `cost_event_id` = the original `drug_exposure_id` / `visit_occurrence_id` / `procedure_occurrence_id` / `device_exposure_id`
- `cost_event_field_concept_id` should reference the appropriate field concept

### 2. Missing v5.4 Columns
Some tables gained columns in v5.4 that aren't in this data. The loader should insert NULLs for:
- `person`: `birth_datetime` (can derive from year/month/day_of_birth)
- `visit_occurrence`: `visit_start_datetime`, `visit_end_datetime`, `preceding_visit_occurrence_id`, `admitted_from_concept_id`, `discharged_to_concept_id`
- `condition_occurrence`: `condition_start_datetime`, `condition_end_datetime`, `condition_status_concept_id`
- `drug_exposure`: `drug_exposure_start_datetime`, `drug_exposure_end_datetime`, `verbatim_end_date`
- And similar `_datetime` columns on other tables

### 3. `measurement_occurrence` → `measurement`
The output has `measurement_occurrence` but CDM v5.4 calls the table just `measurement`. Rename during load.

## Implementation Requirements

### Step 1: Copy data to accessible location
The data is on an external USB drive. First step should be to copy the `output/` directory somewhere the Docker postgres container can access it (e.g., a mounted volume or the Parthenon data directory). Alternatively, use `\copy` from host or `COPY` via stdin pipe.

### Step 2: Implement `datasets/loaders/synpuf.py`

Follow the loader interface from `datasets/loaders/__init__.py`:
- `is_loaded()` → check `SELECT COUNT(*) FROM omop.person WHERE person_source_value LIKE '%SYNPUF%'` or similar marker
- `load()` → orchestrate the full import

The loader should:
1. Verify OMOP vocabulary is loaded (dependency)
2. Truncate any existing SynPUF data (or check if already loaded)
3. Load tables in dependency order: location → care_site → provider → person → visit_occurrence → [clinical tables] → cost
4. Use PostgreSQL `COPY` for bulk loading (not INSERT — we're talking 1.5B+ rows)
5. Handle the cost table consolidation
6. Add `_datetime` columns derived from date columns where possible
7. Build indexes after loading (not before)
8. Run ANALYZE after load
9. Report progress per table (20 shards each)

### Step 3: Update registry if needed

The registry entry at `datasets/registry.py` lines 131-148 already defines `synpuf-full` with `dependencies=["vocabulary"]`. Update `size_estimate` if the actual loaded size differs significantly from "~10 GB loaded" (it will be larger given 1.5B+ rows).

## Vocabulary Note

The backup also contains `vocabulary_download_v5/` (5 GB) at:
```
/media/smudoshi/DATA/Old Backup Data/ETL-CMS/data/vocabulary_download_v5/
```
This is an older OMOP v5 vocabulary. Do NOT use it — Parthenon should use a current Athena v5.4 vocabulary download. The SynPUF concept IDs will still resolve against any v5.x vocabulary since concept IDs are stable.

## Performance Considerations

- Total rows across all tables: ~1.57 billion
- Estimated load time: 2-4 hours with COPY, longer with indexes
- Recommend: disable triggers/constraints during load, rebuild after
- Recommend: load shards in parallel where possible (e.g., all 20 person shards, then all 20 visit_occurrence shards)
- The procedure_cost table alone is 548M rows — this is the largest table and will dominate load time

## What NOT To Do

- Don't re-run the ETL from the raw DE_* files — the output is already transformed
- Don't load the old vocabulary — use Athena
- Don't try to load everything into memory — stream with COPY
- Don't create indexes before loading — add them after all COPY operations complete
