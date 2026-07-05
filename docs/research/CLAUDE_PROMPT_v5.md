# Claude-Code Prompt — Hypertension Outcomes Program v5 (Protocol #1 executable; Protocol #2 readiness)

**Protocol:** "The failure of hypertension interventions in a large study population (V5)" — Protocol #1 of the consolidated Hypertension Outcomes Program, with the Protocol #2 prospective pilot carried as a readiness workstream.
**PI:** Glenn H. Bock, MD. **Consolidation editor / CMIO:** Sanjay M. Udoshi, MD.
**Doc ID:** ACUM-PROT-HTN-V5-001. **Date:** 2026-07-03.
**Use case:** Retrospective outcomes study against the Acumenus OHDSI CDM, executed inside Parthenon (OMOP CDM v5.4, schema-isolated). Single data source: Acumenus OHDSI CDM (`omop` schema, `omop` connection).
**Mode:** **Extend the existing `htn-v4-bock-2026` study in place.** Do NOT fork a new study container. Reuse valid v4 concept sets, cohorts, and generations; re-lock the analysis plan as **v5.0**; add analyses M, N (from the v4.1 amendment) and O–R (the v5 causal redesign + phenotype stress-test); render a new v5 report.

> Read alongside: `CHANGELOG_v3_to_v4.md`, `CHANGE_REQUEST_v4.1_Bock_2026-05-23.md`, the v4 prompt `CLAUDE_PROMPT.md`, `Hypertension_v4_Consolidated_Acumenus.docx`, and the v5 go-forward doc `Hypertension_v5_GoForward_Acumenus.docx` (ACUM-PROT-HTN-V5-001). This prompt supersedes the analyses section of the v4 prompt and is additive to everything else.

---

## 0 — Mission

The v4 run succeeded on everything except the one contrast that mattered most: **delayed vs timely diagnosis (G4 vs G1) was not estimable** — the propensity model reached AUC 0.7984 with a maximum post-adjustment SMD of 0.2443, so the effect was correctly withheld. v5's mission is to make that causal question answerable without over-claiming, complete the two v4.1 analyses (comorbidity matrix M and BP-distribution N) that never landed in the v4 manuscript, stress-test the 90%-never-diagnosed phenotype, resolve the fourteen open questions with the defaults the PI signs off, and produce the platform's reference validation artifacts.

Concretely, v5:

1. Replaces 1:1 PSM (OQ-5) with **overlap weighting (ATO)** as the primary effect-estimation method for every delay contrast, collapsing the primary exposure to **timely (≤ 3 mo) vs delayed (> 3 mo)** with the four-group gradient retained as a secondary dose-response (Analysis **O**).
2. Adds a **target-trial emulation** of "record HTN diagnosis + initiate antihypertensive within 90 days of index" via **clone-censor-weight with IPCW** (Analysis **P**).
3. Adds a **site diagnostic-propensity instrumental-variable** analysis as a natural experiment robust to unmeasured confounding (Analysis **R**).
4. Adds a **phenotype robustness + quantitative-bias** workstream (index-rule, threshold, surveillance/recording bias, informative-visit, E-values) (Analysis **Q**).
5. Executes **Analysis M** (comorbidity comparison matrix) and **Analysis N** (BP distribution & variance at t1/t2/t_dx) exactly as scoped in the v4.1 change request.
6. Re-estimates the retained effect analyses (C, G, H, F) under the ATO estimand and re-runs negative-control calibration across the expanded FDR family.
7. Re-locks the analysis plan as `analysis_plan_v5.0.lock.json` and records M/N/O–R in the amendment log.

**Baseline facts to preserve (from the v4 manuscript — do not recompute as if unknown; reconcile against them):** T = 109,763; never-diagnosed = 98,769 (90%); diagnosed = 10,994 (G1 139 / G2 284 / G3 675 / G4 9,896); latency_a median 175 d (IQR 84–266); latency_b median 1,106 d (IQR 704–1,862); time-to-first-drug median 1,134 d; MACE 7.00/1k py; CKD 1.67/1k py; ever-treated 18,930 (17.2%); elevated-vs-normotensive calibrated MACE HR 1.03 (0.94–1.14) p 0.50, CKD HR 2.60 (2.01–3.38) p < 0.0001.

