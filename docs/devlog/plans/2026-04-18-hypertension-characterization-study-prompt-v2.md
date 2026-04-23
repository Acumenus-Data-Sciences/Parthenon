# Claude Code Implementation Prompt — Hypertension Characterization Study (V2)

**Date:** 2026-04-18
**Author:** Sanjay M. Udoshi, MD (PI)
**Study PI:** Glenn H. Bock, MD
**Protocol version:** V2 (Dr. Bock revision dated 2026-04-17, imported 2026-04-18)
**Study type:** Retrospective characterization (OHDSI Characterization / Drug Utilization hybrid)
**Status:** Draft spec ready for Claude Code execution

Copy everything below the horizontal rule into a fresh Claude Code session running inside the Parthenon repo. The prompt is fully self-contained — it assumes only that Claude Code has read access to `CLAUDE.md`, `.claude/rules/HIGHSEC.spec.md`, and the working tree.

## Changes from V1 (2026-04-17 → V2 2026-04-18)

1. **New scientific anchor.** Lu et al. 2025 (median 16–18 month diagnostic delay; 29 % higher CV risk score when delay > 1 year) is now cited as the explicit benchmark. The study's primary hypothesis is reframed as a reproducibility/extension of Lu et al. with a matched normotensive comparator.
2. **Principal Goals restructured.** V1's single flat 5-goal list is replaced by **one Primary Goal** ("identify prevalence, characteristics, primary antihypertensive drug selection, and diagnostic timeliness of all HTN in a large general cohort, retrospectively") plus a **new Secondary Goals section** with seven explicit aims covering Lu et al. reproducibility, delayed-diagnosis characterization, lab ordering frequency (including serum aldosterone), drug-class timing, and resistant-HTN composition.
3. **Two-consecutive-readings threshold.** Cohort inclusion and prevalence calculation now require SBP > 130 OR DBP > 80 **on two consecutive recordings** (V1 required an average across ≥3 readings). Circe criterion tightened.
4. **Aldosterone and hyperaldosteronism.** Serum aldosterone added to baseline labs; new concept sets `labs_aldosterone` and `htn_primary_aldosteronism` added. The paragraph on emerging recognition of hyperaldosteronism as an underlying cause is reflected in the sensitivity analyses.
5. **Kidney disease added to outcomes.** CKD incidence joins MACE as a primary outcome; new cohort `O4 — CKD incidence` added.
6. **Diagnostic latency now reports two intervals.** Analysis C produces (a) first-elevated → second-elevated BP, and (b) second-elevated → recorded diagnosis. Plus a Lu-et-al.-style comparator analysis vs. the matched normotensive C cohort.
7. **Treatment-trajectory expansions.** Analysis D now reports drug class at the moment of diagnosis and the time from diagnosis to first antihypertensive prescription. The resistant-HTN subgroup (S1) output is expanded to include drug-class composition breakdown.
8. **Lab ordering frequency.** Analyses now capture both the frequency of lab ordering and the values themselves at diagnosis, not just the values.
9. **CV event categorization.** Outcome cohorts record event type (MI vs stroke vs HF vs death) and time, not just time.
10. **Minor wording alignments** to match V2 protocol ("recorded in the medical record," "> 130 or > 80" instead of "and/or," "kidney disease" added to modifiable consequences).

---

## PROMPT START

You are implementing an end-to-end observational hypertension characterization study inside the Parthenon platform. The study was authored by Glenn H. Bock, MD ("DRAFT: Characterization of hypertension in a large study population (V2)", 04/17/2026, imported 04/18/2026). Read `docs/devlog/modules/STUDIES.md`, `docs/devlog/modules/analyses/`, and `CLAUDE.md` before writing any code. Query the Parthenon Brain (`parthenon-brain` MCP, collections `parthenon_docs` and `parthenon_code`) for prior art on:

- "study creation workflow"
- "cohort definition Circe JSON generator"
- "concept set Laravel model"
- "Achilles characterization SQL templates"
- "HADES PatientLevelPrediction R plumber endpoint"
- "results dashboard React components"

Do not reinvent patterns that already exist. Extend them.

### 0. Scope & Guardrails

**You MUST:**

- Follow `.claude/rules/HIGHSEC.spec.md` — every route behind `auth:sanctum`, every research endpoint behind `permission:studies.*` or `permission:cohorts.*`, no `$guarded = []`, no unauthenticated clinical data, CdmModel subclasses remain read-only.
- Use the existing 8 Laravel connections — write clinical reads against `omop` / `synpuf` / `irsf` / `pancreas` / `inpatient` (do NOT invent a `cdm` or `docker_pg` connection). Vocabulary joins use the shared `vocab` schema via `search_path`; in SQL templates use `{@cdmSchema}` and `{@vocabSchema}`.
- Run Docker Pint, PHPStan level 8, `tsc --noEmit`, `vite build`, ESLint (staged), and Vitest (`--changed`) before every commit. The pre-commit hook will enforce this; do not bypass with `--no-verify`.
- Cast Recharts tooltip formatters as `never`. Use `Pick<T, ...>` for subset component props. Use `--legacy-peer-deps` for npm installs.
- Write feature code into the existing `studies` module scaffolding (`backend/app/Models/*`, `backend/app/Services/*`, `backend/app/Http/Controllers/Api/V1/*`, `frontend/src/features/studies/`). Do not create a sibling module.

