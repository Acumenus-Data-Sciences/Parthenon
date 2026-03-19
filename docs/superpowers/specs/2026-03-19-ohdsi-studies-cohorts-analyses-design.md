# OHDSI Studies: Cohort Definitions & HADES Analysis Configurations

**Date:** 2026-03-19
**Status:** Approved
**Author:** Dr. Sanjay Udoshi / Claude
**Scope:** Phase B — 5 studies (37 cohorts, 28 analyses, 2 full study protocols)

## Overview

End-to-end implementation of 5 novel OHDSI studies against the Parthenon OMOP CDM (1,005,788 patients). All cohort definitions and analysis configurations are built as JSON fixture files importable via `parthenon:import-designs`. Two studies (Cardiorenal Cascade, Opioid Trajectory) additionally get full Study model records with protocol metadata, milestones, team assignments, and site configuration.

### Data Landscape

| Metric | Value |
|--------|-------|
| Patients | 1,005,788 |
| Observation span | 1914–2025 (median 30 years/patient) |
| Gender | 50.4% M / 49.6% F |
| Race | 83% White, 11.4% Black, 3.4% Asian |
| Deaths | 54,205 (5.4%) |
| Condition occurrences | 14.7M |
| Drug exposures | 86M |
| Measurements | 710M |
| Procedures | 111M |
| Devices | 5.4M |

### Study Portfolio

| ID | Study Name | Fixture/Full | Difficulty | HADES Types |
|----|-----------|--------------|------------|-------------|
| S6 | Cardiorenal-Metabolic Cascade | **Full Study** | Extreme | Characterization, Incidence Rate, Pathway, PLP |
| S7 | Statin Paradox | Fixtures | Hard | Characterization, Estimation, SCCS |
| S8 | Opioid Trajectory | **Full Study** | Extreme | Characterization, Pathway, Estimation, PLP |
| S9 | Metformin Repurposing | Fixtures | Hard | Characterization, Estimation, Evidence Synthesis |
| S10 | Prediabetes Reversal | Fixtures | Moderate | Characterization, Pathway, PLP, Incidence Rate |

---

## File Architecture

All fixtures in `backend/database/fixtures/designs/`. Prefix `s6–s10` avoids collision with existing `study-2` through `study-5` fixtures.

```
backend/database/fixtures/designs/
├── cohort_definitions/          (37 new files)
│   ├── s6-cardiorenal-*.json    (11 cohorts — includes CKD stages 1-3 for pathway)
│   ├── s7-statin-*.json         (6 cohorts)
│   ├── s8-opioid-*.json         (7 cohorts)
│   ├── s9-metformin-*.json      (7 cohorts)
│   └── s10-prediabetes-*.json   (6 cohorts — includes s10-c0 base cohort)
├── characterizations/           (5 new files)
├── estimation_analyses/         (8 new files)
├── prediction_analyses/         (5 new files)
├── pathway_analyses/            (4 new files)
├── incidence_rate_analyses/     (3 new files)
├── sccs_analyses/               (2 new files — NEW directory)
└── evidence_synthesis_analyses/ (1 new file — NEW directory)
```

Import mechanism: `php artisan parthenon:import-designs` (Fort Knox system). No seeder modification needed.

---

## Verified Concept IDs

All concept IDs verified against the live `omop.concept` table on `pgsql.acumenus.net`.

### Conditions (SNOMED, Standard)

| Concept ID | Concept Name | Patients | Prevalence |
|------------|-------------|----------|------------|
| 37018196 | Prediabetes | 394,039 | 39.2% |
| 201826 | Type 2 diabetes mellitus | 75,431 | 7.5% |
| 320128 | Essential hypertension | 380,336 | 37.8% |
| 436940 | Metabolic syndrome X | 200,127 | 19.9% |
| 4185932 | Ischemic heart disease | 187,381 | 18.6% |
| 439777 | Anemia | 373,262 | 37.1% |
| 443614 | Chronic kidney disease stage 1 | 149,153 | 14.8% |
| 443601 | Chronic kidney disease stage 2 | 133,294 | 13.3% |
| 443597 | Chronic kidney disease stage 3 | 95,905 | 9.5% |
| 443612 | Chronic kidney disease stage 4 | 60,682 | 6.0% |
| 193782 | End-stage renal disease | 10,591 (deaths) | — |
| 4296653 | Acute ST segment elevation MI | 5,084 (deaths) | — |
| 4270024 | Acute non-ST segment elevation MI | 521 (deaths) | — |
| 381316 | Cerebrovascular accident | 754 (deaths) | — |
| 4229440 | Chronic congestive heart failure | 9,087 (deaths) | — |
| 4317150 | Sudden cardiac death | 4,390 (deaths) | — |
| 436096 | Chronic pain | 247,198 | 24.6% |
| 4234597 | Misuses drugs | 84,886 | 8.4% |
| 4275756 | Dependent drug abuse | 61,914 | 6.2% |
| 37311061 | COVID-19 | 81,694 | 8.1% |
| 4285898 | Polyp of colon | 77,539 | 7.7% |
| 378419 | Alzheimer's disease | 2,135 (deaths) | — |
| 4180790 | Malignant tumor of colon | 1,122 (deaths) | — |
| 4112853 | Malignant tumor of breast | 736 (deaths) | — |
| 432867 | Hyperlipidemia | 112,492 | 11.2% |
| 4120314 | Hypertriglyceridemia | 74,139 | 7.4% |
| 192279 | Disorder of kidney due to diabetes mellitus | 170,300 | 16.9% |

### Drug Ingredients (RxNorm, Standard)

