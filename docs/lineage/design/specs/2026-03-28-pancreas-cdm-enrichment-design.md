# Pancreatic Cancer Corpus — CDM Enrichment & Demo Readiness

**Date:** 2026-03-28
**Status:** Approved
**Audience:** Clinical researchers (primary), health IT / informatics peers (secondary)

## Goal

Transform the 189-patient pancreatic cancer CDM from a minimal skeleton (one visit, one diagnosis, one procedure per patient) into a research-grade longitudinal dataset that produces compelling results across all Parthenon modules — Achilles dashboards, cohort builder, treatment pathways, survival analysis, and patient profiles — without any new frontend pages.

## Current State

- 189 patients: 21 PANCREAS-CT (imaging) + 168 CPTAC-PDA (pathology)
- Source registered as `PANCREAS` (ID 58), connection `pancreas`, results in `pancreas_results`
- Achilles runs clean (128/128 passing after schema fixes)
- Data is flat: 1 visit, 1 condition, 1 procedure, 1 observation period (~60 days) per patient
- Empty tables: measurement, drug_exposure, death, condition_era, drug_era

## Patient Stratification

Each patient is assigned deterministically (by `person_id % 3`-ish distribution) to one of three clinical subgroups:

| Subgroup | N | % | Trajectory |
|----------|---|---|------------|
| Resectable | ~55 | 29% | Dx → neoadjuvant (50%) → Whipple/distal pancreatectomy → adjuvant chemo → follow-up. ~45% alive at end |
| Borderline / Locally Advanced | ~50 | 26% | Dx → FOLFIRINOX induction → restaging → surgery if downstaged (40%) or continued chemo. ~30% alive |
| Metastatic | ~84 | 45% | Dx → palliative chemo (1st/2nd line) → best supportive care. ~10% alive, median OS ~11 months |

CPTAC-PDA patients skew slightly toward resectable/borderline (surgical specimens exist). PANCREAS-CT patients distribute proportionally.

### Tumor characteristics

- Location: head (65%), body (20%), tail (15%) — affects surgical approach (Whipple vs distal)
- TNM staging: AJCC 8th edition concepts mapped to OMOP observations
  - Resectable: Stage I–II
  - Borderline/LA: Stage III
  - Metastatic: Stage IV

## Data Enrichment Detail

### Visits (5–8 per patient)

Anchored to existing diagnosis date with clinically realistic intervals (±random jitter):

- **Diagnostic workup** (day 0): Initial presentation
- **Staging** (~day 7–14): CT/EUS/biopsy
- **Treatment start** (~day 21–35): Neoadjuvant or 1st-line chemo
- **Mid-treatment restaging** (~day 90–120): Response assessment
- **Surgery** (if applicable, ~day 120–180): Pancreaticoduodenectomy (4020329) or distal pancreatectomy (4144850)
- **Adjuvant start** (~day 30 post-surgery): Adjuvant chemo
- **Follow-up visits** (q3 months): Surveillance
- Visit types: 9201 (inpatient) for surgery, 9202 (outpatient) for everything else

### Measurements (per visit, with realistic trends)

| Measurement | Concept ID | Units | Pattern |
|-------------|-----------|-------|---------|
| CA 19-9 | 3022914 | U/mL | Elevated at dx (median ~500), drops post-resection, rises on recurrence |
| CEA | 3013444 | U/mL | Mildly elevated (~8–15) at dx |
| Total bilirubin | 3024128 | mg/dL | Elevated if head tumor with obstruction, normalizes post-stent |
| Direct bilirubin | 3027597 | mg/dL | Tracks total bilirubin |
| Albumin | 3024561 | g/dL | Declining trend (cachexia) |
| ALT | 3006923 | U/L | Elevated with biliary obstruction |
| AST | 3013721 | U/L | Elevated with biliary obstruction |
| WBC | 3000905 | 10^3/uL | Drops during chemo (nadir day 10–14) |
| Hemoglobin | 3000963 | g/dL | Gradual decline during treatment |
| Platelets | 3024929 | 10^3/uL | Drops during chemo |
| HbA1c | 3004410 | % | Elevated (>6.5%) in ~25% (new-onset diabetes) |

All concept IDs validated against `vocab.concept`.

### Drug Exposures

Three treatment regimens assigned by subgroup:

| Regimen | % of treated | Components (OMOP RxNorm concepts) |
|---------|-------------|-----------------------------------|
| FOLFIRINOX | ~40% | fluorouracil (955632), oxaliplatin (1318011), irinotecan (1367268), leucovorin (1388796) |
| Gem/nab-paclitaxel | ~35% | gemcitabine (1314924), paclitaxel (1378382) |
| Gemcitabine mono | ~25% | gemcitabine (1314924) |