**You MUST NOT:**

- Hardcode concept IDs inline in SQL — all concepts live in concept sets (`app.concept_sets` + `app.concept_set_items`) resolved through the ConceptSetExpressionService.
- Touch the auth system (`.claude/rules/auth-system.md`). No changes to AuthController, LoginPage, ChangePasswordModal, or the temp-password flow.
- Store PHI in logs, dev fixtures, or brain ingestion output.
- Emit `any` in TypeScript. Emit `unknown` and narrow with Zod.

### 1. Clinical Summary (authoritative source of truth)

The PI's intent, condensed for implementers:

**Scientific anchor (Lu et al. 2025).** A 2025 retrospective study (Lu et al.) found a median delay of 16–18 months between two documented elevated BPs and a recorded HTN diagnosis. Patients with > 1-year delays had a 29 % higher cardiovascular risk score and elevated rates of adverse cardiac and cerebrovascular events. Lu et al. lacked a matched non-hypertensive comparator and did not break out antihypertensive classes. The primary hypothesis for this study is to **reproduce and extend Lu et al. with a matched normotensive comparator, a full drug-class breakdown, and the addition of serum aldosterone to the baseline lab panel** (emerging evidence implicates hyperaldosteronism as an under-recognized cause of otherwise-unexplained HTN).

**Population.** Adults ≥18 at index, any gender, with ≥3 recorded BPs in the 24 months preceding index, whose SBP > 130 mmHg OR DBP > 80 mmHg **on two consecutive recordings** (2017 ACC/AHA Stage 1+). At index they must have NO prior cardiovascular disease (MI, HF, stroke, PAD, revascularization), NO abnormal kidney function (CKD stage ≥3 or eGFR < 60 on ≥2 occasions 90 days apart), NO thyroid disease (hypo- or hyper-), and NO prior antihypertensive exposure.

**Index event.** Earliest qualifying condition_occurrence of Essential Hypertension (SNOMED 59621000 and descendants) OR the earliest date at which two **consecutive** measurements cross the Stage 1 threshold, whichever comes first. Record BOTH timestamps plus the first-elevated-BP date and expose all three so Analysis C can compute two intervals. Modifiable downstream risk includes cardiovascular disease, **kidney disease**, and stroke.

**Primary goal.** Identify the prevalence, characteristics, primary antihypertensive drug selection, and diagnostic timeliness of all HTN in a large general cohort, retrospectively.

**Secondary goals.**

1. Reproduce Lu et al.'s findings on diagnostic onset delays and subsequent morbidity/mortality, now with a matched normotensive comparator (cohort C).
2. Characterize the delayed-diagnosis subgroup: anthropometrics, region of residence, number of distinct sites entering BPs into the record, frequency of ABPM use.
3. At diagnosis (within ±2 weeks of the recorded diagnosis date), capture the frequency of ordering AND the results of CBC, CMP, lipid profile, and **serum aldosterone**.
4. Determine the type and class of the primary antihypertensive prescribed after diagnosis and the time from diagnosis to first prescription.
5. Among all treated patients, count those whose BP remained elevated while on ≥3 antihypertensive agents; for that resistant-HTN subgroup (S1), report the composition of their antihypertensive classes.
6. Determine the frequency of documented home/ABPM use and compare to office BP within the same 30-day window.
7. Align serial BPs to initial and subsequent medication/class changes, and identify patients receiving renal denervation with BP trajectories at 1, 3, 6, and 12 months.

**Goal-to-analysis mapping.**

- Primary goal → Analyses A (Incidence), B (Device Utilization), C (Diagnostic Latency), D (Treatment Trajectory).
- Secondary #1 → Analysis C Lu-replication sub-analysis + Analyses F (Comorbidity Incidence) and G (Survival) stratified by latency tertile.
- Secondary #2 → Analysis H (Geographic / Density Stratification) restricted to the delayed-diagnosis stratum.
- Secondary #3 → new Analysis J (Baseline Lab Ordering) — see §4.
- Secondary #4 → Analysis D (drug-class timing component).
- Secondary #5 → Analysis D (resistant-HTN S1 composition breakdown).
- Secondary #6 → Analysis B.
- Secondary #7 → Analyses D and E (RDN Sub-cohort).

**Secondary characterization:** age/sex/race/region/anthropometrics, baseline labs (CBC, CMP, lipid panel, **serum aldosterone**), renal/cardiac/carotid imaging and function, comorbidity onset after index (including **incident CKD** as a primary outcome), all-cause mortality with HTN stage at last known BP.

**Stratifiers:** demographics, population density (rural vs urban from the GIS module), HTN stage at index, number of concurrent antihypertensives, presence of treatment-resistant HTN (≥3 agents including a diuretic with SBP ≥130 or DBP ≥80), and **diagnostic-latency tertile** (time from second-elevated BP to recorded diagnosis).

### 2. Phenotype Assets — Concept Sets