| Concept ID | Ingredient | Patients |
|------------|-----------|----------|
| 1539403 | simvastatin | 157,180+ |
| 1545958 | atorvastatin | — |
| 1510813 | rosuvastatin | — |
| 1551860 | pravastatin | — |
| 1308216 | lisinopril | 249,512 |
| 1332418 | amlodipine | 199,002 |
| 1503297 | metformin | 38,880 |
| 1322184 | clopidogrel | 146,885 |
| 974166 | hydrochlorothiazide | 216,310 |
| 1307046 | metoprolol | 176,068 |
| 45774751 | empagliflozin | — |
| 44785829 | dapagliflozin | — |
| 43526465 | canagliflozin | — |
| 40170911 | liraglutide | — |
| 793143 | semaglutide | — |
| 45774435 | dulaglutide | — |
| 1583722 | exenatide | — |
| 1361711 | nitroglycerin | 183,578 |
| 1125315 | acetaminophen | 414,362 |
| 1115008 | naproxen | 207,484 |
| 1177480 | ibuprofen | 142,954 |
| 1174888 | hydrocodone | — |
| 1124957 | oxycodone | — |
| 1110410 | morphine | — |
| 1154029 | fentanyl | — |
| 1201620 | codeine | — |
| 1114220 | naloxone | — |
| 1133201 | buprenorphine | — |
| 1103640 | methadone | — |
| 1112807 | aspirin | — |
| 1367500 | losartan | — |
| 1308842 | valsartan | — |
| 1341927 | enalapril | — |

---

## Cohort Definitions (37 total)

### Study 6 — Cardiorenal-Metabolic Cascade (11 cohorts)

#### S6-C1: New Prediabetes, No Prior CKD/HTN (Target)