Supportive medications:
- Ondansetron (1000560) — antiemetic
- Pancreatin (926488) — pancreatic enzyme replacement (pancrelipase not a standard ingredient in RxNorm)
- Insulin glargine (1502905) — for new-onset diabetes patients

Drug exposure records include start/end dates per cycle, quantity, and days_supply.

### Conditions (comorbidities)

Added during trajectory based on clinical realism:

- Jaundice (137977) — ~60% of head tumors
- Type 2 diabetes mellitus (201826) — ~25%, new-onset
- Cachexia (134765) — ~70%, cancer-related weight loss
- Exocrine pancreatic insufficiency (4186463) — ~40%
- Deep venous thrombosis (4133004) — ~10%, Trousseau syndrome
- Abdominal pain (200219) — ~50%

### Death

- Metastatic: ~90% mortality, median OS 8–14 months from diagnosis
- Borderline/LA: ~70% mortality, median OS 14–22 months
- Resectable: ~55% mortality, median OS 20–36 months
- Death cause mapped to OMOP concept for malignant neoplasm of pancreas
- Death dates placed at realistic intervals post-diagnosis with variance

### Specimens

- Existing 168 CPTAC-PDA specimens preserved
- Surgical specimens added for resected patients (Whipple / distal pancreatectomy)
- Biopsy specimens added at diagnostic workup for all patients

### Observation Periods

- Extended from current 60-day windows to cover full trajectory (6–24 months)
- Single continuous observation period per patient (start = 30 days before dx, end = last encounter or death)

### Era Rollups

- **Condition eras**: Rolled up from condition_occurrence records (30-day persistence window per OHDSI convention)
- **Drug eras**: Rolled up from drug_exposure records (30-day gap for same ingredient)

## Pre-built Cohort Definitions

Four cohort definitions seeded into `app.cohort_definitions`, each with pre-generated membership in `pancreas.cohort`:

### 1. All PDAC Patients
- Criteria: `condition_concept_id = 4180793` (Malignant tumor of pancreas)
- Expected N: 189

### 2. Resectable PDAC with Surgical Intervention
- Criteria: Condition 4180793 + procedure_concept_id IN (4020329 Pancreaticoduodenectomy, 4144850 Distal pancreatectomy)
- Expected N: ~70–80

### 3. FOLFIRINOX Recipients
- Criteria: Condition 4180793 + drug_exposure for fluorouracil (955632) + oxaliplatin (1318011) + irinotecan (1367268), all starting within 90 days of first condition_occurrence
- Expected N: ~55–65

### 4. High CA 19-9 at Diagnosis
- Criteria: Condition 4180793 + measurement (CA 19-9, concept 3022914) with value_as_number > 37 U/mL, within 30 days of first condition_occurrence
- Expected N: ~150–170 (most PDAC patients have elevated CA 19-9)

## Implementation

Single Python script: `scripts/pancreatic/enrich_cdm.py`

1. Connects to `parthenon` database, reads existing 189 persons
2. Assigns subgroups deterministically
3. Generates full clinical trajectory per subgroup template
4. Validates all OMOP concept IDs against `vocab.concept`
5. Outputs `enrich_cdm.sql` (idempotent — clears enrichment data before inserting)
6. Executes SQL against `pancreas` schema
7. Computes era rollups
8. Seeds cohort definitions + pre-generated cohort membership
9. Runs verification queries to confirm data integrity

### Idempotency

The script replaces all clinical data wholesale (person table preserved, everything else rebuilt). This allows re-running with different parameters without accumulating duplicates.

### Verification

After enrichment:
- Re-run Achilles (128 analyses should still pass)
- Verify row counts per table match expected ranges
- Confirm all concept IDs exist in vocabulary
- Confirm observation periods cover all events
- Confirm era rollups are consistent with source records

## Known Issues to Fix

- **Wrong condition concept**: Existing `condition_occurrence` uses concept 4092217 (lung cancer) instead of 4180793 (Malignant tumor of pancreas). The enrichment script will replace all clinical data, correcting this.
- **Wrong procedure concepts**: Existing data uses CPT4 codes (2211348, 2212574) which are non-standard; enrichment will use SNOMED standard concepts.

## Out of Scope

- New frontend pages or components
- Genomic data (TCGA-PAAD — separate phase)
- NIfTI-to-DICOM conversion (PanTS — separate phase)
- FHIR export of enriched data
- Real patient data (all synthetic)