Create the following concept sets via `php artisan tinker` seed command `studies:seed-hypertension-characterization`. Each set must be saved as an `app.concept_sets` row with a `json_expression` (OHDSI Circe format) so it resolves to a stable list via `concept_ancestor`. Use descendants (`includeDescendants: true`) where noted.

| Concept set name | Vocabularies | Seed concepts (descendants?) | Purpose |
|---|---|---|---|
| `htn_essential` | SNOMED | 320128 *Essential hypertension* (+desc) | Target diagnosis |
| `htn_secondary` | SNOMED | 442604 *Secondary hypertension* (+desc) | Exclude / sensitivity |
| `htn_resistant` | SNOMED | 45766159 *Resistant hypertension* (+desc) | Subgroup |
| `htn_primary_aldosteronism` | SNOMED | 4022502 *Primary hyperaldosteronism* (+desc) | Secondary HTN sensitivity — emerging cause |
| `bp_systolic_office` | LOINC | 3004249, 8480-6, 8460-8, 35094-2, 18770-1 (+desc) | SBP office |
| `bp_diastolic_office` | LOINC | 3012888, 8462-4, 8453-3, 35094-2, 18771-9 (+desc) | DBP office |
| `bp_systolic_home` | LOINC | 72076-3, 97522-9, 96607-9 (+desc) | Home SBP |
| `bp_diastolic_home` | LOINC | 72075-5, 97521-1, 96608-7 (+desc) | Home DBP |
| `bp_abpm` | LOINC | 96609-5, 96610-3, 96611-1 (+desc) | Ambulatory BPM |
| `anthro_height` | LOINC | 3036277, 8302-2 (+desc) | Height |
| `anthro_weight` | LOINC | 3025315, 29463-7 (+desc) | Weight |
| `anthro_bmi` | LOINC | 3038553, 39156-5 (+desc) | BMI |
| `anthro_waist` | LOINC | 3043340, 8280-0 (+desc) | Waist circumference |
| `labs_cbc` | LOINC | 57021-8, 58410-2 (+desc) | CBC panel |
| `labs_cmp` | LOINC | 24323-8, 34566-0 (+desc) | CMP panel |
| `labs_lipid` | LOINC | 57698-3, 24331-1 (+desc) | Lipid panel |
| `labs_egfr` | LOINC | 98979-8, 62238-1, 33914-3 (+desc) | eGFR |
| `labs_tsh` | LOINC | 3009201, 11580-8 (+desc) | TSH |
| `labs_aldosterone` | LOINC | 1763-2 *Aldosterone (serum)*, 14959-1 *Aldosterone/Renin ratio* (+desc) | Hyperaldosteronism workup |
| `imaging_renal` | SNOMED/CPT4/HCPCS | Renal US, CT abdo/renal, MRA renal | Renal imaging |
| `imaging_cardiac` | SNOMED/CPT4 | Echo, cardiac MRI, stress test | Cardiac imaging |
| `imaging_carotid` | SNOMED/CPT4 | Carotid duplex US | Carotid imaging |
| `drugs_htn_thiazide` | RxNorm ingredients | hydrochlorothiazide, chlorthalidone, indapamide (+desc) | Thiazide diuretic |
| `drugs_htn_loop` | RxNorm | furosemide, torsemide, bumetanide (+desc) | Loop diuretic |
| `drugs_htn_k_sparing` | RxNorm | spironolactone, eplerenone, amiloride, triamterene (+desc) | K-sparing diuretic |
| `drugs_htn_acei` | RxNorm | lisinopril, enalapril, ramipril, benazepril, etc. (+desc) | ACE inhibitor |
| `drugs_htn_arb` | RxNorm | losartan, valsartan, olmesartan, telmisartan, etc. (+desc) | ARB |
| `drugs_htn_ccb_dhp` | RxNorm | amlodipine, nifedipine, felodipine, nicardipine (+desc) | Dihydropyridine CCB |
| `drugs_htn_ccb_nondhp` | RxNorm | diltiazem, verapamil (+desc) | Non-DHP CCB |
| `drugs_htn_beta` | RxNorm | metoprolol, atenolol, carvedilol, bisoprolol, propranolol (+desc) | Beta-blocker |
| `drugs_htn_alpha` | RxNorm | doxazosin, prazosin, terazosin (+desc) | Alpha-blocker |
| `drugs_htn_central` | RxNorm | clonidine, methyldopa, guanfacine (+desc) | Central alpha-agonist |
| `drugs_htn_vasodilator` | RxNorm | hydralazine, minoxidil (+desc) | Direct vasodilator |
| `drugs_htn_ras_other` | RxNorm | aliskiren, sacubitril/valsartan (+desc) | Other RAS |
| `cvd_mi` | SNOMED | 4329847 *MI* (+desc) | CV exclusion & outcome |
| `cvd_stroke` | SNOMED | 443454 *Cerebral infarction* + 4043731 *Hemorrhagic stroke* (+desc) | CV exclusion & outcome |
| `cvd_hf` | SNOMED | 316139 *Heart failure* (+desc) | CV exclusion & outcome |
| `cvd_pad` | SNOMED | 321588 *Peripheral vascular disease* (+desc) | CV exclusion |
| `cvd_revasc` | SNOMED/CPT4 | CABG, PCI (+desc) | CV exclusion |
| `ckd_stage3plus` | SNOMED | 46271022 *CKD stage 3*, 443612 *CKD 4*, 443611 *CKD 5* (+desc) | Renal exclusion |
| `thyroid_any` | SNOMED | 140673 *Hypothyroidism*, 134442 *Hyperthyroidism* (+desc) | Thyroid exclusion |
| `proc_renal_denervation` | CPT4/HCPCS/SNOMED | 0338T, 0339T, 2107195 *Renal sympathetic nerve ablation* (+desc) | Analysis E target |
| `proc_renal_angio` | CPT4 | 36251–36254, 37236 (+desc) | Treatment trajectory |
| `proc_cardiac_angio` | CPT4 | 93454–93461 (+desc) | Treatment trajectory |