> **Live-DB verification (pgsql.acumenus.net · db=parthenon · read-only, 2026-07-03).** All of the above reconciled **exactly** against the production database. Ground truth for the executor:
> - **Study row:** `app.studies.id = 165`, `slug = 'hypertension-study-v4'`, `protocol_version = 'ACUM-PROT-HTN-V4-001'`, `status = 'running'`, `phase = 'analysis'` (NOT `run_complete`; there is no `key = 'htn-v4-bock-2026'` column — the study is identified by `slug`/`id`).
> - **Cohorts (17 rows in `app.study_cohorts`, study_id 165):** T `cohort_definition_id 5441` = 109,763; C `5455` = 37,582; G1 `5450` = 139; G2 `5451` = 284; G3 `5452` = 675; G4 `5453` = 9,896; never-diagnosed `5454` = 98,769; O1 MACE `5426`; O2 CKD `5427`; plus 8 negative-control cohorts. **G1–G4 + never sum to 109,763 exactly.** **No S1 (resistant-HTN) or S2 (renal-denervation) cohort exists** — treat these as net-new builds, not reuse.
> - **Analyses actually executed (`app.study_analyses`, study_id 165):** only **4** — one `Characterization` (Table 1), one `IncidenceRateAnalysis` (MACE/CKD crude rates), and **two** `EstimationAnalysis` rows: result 21 = T(5441)-vs-C(5455) and result 22 = G4(5453)-vs-G1(5450). **Lettered analyses B–L and M/N were never separate executed analyses** — most of the v5 analysis inventory (and all of M/N/O–R) is net-new.
> - **Estimation diagnostics (verbatim from `app.study_results.summary_data`):** result 21 — PS AUC 0.5723, equipoise 0.9884, max |SMD| after 0.0155, EASE 0.0197 (8 NCs); calibrated MACE HR 1.0345 (0.9365–1.1428), CKD HR 2.6024 (2.0065–3.3754). result 22 — PS AUC 0.7984, equipoise 0.9255, **max |SMD| after 0.2443**; only **18 MACE and 26 CKD events total across G1+G4**, and one negative control degenerate (log_rr ≈ 30.9) → diagnostics failed, estimates correctly withheld. The 18/26-event reality is the empirical proof that positivity AND power both fail for a direct G4-vs-G1 contrast — the core motivation for O/P/R.
> - **`app.study_artifacts` for study 165 = 0 rows** → no `analysis_plan.lock` was ever persisted. The v5 `lock` step is therefore a first-time write, not a re-issue.
> - **Source CDM:** `omop.person` ≈ 1,005,788; `omop.measurement` ≈ 710M; `omop.drug_exposure` ≈ 86M; `omop.visit_occurrence` ≈ 52M. **`omop.cost` = 0 rows** (OQ-7 settled — see §4.0/§9). `omop.care_site` = 5,630 rows but `place_of_service_concept_id` is unpopulated (null/0 or "No matching concept") → care-site typology cannot use `place_of_service`; derive from `care_site_source_value`/name heuristics and flag as a data-quality risk.
> - **Site-IV feasibility (Analysis R, measured):** `person.care_site_id`/`person.provider_id` are 100% empty; `visit_occurrence.care_site_id`/`provider_id` are 100% populated (2,405 sites / 1,818 providers in use). Assigning T to most-recent-visit care site → 2,314 sites host T, **521 sites have ≥ 25 T patients** (191 ≥ 50, 40 ≥ 100). **Critical caveat: only 41,642/109,763 (37.9%) of T have any visit** — the IV and care-site covariate cover only that subset; `person.location_id` (100% populated, 3,027 locations) is the full-coverage fallback instrument. See §4.4 and §5.5.

---

## 1 — Pre-flight

1. `docker compose ps` — confirm `php`, `postgres`, `redis`, `solr`, `r-runtime`, `python-ai`, `horizon`, `node` healthy.
2. Confirm the study and its v4 state (verified 2026-07-03): it is `app.studies.id = 165`, `slug = 'hypertension-study-v4'`, `protocol_version = 'ACUM-PROT-HTN-V4-001'`, currently `status = 'running'` / `phase = 'analysis'`. `php artisan tinker --execute="echo App\Models\App\Study::where('slug','hypertension-study-v4')->value('status');"`. Do NOT assume `run_complete` — v4 left the study mid-flight with only 4 analyses executed; v5 continues it. Operate on `id 165`; there is no `key`/`htn-v4-bock-2026` column.
3. Confirm the Acumenus OMOP source (`omop`): `search_path = omop,vocab,php`; `source_daimons` maps `vocabulary → vocab`. Vocab coverage `SELECT count(*) FROM vocab.concept_ancestor;` ≥ 100M.
4. Parthenon Brain — search for reusable assets before drafting new ones:
   - `chroma_query parthenon_docs query="overlap weighting ATO propensity Parthenon"`
   - `chroma_query parthenon_docs query="clone censor weight target trial emulation"`
   - `chroma_query parthenon_docs query="instrumental variable provider preference OMOP"`
   - `chroma_query parthenon_code query="StudyDesignToolRunner r-runtime survival payload"`
   - `chroma_query parthenon_code query="NegativeControlService EmpiricalCalibration EASE"`
5. Re-read `.claude/rules/HIGHSEC.spec.md` and `.claude/rules/auth-system.md`. No new rule violations.
6. **IRB artifact pre-check** — Protocol #1 remains a 45 CFR 46.101(b)(4) Exempt candidate. Confirm the partner-IRB administrative-review filing stub exists in `study_artifacts(kind=irb_filing)`; if the v4 stub is present, append a v5 amendment note referencing analyses M/N/O–R (no new IRB filing is triggered — additive analyses on the same data source under the same posture).
7. **Reuse audit** — enumerate v4 assets to reuse vs re-materialize:
   - Concept sets: reuse all v4 sets; ADD the M morbidity sets (§3).
   - Cohorts T (5441), C (5455), G1–G4 (5450–5453), never-diagnosed (5454), O1 MACE (5426), O2 CKD (5427): reuse generations if the index_rule and exclusion params are unchanged; re-materialize only if §4 parameters change them. **S1 (resistant-HTN) and S2 (renal-denervation) do not exist in the DB — build them net-new** if Analyses E/I are to run.
   - Print a reuse manifest to `docs/research/hypertension-v3/docs/v5-reuse-manifest.md`.

---

## 2 — Study container (amendment, not new)

Operate on the existing row `app.studies.key = htn-v4-bock-2026`. Bump metadata:

