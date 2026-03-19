# OHDSI Studies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 37 cohort definitions and 29 HADES analysis configurations as JSON fixtures, plus 2 full Study protocol records, for 5 novel OHDSI studies against the 1M-patient Parthenon OMOP CDM.

**Architecture:** JSON fixture files in `backend/database/fixtures/designs/` imported via `parthenon:import-designs`. A new artisan command `parthenon:seed-research-studies` resolves cohort name→ID references in analysis fixtures and creates Study protocol records. Two-pass import: cohorts first, then analyses + studies.

**Tech Stack:** Laravel 11 / PHP 8.4, OHDSI Atlas JSON cohort format, HADES analysis design_json schemas, PostgreSQL OMOP CDM v5.4

**Spec:** `docs/superpowers/specs/2026-03-19-ohdsi-studies-cohorts-analyses-design.md`

---

## Reference: JSON Templates

Every cohort/analysis fixture must match the exact format of existing files. These are the canonical templates:

- **Cohort definition:** `backend/database/fixtures/designs/cohort_definitions/prediabetes-new-user-metformin-initiators.json` — full Atlas JSON with ConceptSets, PrimaryCriteria, InclusionRules, AdditionalCriteria, CollapseSettings
- **Estimation:** `backend/database/fixtures/designs/estimation_analyses/study-2-acei-vs-ccb-ckd-progression-cohortmethod-ps-matched-cox.json` — design_json with model, propensityScore, studyPopulation, covariateSettings, excludedConceptIds
- **Characterization:** `backend/database/fixtures/designs/characterizations/study-2-baseline-characterization-lisinopril-vs-amlodipine-initiators.json` — design_json with ageBreaks (flat array), timeWindows, featureTypes, targetCohortIds, comparatorCohortIds
- **Prediction:** `backend/database/fixtures/designs/prediction_analyses/ckd-progression-risk-model.json` — design_json with model, timeAtRisk, splitSettings, covariateSettings, populationSettings
- **Pathway:** `backend/database/fixtures/designs/pathway_analyses/antihypertensive-treatment-pathway.json` — design_json with targetCohortId, eventCohortIds, maxDepth, combinationWindow
- **Incidence rate:** `backend/database/fixtures/designs/incidence_rate_analyses/new-onset-ckd-in-t2dm-patients.json` — design_json with targetCohortId, outcomeCohortIds, timeAtRisk (nested), ageGroups (string array)