Validate every seed concept ID by running:
```sql
SELECT concept_id, concept_name, vocabulary_id, standard_concept
FROM vocab.concept
WHERE concept_id IN (...);
```
against the `omop` connection. If any seed is non-standard, map to its standard replacement via `concept_relationship` (`Maps to`) before inserting. Log every substitution in the seeder's output.

Place the seeder at `backend/database/seeders/HypertensionStudy/ConceptSetSeeder.php`. Wire it into an Artisan command `studies:seed-hypertension-characterization` at `backend/app/Console/Commands/SeedHypertensionStudy.php` so it's idempotent (use `updateOrCreate` keyed on `name`).

### 3. Cohort Definitions (Circe JSON)

Generate the following cohort definitions as Circe JSON expressions and persist them via the existing `CohortDefinitionService::createFromJson()` path. Each definition must round-trip through `results.cohort` generation on the `omop` source before any analysis runs. Place all JSON under `backend/database/seeders/HypertensionStudy/cohorts/`.

**T — Target cohort: Incident Hypertension (no-prior-CVD, treatment-naive)**
- Primary criteria: first occurrence of `htn_essential` recorded in the medical record OR the earliest date at which **two consecutive BP measurements** (on distinct calendar days) both show SBP > 130 OR DBP > 80 within a 24-month lookback that also contains ≥ 3 total readings, whichever is earliest. Index date = min of the two. Record all three reference dates: `first_elevated_bp_date`, `second_elevated_bp_date`, `htn_diagnosis_date`.
- Observation: ≥365d prior observation, ≥365d subsequent observation (or censor at end of observation).
- Inclusion criteria (all must hold at index):
  1. Age ≥ 18 at index.
  2. ≥ 3 BP measurements from `bp_systolic_office` ∪ `bp_diastolic_office` in the 24 months preceding index, on ≥ 2 distinct calendar days.
  3. **Two consecutive** office BP recordings (chronologically adjacent, on distinct days) with SBP > 130 OR DBP > 80 (use `MeasurementValueAsNumber`). The second of the two pins the qualifying-BP threshold-crossing date.
- Exclusion criteria (any triggers exclusion; evaluate in 365d pre-index unless noted):
  1. Any `cvd_mi`, `cvd_stroke`, `cvd_hf`, `cvd_pad`, `cvd_revasc` at any time before index.
  2. ≥1 `ckd_stage3plus` concept at any time before index, OR ≥2 `labs_egfr` measurements with `value_as_number < 60` separated by ≥90d before index.
  3. Any `thyroid_any` at any time before index.
  4. Any drug_exposure in `drugs_htn_*` concept sets at any time before index.
  5. Any `htn_secondary` at any time before index.
- End date strategy: all days from index to end of continuous observation.
- File: `cohorts/target_incident_htn.json`.

**C — Matched comparator cohort: Non-hypertensive adults**
- Patients with ≥3 BP measurements in 24 months, average SBP ≤ 120 and DBP ≤ 80, same exclusions as T (no prior CVD, CKD, thyroid disease, antihypertensives, HTN diagnosis).
- 1:1 propensity-score-matched by age (±3y), sex, race, ethnicity, observation length, year of index, prior healthcare utilization (Charlson components excluding CVD), BMI stratum.
- File: `cohorts/comparator_normotensive.json`.

**O1 — Outcome: Incident MACE** (`cvd_mi` ∪ `cvd_stroke` ∪ `cvd_hf` ∪ cardiovascular death) after index. Capture event **type** and **time**, not just time.
**O2 — Outcome: All-cause mortality** (death table). File: `cohorts/outcome_all_cause_mortality.json`.
**O3 — Outcome: New comorbidity onset** — one cohort per comorbidity concept set, generated programmatically.
**O4 — Outcome: Incident CKD** — first qualifying `ckd_stage3plus` concept OR two `labs_egfr` measurements < 60 mL/min/1.73 m² separated by ≥ 90 days, after index. File: `cohorts/outcome_incident_ckd.json`. CKD is now co-equal with MACE as a primary outcome (V2 protocol adds kidney disease to the modifiable-consequences triad).
**S1 — Subgroup: Resistant HTN** — patients on ≥3 concurrent antihypertensive classes (one must be a diuretic) with SBP ≥130 or DBP ≥80 on ≥2 visits ≥1 month apart, computed on the T cohort. File: `cohorts/subgroup_resistant_htn.json`.
**S2 — Subgroup: RDN recipients** — T cohort ∩ any `proc_renal_denervation` procedure_occurrence after index. File: `cohorts/subgroup_rdn.json`.
**S3 — Subgroup: Home/ABPM device users** — T cohort ∩ any `bp_abpm` ∪ `bp_systolic_home` ∪ `bp_diastolic_home` measurement. File: `cohorts/subgroup_home_monitoring.json`.