```
analysis_plan_version:  v5.0            (was v4.1)
status:                 draft → run_complete (after v5 run)
phi_review:             45_cfr_46_101_b_4_pending   (unchanged)
parent_protocol_id:     ACUM-PROT-HTN-V4-001
child_doc_id:           ACUM-PROT-HTN-V5-001        (v5 go-forward)
```

Extend the existing command `backend/app/Console/Commands/StudyHtnV4.php` (do NOT create a competing command) with a `--version` option defaulting to `v5`, and add actions:

```
php artisan study:htn-v4 --action=reuse-audit    --version=v5
php artisan study:htn-v4 --action=concept-sets   --version=v5   # adds M morbidity sets only
php artisan study:htn-v4 --action=cohorts        --version=v5   # design constructs (§4)
php artisan study:htn-v4 --action=analyses       --version=v5   # A–N re-spec + O–R
php artisan study:htn-v4 --action=lock           --version=v5   # writes analysis_plan_v5.0.lock.json
php artisan study:htn-v4 --action=run  --source=omop --version=v5
php artisan study:htn-v4 --action=report         --version=v5
```

Update the idempotent seeder `HypertensionV4StudySeeder.php` to register the v5 analysis-plan version and the M/N/O–R analysis rows without duplicating v4 rows (upsert by `(study_id, analysis_id, plan_version)`).

**The `lock` step remains mandatory and must run before `run`.** `analysis_plan_v5.0.lock.json` supersedes `analysis_plan_v4.1.lock.json`; both are retained in `study_artifacts(kind=analysis_plan_lock)`. The report verifies the v5 lock hash before rendering and rejects a run if the lock is missing or modified.

---

## 3 — Concept sets (v5 delta)

Reuse every v4 concept set unchanged (`dx_essential_hypertension`, `dx_ckd`, `dx_mi/stroke/heart_failure`, `lab_sbp/dbp`, `rx_antihypertensives_all` and class subsets, `obs_bmi`, `obs_creatinine_clearance`, `dx_family_hx_htn`, `lab_tsh`, `proc_renal_denervation`, `device_abpm`, `device_home_bp_monitor`, etc.).

**ADD (Analysis M morbidity list)** — materialize via `StudyConceptSetDraftService → StudyConceptSetMaterializer`, verify each with `StudyConceptSetDraftVerifier` (zero `unresolved_concept` rows). Vocabularies SNOMED unless noted:

| Key | Vocab | Description |
|---|---|---|
| `dx_diabetes_mellitus` | SNOMED | DM type 1 + 2 + descendants |
| `dx_dyslipidemia` | SNOMED | hyperlipidemia / dyslipidemia umbrella |
| `dx_obesity` | SNOMED | obesity dx (+ derived `obs_bmi` ≥ 30 as sensitivity) |
| `dx_sleep_apnea` | SNOMED | OSA + descendants |
| `dx_ckd_progression` | SNOMED | CKD stage transitions (newly-occurring only; pre-index CKD excluded) |
| `dx_copd` | SNOMED | COPD + descendants |
| `dx_depression_anxiety` | SNOMED | depression + anxiety umbrella |
| `dx_coronary_artery_disease` | SNOMED | CAD (excluded pre-index; tracked post) |
| `dx_peripheral_vascular_disease` | SNOMED | PVD |
| `dx_cerebrovascular_disease` | SNOMED | CVD (excluded pre-index; tracked post) |
| `dx_atrial_fibrillation` | SNOMED | AF + flutter |
| `dx_hypertensive_retinopathy` | SNOMED | hypertensive retinopathy |
| `dx_cancer_all` | SNOMED | malignant neoplasm umbrella |
| `dx_dementia` | SNOMED | dementia umbrella |
| `dx_liver_disease` | SNOMED | chronic liver disease / cirrhosis |

`dx_heart_failure` and `dx_primary_aldosteronism` already exist — reuse.

**Derived attributes (NOT concept sets), materialized in §4:**
- `care_site_type` ∈ {medicaid_clinic, provider_office, office_with_trainees, hospital_outpatient, other} — already derived in v4; reuse the persisted `study_artifacts(kind=care_site_typology_map)`.
- `site_dx_propensity` — per-`care_site` leave-one-out diagnostic propensity used as the Analysis R instrument (§4.4).

Re-run the **negative-control outcome set** (Gingivitis, Viral sinusitis, Primary dental caries, Acute viral pharyngitis, Acute bronchitis, Chronic sinusitis, Loss of teeth, Otitis media — the eight used in v4) against the expanded M/N/O–R hypothesis space so empirical calibration stays valid across the enlarged FDR family. Add 2–4 additional negative controls if `NegativeControlService` recommends them for the new outcome/exposure pairs.

---

## 4 — Cohort definitions & v5 design constructs

`StudyCohortDraftService → StudyCohortMaterializer`; each cohort keeps its `CohortDefinition` row, Achilles-style SQL template (`{@cdmSchema}` / `{@vocabSchema}`), and `CohortGeneration` per source. **Reuse v4 T, C, S1, S2, O1, O2 unchanged** except for the parameter resolutions below and the new constructs.

### 4.0 Parameter resolutions (OQ sign-offs baked in)