- **Primary criteria:** First condition occurrence of prediabetes (37018196, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Exclusion criteria (AT_MOST_0):**
  - Any CKD: 443614, 443601, 443597, 443612 (include descendants) — any time prior
  - HTN: 320128 (include descendants) — any time prior
  - T2DM: 201826 (include descendants) — any time prior
- **End strategy:** Observation period end date
- **Concept sets:** [0] Prediabetes conditions, [1] CKD all stages, [2] Hypertension, [3] T2DM

#### S6-C2: Matched Controls, No Prediabetes (Comparator)

- **Primary criteria:** First visit occurrence (any type) with 365d prior observation
- **Qualified limit:** First
- **Exclusion criteria (AT_MOST_0):**
  - Prediabetes (37018196, include descendants) — any time
  - T2DM (201826, include descendants) — any time
- **End strategy:** Observation period end date
- **Note:** Age/sex matching performed at analysis level (PS matching), not in cohort definition

#### S6-C3: CKD Stage 4, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of CKD stage 4 (443612, include descendants)
- **Observation window:** 0 days prior (no washout — outcome cohort)
- **Qualified limit:** First
- **End strategy:** Condition end date + 1 day (or observation period end)

#### S6-C4: ESRD, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of ESRD (193782, include descendants)
- **Observation window:** 0 days prior
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C5: Composite MACE, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of ANY of:
  - STEMI (4296653)
  - NSTEMI (4270024)
  - Stroke (381316)
  - Sudden cardiac death (4317150)
  - All include descendants
- **Observation window:** 0 days prior
- **Qualified limit:** First
- **End strategy:** Condition end date + 1 day
- **Concept set:** Single concept set "MACE components" with all 4 concepts

#### S6-C6: Anemia at CKD Diagnosis (Subgroup)

- **Primary criteria:** First condition occurrence of anemia (439777, include descendants)
- **Additional criteria (ALL):**
  - Any CKD stage (443614/443601/443597/443612) within ±90 days of index
  - Occurrence type: at least 1
  - Start window: -90 to +90 days
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C7: Metabolic Syndrome, First Occurrence (Event)

- **Primary criteria:** First condition occurrence of MetSyn (436940, include descendants)
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C8: Essential Hypertension, First Occurrence (Event)

- **Primary criteria:** First condition occurrence of HTN (320128, include descendants)
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C9: CKD Stage 1, First Occurrence (Event — Pathway)

- **Primary criteria:** First condition occurrence of CKD stage 1 (443614, include descendants)
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C10: CKD Stage 2, First Occurrence (Event — Pathway)

- **Primary criteria:** First condition occurrence of CKD stage 2 (443601, include descendants)
- **Qualified limit:** First
- **End strategy:** Observation period end

#### S6-C11: CKD Stage 3, First Occurrence (Event — Pathway)

- **Primary criteria:** First condition occurrence of CKD stage 3 (443597, include descendants)
- **Qualified limit:** First
- **End strategy:** Observation period end

---

### Study 7 — Statin Paradox (6 cohorts)

#### S7-C1: New Simvastatin Users (Target)

- **Primary criteria:** First drug exposure of simvastatin (1539403, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Exclusion criteria (AT_MOST_0):**
  - Any statin exposure (concept set: 1539403, 1545958, 1510813, 1551860, all include descendants) — any time prior to index
- **End strategy:** Drug era end date (continuous exposure)
- **Concept sets:** [0] Simvastatin, [1] All statins (washout)

#### S7-C2: New Atorvastatin Users (Comparator)

- **Primary criteria:** First drug exposure of atorvastatin (1545958, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Exclusion criteria (AT_MOST_0):**
  - Any statin exposure (same "All statins" concept set) — any time prior
- **End strategy:** Drug era end date

#### S7-C3: Composite MACE, First Post-Index (Outcome)

- Same definition as S6-C5 (STEMI + NSTEMI + stroke + sudden cardiac death)
- Additionally includes CHF (4229440, include descendants) for statin study
- **Concept set:** STEMI (4296653), NSTEMI (4270024), stroke (381316), CHF (4229440), sudden cardiac death (4317150)

#### S7-C4: STEMI, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of STEMI (4296653, include descendants)
- **Qualified limit:** First

#### S7-C5: Stroke, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of stroke (381316, include descendants)
- **Qualified limit:** First

#### S7-C6: All-Cause Death (Outcome)

- **Primary criteria:** Death record (any cause)
- **Qualified limit:** First
- **End strategy:** Death date

---

### Study 8 — Opioid Trajectory (7 cohorts)

#### S8-C1: New Opioid Users with Chronic Pain, No Prior Substance Abuse (Target)

- **Primary criteria:** First drug exposure of ANY opioid:
  - Hydrocodone (1174888), oxycodone (1124957), morphine (1110410), fentanyl (1154029), codeine (1201620)
  - All include descendants
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - Chronic pain (436096, include descendants) within ±180 days of index
  - Occurrence type: at least 1
- **Exclusion criteria (AT_MOST_0):**
  - Drug misuse (4234597, include descendants) — any time prior
  - Dependent drug abuse (4275756, include descendants) — any time prior
- **End strategy:** Observation period end
- **Concept sets:** [0] Opioid ingredients, [1] Chronic pain, [2] Substance abuse (exclusion)

#### S8-C2: Chronic Pain, NSAID-Only Management (Comparator)

- **Primary criteria:** First drug exposure of NSAID:
  - Naproxen (1115008) OR ibuprofen (1177480), include descendants
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - Chronic pain (436096, include descendants) within ±180 days
  - Occurrence type: at least 1
- **Exclusion criteria (AT_MOST_0):**
  - Any opioid exposure (concept set [0] from S8-C1) — any time prior to index (not future; excluding future opioid use would create immortal-time bias)
- **End strategy:** Observation period end

#### S8-C3: Drug Misuse, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of "Misuses drugs" (4234597, include descendants)
- **Qualified limit:** First

#### S8-C4: Drug Dependence, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of "Dependent drug abuse" (4275756, include descendants)
- **Qualified limit:** First

#### S8-C5: All-Cause Death (Outcome)

- Same as S7-C6

#### S8-C6: Buprenorphine/Methadone Initiation — MAT (Event)

- **Primary criteria:** First drug exposure of buprenorphine (1133201) OR methadone (1103640), include descendants
- **Qualified limit:** First
- **End strategy:** Drug era end

#### S8-C7: Naloxone Administration — Overdose Reversal (Event)

- **Primary criteria:** First drug exposure of naloxone (1114220, include descendants)
- **Qualified limit:** First
- **End strategy:** Drug exposure end date + 1 day

---

### Study 9 — Metformin Repurposing (7 cohorts)

#### S9-C1: T2DM New Metformin Users (Target)

- **Primary criteria:** First drug exposure of metformin (1503297, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - T2DM (201826, include descendants) within ±180 days of index
  - Occurrence type: at least 1
- **Exclusion criteria (AT_MOST_0):**
  - Any prior metformin (1503297, include descendants) — ensures true new user
- **End strategy:** Observation period end

#### S9-C2: T2DM New Insulin Users, No Prior Metformin (Comparator)

- **Primary criteria:** First drug exposure of insulin (concept set of insulin ingredients: insulin isophane, insulin regular, insulin glargine, insulin lispro, insulin aspart — use ancestor concept 21600712 "Insulins" OR individual RxNorm ingredients, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - T2DM (201826, include descendants) within ±180 days
- **Exclusion criteria (AT_MOST_0):**
  - Any metformin (1503297, include descendants) — any time (never exposed to metformin)
- **End strategy:** Observation period end
- **Note:** The "no prior metformin ever" criterion ensures the insulin arm represents patients who truly started on insulin without metformin trial, avoiding prevalent-user bias

#### S9-C3: Colorectal Neoplasm, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of colon polyp (4285898) OR malignant colon tumor (4180790), include descendants
- **Qualified limit:** First

#### S9-C4: Alzheimer's/Dementia, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of Alzheimer's disease (378419, include descendants)
- **Qualified limit:** First

#### S9-C5: Composite MACE (Outcome)

- Same definition as S7-C3 (STEMI + NSTEMI + stroke + CHF + sudden cardiac death)

#### S9-C6: All-Cause Death (Outcome)

- Same as S7-C6

#### S9-C7: Malignant Breast Tumor, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of malignant breast tumor (4112853, include descendants)
- **Qualified limit:** First

---

### Study 10 — Prediabetes Reversal (6 cohorts)

#### S10-C0: Prediabetes, First Occurrence — Base Cohort (PLP Target)

- **Primary criteria:** First condition occurrence of prediabetes (37018196, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **No exclusions** — full prediabetes population for PLP training
- **End strategy:** Observation period end date
- **Note:** This is the combined population (escapers + progressors + censored) used as the PLP target in S10-A4. The model learns discriminating features itself.

#### S10-C1: Prediabetes "Escapers" — 5yr+ Follow-Up, No T2DM (Target)

- **Primary criteria:** First condition occurrence of prediabetes (37018196, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - Observation period extends at least 1825 days (5 years) after index
  - Implementation: observation period end date >= index date + 1825 days
- **Exclusion criteria (AT_MOST_0):**
  - T2DM (201826, include descendants) — any time after index (0 to +99999 days)
- **End strategy:** Index date + 1825 days (5-year study window)
- **Note:** The 5-year follow-up requirement prevents misclassifying right-censored patients as escapers

#### S10-C2: Prediabetes "Progressors" — T2DM Within 5 Years (Comparator)

- **Primary criteria:** First condition occurrence of prediabetes (37018196, include descendants)
- **Observation window:** 365 days prior
- **Qualified limit:** First
- **Additional criteria (ALL):**
  - T2DM (201826, include descendants) within 0 to +1825 days after index
  - Occurrence type: at least 1
- **End strategy:** First T2DM diagnosis date (or index + 1825, whichever comes first)

#### S10-C3: T2DM, First Occurrence After Prediabetes (Outcome)

- **Primary criteria:** First condition occurrence of T2DM (201826, include descendants)
- **Qualified limit:** First

#### S10-C4: Metabolic Syndrome, First Occurrence (Event)

- Same as S6-C7

#### S10-C5: CKD Any Stage, First Occurrence (Outcome)

- **Primary criteria:** First condition occurrence of ANY CKD stage: 443614, 443601, 443597, 443612, include descendants
- **Qualified limit:** First

---

## Analysis Configurations (28 total)

### Study 6 — Cardiorenal Cascade (6 analyses)

#### S6-A1: Baseline Characterization

```json
{
  "type": "characterization",
  "targetCohortIds": ["s6-c1"],
  "comparatorCohortIds": ["s6-c2"],
  "featureTypes": ["demographics", "conditions", "drugs", "measurements", "procedures", "visits"],
  "timeWindows": [{"start": -365, "end": 0}],
  "stratifyByGender": true,
  "stratifyByAge": true,
  "ageGroups": [[18,39],[40,54],[55,64],[65,74],[75,120]],
  "topN": 100,
  "minCellCount": 5
}
```

#### S6-A2: CKD Progression Incidence by Anemia Status

```json
{
  "type": "incidence_rate",
  "targetCohortId": "s6-c1",
  "outcomeCohortIds": ["s6-c3", "s6-c4", "s6-c5"],
  "timeAtRisk": {"start": 1, "end": null, "endAnchor": "cohort end"},
  "stratifyByGender": true,
  "stratifyByAge": true,
  "ageGroups": [[18,39],[40,54],[55,64],[65,74],[75,120]],
  "minCellCount": 5
}
```

#### S6-A3: CKD Progression Incidence — Anemia Subgroup

```json
{
  "type": "incidence_rate",
  "targetCohortId": "s6-c6",
  "outcomeCohortIds": ["s6-c3", "s6-c4"],
  "timeAtRisk": {"start": 1, "end": null, "endAnchor": "cohort end"},
  "stratifyByAge": true,
  "ageGroups": [[18,39],[40,54],[55,64],[65,74],[75,120]],
  "minCellCount": 5
}
```

#### S6-A4: Metabolic Cascade Pathway

```json
{
  "type": "pathway",
  "targetCohortId": "s6-c1",
  "eventCohortIds": ["s6-c7", "s6-c8", "s6-c9", "s6-c10", "s6-c11", "s6-c3", "s6-c4", "s6-c5"],
  "maxDepth": 6,
  "combinationWindow": 30,
  "maxPathLength": 8,
  "minCellCount": 5
}
```

**Note:** CKD stages 1-3 are defined as S6-C9, S6-C10, S6-C11 cohorts. Together with S6-C7 (MetSyn), S6-C8 (HTN), S6-C3 (CKD4), S6-C4 (ESRD), and S6-C5 (MACE), this traces the full cascade: prediabetes → MetSyn → HTN → CKD1 → CKD2 → CKD3 → CKD4 → ESRD/MACE.

#### S6-A5: Predict CKD Stage 4 from Prediabetes Baseline (LASSO)

```json
{
  "type": "prediction",
  "targetCohortId": "s6-c1",
  "outcomeCohortId": "s6-c3",
  "model": {
    "type": "lasso_logistic_regression",
    "hyperParameters": {"variance": 0.01}
  },
  "timeAtRisk": {"start": 1, "end": 1825, "endAnchor": "cohort start"},
  "covariateSettings": {
    "useDemographics": true,
    "useConditionOccurrence": true,
    "useDrugExposure": true,
    "useMeasurement": true,
    "useProcedureOccurrence": true,
    "timeWindows": [{"start": -365, "end": 0}]
  },
  "populationSettings": {
    "washoutPeriod": 365,
    "minTimeAtRisk": 365,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true
  },
  "splitSettings": {"testFraction": 0.25, "splitSeed": 42}
}
```

#### S6-A6: Predict Composite MACE from Prediabetes Baseline (Gradient Boosting)

```json
{
  "type": "prediction",
  "targetCohortId": "s6-c1",
  "outcomeCohortId": "s6-c5",
  "model": {
    "type": "gradient_boosting_machine",
    "hyperParameters": {"ntrees": 5000, "maxDepth": 4, "learnRate": 0.01, "minRows": 20}
  },
  "timeAtRisk": {"start": 1, "end": 1825, "endAnchor": "cohort start"},
  "covariateSettings": {
    "useDemographics": true,
    "useConditionOccurrence": true,
    "useDrugExposure": true,
    "useMeasurement": true,
    "useProcedureOccurrence": true,
    "timeWindows": [{"start": -365, "end": 0}]
  },
  "populationSettings": {
    "washoutPeriod": 365,
    "minTimeAtRisk": 365,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true
  },
  "splitSettings": {"testFraction": 0.25, "splitSeed": 42}
}
```

---

### Study 7 — Statin Paradox (5 analyses)

#### S7-A1: Statin New-User Baseline Comparison

```json
{
  "type": "characterization",
  "targetCohortIds": ["s7-c1"],
  "comparatorCohortIds": ["s7-c2"],
  "featureTypes": ["demographics", "conditions", "drugs", "measurements", "procedures", "visits"],
  "timeWindows": [{"start": -365, "end": 0}],
  "topN": 100,
  "minCellCount": 5
}
```

#### S7-A2: Simvastatin vs Atorvastatin — Composite MACE (CohortMethod)

```json
{
  "type": "estimation",
  "analysisType": "CohortMethod",
  "targetCohortId": "s7-c1",
  "comparatorCohortId": "s7-c2",
  "outcomeCohortIds": ["s7-c3"],
  "outcomeOfInterest": "s7-c3",
  "model": {
    "type": "cox",
    "covariateSettings": {
      "endDays": 0,
      "longTermStartDays": -365,
      "shortTermStartDays": -30,
      "useDemographicsAge": true,
      "useDemographicsGender": true,
      "useDemographicsRace": true,
      "useDemographicsIndexYear": true,
      "useDemographicsIndexMonth": true,
      "useDemographicsAgeGroup": true,
      "useDemographicsEthnicity": true,
      "useConditionEraLongTerm": true,
      "useConditionOccurrenceLongTerm": true,
      "useConditionOccurrenceShortTerm": true,
      "useDrugExposureLongTerm": true,
      "useDrugExposureShortTerm": true,
      "useDrugEraLongTerm": true,
      "useProcedureOccurrenceLongTerm": true,
      "useMeasurementLongTerm": true,
      "useObservationLongTerm": true,
      "useCharlsonIndex": true
    }
  },
  "timeAtRisk": {
    "start": {"offset": 1, "dateField": "index_date"},
    "end": {"offset": 1095, "dateField": "index_date"}
  },
  "propensityScore": {
    "enabled": true,
    "trimming": {"type": "preference_score", "fraction": 0.05},
    "matching": {"ratio": 1, "caliper": 0.2, "caliperScale": "standardized logit", "allowReverseMatch": false}
  },
  "studyPopulation": {
    "riskWindowStart": 1,
    "riskWindowEnd": 1095,
    "minTimeAtRisk": 1,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true,
    "priorOutcomeLookback": 99999,
    "removeDuplicateSubjects": "keep first",
    "washoutPeriod": 0
  },
  "covariateSettings": {
    "useDemographicsAge": true,
    "useDemographicsGender": true,
    "useDemographicsRace": true,
    "useConditionOccurrenceLongTerm": true,
    "useDrugExposureLongTerm": true,
    "useProcedureOccurrenceLongTerm": true,
    "useCharlsonIndex": true,
    "excludedConceptIds": [1539403, 1545958, 1510813, 1551860]
  },
  "negativeControlOutcomeIds": []
}
```

#### S7-A3: Simvastatin vs Atorvastatin — Stroke Only

- Same design as S7-A2
- Outcome: `s7-c5` (stroke only)
- TAR: 1–1095 days

#### S7-A4: SCCS — Statin Exposure and STEMI

```json
{
  "type": "sccs",
  "exposureCohortId": "s7-c1",
  "outcomeCohortId": "s7-c4",
  "model": {
    "type": "age_season_adjusted"
  },
  "studyPopulation": {
    "naivePeriod": 180,
    "firstOutcomeOnly": true,
    "minAge": null,
    "maxAge": null
  },
  "riskWindows": [
    {
      "label": "acute",
      "start": {"offset": 0, "anchor": "era start"},
      "end": {"offset": 30, "anchor": "era start"}
    },
    {
      "label": "chronic",
      "start": {"offset": 31, "anchor": "era start"},
      "end": {"offset": 365, "anchor": "era start"}
    }
  ],
  "preExposureWindow": {
    "start": -30,
    "end": -1
  }
}
```

#### S7-A5: SCCS — Statin Exposure and Stroke

- Same design as S7-A4
- Outcome: `s7-c5` (stroke)

---

### Study 8 — Opioid Trajectory (7 analyses)

#### S8-A1: Opioid vs NSAID Baseline Characterization

```json
{
  "type": "characterization",
  "targetCohortIds": ["s8-c1"],
  "comparatorCohortIds": ["s8-c2"],
  "featureTypes": ["demographics", "conditions", "drugs", "measurements", "procedures", "visits"],
  "timeWindows": [{"start": -365, "end": 0}],
  "topN": 100,
  "minCellCount": 5
}
```

#### S8-A2: Opioid Prescribing Escalation Pathway

```json
{
  "type": "pathway",
  "targetCohortId": "s8-c1",
  "eventCohortIds": ["s8-c3", "s8-c4", "s8-c6", "s8-c7", "s8-c5"],
  "maxDepth": 5,
  "combinationWindow": 30,
  "maxPathLength": 6,
  "minCellCount": 5
}
```

Event sequence traced: opioid initiation → drug misuse → drug dependence → MAT (buprenorphine/methadone) or naloxone (overdose) → death.

#### S8-A3: Opioid vs NSAID — Drug Misuse Risk (CohortMethod)

```json
{
  "type": "estimation",
  "analysisType": "CohortMethod",
  "targetCohortId": "s8-c1",
  "comparatorCohortId": "s8-c2",
  "outcomeCohortIds": ["s8-c3"],
  "outcomeOfInterest": "s8-c3",
  "model": {
    "type": "cox",
    "covariateSettings": {
      "endDays": 0,
      "longTermStartDays": -365,
      "shortTermStartDays": -30,
      "useDemographicsAge": true,
      "useDemographicsGender": true,
      "useDemographicsRace": true,
      "useDemographicsIndexYear": true,
      "useDemographicsIndexMonth": true,
      "useDemographicsAgeGroup": true,
      "useConditionEraLongTerm": true,
      "useConditionOccurrenceLongTerm": true,
      "useConditionOccurrenceShortTerm": true,
      "useDrugExposureLongTerm": true,
      "useDrugExposureShortTerm": true,
      "useDrugEraLongTerm": true,
      "useProcedureOccurrenceLongTerm": true,
      "useMeasurementLongTerm": true,
      "useObservationLongTerm": true,
      "useCharlsonIndex": true
    }
  },
  "timeAtRisk": {
    "start": {"offset": 1, "dateField": "index_date"},
    "end": {"offset": 1095, "dateField": "index_date"}
  },
  "propensityScore": {
    "enabled": true,
    "trimming": {"type": "preference_score", "fraction": 0.05},
    "matching": {"ratio": 1, "caliper": 0.2, "caliperScale": "standardized logit", "allowReverseMatch": false}
  },
  "studyPopulation": {
    "riskWindowStart": 1,
    "riskWindowEnd": 1095,
    "minTimeAtRisk": 1,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true,
    "priorOutcomeLookback": 99999,
    "removeDuplicateSubjects": "keep first",
    "washoutPeriod": 0
  },
  "covariateSettings": {
    "useDemographicsAge": true,
    "useDemographicsGender": true,
    "useDemographicsRace": true,
    "useConditionOccurrenceLongTerm": true,
    "useDrugExposureLongTerm": true,
    "useProcedureOccurrenceLongTerm": true,
    "useMeasurementLongTerm": true,
    "useCharlsonIndex": true,
    "excludedConceptIds": [1174888, 1124957, 1110410, 1154029, 1201620, 1115008, 1177480]
  },
  "negativeControlOutcomeIds": []
}
```

#### S8-A4: Opioid vs NSAID — Drug Dependence Risk

- Same design as S8-A3
- Outcome: `s8-c4` (drug dependence)

#### S8-A5: Opioid vs NSAID — All-Cause Death

- Same design as S8-A3
- Outcome: `s8-c5` (death)
- TAR extended: 1–1825 days (5 years)

#### S8-A6: Predict Drug Misuse from Opioid Baseline (LASSO)

```json
{
  "type": "prediction",
  "targetCohortId": "s8-c1",
  "outcomeCohortId": "s8-c3",
  "model": {
    "type": "lasso_logistic_regression",
    "hyperParameters": {"variance": 0.01}
  },
  "timeAtRisk": {"start": 1, "end": 1095, "endAnchor": "cohort start"},
  "covariateSettings": {
    "useDemographics": true,
    "useConditionOccurrence": true,
    "useDrugExposure": true,
    "useMeasurement": true,
    "useProcedureOccurrence": true,
    "timeWindows": [{"start": -365, "end": 0}]
  },
  "populationSettings": {
    "washoutPeriod": 365,
    "minTimeAtRisk": 30,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true
  },
  "splitSettings": {"testFraction": 0.25, "splitSeed": 42}
}
```

#### S8-A7: Predict Drug Dependence from Opioid Baseline (Gradient Boosting)

```json
{
  "type": "prediction",
  "targetCohortId": "s8-c1",
  "outcomeCohortId": "s8-c4",
  "model": {
    "type": "gradient_boosting_machine",
    "hyperParameters": {"ntrees": 5000, "maxDepth": 4, "learnRate": 0.01, "minRows": 20}
  },
  "timeAtRisk": {"start": 1, "end": 1095, "endAnchor": "cohort start"},
  "covariateSettings": {
    "useDemographics": true,
    "useConditionOccurrence": true,
    "useDrugExposure": true,
    "useMeasurement": true,
    "useProcedureOccurrence": true,
    "timeWindows": [{"start": -365, "end": 0}]
  },
  "populationSettings": {
    "washoutPeriod": 365,
    "minTimeAtRisk": 30,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true
  },
  "splitSettings": {"testFraction": 0.25, "splitSeed": 42}
}
```

---

### Study 9 — Metformin Repurposing (6 analyses)

#### S9-A1: Metformin vs Insulin Baseline Characterization

```json
{
  "type": "characterization",
  "targetCohortIds": ["s9-c1"],
  "comparatorCohortIds": ["s9-c2"],
  "featureTypes": ["demographics", "conditions", "drugs", "measurements", "procedures", "visits"],
  "timeWindows": [{"start": -365, "end": 0}],
  "topN": 100,
  "minCellCount": 5
}
```

#### S9-A2: Metformin vs Insulin — Colorectal Neoplasm (CohortMethod)

```json
{
  "type": "estimation",
  "analysisType": "CohortMethod",
  "targetCohortId": "s9-c1",
  "comparatorCohortId": "s9-c2",
  "outcomeCohortIds": ["s9-c3"],
  "outcomeOfInterest": "s9-c3",
  "model": {
    "type": "cox",
    "covariateSettings": {
      "endDays": 0,
      "longTermStartDays": -365,
      "shortTermStartDays": -30,
      "useDemographicsAge": true,
      "useDemographicsGender": true,
      "useDemographicsRace": true,
      "useDemographicsIndexYear": true,
      "useDemographicsAgeGroup": true,
      "useConditionEraLongTerm": true,
      "useConditionOccurrenceLongTerm": true,
      "useDrugExposureLongTerm": true,
      "useDrugExposureShortTerm": true,
      "useProcedureOccurrenceLongTerm": true,
      "useMeasurementLongTerm": true,
      "useCharlsonIndex": true
    }
  },
  "timeAtRisk": {
    "start": {"offset": 1, "dateField": "index_date"},
    "end": {"offset": 1825, "dateField": "index_date"}
  },
  "propensityScore": {
    "enabled": true,
    "trimming": {"type": "preference_score", "fraction": 0.05},
    "matching": {"ratio": 1, "caliper": 0.2, "caliperScale": "standardized logit", "allowReverseMatch": false}
  },
  "studyPopulation": {
    "riskWindowStart": 1,
    "riskWindowEnd": 1825,
    "minTimeAtRisk": 1,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true,
    "priorOutcomeLookback": 99999,
    "removeDuplicateSubjects": "keep first",
    "washoutPeriod": 0
  },
  "covariateSettings": {
    "useDemographicsAge": true,
    "useDemographicsGender": true,
    "useDemographicsRace": true,
    "useConditionOccurrenceLongTerm": true,
    "useDrugExposureLongTerm": true,
    "useProcedureOccurrenceLongTerm": true,
    "useMeasurementLongTerm": true,
    "useCharlsonIndex": true,
    "excludedConceptIds": [1503297]
  },
  "negativeControlOutcomeIds": []
}
```

#### S9-A3: Metformin vs Insulin — Alzheimer's/Dementia

- Same design as S9-A2
- Outcome: `s9-c4` (Alzheimer's)
- TAR: 1–2555 days (7 years — longer latency for neurodegeneration)

#### S9-A4: Metformin vs Insulin — Composite MACE

- Same design as S9-A2
- Outcome: `s9-c5` (composite MACE)
- TAR: 1–1825 days

#### S9-A5: Metformin vs Insulin — All-Cause Mortality

- Same design as S9-A2
- Outcome: `s9-c6` (death)
- TAR: 1–1825 days

#### S9-A6: Multi-Outcome Evidence Synthesis

```json
{
  "type": "evidence_synthesis",
  "method": "random_effects",
  "description": "Multi-outcome repurposing signal profile combining metformin effect estimates across colorectal neoplasm, Alzheimer's, MACE, and mortality",
  "estimates": [],
  "settings": {
    "chainLength": 1100000,
    "burnIn": 100000,
    "subSample": 100
  }
}
```

**Note:** The `estimates` array is populated at execution time from the results of S9-A2 through S9-A5. Each entry provides `logRr`, `seLogRr`, and `outcomeName`.

---

### Study 10 — Prediabetes Reversal (5 analyses)

#### S10-A1: Escapers vs Progressors Baseline Characterization

```json
{
  "type": "characterization",
  "targetCohortIds": ["s10-c1"],
  "comparatorCohortIds": ["s10-c2"],
  "featureTypes": ["demographics", "conditions", "drugs", "measurements", "procedures", "visits"],
  "timeWindows": [{"start": -365, "end": 0}],
  "topN": 100,
  "minCellCount": 5
}
```

#### S10-A2: Escaper Treatment Pathway

```json
{
  "type": "pathway",
  "targetCohortId": "s10-c1",
  "eventCohortIds": ["s10-c4", "s10-c3", "s10-c5"],
  "maxDepth": 4,
  "combinationWindow": 30,
  "maxPathLength": 5,
  "minCellCount": 5
}
```

#### S10-A3: Progressor Treatment Pathway

```json
{
  "type": "pathway",
  "targetCohortId": "s10-c2",
  "eventCohortIds": ["s10-c4", "s10-c3", "s10-c5"],
  "maxDepth": 4,
  "combinationWindow": 30,
  "maxPathLength": 5,
  "minCellCount": 5
}
```

#### S10-A4: Predict T2DM Progression from Prediabetes Baseline (LASSO)

```json
{
  "type": "prediction",
  "targetCohortId": "s10-c0",
  "outcomeCohortId": "s10-c3",
  "model": {
    "type": "lasso_logistic_regression",
    "hyperParameters": {"variance": 0.01}
  },
  "timeAtRisk": {"start": 1, "end": 1825, "endAnchor": "cohort start"},
  "covariateSettings": {
    "useDemographics": true,
    "useConditionOccurrence": true,
    "useDrugExposure": true,
    "useMeasurement": true,
    "useProcedureOccurrence": false,
    "timeWindows": [{"start": -365, "end": 0}]
  },
  "populationSettings": {
    "washoutPeriod": 365,
    "minTimeAtRisk": 365,
    "requireTimeAtRisk": true,
    "removeSubjectsWithPriorOutcome": true
  },
  "splitSettings": {"testFraction": 0.25, "splitSeed": 42}
}
```

**Note:** `targetCohortId` references S10-C0, the base prediabetes first-occurrence cohort WITHOUT escaper/progressor filters. This lets the LASSO model learn the discriminating features itself.

#### S10-A5: T2DM and CKD Incidence After Prediabetes

```json
{
  "type": "incidence_rate",
  "targetCohortId": "s10-c0",
  "outcomeCohortIds": ["s10-c3", "s10-c5"],
  "timeAtRisk": {"start": 1, "end": null, "endAnchor": "cohort end"},
  "stratifyByGender": true,
  "stratifyByAge": true,
  "ageGroups": [[18,39],[40,54],[55,64],[65,74],[75,120]],
  "minCellCount": 5
}
```

---

## Full Study Protocol Records

### Study 6: The Cardiorenal-Metabolic Cascade

```
title:                "The Cardiorenal-Metabolic Cascade: A Multi-State Transition
                       Model from Prediabetes to End-Stage Renal Disease"
short_title:          "Cardiorenal Cascade"
study_type:           "observational"
study_design:         "cohort"
phase:                null
priority:             "high"
status:               "protocol_development"

description:          [see Section 4 above]
scientific_rationale: [see Section 4 above]
hypothesis:           [see Section 4 above]
primary_objective:    [see Section 4 above]
secondary_objectives: [see Section 4 above — 4 objectives]

study_start_date:     "2026-03-19"
protocol_version:     "1.0"
funding_source:       "Acumenus Data Sciences"
tags:                 ["cardiorenal","ckd-progression","metabolic-syndrome",
                       "multi-state-model","prediabetes","anemia"]

Study Cohorts:
  - s6-c1 → role: target,     label: "Primary study population"
  - s6-c2 → role: comparator, label: "Background rate comparator"
  - s6-c3 → role: outcome,    label: "Primary endpoint — CKD Stage 4"
  - s6-c4 → role: outcome,    label: "Secondary endpoint — ESRD"
  - s6-c5 → role: outcome,    label: "Secondary endpoint — MACE"
  - s6-c6 → role: subgroup,   label: "Effect modifier — anemia at CKD"
  - s6-c7 → role: event,      label: "Pathway event — metabolic syndrome"
  - s6-c8 → role: event,      label: "Pathway event — hypertension"

Study Analyses: s6-a1 through s6-a6

Study Site:
  - source: default (Acumenus Parthenon)
  - site_role: coordinating_center
  - status: irb_approved
  - cdm_version: "5.4"
  - patient_count_estimate: 1005788

Milestones: 8 milestones (see Section 4)
```

### Study 8: The Opioid Trajectory

```
title:                "The Opioid Trajectory: Predicting Transition from Legitimate
                       Prescription to Substance Use Disorder in Chronic Pain Patients"
short_title:          "Opioid Trajectory"
study_type:           "observational"
study_design:         "cohort"
phase:                null
priority:             "high"
status:               "protocol_development"

description:          [see Section 4 above]
scientific_rationale: [see Section 4 above]
hypothesis:           [see Section 4 above]
primary_objective:    [see Section 4 above]
secondary_objectives: [see Section 4 above — 4 objectives]

study_start_date:     "2026-03-19"
protocol_version:     "1.0"
funding_source:       "Acumenus Data Sciences"
tags:                 ["opioid","substance-use-disorder","chronic-pain",
                       "drug-safety","prediction","pharmacoepidemiology"]

Study Cohorts:
  - s8-c1 → role: target,     label: "Primary exposed population"
  - s8-c2 → role: comparator, label: "Active comparator — NSAID"
  - s8-c3 → role: outcome,    label: "Primary endpoint — drug misuse"
  - s8-c4 → role: outcome,    label: "Secondary endpoint — drug dependence"
  - s8-c5 → role: outcome,    label: "Secondary endpoint — mortality"
  - s8-c6 → role: event,      label: "MAT pathway event"
  - s8-c7 → role: event,      label: "Overdose sentinel event"

Study Analyses: s8-a1 through s8-a7

Study Site: same as Study 6

Milestones: 10 milestones (see Section 4)
```

---

## Implementation Approach

### Fixture Files (37 + 28 = 65 JSON files)

Each fixture follows the exact format of existing files in `backend/database/fixtures/designs/`. Cohort definitions use the OHDSI Atlas JSON expression format with `ConceptSets`, `PrimaryCriteria`, `AdditionalCriteria`, `QualifiedLimit`, `ExpressionLimit`, `CollapseSettings`. Analysis fixtures use `design_json` matching each model's expected schema.

All fixtures import via `php artisan parthenon:import-designs` — no seeder modification needed.

All cohort and analysis fixtures must include `is_public: true` and study-specific `tags` arrays for UI discoverability.

### Cohort ID Resolution Strategy (CRITICAL)

**Problem:** Analysis fixture `design_json` fields (`targetCohortId`, `comparatorCohortId`, `outcomeCohortIds`) require integer database IDs, but IDs are only assigned at import time by `ImportDesigns`.

**Solution — Two-pass import:**

1. **Pass 1:** Import all cohort definitions first via `parthenon:import-designs`. Each cohort gets a database ID assigned.
2. **Pass 2:** The `parthenon:seed-research-studies` artisan command (which handles both Study records AND analysis fixture ID resolution):
   - Reads each analysis fixture JSON
   - Resolves string cohort references (e.g., `"s6-c1"`) to database IDs by looking up `CohortDefinition::where('name', 'LIKE', '%s6-cardiorenal-new-prediabetes%')`
   - Writes the resolved integer IDs into the `design_json` before creating/updating the analysis record

**Alternative (simpler but fragile):** Write analysis fixtures with placeholder IDs, then after importing cohorts, query for assigned IDs and update analysis fixtures manually. The two-pass artisan command is more robust.

**In the spec JSON blocks**, cohort references like `"s6-c1"` are logical identifiers. The implementation must map them to cohort names:

| Logical ID | Cohort Name (fixture filename stem) |
|------------|--------------------------------------|
| s6-c1 | s6-cardiorenal-new-prediabetes-no-prior-ckd-htn |
| s6-c2 | s6-cardiorenal-matched-controls-no-prediabetes |
| s6-c3 | s6-cardiorenal-outcome-ckd-stage4 |
| s6-c4 | s6-cardiorenal-outcome-esrd |
| s6-c5 | s6-cardiorenal-outcome-composite-mace |
| s6-c6 | s6-cardiorenal-subgroup-anemia-at-ckd |
| s6-c7 | s6-cardiorenal-event-metabolic-syndrome |
| s6-c8 | s6-cardiorenal-event-hypertension |
| s6-c9 | s6-cardiorenal-event-ckd-stage1 |
| s6-c10 | s6-cardiorenal-event-ckd-stage2 |
| s6-c11 | s6-cardiorenal-event-ckd-stage3 |
| s7-c1 | s7-statin-new-simvastatin-users |
| s7-c2 | s7-statin-new-atorvastatin-users |
| s7-c3 | s7-statin-outcome-composite-mace |
| s7-c4 | s7-statin-outcome-stemi |
| s7-c5 | s7-statin-outcome-stroke |
| s7-c6 | s7-statin-outcome-death |
| s8-c1 | s8-opioid-new-users-chronic-pain-no-prior-abuse |
| s8-c2 | s8-opioid-comparator-nsaid-only-chronic-pain |
| s8-c3 | s8-opioid-outcome-drug-misuse |
| s8-c4 | s8-opioid-outcome-drug-dependence |
| s8-c5 | s8-opioid-outcome-death |
| s8-c6 | s8-opioid-event-mat-initiation |
| s8-c7 | s8-opioid-event-naloxone-overdose |
| s9-c1 | s9-metformin-t2dm-new-metformin-users |
| s9-c2 | s9-metformin-t2dm-new-insulin-users-no-metformin |
| s9-c3 | s9-metformin-outcome-colorectal-neoplasm |
| s9-c4 | s9-metformin-outcome-alzheimers |
| s9-c5 | s9-metformin-outcome-composite-mace |
| s9-c6 | s9-metformin-outcome-death |
| s9-c7 | s9-metformin-outcome-breast-cancer |
| s10-c0 | s10-prediabetes-first-occurrence-base |
| s10-c1 | s10-prediabetes-escapers-5yr-no-t2dm |
| s10-c2 | s10-prediabetes-progressors-t2dm-within-5yr |
| s10-c3 | s10-prediabetes-outcome-t2dm |
| s10-c4 | s10-prediabetes-event-metabolic-syndrome |
| s10-c5 | s10-prediabetes-outcome-ckd-any-stage |

### Analysis JSON Format Notes

The following format conventions must match existing fixtures exactly:

- **`analysisType` field:** Every analysis `design_json` must include a top-level `analysisType` string: `"CohortMethod"`, `"PatientLevelPrediction"`, `"SelfControlledCaseSeries"`, `"Characterization"`, `"IncidenceRate"`, `"Pathway"`, `"EvidenceSynthesis"`
- **Age stratification:** Characterizations use `"ageBreaks": [18, 40, 55, 65, 75]` (flat breakpoint array), NOT nested `ageGroups` arrays
- **Time-at-risk:** Incidence rate analyses use nested object format: `{"start": {"offset": 1, "dateField": "index_date"}, "end": {"offset": 1825, "dateField": "index_date"}}`, NOT flat `{"start": 1, "end": null}`
- **MACE composites:** S6-C5 (cardiorenal) excludes CHF; S7-C3 (statin), S9-C5 (metformin) include CHF. This is intentional — CHF is more relevant to statin/metabolic studies.

### S9-C2 Insulin Concept Set

The insulin comparator cohort uses individual verified RxNorm ingredient concept IDs. The insulin concept IDs must be queried from the vocabulary at implementation time:

```sql
SELECT concept_id, concept_name FROM omop.concept
WHERE standard_concept = 'S' AND concept_class_id = 'Ingredient'
  AND concept_name ILIKE '%insulin%'
ORDER BY concept_name;
```

The results are used to build the insulin concept set with `includeDescendants: true` for each ingredient.

### Study Records (2 studies — artisan command)

Study protocol records require creating Study, StudyCohort, StudyAnalysis, StudySite, and StudyMilestone records. Implemented as the same `parthenon:seed-research-studies` artisan command that handles cohort ID resolution:

1. Import cohort definitions via `parthenon:import-designs` (must run first)
2. Resolve cohort name → database ID mapping
3. Create analysis records with resolved integer IDs in `design_json`
4. Create Study records with full protocol metadata
5. Link cohort definitions as StudyCohort records (by name lookup)
6. Link analysis configurations as StudyAnalysis records (polymorphic)
7. Create StudySite and StudyMilestone records

### New Fixture Directories

Two new subdirectories needed (no existing fixtures):
- `backend/database/fixtures/designs/sccs_analyses/` — for S7-A4, S7-A5
- `backend/database/fixtures/designs/evidence_synthesis_analyses/` — for S9-A6

The `ImportDesigns` command already handles both `sccs_analyses` and `evidence_synthesis_analyses` entity types (see `ENTITY_CONFIG` constant).

### Execution Order

1. Create new fixture directories (`sccs_analyses/`, `evidence_synthesis_analyses/`)
2. Write all 37 cohort definition fixture JSON files
3. Run `php artisan parthenon:import-designs` to load cohort definitions
4. Write the `parthenon:seed-research-studies` artisan command
5. Run `php artisan parthenon:seed-research-studies` to create analyses + Study records (resolves cohort IDs)
6. Validate cohort generation on at least one cohort per study
7. Execute characterization analyses first (SQL-based, fast validation)
8. Execute R-based analyses (estimation, prediction, SCCS) after characterization validates

---

## Deliverable Summary

| Component | Count |
|-----------|-------|
| Cohort definition fixture files | 37 |
| Characterization fixture files | 5 |
| Estimation fixture files | 8 |
| Prediction fixture files | 5 |
| Pathway fixture files | 4 |
| Incidence rate fixture files | 3 |
| SCCS fixture files | 2 |
| Evidence synthesis fixture files | 1 |
| **Total fixture files** | **65** |
| Artisan command (study seeder + ID resolution) | 1 |
| Study records (full protocol) | 2 |
| Study cohort assignments | 15 |
| Study milestones | 18 |
| Study sites | 2 |