Each Circe JSON must pass Parthenon's existing validator (`app/Services/Cohort/CircleValidator.php` or equivalent — confirm exact path). Generate the SQL with the existing Circe→SQL translator and dry-run against `synpuf` (smaller) before generating on `omop`.

### 4. Study Record & Analyses

Create one `studies.studies` row using the `StudyService::create()` method:

```
title: "Characterization of Incident Hypertension in a Large Study Population"
short_title: "HTN-CHAR-2026"
slug: "htn-characterization-2026"
study_type: "characterization"
study_design: "cohort"
status: "draft"
phase: "pre_study"
priority: "high"
principal_investigator_id: <Glenn Bock user id — resolve by email or create placeholder>
description: <full text from the draft protocol, copy verbatim into the description column>
primary_objective: <verbatim "Principal goals" block>
secondary_objectives: <verbatim "Principal outcomes" list as JSON array>
tags: ["hypertension", "characterization", "retrospective", "cardiovascular", "renal-denervation"]
settings: {
  "index_rule": "earliest_of_diagnosis_or_bp_threshold",
  "stage_thresholds": { "stage1_sbp": 130, "stage1_dbp": 80, "stage2_sbp": 140, "stage2_dbp": 90, "stage3_sbp": 180, "stage3_dbp": 120 },
  "rolling_window_months": 24,
  "min_measurements": 3,
  "follow_up_censor": "observation_end_or_death",
  "resistant_htn_definition": "three_plus_classes_with_diuretic_uncontrolled"
}
```

Attach the concept sets, cohorts, and team members via `study_cohorts`, `study_concept_sets`, and `study_team_members`. Assign Dr. Bock as PI, Dr. Udoshi as co-investigator. Sites: start with `Acumenus` (omop), `SynPUF` (synpuf) as data partners in `study_sites` status = `executing`.

Create `studies.study_analyses` rows (one per analysis below), each with `analysis_type`, `specification_json`, and status `draft`:

**Analysis A — Incidence of Stage 1+ HTN.**
Annual incidence rate per 1000 person-years, stratified by age-sex-race-region, calendar year of index 2015–2025. Implementation: use the Achilles Incidence query family (see `scripts/achilles/` and `r-runtime/` Achilles port) parameterized by cohort T and the full `omop` + `synpuf` denominator. Confidence intervals via Poisson exact.

**Analysis B — BP device utilization.**
For T cohort, compute: (a) % ever with a home BP measurement, (b) % with ABPM, (c) median count of home readings per patient-year, (d) mean SBP/DBP difference between office and home within the same 30-day window (office − home). Stratify by HTN stage at index and by population density tertile (join `gis.person_geography` on person_id, bin by `zcta_population_density`).

**Analysis C — Diagnostic latency (Lu-replication core).**
For each T patient compute **two** intervals:
- `days_first_to_second_elevated_bp` — the gap between the first office BP that crossed the Stage 1 threshold and the second consecutive elevated BP that satisfied the inclusion criterion.
- `days_second_elevated_to_recorded_diagnosis` — the gap from that second-elevated BP to the first recorded diagnosis of HTN in the medical record.

Report median/IQR for both overall, by stage at index, by age band, and by rural vs urban (GIS classification). Kaplan-Meier of time-from-second-elevated-to-diagnosis.

Add a **Lu-replication sub-analysis**: stratify T into latency tertiles (≤ 6 mo, 6–12 mo, > 12 mo) and compare CV risk score, MACE incidence (O1), and incident CKD (O4) across tertiles vs. the matched normotensive comparator C. Report HRs (95 % CI) — Lu et al. reported a 29 % CV-risk-score increase in the > 12 mo group; record whether our cohort reproduces this.

**Analysis D — Treatment trajectory.**
Use the existing `DrugEraBuilder` to construct continuous eras per RxNorm ingredient. For each T patient, produce an ordered timeline of (era_start, era_end, class). Build state-transition diagrams (first-line → second-line → third-line) using the class buckets defined in §2. Co-register BP measurements within ±30 d of each era boundary. Output: Sankey diagram data + per-regimen mean BP trajectory (weeks −12 to +52 relative to era start).

V2 additions to Analysis D:
1. **Drug class at diagnosis.** For each T patient, report the drug class of the first antihypertensive prescribed within ±2 weeks of `htn_diagnosis_date`, plus the count and class distribution of patients with **no** antihypertensive within 90 days post-diagnosis.
2. **Time from diagnosis to first prescription.** Report median/IQR `days_from_diagnosis_to_first_antihtn_rx`, stratified by stage at index and by rural vs urban.
3. **Resistant-HTN composition (S1).** For the resistant-HTN subgroup, report the full multiset of drug classes per patient (e.g., "ACEi + thiazide + CCB-DHP" frequencies), the prevalence of each individual class, the prevalence of patients on a mineralocorticoid receptor antagonist, and the count of patients with no diuretic in their regimen despite ≥ 3 agents.
4. **BP-vs-medication co-registration window.** Report mean SBP/DBP in the 30 days before and the 30 days after each regimen change.