| Param | v5 value | OQ |
|---|---|---|
| `index_rule` | run BOTH; primary `average_of_two_recent`; report both | OQ-11 |
| `max_gap_between_consecutive_bps_days` | 365 (sensitivity 90 / 180); distinct calendar days required | OQ-1 |
| `bp_threshold` | 130/80 primary; 140/90 sensitivity | phenotype |
| `rx_scope` | ATC C02–C09 primary; JNC-8 first-line sensitivity | OQ-4 |
| `comparator_method` | **ATO overlap weighting primary**; 1:1 PSM (caliper 0.2 SD) sensitivity | OQ-5 |
| `max_followup_days` | 1825 (5 yr) primary; all-available sensitivity; landmark at 365 d | OQ-6 |
| `lab_window_days` | ±28 | v4b |
| `delay_group_cutoffs_months` | [3, 6, 12] → g1–g4 + never_diagnosed | v4b |
| `dose_fidelity` | RxNorm strength if `drug_exposure.dose_unit_source_value` sparse | OQ-14 |
| `dx_ckd` | retain as EXCLUSION AND capture eGFR/CrCl covariate | OQ-13 |

Persist the resolved parameter set into `study_artifacts(kind=v5_parameter_resolution)` and reference it in the lock.

### 4.1 Overlap-weight construct (Analysis O)

Build a modeling table `results.htn_v4_o_weights` at the **T-member** grain, restricted to the **diagnosed** subset (n≈10,994), with:
- `exposure_binary` = 1 if `delay_group == 1` (timely ≤ 3 mo) else 0 (delayed > 3 mo). Also keep the 4-level `delay_group` for the secondary gradient.
- Propensity model covariates: age, sex, race, BMI, family_history_htn, care_site_type, eGFR/CrCl, baseline SBP/DBP at index, number of BP-recording sites, BP-recording frequency (per year), region/population-density quintile, calendar quarter of index.
- Fit the PS in `r-runtime` (`WeightIt` or `PSweight`, `estimand = "ATO"`). Compute **overlap weights** `w = (1 - e)` for treated and `w = e` for controls.
- Emit weighted `Table 1` with SMDs. Under a **logistic PS with the covariates entered as main effects**, ATO **exactly balances the mean of each included covariate** (Li–Morgan–Zaslavsky) — verify all |SMD| < 0.001 on those main-effect moments as a build check. This does NOT guarantee balance on interactions, non-linear terms, or any covariate omitted from the PS; check those separately and add terms to the PS if imbalanced.
- Persist propensity distribution + weighted equipoise for the estimability gate.

### 4.2 Target-trial clone-censor-weight dataset (Analysis P)

Build `results.htn_v4_p_target_trial` at the **T-member × strategy-clone × interval** grain:
- Eligibility: all treatment-naïve T members at time zero = index second-elevated reading (t2). Include the never-diagnosed (they are the natural "no-treatment-within-grace" arm).
- Two strategies: **A** = "record HTN dx AND initiate an antihypertensive within `grace` days of t2"; **B** = "not A within grace." Clone each eligible patient into both arms at t2.
- Grace period `grace` = 90 d primary; 30 / 180 d sensitivity.
- Censor a clone when observed data first diverge from its assigned strategy; compute stabilized **inverse-probability-of-censoring weights (IPCW)** from a pooled logistic hazard model of artificial censoring on time-varying covariates.
- Outcomes: O1 MACE (typed) and O2 incident CKD, with all-cause death as competing risk.
- Estimand: per-protocol hazard ratio and 5-year risk difference (IPCW-weighted pooled logistic / weighted Cox).

### 4.3 Phenotype-sensitivity cohorts (Analysis Q)

For each `(index_rule, bp_threshold, max_gap)` combination in {average/two-consecutive} × {130-80/140-90} × {90/180/365}, materialize a lightweight T-variant `CohortGeneration` tagged `phenotype_variant=<hash>` and record the **never-diagnosed fraction**, N, and delay-group distribution. Do NOT re-run the full analysis stack per variant — only the counts + the never-diagnosed fraction + median latency. Persist to `results.htn_v4_q_phenotype_grid`.

### 4.4 Site diagnostic-propensity instrument (Analysis R)

> **Feasibility measured on the live DB (2026-07-03).** Assigning each T member to their most-recent visit's `care_site_id`: **2,314** sites host ≥ 1 T patient; **521** have ≥ 25, **191** have ≥ 50, **40** have ≥ 100 — structurally ample for a site instrument. **BUT only 41,642 / 109,763 (37.9%) of T have any `omop.visit_occurrence` row** (`person.care_site_id` and `person.provider_id` are 100% empty; `visit_occurrence.care_site_id`/`provider_id` are 100% populated but ~62% of T patients have no visit at all — their qualifying BPs live in `omop.measurement` without an encounter link). **Consequences:** (a) the care-site instrument and any care-site covariate are available only for the ~38% visit-linked subset — restrict Analysis R to that subset and report the selection explicitly; (b) this visit-vs-no-visit split is itself an informative-visit signal — feed it into Analysis Q; (c) as a full-coverage fallback instrument, `omop.person.location_id` is 100% populated (3,027 distinct locations) — a region-level diagnostic-propensity instrument covers all of T but is more distal (weaker, more confounding-prone), so use it only as a triangulation sensitivity.

For each `care_site_id` with ≥ 25 treatment-naïve elevated-BP patients (521 such sites exist), compute a **leave-one-out** instrument value:
- `site_dx_propensity_loo` = proportion of the site's other patients diagnosed within 90 d of their index (and, as an alternative continuous instrument, the site's LOO mean `latency_b_days`).
- Assign each T member their site's LOO value as `Z`.
- Persist to `results.htn_v4_r_instrument` at T-member grain with `Z`, site size, and the measured covariates for the tertile-balance falsification check.