**Key format rules:**
- `id` field: include in JSON (stripped by ImportDesigns, but needed for fixture format consistency). Use IDs starting at 200 to avoid collisions.
- `author_id`: always `117` (remapped to admin by ImportDesigns if user 117 doesn't exist)
- `deleted_at`: include as `null` for format consistency with existing fixtures
- **Cohort definitions only:** include `is_public: true`, `tags: [...]`, `share_token: null`, `share_expires_at: null`. Analysis fixtures do NOT have these fields (not in their model's `$fillable`).
- **Cohort ID placeholders in analysis `design_json`:** use **string references** like `"s6-c1"`, `"s7-c2"`, etc. (matching the spec's logical ID table). The `seed-research-studies` command walks the JSON recursively and replaces any string matching `s\d+-c\d+` with the resolved database ID. This is self-documenting and unambiguous (unlike placeholder `0` which can't distinguish target from comparator).
- **`analysisType` field:** Include in `design_json` ONLY for analysis types where existing fixtures already have it: **characterizations** (`"Characterization"`), **estimations** (`"CohortMethod"`). Do NOT add to prediction, pathway, incidence rate, SCCS, or evidence synthesis fixtures — existing fixtures for these types omit it.
- **Characterization `ageBreaks`:** flat array `[18, 40, 55, 65, 75]` (matches existing study-2 characterization fixtures)
- **Incidence rate `ageGroups`:** use object array format matching the most recent fixtures: `[{"minAge": 18, "maxAge": 39}, {"minAge": 40, "maxAge": 54}, {"minAge": 55, "maxAge": 64}, {"minAge": 65, "maxAge": 74}, {"minAge": 75, "maxAge": 120}]`
- **Incidence rate `timeAtRisk`:** nested object format: `{"start": {"offset": 1, "dateField": "index_date"}, "end": {"offset": 0, "dateField": "EndDate"}}`. Use `"dateField": "index_date"` for start (day N after index), `"EndDate"` for end-of-observation, or `"index_date"` with a specific offset for fixed windows. Match existing fixture patterns.

---

## Concept Set Building Block

Many cohorts share the same concept set patterns. To avoid repetition, here are the reusable concept set item templates. When building a concept set, use this JSON structure for each concept:

```json
{
  "concept": {
    "DOMAIN_ID": "<Condition|Drug>",
    "CONCEPT_ID": <integer>,
    "CONCEPT_NAME": "<name>",
    "VOCABULARY_ID": "<SNOMED|RxNorm>",
    "CONCEPT_CLASS_ID": "<Clinical Finding|Ingredient>",
    "STANDARD_CONCEPT": "S"
  },
  "isExcluded": false,
  "includeMapped": false,
  "includeDescendants": true
}
```

### Verified Concept Registry

**Conditions (SNOMED):**

| ID | Name | Use In |
|----|------|--------|
| 37018196 | Prediabetes | S6, S10 |
| 201826 | Type 2 diabetes mellitus | S6, S9, S10 |
| 320128 | Essential hypertension | S6 |
| 436940 | Metabolic syndrome X | S6, S10 |
| 443614 | Chronic kidney disease stage 1 | S6 |
| 443601 | Chronic kidney disease stage 2 | S6 |
| 443597 | Chronic kidney disease stage 3 | S6 |
| 443612 | Chronic kidney disease stage 4 | S6, S10 |
| 193782 | End-stage renal disease | S6 |
| 4296653 | Acute ST segment elevation MI | S6, S7, S9 |
| 4270024 | Acute non-ST segment elevation MI | S6, S7, S9 |
| 381316 | Cerebrovascular accident (stroke) | S6, S7, S9 |
| 4229440 | Chronic congestive heart failure | S7, S9 |
| 4317150 | Sudden cardiac death | S6, S7, S9 |
| 436096 | Chronic pain | S8 |
| 4234597 | Misuses drugs | S8 |
| 4275756 | Dependent drug abuse | S8 |
| 439777 | Anemia | S6 |
| 4285898 | Polyp of colon | S9 |
| 4180790 | Malignant tumor of colon | S9 |
| 378419 | Alzheimer's disease | S9 |
| 4112853 | Malignant tumor of breast | S9 |

**Drug Ingredients (RxNorm):**

| ID | Name | Use In |
|----|------|--------|
| 1539403 | simvastatin | S7 |
| 1545958 | atorvastatin | S7 |
| 1510813 | rosuvastatin | S7 |
| 1551860 | pravastatin | S7 |
| 1174888 | hydrocodone | S8 |
| 1124957 | oxycodone | S8 |
| 1110410 | morphine | S8 |
| 1154029 | fentanyl | S8 |
| 1201620 | codeine | S8 |
| 1115008 | naproxen | S8 |
| 1177480 | ibuprofen | S8 |
| 1133201 | buprenorphine | S8 |
| 1103640 | methadone | S8 |
| 1114220 | naloxone | S8 |
| 1503297 | metformin | S9 |

**Insulin ingredients (for S9-C2, from existing fixture `prediabetes-new-user-metformin-initiators.json`):**

| ID | Name |
|----|------|
| 1596977 | insulin, regular, human |
| 46221581 | insulin isophane |
| 1550023 | insulin lispro |
| 1502905 | insulin glargine |
| 35198096 | insulin aspart |

---

## Task 1: Setup — Create New Directories

**Files:**
- Create: `backend/database/fixtures/designs/sccs_analyses/` (directory)
- Create: `backend/database/fixtures/designs/evidence_synthesis_analyses/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p backend/database/fixtures/designs/sccs_analyses
mkdir -p backend/database/fixtures/designs/evidence_synthesis_analyses
```

- [ ] **Step 2: Add .gitkeep files**

```bash
touch backend/database/fixtures/designs/sccs_analyses/.gitkeep
touch backend/database/fixtures/designs/evidence_synthesis_analyses/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add backend/database/fixtures/designs/sccs_analyses/.gitkeep backend/database/fixtures/designs/evidence_synthesis_analyses/.gitkeep
git commit -m "chore: add sccs and evidence synthesis fixture directories"
```

---

## Task 2: Study 6 — Cardiorenal Cascade Cohort Definitions (11 files)

**Files:**
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-new-prediabetes-no-prior-ckd-htn.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-matched-controls-no-prediabetes.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-outcome-ckd-stage4.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-outcome-esrd.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-outcome-composite-mace.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-subgroup-anemia-at-ckd.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-event-metabolic-syndrome.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-event-hypertension.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-event-ckd-stage1.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-event-ckd-stage2.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s6-cardiorenal-event-ckd-stage3.json`

**Reference:** Use `prediabetes-new-user-metformin-initiators.json` as the structural template for all cohort definitions. Every file must have the full OHDSI Atlas JSON structure.

- [ ] **Step 1: Build S6-C1 — New Prediabetes Target**

Write the target cohort. This is the most complex cohort — it has 4 concept sets (prediabetes, CKD all stages, HTN, T2DM), PrimaryCriteria on prediabetes first occurrence with 365d prior obs, and InclusionRules excluding prior CKD/HTN/T2DM using `Occurrence.Type: 0, Count: 0` pattern (exactly 0 = AT_MOST_0).

Key patterns from the reference template:
- `InclusionRules` array (NOT `AdditionalCriteria`) for exclusion logic using `Type: 0, Count: 0`
- `StartWindow` with `Coeff: -1` for "before index" and `Days: 99999` for "all time prior"
- `PrimaryCriteria.CriteriaList[0].ConditionOccurrence.First: true` for first occurrence
- `ObservationWindow.PriorDays: 365`

Concept sets needed:
- [0] Prediabetes: concept 37018196
- [1] CKD All Stages: concepts 443614, 443601, 443597, 443612
- [2] Hypertension: concept 320128
- [3] T2DM: concept 201826

Tags: `["cardiorenal", "prediabetes", "target", "s6"]`

- [ ] **Step 2: Build S6-C2 — Matched Controls**

Simpler cohort. PrimaryCriteria on VisitOccurrence (any visit type, no CodesetId needed). InclusionRules exclude prediabetes and T2DM all-time. No AdditionalCriteria.

Tags: `["cardiorenal", "controls", "comparator", "s6"]`

- [ ] **Step 3: Build S6-C3 through S6-C5 — Outcome cohorts**

Three simple outcome cohorts. Each is a first-occurrence condition cohort with 0 prior days observation.

- S6-C3: CKD Stage 4 (443612). Tags: `["cardiorenal", "ckd", "outcome", "s6"]`
- S6-C4: ESRD (193782). Tags: `["cardiorenal", "esrd", "outcome", "s6"]`
- S6-C5: Composite MACE — single concept set with STEMI (4296653), NSTEMI (4270024), stroke (381316), sudden cardiac death (4317150). Note: NO CHF in this MACE composite (that's S7's variant). Tags: `["cardiorenal", "mace", "outcome", "s6"]`

- [ ] **Step 4: Build S6-C6 — Anemia at CKD Subgroup**

PrimaryCriteria on anemia (439777) first occurrence. AdditionalCriteria requires any CKD stage (concept set with 443614/443601/443597/443612) within ±90 days: `StartWindow.Start.Days: 90, Coeff: -1` and `StartWindow.End.Days: 90, Coeff: 1`.

Tags: `["cardiorenal", "anemia", "subgroup", "s6"]`

- [ ] **Step 5: Build S6-C7 through S6-C11 — Event cohorts for pathway**

Five simple first-occurrence cohorts:
- S6-C7: MetSyn (436940). Tags: `["cardiorenal", "metabolic-syndrome", "event", "s6"]`
- S6-C8: HTN (320128). Tags: `["cardiorenal", "hypertension", "event", "s6"]`
- S6-C9: CKD Stage 1 (443614). Tags: `["cardiorenal", "ckd-stage1", "event", "s6"]`
- S6-C10: CKD Stage 2 (443601). Tags: `["cardiorenal", "ckd-stage2", "event", "s6"]`
- S6-C11: CKD Stage 3 (443597). Tags: `["cardiorenal", "ckd-stage3", "event", "s6"]`

- [ ] **Step 6: Validate JSON syntax**

```bash
for f in backend/database/fixtures/designs/cohort_definitions/s6-*.json; do python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"; done
```

- [ ] **Step 7: Dry-run import**

```bash
docker compose exec php php artisan parthenon:import-designs --dry-run 2>&1 | grep -E 's6-|created|updated|skipped'
```

Expected: 11 `created` for cohort_definitions matching `s6-*`

- [ ] **Step 8: Commit**

```bash
git add backend/database/fixtures/designs/cohort_definitions/s6-*.json
git commit -m "feat(studies): S6 Cardiorenal Cascade — 11 cohort definitions"
```

---

## Task 3: Study 7 — Statin Paradox Cohort Definitions (6 files)

**Files:**
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-new-simvastatin-users.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-new-atorvastatin-users.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-outcome-composite-mace.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-outcome-stemi.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-outcome-stroke.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s7-statin-outcome-death.json`

- [ ] **Step 1: Build S7-C1 — New Simvastatin Users (Target)**

PrimaryCriteria on DrugExposure with CodesetId [0] = simvastatin (1539403). Concept set [1] = all statins (1539403, 1545958, 1510813, 1551860). InclusionRules: exclude prior statin (concept set [1]) all time.

End strategy: Use drug era end date. In Atlas JSON this is modeled with `EndStrategy.DateOffset.DateField: "DrugExposureEndDate"` and `Offset: 0`.

Tags: `["statin", "simvastatin", "target", "s7"]`

- [ ] **Step 2: Build S7-C2 — New Atorvastatin Users (Comparator)**

Same structure as S7-C1 but PrimaryCriteria uses atorvastatin (1545958). Same exclusion concept set (all statins).

Tags: `["statin", "atorvastatin", "comparator", "s7"]`

- [ ] **Step 3: Build S7-C3 through S7-C6 — Outcome cohorts**

- S7-C3: Composite MACE — STEMI (4296653), NSTEMI (4270024), stroke (381316), CHF (4229440), sudden cardiac death (4317150). Note: includes CHF (unlike S6-C5). Tags: `["statin", "mace", "outcome", "s7"]`
- S7-C4: STEMI only (4296653). Tags: `["statin", "stemi", "outcome", "s7"]`
- S7-C5: Stroke only (381316). Tags: `["statin", "stroke", "outcome", "s7"]`
- S7-C6: Death — use `DeathOccurrence` in PrimaryCriteria (not ConditionOccurrence). Tags: `["statin", "death", "outcome", "s7"]`

For Death cohort: PrimaryCriteria uses `{"Death": {}}` instead of ConditionOccurrence. Check existing death cohorts for the exact format.

- [ ] **Step 4: Validate and dry-run**

```bash
for f in backend/database/fixtures/designs/cohort_definitions/s7-*.json; do python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"; done
docker compose exec php php artisan parthenon:import-designs --dry-run 2>&1 | grep -E 's7-|created'
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/fixtures/designs/cohort_definitions/s7-*.json
git commit -m "feat(studies): S7 Statin Paradox — 6 cohort definitions"
```

---

## Task 4: Study 8 — Opioid Trajectory Cohort Definitions (7 files)

**Files:**
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-new-users-chronic-pain-no-prior-abuse.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-comparator-nsaid-only-chronic-pain.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-outcome-drug-misuse.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-outcome-drug-dependence.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-outcome-death.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-event-mat-initiation.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s8-opioid-event-naloxone-overdose.json`

- [ ] **Step 1: Build S8-C1 — New Opioid Users Target**

Most complex cohort in the study. Concept sets:
- [0] Opioids: hydrocodone (1174888), oxycodone (1124957), morphine (1110410), fentanyl (1154029), codeine (1201620)
- [1] Chronic pain: 436096
- [2] Substance abuse (exclusion): 4234597, 4275756

PrimaryCriteria: first DrugExposure in concept set [0], 365d prior obs.
AdditionalCriteria: chronic pain (concept set [1]) within ±180d (`Start.Days: 180, Coeff: -1` to `End.Days: 180, Coeff: 1`), at least 1 occurrence.
InclusionRules: exclude prior substance abuse (concept set [2]) all time.

Tags: `["opioid", "chronic-pain", "target", "s8"]`

- [ ] **Step 2: Build S8-C2 — NSAID Comparator**

PrimaryCriteria: first DrugExposure of naproxen (1115008) or ibuprofen (1177480).
AdditionalCriteria: chronic pain within ±180d.
InclusionRules: exclude prior opioid (concept set [0] from S8-C1) — all time **prior to index only** (not future, to avoid immortal-time bias).

Tags: `["opioid", "nsaid", "comparator", "s8"]`

- [ ] **Step 3: Build S8-C3 through S8-C7 — Outcome and event cohorts**

- S8-C3: Drug misuse (4234597). Tags: `["opioid", "drug-misuse", "outcome", "s8"]`
- S8-C4: Drug dependence (4275756). Tags: `["opioid", "drug-dependence", "outcome", "s8"]`
- S8-C5: Death (same structure as S7-C6). Tags: `["opioid", "death", "outcome", "s8"]`
- S8-C6: Buprenorphine (1133201) or methadone (1103640) first exposure. Tags: `["opioid", "mat", "event", "s8"]`
- S8-C7: Naloxone (1114220) first exposure. Tags: `["opioid", "naloxone", "event", "s8"]`

- [ ] **Step 4: Validate and dry-run**

```bash
for f in backend/database/fixtures/designs/cohort_definitions/s8-*.json; do python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"; done
docker compose exec php php artisan parthenon:import-designs --dry-run 2>&1 | grep -E 's8-|created'
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/fixtures/designs/cohort_definitions/s8-*.json
git commit -m "feat(studies): S8 Opioid Trajectory — 7 cohort definitions"
```

---

## Task 5: Study 9 — Metformin Repurposing Cohort Definitions (7 files)

**Files:**
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-t2dm-new-metformin-users.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-t2dm-new-insulin-users-no-metformin.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-outcome-colorectal-neoplasm.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-outcome-alzheimers.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-outcome-composite-mace.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-outcome-death.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s9-metformin-outcome-breast-cancer.json`

- [ ] **Step 1: Build S9-C1 — T2DM New Metformin Users (Target)**

Reuse the pattern from existing `prediabetes-new-user-metformin-initiators.json` — it's almost identical. PrimaryCriteria on first metformin (1503297). AdditionalCriteria: T2DM (201826) within ±180d. InclusionRules: no prior metformin.

Tags: `["metformin", "t2dm", "target", "s9"]`

- [ ] **Step 2: Build S9-C2 — T2DM New Insulin Users (Comparator)**

PrimaryCriteria on first insulin exposure. Use the insulin ingredient concept set from the existing `prediabetes-new-user-metformin-initiators.json` (concepts: 1596977, 46221581, 1550023, 1502905, 35198096). AdditionalCriteria: T2DM within ±180d. InclusionRules: no prior metformin (1503297) — all time.

Tags: `["metformin", "insulin", "comparator", "s9"]`

- [ ] **Step 3: Build S9-C3 through S9-C7 — Outcome cohorts**

- S9-C3: Colorectal neoplasm — concept set with polyp (4285898) and malignant colon tumor (4180790). Tags: `["metformin", "colorectal", "outcome", "s9"]`
- S9-C4: Alzheimer's (378419). Tags: `["metformin", "alzheimers", "outcome", "s9"]`
- S9-C5: Composite MACE — same as S7-C3 (includes CHF). Tags: `["metformin", "mace", "outcome", "s9"]`
- S9-C6: Death — same as S7-C6. Tags: `["metformin", "death", "outcome", "s9"]`
- S9-C7: Malignant breast tumor (4112853). Tags: `["metformin", "breast-cancer", "outcome", "s9"]`

- [ ] **Step 4: Validate and dry-run**

```bash
for f in backend/database/fixtures/designs/cohort_definitions/s9-*.json; do python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"; done
docker compose exec php php artisan parthenon:import-designs --dry-run 2>&1 | grep -E 's9-|created'
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/fixtures/designs/cohort_definitions/s9-*.json
git commit -m "feat(studies): S9 Metformin Repurposing — 7 cohort definitions"
```

---

## Task 6: Study 10 — Prediabetes Reversal Cohort Definitions (6 files)

**Files:**
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-first-occurrence-base.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-escapers-5yr-no-t2dm.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-progressors-t2dm-within-5yr.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-outcome-t2dm.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-event-metabolic-syndrome.json`
- Create: `backend/database/fixtures/designs/cohort_definitions/s10-prediabetes-outcome-ckd-any-stage.json`

- [ ] **Step 1: Build S10-C0 — Base Prediabetes Cohort (PLP target)**

Simplest cohort: first prediabetes (37018196) with 365d prior obs. No exclusions. End = observation period end.

Tags: `["prediabetes", "base", "target", "s10"]`

- [ ] **Step 2: Build S10-C1 — Escapers**

First prediabetes. InclusionRules: (1) observation period end >= index + 1825 days — this requires a custom criterion. Use `ObservationPeriodEnd` check or a time-based additional criterion. (2) No T2DM (201826) any time after index (0 to +99999 days) using `Type: 0, Count: 0`.

End strategy: fixed offset — cohort_end_date = index + 1825 days. In Atlas JSON: `EndStrategy.DateOffset.DateField: "StartDate", Offset: 1825`.

Tags: `["prediabetes", "escapers", "target", "s10"]`

- [ ] **Step 3: Build S10-C2 — Progressors**

First prediabetes. AdditionalCriteria: T2DM (201826) within 0 to +1825 days after index (`Start.Days: 0, Coeff: 1` to `End.Days: 1825, Coeff: 1`), at least 1 occurrence.

End strategy: first T2DM date. This may require custom SQL or use observation period end as approximation.

Tags: `["prediabetes", "progressors", "comparator", "s10"]`

- [ ] **Step 4: Build S10-C3 through S10-C5 — Outcome and event cohorts**

- S10-C3: T2DM first occurrence (201826). Tags: `["prediabetes", "t2dm", "outcome", "s10"]`
- S10-C4: MetSyn first occurrence (436940). Tags: `["prediabetes", "metabolic-syndrome", "event", "s10"]`
- S10-C5: CKD any stage — concept set with 443614, 443601, 443597, 443612. Tags: `["prediabetes", "ckd", "outcome", "s10"]`

- [ ] **Step 5: Validate and dry-run**

```bash
for f in backend/database/fixtures/designs/cohort_definitions/s10-*.json; do python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"; done
docker compose exec php php artisan parthenon:import-designs --dry-run 2>&1 | grep -E 's10-|created'
```

- [ ] **Step 6: Commit**

```bash
git add backend/database/fixtures/designs/cohort_definitions/s10-*.json
git commit -m "feat(studies): S10 Prediabetes Reversal — 6 cohort definitions"
```

---

## Task 7: Import All Cohort Definitions

- [ ] **Step 1: Run full import**

```bash
docker compose exec php php artisan parthenon:import-designs
```

Expected: 37 new `created` across cohort_definitions (s6: 11, s7: 6, s8: 7, s9: 7, s10: 6)

- [ ] **Step 2: Verify cohort IDs in database**

```bash
docker compose exec php php artisan tinker --execute="
  App\Models\App\CohortDefinition::where('name', 'LIKE', 's6-%')->orWhere('name', 'LIKE', 's7-%')->orWhere('name', 'LIKE', 's8-%')->orWhere('name', 'LIKE', 's9-%')->orWhere('name', 'LIKE', 's10-%')
  ->get(['id', 'name'])->each(fn(\$c) => echo \$c->id . ' => ' . \$c->name . PHP_EOL);
"
```

Record the assigned IDs — they're needed for analysis fixtures.

- [ ] **Step 3: Commit** (if import changed any existing records)

No commit needed — import doesn't modify fixture files.

---

## Task 8: Analysis Fixtures — All 5 Studies (29 files)

**Files:**
- Create: `backend/database/fixtures/designs/characterizations/s6-cardiorenal-baseline-characterization.json`
- Create: `backend/database/fixtures/designs/incidence_rate_analyses/s6-cardiorenal-ckd-progression-by-anemia.json`
- Create: `backend/database/fixtures/designs/incidence_rate_analyses/s6-cardiorenal-ckd-progression-anemia-subgroup.json`
- Create: `backend/database/fixtures/designs/pathway_analyses/s6-cardiorenal-metabolic-cascade-pathway.json`
- Create: `backend/database/fixtures/designs/prediction_analyses/s6-cardiorenal-predict-ckd4-lasso.json`
- Create: `backend/database/fixtures/designs/prediction_analyses/s6-cardiorenal-predict-mace-gradient-boosting.json`
- Create: `backend/database/fixtures/designs/characterizations/s7-statin-new-user-baseline-comparison.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s7-statin-simvastatin-vs-atorvastatin-mace-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s7-statin-simvastatin-vs-atorvastatin-stroke-ps-cox.json`
- Create: `backend/database/fixtures/designs/sccs_analyses/s7-statin-sccs-stemi-within-person.json`
- Create: `backend/database/fixtures/designs/sccs_analyses/s7-statin-sccs-stroke-within-person.json`
- Create: `backend/database/fixtures/designs/characterizations/s8-opioid-baseline-characterization.json`
- Create: `backend/database/fixtures/designs/pathway_analyses/s8-opioid-prescribing-escalation-pathway.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s8-opioid-vs-nsaid-drug-misuse-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s8-opioid-vs-nsaid-drug-dependence-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s8-opioid-vs-nsaid-death-ps-cox.json`
- Create: `backend/database/fixtures/designs/prediction_analyses/s8-opioid-predict-misuse-lasso.json`
- Create: `backend/database/fixtures/designs/prediction_analyses/s8-opioid-predict-dependence-gradient-boosting.json`
- Create: `backend/database/fixtures/designs/characterizations/s9-metformin-baseline-characterization.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s9-metformin-vs-insulin-colorectal-neoplasm-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s9-metformin-vs-insulin-alzheimers-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s9-metformin-vs-insulin-mace-ps-cox.json`
- Create: `backend/database/fixtures/designs/estimation_analyses/s9-metformin-vs-insulin-mortality-ps-cox.json`
- Create: `backend/database/fixtures/designs/evidence_synthesis_analyses/s9-metformin-multi-outcome-signal-profile.json`
- Create: `backend/database/fixtures/designs/characterizations/s10-prediabetes-escapers-vs-progressors-baseline.json`
- Create: `backend/database/fixtures/designs/pathway_analyses/s10-prediabetes-escaper-pathway.json`
- Create: `backend/database/fixtures/designs/pathway_analyses/s10-prediabetes-progressor-pathway.json`
- Create: `backend/database/fixtures/designs/prediction_analyses/s10-prediabetes-predict-t2dm-lasso.json`
- Create: `backend/database/fixtures/designs/incidence_rate_analyses/s10-prediabetes-t2dm-ckd-incidence.json`

**CRITICAL: Cohort ID resolution.** All `targetCohortId`, `comparatorCohortId`, `outcomeCohortIds`, `eventCohortIds`, `exposureCohortId`, `outcomeCohortId` fields in `design_json` must use string placeholders like `"s6-c1"`, `"s7-c3"`, etc. The `seed-research-studies` command (Task 9) walks the JSON recursively and replaces any string matching the `s\d+-c\d+` pattern with the resolved integer database ID.

- [ ] **Step 1: Build S6 analysis fixtures (6 files)**

Use the reference templates noted at the top of this plan. Each `design_json` must include:
- `analysisType` field (e.g., `"Characterization"`, `"CohortMethod"`, etc.)
- Characterizations: `ageBreaks: [18, 40, 55, 65, 75]` (flat), `timeWindows` with `startDays`/`endDays`/`label`/`id`
- Predictions: `model.type`, `hyperParameters`, `timeAtRisk`, `covariateSettings`, `populationSettings`, `splitSettings`
- Pathways: `targetCohortId`, `eventCohortIds`, `maxDepth`, `combinationWindow`, `maxPathLength`, `minCellCount`
- Incidence rates: `targetCohortId`, `outcomeCohortIds`, `timeAtRisk` (nested), `ageGroups` (string array), `stratifyByAge`, `stratifyByGender`

Use `0` for all cohort ID fields — they'll be resolved by the artisan command.

See spec sections S6-A1 through S6-A6 for exact parameters.

- [ ] **Step 2: Build S7 analysis fixtures (5 files)**

Estimation fixtures follow the `study-2-acei-vs-ccb-ckd-progression-cohortmethod-ps-matched-cox.json` template exactly. Key fields: `model`, `timeAtRisk`, `propensityScore`, `studyPopulation`, `covariateSettings` with `excludedConceptIds`.

For S7-A2 and S7-A3 (estimations): `excludedConceptIds: [1539403, 1545958, 1510813, 1551860]` (all statins).

SCCS fixtures (S7-A4, S7-A5) — new format, no existing template. Structure from spec:
```json
{
  "name": "...",
  "description": "...",
  "design_json": {
    "analysisType": "SelfControlledCaseSeries",
    "exposureCohortId": 0,
    "outcomeCohortId": 0,
    "model": {"type": "age_season_adjusted"},
    "studyPopulation": {"naivePeriod": 180, "firstOutcomeOnly": true},
    "riskWindows": [...],
    "preExposureWindow": {"start": -30, "end": -1}
  }
}
```

- [ ] **Step 3: Build S8 analysis fixtures (7 files)**

Three estimation analyses with `excludedConceptIds: [1174888, 1124957, 1110410, 1154029, 1201620, 1115008, 1177480]` (all opioids + NSAIDs). S8-A5 uses longer TAR (1825d vs 1095d).

Two PLP analyses: LASSO for misuse, gradient boosting for dependence.

- [ ] **Step 4: Build S9 analysis fixtures (6 files)**

Four estimation analyses (same structure, different outcomes and TARs). S9-A3 (Alzheimer's) uses 2555d TAR. `excludedConceptIds: [1503297]` (metformin only — insulin concept IDs vary).

Evidence synthesis fixture (S9-A6): minimal `design_json` with `method: "random_effects"`, empty `estimates` array (populated at runtime).

- [ ] **Step 5: Build S10 analysis fixtures (5 files)**

Two pathway analyses (same structure, different target cohorts — escapers vs progressors). PLP and incidence rate.

- [ ] **Step 6: Validate all analysis JSON**

```bash
for dir in characterizations estimation_analyses prediction_analyses pathway_analyses incidence_rate_analyses sccs_analyses evidence_synthesis_analyses; do
  for f in backend/database/fixtures/designs/$dir/s*.json; do
    [ -f "$f" ] && python3 -c "import json; json.load(open('$f')); print('OK: $f')" || echo "FAIL: $f"
  done
done
```

- [ ] **Step 7: Commit all analysis fixtures**

```bash
git add backend/database/fixtures/designs/characterizations/s*.json
git add backend/database/fixtures/designs/estimation_analyses/s*.json
git add backend/database/fixtures/designs/prediction_analyses/s*.json
git add backend/database/fixtures/designs/pathway_analyses/s*.json
git add backend/database/fixtures/designs/incidence_rate_analyses/s*.json
git add backend/database/fixtures/designs/sccs_analyses/s*.json
git add backend/database/fixtures/designs/evidence_synthesis_analyses/s*.json
git commit -m "feat(studies): all 29 HADES analysis configurations for S6-S10"
```

---

## Task 9: Artisan Command — seed-research-studies

**Files:**
- Create: `backend/app/Console/Commands/SeedResearchStudies.php`

This command does three things:
1. Resolves cohort name → database ID for all analysis fixtures
2. Creates/updates analysis records with resolved IDs
3. Creates Study, StudyCohort, StudyAnalysis, StudySite, StudyMilestone records for S6 and S8

- [ ] **Step 1: Create the command skeleton**

```bash
docker compose exec php php artisan make:command SeedResearchStudies
```

- [ ] **Step 2: Implement cohort ID resolution**

The command must:
1. Build a name→ID map by querying all cohort definitions with `s6-` through `s10-` prefixes
2. Build a `COHORT_MAP` constant mapping logical IDs to cohort name patterns (for resolving fixture references)
3. Read each analysis fixture JSON from disk
4. Recursively walk the `design_json` and replace any string value matching the regex `/^s\d+-c\d+$/` with the resolved integer database ID
5. Create/update the analysis record using the appropriate model class

```php
private const COHORT_MAP = [
    's6-c1'  => 's6-cardiorenal-new-prediabetes-no-prior-ckd-htn',
    's6-c2'  => 's6-cardiorenal-matched-controls-no-prediabetes',
    's6-c3'  => 's6-cardiorenal-outcome-ckd-stage4',
    's6-c4'  => 's6-cardiorenal-outcome-esrd',
    's6-c5'  => 's6-cardiorenal-outcome-composite-mace',
    's6-c6'  => 's6-cardiorenal-subgroup-anemia-at-ckd',
    's6-c7'  => 's6-cardiorenal-event-metabolic-syndrome',
    's6-c8'  => 's6-cardiorenal-event-hypertension',
    's6-c9'  => 's6-cardiorenal-event-ckd-stage1',
    's6-c10' => 's6-cardiorenal-event-ckd-stage2',
    's6-c11' => 's6-cardiorenal-event-ckd-stage3',
    's7-c1'  => 's7-statin-new-simvastatin-users',
    's7-c2'  => 's7-statin-new-atorvastatin-users',
    's7-c3'  => 's7-statin-outcome-composite-mace',
    's7-c4'  => 's7-statin-outcome-stemi',
    's7-c5'  => 's7-statin-outcome-stroke',
    's7-c6'  => 's7-statin-outcome-death',
    's8-c1'  => 's8-opioid-new-users-chronic-pain-no-prior-abuse',
    's8-c2'  => 's8-opioid-comparator-nsaid-only-chronic-pain',
    's8-c3'  => 's8-opioid-outcome-drug-misuse',
    's8-c4'  => 's8-opioid-outcome-drug-dependence',
    's8-c5'  => 's8-opioid-outcome-death',
    's8-c6'  => 's8-opioid-event-mat-initiation',
    's8-c7'  => 's8-opioid-event-naloxone-overdose',
    's9-c1'  => 's9-metformin-t2dm-new-metformin-users',
    's9-c2'  => 's9-metformin-t2dm-new-insulin-users-no-metformin',
    's9-c3'  => 's9-metformin-outcome-colorectal-neoplasm',
    's9-c4'  => 's9-metformin-outcome-alzheimers',
    's9-c5'  => 's9-metformin-outcome-composite-mace',
    's9-c6'  => 's9-metformin-outcome-death',
    's9-c7'  => 's9-metformin-outcome-breast-cancer',
    's10-c0' => 's10-prediabetes-first-occurrence-base',
    's10-c1' => 's10-prediabetes-escapers-5yr-no-t2dm',
    's10-c2' => 's10-prediabetes-progressors-t2dm-within-5yr',
    's10-c3' => 's10-prediabetes-outcome-t2dm',
    's10-c4' => 's10-prediabetes-event-metabolic-syndrome',
    's10-c5' => 's10-prediabetes-outcome-ckd-any-stage',
];
```

The recursive resolver:
```php
private function resolveIds(mixed $value, array $idMap): mixed
{
    if (is_string($value) && preg_match('/^s\d+-c\d+$/', $value)) {
        return $idMap[$value] ?? throw new \RuntimeException("Unresolved cohort ref: {$value}");
    }
    if (is_array($value)) {
        return array_map(fn ($v) => $this->resolveIds($v, $idMap), $value);
    }
    return $value;
}
```

For each analysis fixture:
- Load JSON from disk
- Apply `resolveIds()` to the entire `design_json` array
- Use the appropriate model class to `updateOrCreate` by name

- [ ] **Step 3: Implement Study record creation for S6**

Create the Study record with full protocol metadata from the spec (Section 4). Then create:
- 8 StudyCohort records (linking cohort definitions by name lookup)
- 6 StudyAnalysis records (polymorphic links to the created analyses)
- 1 StudySite record (default source, coordinating_center)
- 8 StudyMilestone records

- [ ] **Step 4: Implement Study record creation for S8**

Same pattern as S6 but with S8 cohorts (7), analyses (7), and milestones (10).

- [ ] **Step 5: Add idempotency**

Use `Study::updateOrCreate(['short_title' => 'Cardiorenal Cascade'], [...])` pattern throughout. The command must be safe to run multiple times.

- [ ] **Step 6: Test the command**

```bash
docker compose exec php php artisan parthenon:seed-research-studies
```

Verify:
- All analysis records created with resolved integer cohort IDs (not 0)
- Two Study records created
- StudyCohort, StudyAnalysis, StudySite, StudyMilestone records present

```bash
docker compose exec php php artisan tinker --execute="
  echo 'Studies: ' . App\Models\App\Study::where('short_title', 'LIKE', '%Cascade%')->orWhere('short_title', 'LIKE', '%Opioid%')->count() . PHP_EOL;
  echo 'StudyCohorts: ' . App\Models\App\StudyCohort::count() . PHP_EOL;
"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/Console/Commands/SeedResearchStudies.php
git commit -m "feat(studies): artisan command for research study seeding with cohort ID resolution"
```

---

## Task 10: Validation — Generate and Verify Cohorts

- [ ] **Step 1: Generate one cohort per study**

Pick the simplest outcome cohort from each study and generate it to verify the SQL compilation works:

```bash
# Get the cohort IDs for simple outcome cohorts
docker compose exec php php artisan tinker --execute="
  \$cohorts = ['s6-cardiorenal-outcome-ckd-stage4', 's7-statin-outcome-stemi', 's8-opioid-outcome-drug-misuse', 's9-metformin-outcome-colorectal-neoplasm', 's10-prediabetes-outcome-t2dm'];
  foreach (\$cohorts as \$name) {
    \$c = App\Models\App\CohortDefinition::where('name', \$name)->first();
    if (\$c) echo \$c->id . ' => ' . \$c->name . PHP_EOL;
  }
"
```

Then trigger generation for each (via API or tinker). Check the source_id for the default Acumenus source.

- [ ] **Step 2: Verify SQL preview**

For each cohort, check the compiled SQL looks correct:

```bash
# Example: preview SQL for one cohort
curl -s http://localhost:8082/api/v1/cohort-definitions/{ID}/sql -H "Authorization: Bearer {TOKEN}" | python3 -m json.tool | head -50
```

- [ ] **Step 3: Verify person counts are non-zero**

After generation completes, check that cohorts have reasonable person counts matching the data exploration:

| Cohort | Expected Range (upper bound from prevalence — actual will be lower due to exclusion criteria) |
|--------|---------------|
| CKD Stage 4 (s6-c3, no exclusions) | ~60,000 |
| STEMI (s7-c4, no exclusions) | ~5,000+ |
| Drug misuse (s8-c3, no exclusions) | ~85,000 |
| Colorectal neoplasm (s9-c3, no exclusions) | ~78,000 |
| T2DM (s10-c3, no exclusions) | ~75,000 |

- [ ] **Step 4: Document validation results and commit**

```bash
git commit --allow-empty -m "chore(studies): validation checkpoint — cohort generation verified"
```

---

## Task 11: Final Integration Test

- [ ] **Step 1: Run full import pipeline end-to-end**

```bash
# Full clean run
docker compose exec php php artisan parthenon:import-designs
docker compose exec php php artisan parthenon:seed-research-studies
```

- [ ] **Step 2: Verify fixture counts**

```bash
docker compose exec php php artisan tinker --execute="
  echo 'Cohorts (s6-s10): ' . App\Models\App\CohortDefinition::where('name', 'LIKE', 's6-%')->orWhere('name', 'LIKE', 's7-%')->orWhere('name', 'LIKE', 's8-%')->orWhere('name', 'LIKE', 's9-%')->orWhere('name', 'LIKE', 's10-%')->count() . PHP_EOL;
  echo 'Estimations: ' . App\Models\App\EstimationAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Predictions: ' . App\Models\App\PredictionAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Characterizations: ' . App\Models\App\Characterization::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Pathways: ' . App\Models\App\PathwayAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Incidence Rates: ' . App\Models\App\IncidenceRateAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'SCCS: ' . App\Models\App\SccsAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Evidence Synthesis: ' . App\Models\App\EvidenceSynthesisAnalysis::where('name', 'LIKE', 'S%')->count() . PHP_EOL;
  echo 'Studies: ' . App\Models\App\Study::count() . PHP_EOL;
"
```

Expected counts (new records only, plus any existing):
- Cohorts: 37
- Estimations: 9 (S7: 2, S8: 3, S9: 4)
- Predictions: 5 (S6: 2, S8: 2, S10: 1)
- Characterizations: 5 (one per study)
- Pathways: 4 (S6: 1, S8: 1, S10: 2)
- Incidence Rates: 3 (S6: 2, S10: 1)
- SCCS: 2 (S7: 2)
- Evidence Synthesis: 1 (S9: 1)
- **Total analyses: 29**
- Studies: 2

- [ ] **Step 3: Execute one characterization (SQL-based, fast)**

Pick S6-A1 or S7-A1 and run it — characterizations are SQL-only (no R runtime needed), so they validate the full pipeline without HADES.

- [ ] **Step 4: Execute one estimation (R-based)**

Pick the simplest estimation (e.g., S7-A2 simvastatin vs atorvastatin) and run it via the API. This validates the R runtime HADES pipeline end-to-end.

Monitor:
```bash
docker compose logs -f r-runtime --since 1m
docker compose exec php php artisan horizon:status
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(studies): Phase B complete — 5 OHDSI studies, 37 cohorts, 29 analyses"
```