**Analysis E — Renal denervation sub-cohort.**
For S2, compute office SBP/DBP at pre-procedure baseline (mean of last 3 in 90d pre-procedure) and at 1, 3, 6, 12 months (±30d window). Compare to matched non-RDN resistant-HTN patients (S1 minus S2). Primary endpoint: change in office SBP at 6 months. Secondary: change in 24-hour mean SBP for the ABPM subset. Use a linear mixed model with random intercept per patient (HADES `PatientLevelPrediction` is not required; use R `lme4` via the plumber API — add an endpoint `/mixed-model/fit` if absent).

**Analysis F — Comorbidity incidence after index.**
For each O3 outcome cohort, compute incidence in T vs C with Cox proportional hazards adjusted for the baseline covariates of §3. Output HR (95% CI).

**Analysis G — Survival and stage at last known BP.**
Kaplan-Meier all-cause mortality by HTN stage category at last recorded BP. Log-rank p-value. Cox PH with stage as time-varying covariate.

**Analysis H — Geographic / density stratification.**
Join T with `gis.person_geography` to classify by urban/suburban/rural (USDA RUCA codes) and population density quartiles. Produce choropleth-ready aggregates at county and state level (suppress any cell n < 11 per small-cell rule). Hand off to the GIS Explorer module via its existing `GisAggregateService`.

**Analysis I — Incremental cost estimate (exploratory).**
If claims data is linked (check `claims` Solr core and `heor` module), compute mean annualized total allowed amount for T vs C, stratified by stage. Tag as exploratory; do not present as primary.

**Analysis J — Baseline lab ordering (NEW in V2).**
For every T patient, within ± 2 weeks of `htn_diagnosis_date`, report:
- the **frequency** with which each panel was ordered: CBC, CMP, lipid panel, eGFR, TSH, **serum aldosterone** (and aldosterone/renin ratio when available);
- the **value** distribution (median, IQR, % abnormal) for each ordered panel;
- the rate of `htn_primary_aldosteronism` diagnoses subsequently recorded within 12 months of an aldosterone order.

This analysis directly addresses Secondary Goal #3 and supports the hyperaldosteronism sensitivity arm. Stratify by region/density and by latency tertile.

### 5. Backend Implementation Checklist

1. **Migrations.** If new columns are needed on `studies.*` (e.g., `studies.studies.settings` is already jsonb — verify), write additive migrations only. Do not alter existing columns destructively.
2. **Models.**
   - `App\Models\Studies\HypertensionStudySettings` — typed DTO (not an Eloquent model) that hydrates from `studies.settings`. Strict types, PHPStan-clean.
   - Extend `App\Services\Cohort\CohortBuildService` if needed for the "rolling 24-month mean" criterion — this is not in stock Circe. Add a custom criterion renderer and register it in the Circe translator.
3. **Services.**
   - `App\Services\Studies\Hypertension\IndexEventResolver` — resolves index date given diagnosis + rolling-mean crossover.
   - `App\Services\Studies\Hypertension\TreatmentTrajectoryService` — builds drug-class timelines and merges BP co-registration.
   - `App\Services\Studies\Hypertension\ResistantHtnClassifier` — computes S1 membership from drug eras + BP measurements.
   - `App\Services\Studies\Hypertension\RenalDenervationAnalyzer` — calls the R runtime `lme4` endpoint, persists results.
4. **Jobs.**
   - `App\Jobs\Studies\Hypertension\GenerateAllCohortsJob` — generates T, C, O1–O3, S1–S3 on all configured sources. Chain with `Bus::chain()`.
   - `App\Jobs\Studies\Hypertension\RunCharacterizationJob` — runs Achilles-style queries and writes to `studies.study_results`.
   - `App\Jobs\Studies\Hypertension\RunEffectEstimationJob` — runs Cox PH and mixed models via R.
   - All jobs dispatch on the `analytics` queue, honor Horizon supervisors, and implement `$timeout = 3600` + `tries = 2`.
5. **Controllers.**
   - `App\Http\Controllers\Api\V1\Studies\HypertensionCharacterizationController` — thin controller exposing:
     - `GET /api/v1/studies/{study}/hypertension/summary` → aggregate KPIs
     - `GET /api/v1/studies/{study}/hypertension/trajectories` → per-class BP trajectory data
     - `GET /api/v1/studies/{study}/hypertension/rdn` → RDN pre/post results
     - `GET /api/v1/studies/{study}/hypertension/geography` → density/urbanicity aggregates
     - `POST /api/v1/studies/{study}/hypertension/regenerate` → queues GenerateAllCohortsJob
   - Every route: `auth:sanctum` + `permission:studies.view` (reads) or `permission:studies.execute` (regenerate).