Persist all four constructs' build provenance (SHA-256 of the generating SQL/R) into `study_artifacts(kind=v5_construct)`.

---

## 5 — Analyses (v5)

`StudyAnalysisPlanService → StudyAnalysisPlanMaterializer`; executed via `StudyDesignToolRunner`. Summary JSONB → `app.study_analyses`; result tables → `results.htn_v4_*`. **A–L retained** (re-estimate C/F/G/H under ATO); **M/N executed**; **O–R new**.

| ID | Analysis | Engine | v5 change |
|---|---|---|---|
| A | Cohort characterization (Table 1) | Achilles + R FeatureExtraction | add ATO-weighted Table 1 beside unweighted |
| B | Prevalence Stage-1+ HTN | SQL | unchanged |
| C | Diagnostic latency (split intervals) | R survival | KM + 4-group gradient; reconcile to v4 (175 d / 1,106 d) |
| D | Treatment trajectory (class + dose) | SQL | OQ-14 dose scoping |
| E | Resistant-HTN composition | SQL | unchanged |
| F | Sensitivity vs Lu 2025 | R | ATO-weighted; report PASS/FAIL/N-A of 29% CV-risk delta |
| G | MACE incidence (typed) | R survival | **re-estimate with ATO weights**; competing risk death |
| H | Incident CKD | R survival | **re-estimate with ATO weights** |
| I | Renal-denervation eligibility | SQL | code-completeness check (OQ-10) |
| J | Baseline lab ordering (±28 d) | SQL | unchanged |
| K | Geographic stratification | GIS | unchanged |
| L | Cost / utilization | HEOR | **`omop.cost` verified empty (0 rows)** — cost analysis infeasible; use encounter + drug-exposure utilization proxies, mark CAUTION (OQ-7 settled) |
| **M** | **Comorbidity comparison matrix** | SQL + R | **execute** (v4.1) — §5.1 |
| **N** | **BP distribution & variance at t1/t2/t_dx** | R | **execute** (v4.1) — §5.2 |
| **O** | **Overlap-weighted delay effect (PRIMARY)** | R (WeightIt/PSweight) | **new** — §5.3 |
| **P** | **Target-trial emulation (clone-censor-weight)** | R survival + IPCW | **new** — §5.4 |
| **Q** | **Phenotype robustness + quantitative bias** | R | **new** — §5.5 |
| **R** | **Site diagnostic-propensity IV** | R (2SRI) | **new** — §5.6 |

For A, C, F, G, H, O, P, R also write **negative-control outcomes** via `Network/NegativeControlService`; apply OHDSI `EmpiricalCalibration`. Apply Holm-Bonferroni within each analysis family, then join all families to the study-wide negative-control-calibrated FDR pool. **Report EASE per family.**

### 5.1 — Analysis M — Comorbidity comparison matrix (Bock v4.1)