6. **Form Requests.** One per write endpoint. Validate study scope (user must be a team member).
7. **Policies.** `HypertensionAnalysisPolicy` — scoped by `study_team_members`.
8. **OpenAPI.** Annotate controllers with `#[OA\*]` attributes so `./deploy.sh --openapi` regenerates `frontend/src/types/api.generated.ts`.
9. **Tests (Pest).**
   - Unit: `IndexEventResolverTest`, `ResistantHtnClassifierTest`, `TreatmentTrajectoryServiceTest` — deterministic fixtures against the `eunomia` schema (GiBleed demo). Seed a handful of synthetic HTN patients.
   - Feature: `HypertensionCharacterizationControllerTest` — route auth, RBAC, happy path, permission denial, 404 when study does not exist.
   - Integration: `GenerateAllCohortsJobTest` with a miniature cohort on `eunomia`.

### 6. R Runtime Contribution

In `r-runtime/`:

1. Add `analyses/hypertension_mixed_model.R` implementing `fit_bp_mixed_model(data, outcome = "sbp")` using `lme4::lmer(value ~ timepoint + (1 | person_id))`. Return coefficients, CIs, residual SD, model AIC.
2. Add `analyses/hypertension_cox.R` wrapping `survival::coxph` for the comorbidity/mortality analyses.
3. Register both in `plumber_api.R`:
   - `POST /hypertension/mixed-model` { rows: [...] } → JSON result.
   - `POST /hypertension/cox` { subjects: [...], covariates: [...] } → JSON result.
4. Add container health check assertion: new endpoints respond within the 60s HADES startup budget.

### 7. AI Service (Python)

Add an Abby capability so researchers can ask natural-language questions over this study:

1. New FastAPI router `ai/app/routers/htn_characterization.py` with `/htn/summary-nl`, `/htn/compare-classes`, `/htn/explain-finding`.
2. Tools exposed to MedGemma:
   - `get_htn_kpis(study_id)` → calls Laravel `/summary` endpoint.
   - `get_class_trajectory(study_id, drug_class)` → trajectory series.
   - `get_rdn_effect(study_id)` → RDN results.
3. Guardrails: every tool enforces `permission:studies.view` via the authenticated-forward JWT. No PHI leaks — aggregates only, small-cell suppression at n < 11.
4. pytest: mocked Laravel client, verify the 3 tools correctly format prompts and respect small-cell suppression.

### 8. Solr

Add a "study" document type representing this study in the `query_library` configset so researchers can find Bock's HTN study via the global search. Index: title, short_title, tags, team member names, status, updated_at. Reindex on study changes via an observer.

### 9. Frontend — Studies Module Feature

Create `frontend/src/features/studies/pages/HypertensionCharacterizationPage.tsx` (route: `/studies/:studyId/hypertension`). Sections:

1. **Header.** Study title, status chip, PI avatar, team list, last regeneration timestamp, "Regenerate cohorts" button (gated on `studies.execute`).
2. **Overview KPIs.** 6 stat cards: N in T cohort, N in C cohort, median age, % female, median follow-up (years), MACE events observed.
3. **Incidence by year.** Line chart (Recharts `LineChart`), x = year, y = rate per 1000 PY, stratified series by age band.
4. **Diagnostic latency distribution.** Histogram + KM time-to-diagnosis curve.
5. **Device utilization.** Paired bar (office vs home vs ABPM) + scatter of office-home BP delta.
6. **Treatment trajectory.** Sankey diagram (use `@nivo/sankey` or lightweight custom — check registry for `@nivo` being on the approved list; if not, implement with d3-sankey already available as a transitive dep). Per-class BP trajectory selectable via dropdown.
7. **Resistant HTN.** Stacked bar by number of concurrent classes + prevalence by region.
8. **RDN sub-cohort.** Pre/post line plot with 95% CI band, forest plot of SBP change at 1/3/6/12 months.
9. **Geography.** Embed the GIS Explorer in `iframe`-free mode using the `<GisChoropleth />` component from the gis feature. Urbanicity and density stratifiers.
10. **Comorbidity HRs.** Forest plot.
11. **Survival.** KM curves by HTN stage + Cox HR table.
12. **Export.** Buttons: "Download protocol PDF", "Download results workbook (xlsx)", "Publish to Studies catalog".

**Component architecture.**
- `features/studies/hypertension/` subfolder.
  - `api.ts` — TanStack Query hooks (`useHtnSummary`, `useHtnTrajectories`, `useHtnRdn`, `useHtnGeography`, `useRegenerateHtn`).
  - `components/` — each visualization as its own component. Props via `Pick<ApiResponse, ...>`.
  - `store.ts` — Zustand slice for local UI state (selected drug class, selected timepoint, geography filter).
  - `schemas.ts` — Zod schemas mirroring the API contract, imported by `api.ts`.
- Recharts tooltip formatters cast as `never`.
- All strings go through the existing i18n helper.
- Dark clinical theme tokens (#0E0E11, #9B1B30, #C9A227, #2DD4BF).

### 10. Docs & Protocol Artifacts

1. `docs/studies/hypertension-characterization/protocol.md` — protocol converted from Dr. Bock's docx, using the Acumenus brand Markdown-to-docx/PDF pipeline (see `brand_system.md` in memory).
2. `docs/studies/hypertension-characterization/analysis-plan.md` — this spec trimmed to implementer-agnostic language.
3. `docs/studies/hypertension-characterization/concept-sets.md` — rendered table of every concept set with resolved concept counts.
4. `docs/studies/hypertension-characterization/phenotype-diagram.mermaid` — flow diagram of T/C/O/S cohort logic.
5. `docs/devlog/modules/studies/2026-04-17-htn-characterization-implementation.md` — implementation devlog in the standard format.
6. Trigger the Parthenon Brain post-commit ingestion so the study is immediately queryable.

### 11. Seeding, Running & Verification

Provide a one-shot command that brings the study up end-to-end on a fresh dev environment:

```bash
php artisan studies:seed-hypertension-characterization
php artisan studies:generate-cohorts --study=htn-characterization-2026 --source=synpuf
php artisan studies:run-characterization --study=htn-characterization-2026 --source=synpuf
./deploy.sh --frontend
```

Validation checklist Claude Code must report before declaring done:

- [ ] `make lint` passes (Pint, PHPStan 8, ESLint, tsc, mypy).
- [ ] `make test` passes, including the new Pest/Vitest/pytest cases.
- [ ] `npx vite build` exits 0.
- [ ] `php artisan route:list --path=hypertension` shows every new route with `auth:sanctum` and the correct permission middleware.
- [ ] A smoke run on `synpuf` completes the full pipeline in < 30 minutes on the standard dev box.
- [ ] The Studies page at `/studies/htn-characterization-2026/hypertension` renders all sections with real data from synpuf.
- [ ] Small-cell suppression (n < 11) is visibly enforced in the geography panel.
- [ ] No `$guarded = []`, no `any` types, no secrets committed.
- [ ] OpenAPI regenerated and `frontend/src/types/api.generated.ts` updated.
- [ ] Pre-commit hook runs clean; no `--no-verify`.

### 12. Commit Strategy

Work in a single feature branch `feature/htn-characterization-study`. Commit sequence (conventional commits):

1. `feat(studies): seed HTN characterization concept sets`
2. `feat(studies): add HTN cohort definitions (T, C, O1-O3, S1-S3)`
3. `feat(studies): index event resolver and rolling-mean criterion`
4. `feat(studies): treatment trajectory service + resistant HTN classifier`
5. `feat(r): mixed-model and cox endpoints for HTN analyses`
6. `feat(api): HTN characterization controller and jobs`
7. `feat(ai): Abby tools for HTN study Q&A`
8. `feat(ui): HTN characterization dashboard`
9. `docs: HTN characterization protocol, analysis plan, devlog`
10. `test: HTN study end-to-end coverage`

Open a PR against `main` with the generated analysis plan, sample screenshots of the dashboard running on synpuf, and a runtime summary from the smoke run.

### 13. Open Questions to Raise Back to Dr. Bock (do NOT block on these — document them in the PR description)

1. Preferred definition of "region" — HHS region, US Census division, state, or CBSA?
2. Should Stage 1 by home BP (≥130/80 by 2017 ACC/AHA) also qualify for index even absent office confirmation?
3. Minimum follow-up for inclusion in the RDN cohort (1, 3, 6, or 12 months)?
4. Is secondary HTN (`htn_secondary`) an exclusion or a separate sensitivity cohort? (V2 adds `htn_primary_aldosteronism` as a distinct sensitivity arm — same question: exclude from T, or analyze as an overlay?)
5. For cost estimation, which claims source is authoritative (HEOR module vs external)?
6. **[V2]** What exact Lu et al. 2025 citation should anchor the protocol (journal, DOI)? The narrative paragraph references the paper but no bibliographic stub was included.
7. **[V2]** For "two consecutive" BP recordings, is there a maximum allowable gap between the two (e.g., must the second be within 12 months of the first) or is chronological adjacency within the 24-month lookback sufficient?
8. **[V2]** Is "diagnostic latency tertile" the right bucketing (≤ 6 / 6–12 / > 12 mo), or should we use Lu et al.'s exact 16–18 month median as a single cutoff?

### 14. Security & Compliance Re-Check Before Merge

- Run `grep -rn "guarded = \[\]" backend/app/Models/Studies/` → must be empty.
- Run `php artisan route:list --path=hypertension` → every row shows `auth:sanctum`.
- Confirm no concept_id lists, patient IDs, or site-specific descriptors are committed in fixtures. Fixtures must be synthetic (GiBleed/Eunomia or synthesized with `PersonFactory`).
- Confirm `.env` and `backend/.env` remain mode 600; do not write new secrets.
- Confirm no PHI lands in the Parthenon Brain ingest output (grep the vector store's manifest for any person_id after post-commit hook).

### End State

At merge, a logged-in user with `studies.view` permission can navigate to the study, regenerate it against Acumenus or SynPUF, and view the full characterization dashboard with Dr. Bock's 5 principal goals rendered as interactive analyses. A logged-in researcher with `studies.execute` can re-queue the generation. Abby can answer questions like "What was the mean SBP drop at 6 months in the RDN sub-cohort?" using aggregate tool calls.

## PROMPT END