Long-form table `results.htn_v4_m_comorbidity_matrix`, one row per **morbidity × group × epoch**, across all six populations: g1–g4, never_diagnosed, and matched comparator C.
- **Epochs:** `pre_existing` (any evidence before the T member's t2, or C's synthetic t2_c) and `newly_occurring` (first evidence between index and end of follow-up).
- **Per cell:** count; prevalence % with **Wilson 95% CI**; for newly-occurring, person-years denominator + **incidence per 1,000 py**; age-and-sex-standardized rate ratio where the denominator is stable.
- **Tests:** pairwise between delay groups — chi-square (Fisher's exact when any expected cell < 5), Holm-Bonferroni within the pairwise set; each delay group vs C — same test PLUS unadjusted and covariate-adjusted (age, sex, race, BMI, care_site_type) **logistic odds ratios** with 95% CI in `r-runtime`.
- **Morbidities (17):** diabetes, dyslipidemia, obesity (dx + BMI ≥ 30 sensitivity), sleep apnea, CKD progression, COPD, depression/anxiety, CAD, PVD, cerebrovascular disease, heart failure, atrial fibrillation, hypertensive retinopathy, primary aldosteronism, cancer, dementia, liver disease.
- **Deliverables:** the long-form table; a compact prevalence **heatmap** (report); the full comparison table with p-values + ORs (report + downloadable CSV).

### 5.2 — Analysis N — BP distribution & variance at index-triggering timepoints (Bock v4.1)

Long-form `results.htn_v4_n_bp_distribution` (member × timepoint) + aggregate `results.htn_v4_n_bp_summary` (group × timepoint).
- **Timepoints per T member:** `t1` (first elevated), `t2` (second elevated = index), `t_dx` (BP nearest first `dx_essential_hypertension`, ±14 d; else most-recent-prior flagged `t_dx_bp_source='nearest_prior'`).
- **Comparator alignment:** C aligned to synthetic `t1_c`, `t2_c` (first two BPs in the 24-mo window) and `t_dx_c` placed at the matched T's `latency_b_days` past `t2_c`.
- **Per group × timepoint, SBP and DBP separately:** N, mean, SD, median, IQR (Q1/Q3), 5th/95th pct, skewness, kurtosis; kernel density (Silverman bandwidth) for ridgelines; per-person deltas `Δ_sbp_t1_t2`, `Δ_sbp_t2_tdx` (mean/SD/median/IQR); fraction whose `t_dx` fell **below** both triggering readings (regression-to-mean / white-coat); fraction whose `t_dx` was Stage 2/3 vs Stage 1 (Appendix 1 cut-offs).
- **Tests:** Kruskal-Wallis across the six populations at each timepoint (SBP, DBP separately); Dunn post-hoc with Holm-Bonferroni; Levene + Fligner-Killeen for variance equality.
- **Deliverables:** ridgeline plots per group per timepoint; violin+box comparing `t_dx` across groups; trellis of paired-arrow plots (t1 → t2 → t_dx) per group; downloadable CSV.

### 5.3 — Analysis O — Overlap-weighted delay effect (PRIMARY causal analysis)

Using `results.htn_v4_o_weights` (§4.1):
- **Confirmatory contrast:** timely (≤ 3 mo) vs delayed (> 3 mo). ATO-weighted **Cox PH** for MACE (O1) and incident CKD (O2), death as competing risk (Fine-Gray sensitivity). Report weighted HR, 5-yr risk difference, and negative-control-calibrated HR + empirical p.
- **Secondary dose-response:** 4-level `delay_group` gradient, ATO-weighted, testing monotone trend.
- **Estimability gates (must all pass to report an effect):** after weighting (a) every covariate |SMD| < 0.1; (b) weighted equipoise ≥ 0.3; (c) calibrated null centered (|mean log-HR| < 0.1, 95% CI covers 0). **If any gate fails, WITHHOLD the effect** (persist `estimable=false`, blind the estimate) exactly as v4 did for G4-vs-G1 — this is required behavior, not an error.
- Report the E-value for the point estimate and the CI bound.

### 5.4 — Analysis P — Target-trial emulation (clone-censor-weight)

Using `results.htn_v4_p_target_trial` (§4.2):
- Strategy A ("dx + treat within `grace` days") vs B; IPCW-adjusted weighted Cox / pooled logistic hazard; per-protocol HR + 5-yr risk difference for MACE and CKD; death as competing risk.
- Grace 90 d primary; 30 / 180 d sensitivity.
- Report cumulative-incidence curves by strategy, IPCW weight distribution (flag if max stabilized weight > 10), and negative-control-calibrated estimates.
- **Immortal-time check:** confirm no clone contributes person-time to a strategy before its assignment can be determined; assert in a unit test.

### 5.5 — Analysis Q — Phenotype robustness + quantitative bias

Using `results.htn_v4_q_phenotype_grid` (§4.3):
- Report the **never-diagnosed fraction** and median latency across the index-rule × threshold × max-gap grid; show how the 90% figure moves.
- **Surveillance/recording bias:** outcome ascertainment (MACE, CKD) as a function of BP-recording frequency and encounter count; report whether the comparator's "recording-comparable" match holds on recording frequency (add it to the match/weight covariates if not).
- **Informative-visit process:** compare encounter/lab counts between diagnosed and never-diagnosed; quantify differential follow-up. **Live-DB signal to investigate first:** only 37.9% of T (41,642/109,763) have any `visit_occurrence` row — the other ~62% carry qualifying BPs in `measurement` with no encounter. Report the never-diagnosed rate, MACE, and CKD ascertainment separately for the visit-linked vs measurement-only strata; a large share of the "90% undiagnosed" may be measurement-only patients whose data feed lacks encounters rather than true clinical inaction. This materially conditions how the 90% headline is framed.
- **Quantitative bias analysis:** E-values for the O and P headline effects (CKD, MACE); a probabilistic bias analysis for differential outcome ascertainment between diagnosed and undiagnosed (specify bias parameters + priors; report the bias-adjusted interval).
- Deliverable: `results.htn_v4_q_phenotype_grid` + a robustness panel in the report.

### 5.6 — Analysis R — Site diagnostic-propensity instrument

Using `results.htn_v4_r_instrument` (§4.4):
- **First stage:** regress individual delay (continuous `latency_b_days`, and binary ≤ 90 d) on `Z` + covariates; report first-stage **F** (require ≥ 10 to interpret).
- **Second stage:** two-stage residual inclusion for the survival outcome (MACE, CKD); report the local average treatment effect (LATE) with 95% CI.
- **Falsification:** covariate balance across instrument tertiles (a valid instrument should be ~balanced on measured prognostic covariates); negative-control-outcome check on the instrument (the instrument should show ~null association with the negative controls).
- Report the IV estimate with explicit caveats; **never** present it as the sole basis for a conclusion — it triangulates with O and P.

### 5.7 — Triangulation summary

Produce `results.htn_v4_triangulation`: side-by-side of the delay→outcome effect from O (ATO), P (target trial), and R (IV), with each design's key assumption and estimability status. The report renders this as the study's headline causal figure. Concordance across designs strengthens the claim; divergence is reported transparently with the most-credible design flagged.

---

## 6 — Statistical & methodological guardrails

- **Estimand of record:** ATO overlap-weighted HR + 5-yr risk difference (primary); target-trial per-protocol HR (secondary); IV LATE (tertiary). The elevated-vs-normotensive contrast (v4, well-calibrated) is retained as the anchor.
- **Index-date alignment:** T index = t2; C synthetic index = second of the normal BPs; time zero for O/P = t2 (no immortal time).
- **Censoring:** end of observation, death, or `max_followup_days` (1825 primary). Death is a competing risk for MACE/CKD (Fine-Gray sensitivity beside cause-specific Cox).
- **Overlap weighting:** ATO via `WeightIt`/`PSweight`; verify exact mean balance on the PS main-effect covariates (exact only for those moments under a logistic PS); flag residual imbalance on any main-effect covariate as a build failure. Interactions/non-linear terms are not auto-balanced — check them and extend the PS if needed.
- **IPCW (target trial):** stabilized weights; truncate at the 99th percentile only with a logged justification; report weight distribution.
- **IV:** report first-stage F, exclusion-restriction argument, tertile-balance falsification, negative-control-outcome check.
- **Calibration:** every effect family calibrated against the negative controls (OHDSI `EmpiricalCalibration`); report EASE; block reporting if the calibrated null is not centered (|mean log-HR| < 0.1, 95% CI covers 0).
- **Multiplicity:** Holm-Bonferroni within family + study-wide negative-control-calibrated FDR across the expanded M/N/O–R set.
- **Sensitivity everywhere:** E-values for headline effects; index-rule/threshold sensitivity (Q); Fine-Gray beside cause-specific; PSM retained as a sensitivity comparator against ATO.
- **Missing data:** report % missingness per covariate; do NOT impute BPs or labs; overlap weights use complete-covariate PS with a missingness-indicator sensitivity.
- **Pre-registration:** persist `analysis_plan_v5.0.lock.json` to `study_artifacts` before `run`; reject `run` if the lock is missing or modified.

---

## 7 — Deliverables

```
docs/research/hypertension-v3/                              ← protocol home (v3 → v5 lineage)
├── CLAUDE_PROMPT.md                                        ← v4 prompt (retained)
├── CLAUDE_PROMPT_v5.md                                     ← this file (v5)
├── CHANGELOG_v3_to_v4.md
├── CHANGE_REQUEST_v4.1_Bock_2026-05-23.md
├── CHANGELOG_v4_to_v5.md                                   ← NEW deep diff (write this)
├── Hypertension_v4_Consolidated_Acumenus.docx
├── Hypertension_v5_GoForward_Acumenus.docx                ← NEW go-forward (ACUM-PROT-HTN-V5-001)
├── PROTOCOL.md                                             ← update Part 1 to v5 estimands
├── README.md                                              ← update run instructions + v5 status
├── concept-sets/                                          ← + M morbidity sets
├── cohort-definitions/                                    ← + O/P/Q/R constructs
├── sql/                                                   ← rendered SQL per cohort & analysis
├── r/                                                     ← WeightIt/PSweight, CCW+IPCW, 2SRI payloads
├── results/omop/                                          ← result tables incl. htn_v4_{m,n,o,p,q,r}_*
├── reports/
│   ├── htn_v5_report.html                                 ← interactive v5 report
│   └── htn_v5_report.pdf                                  ← printable
└── docs/
    ├── open-questions.md                                  ← all 14 resolved + Protocol-#2 items
    ├── v5-reuse-manifest.md                               ← v4→v5 asset reuse audit
    └── irb/                                               ← Part-3 artifacts + v5 amendment note
```

The **v5 HTML report** MUST:
- Use the Acumenus palette (Crimson #9B1B30, Dark #0E0E11, Gold #C9A227, Teal #2DD4BF) and Arial.
- Show the `analysis_plan_v5.0` lock hash prominently in the header.
- Show negative-control p-value calibration plots (per family) and EASE.
- Render the **triangulation figure** (O / P / R side-by-side) as the headline.
- Render ATO-weighted forest plots and love plots (SMD before/after weighting).
- Render Analysis M heatmap + comparison table, Analysis N ridgelines / violin+box / paired-arrow trellis.
- Render the Q phenotype-robustness panel (never-diagnosed fraction across the grid) and E-values.
- Render the "Lu 2025 sensitivity replication" panel with PASS/FAIL/N-A.
- Carry a **V&V acceptance matrix** panel (see §8) so the report doubles as the platform-validation artifact.

Also write `CHANGELOG_v4_to_v5.md` (deep diff, same style as `CHANGELOG_v3_to_v4.md`).

---

## 8 — Acceptance criteria

1. `app.studies` row `key=htn-v4-bock-2026` has `analysis_plan_version=v5.0`, `status=run_complete`.
2. New M concept sets verified (`StudyConceptSetDraftVerifier::status=passed`); zero `unresolved_concept` rows.
3. v4 T/C/S1/S2/O1/O2 reused (or re-materialized) with counts idempotent within ±0.1%; the v5 constructs `htn_v4_{o_weights,p_target_trial,q_phenotype_grid,r_instrument}` populated and non-empty.
4. Every analysis A–R has `result_summary` populated and a result table under `results.htn_v4_*`.
5. **Analysis O reports an estimable, negative-control-calibrated timely-vs-delayed effect** with all estimability gates passing — OR, if a gate fails, the effect is explicitly withheld with `estimable=false` and the failing gate logged (either is acceptable; silent reporting of an ungated effect is NOT).
6. Analyses M and N produce their full tables + figures (heatmap, ridgelines, violin+box, paired-arrow trellis).
7. Analysis P passes the immortal-time unit test; Analysis R reports first-stage F and the tertile-balance falsification.
8. `analysis_plan_v5.0.lock.json` exists in `study_artifacts` and hash-matches the rendered v5 report.
9. Negative-control distribution centered ≈ 0 on log-HR scale across the expanded family; EASE reported per family.
10. The v4 baseline facts reconcile (T=109,763; never-diagnosed 90%; latency_b median 1,106 d; CKD HR 2.60) — any deviation > 0.1% is investigated and explained in `CHANGELOG_v4_to_v5.md`.
11. IRB filing stub present with a v5 amendment note; no new IRB filing required.
12. `make lint` + `make test` pass; `npx vite build` succeeds; PHPStan level 8 clean (no new `phpstan-baseline.neon` entries).
13. No PHI / `person_id` / MRN in logs.

**V&V acceptance matrix (platform validation — all must be present in the report):** estimand robustness (O/P/R triangulation), positivity handling (O clears gates PSM failed), lock integrity (hash match), negative-control coverage (centered null), reproducibility (stable cohort hashes, ±0.1% idempotent), governance (no PHI in logs, HIGHSEC, IRB artifact pre-egress), external validity (Lu PASS/FAIL/N-A), sensitivity transparency (E-values + QBA).

---

## 9 — Open questions

**Resolved for v5 (baked into §4.0; PI sign-off recorded in the go-forward doc):**

| # | Question | v5 resolution |
|---|---|---|
| 1 | Max gap between consecutive elevated BPs | 365 d cap, distinct days; sensitivity 90/180 |
| 4 | Antihypertensive scope | ATC C02–C09 primary; JNC-8 first-line sensitivity |
| 5 | Comparator method | **ATO overlap weighting primary; PSM sensitivity** |
| 6 | Max follow-up | 5 yr primary; all-available sensitivity; 1-yr landmark |
| 7 | Cost fidelity | **Settled: `omop.cost` = 0 rows (verified 2026-07-03). No cost analysis; utilization proxies only, CAUTION** |
| 8 | Sample-size justification | positivity-bound, not N-bound; report min detectable HR per contrast |
| 10 | Renal-denervation code completeness | validate device + procedure codes vs registry |
| 11 | Index BP rule | run both; default average_of_two_recent; report both |
| 12 | Lu framing | sensitivity analysis F |
| 13 | Kidney exclusion | retain dx_ckd exclusion AND capture eGFR covariate |
| 14 | Drug dose fidelity | RxNorm strength if drug_exposure sparse |

**Protocol #2 (readiness — NOT executable from this prompt):**

| # | Question | Path |
|---|---|---|
| 15 | Protocol #2 IRB framing | expedited cat. 7 (QI/human-factors); partner-IRB pre-consult; cluster-randomized characterization |
| 16 | Protocol #2 EPIC integration | two layers — EPIC-side out-of-platform; Parthenon study `htn-pilot-bp-capture-2026` ingests post-pilot OMOP data and runs comparability + outcome analyses |

Persist the resolutions into `docs/research/hypertension-v3/docs/open-questions.md` and reference the go-forward sign-off doc.

---

## 10 — Style & safety rules (enforced)

- HIGHSEC — no public/unauthenticated endpoint serves cohort/PHI data; new routes pass `auth:sanctum + permission:studies.execute` or stricter.
- `CdmModel` is read-only. Never INSERT/UPDATE/DELETE against `omop.*` or `vocab.*`. Writes only to `app.*`, `results.htn_v4_*`, `php.*`.
- Use the `omop` connection (`search_path omop,vocab,php`); `interrogation` connection permitted for read-only Abby analytics.
- Pint in Docker: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` after every PHP edit.
- TypeScript strict — `npx vite build` + `tsc --noEmit`. Recharts Tooltip formatter cast `as never`.
- Branch: `feature/htn-v5-outcomes-study` from `main`. Conventional commits. No `--no-verify` without an emergency note.
- No PHI, `person_id`, or MRN in logs, reports, or CSV downloads (group-level aggregates only in any egress).

---

## 11 — Done definition

```
Hypertension v5 study run complete on Acumenus omop CDM @ <commit>.
Study key: htn-v4-bock-2026  ·  analysis_plan_version: v5.0
Reused v4 cohorts: T={n} C={n} S1={n} S2={n}  (idempotent ±0.1%: <PASS|FAIL>)
delay_group distribution: g1=<n> g2=<n> g3=<n> g4=<n> never=<n>  (reconciled to v4: <PASS|FAIL>)
Analysis M — comorbidity matrix: <17 morbidities> × <6 populations> × 2 epochs rows
Analysis N — BP distributions: <3 timepoints> × <6 populations> ridgelines
Analysis O — timely vs delayed (ATO): HR_MACE=<x> (<ci>) HR_CKD=<y> (<ci>)  estimable=<true|false> gates=<pass/fail>
Analysis P — target trial (grace 90d): HR_MACE=<x> HR_CKD=<y>  immortal-time test=<PASS|FAIL>
Analysis R — site-IV LATE: first-stage F=<f>  LATE_MACE=<x> LATE_CKD=<y>
Triangulation (O/P/R): concordance=<concordant|divergent — most-credible: __>
Anchor (elevated vs normotensive): MACE HR 1.03 (0.94–1.14) · CKD HR 2.60 (2.01–3.38)  [reconciled]
Phenotype grid: never-diagnosed fraction range across index-rule×threshold×gap = <lo>–<hi>%
Negative-control EASE (per family): <...>   calibrated null centered: <PASS|FAIL>
Lu 2025 sensitivity replication (29% CV-risk delta): <PASS|FAIL|N/A>
Analysis plan lock (v5.0): <sha256>
IRB filing: <pending|exempt-granted|expedited-granted>  (v5 amendment note appended)
V&V acceptance matrix: <all-present|missing: __>
Report: docs/research/hypertension-v3/reports/htn_v5_report.html
Open questions outstanding: <n>  (Protocol #2: 15, 16 tracked separately)
```

End of prompt.
