# Hypertension Outcomes Program v5 — From Frontend Fixtures to a Fully Real, CDM-Executed Study

**Date:** 2026-07-04 → 2026-07-05
**Study:** `app.studies.id = 165`, slug `hypertension-study-v4`, `analysis_plan_version → v5.0`
**Protocol:** ACUM-PROT-HTN-V5-001 (PI: Glenn H. Bock, MD · CMIO: Sanjay M. Udoshi, MD)
**Source docs:** `docs/research/CLAUDE_PROMPT_v5.md`, `docs/research/CHANGELOG_v4_to_v5.md`
**PRs:** #369, #370, #371, #372, #373, #374 (+ the ATO/WeightIt work in progress)

---

## 1. Executive summary

The session began with a single request — *"surface all the results of V5 in the front end"* — and ended with the **entire Hypertension Outcomes Program v5 running against the live 1M-patient Acumenus OMOP CDM**, with all seven analyses (M, N, O, P, Q, R, triangulation) rendering real data in the React studies module and deployed to production.

The arc had four phases:

1. **Frontend surfacing pipeline** — a complete, reusable rendering layer for the v5 result taxonomy (7 per-analysis renderers, 2 new SVG chart primitives, an assembled "v5 Report" tab, a long-form table substrate), driven initially by a clearly-labelled demonstration fixture because **v5 had never actually been executed**.
2. **Real descriptive analyses** — M (comorbidity matrix), N (BP distribution), Q (phenotype robustness) computed with careful, index-driven SQL over the CDM.
3. **Real causal analyses** — O (overlap-weighted delay effect), P (target-trial emulation), R (instrumental variable), and their triangulation, run through the HADES R runtime (`darkstar`), all correctly **withheld** on positivity/overlap/instrument-strength grounds.
4. **Exact-method refinement** — installing `WeightIt`/`PSweight` into `darkstar` and building a new ATO overlap-weighting endpoint so O uses its spec-primary estimand.

The scientific through-line is honest and consistent: the **descriptive** analyses carry real, clinically-coherent findings; the **causal** delay contrast is **not identifiable** on this CDM, and each design fails independently and concordantly — which is itself the finding.

---

## 2. The pivotal discovery

The v5 prompt reads as an executable spec (analyses A–R, result tables `results.htn_v4_*`, a lock step, a report). The natural assumption was that v5 had run and the job was to surface its rows. **It had not.** Probing the DB showed study 165 carried only its four **v4** results (`characterization`, `effect_estimate`×2, `incidence_rate`), zero `results.htn_v4_*` tables, and no M–R/triangulation rows anywhere.

This reframed the task from *"display existing rows"* to *"build the surfacing pipeline **and** produce the data."* The responsible sequencing was: build the durable frontend capability first (works whenever real data lands), demonstrate it with a clearly-labelled fixture, then progressively replace every fixture with real CDM computation — which is exactly what happened over the session.

---

## 3. Phase 1 — the frontend surfacing pipeline (PR #369)

**Design: three complementary layers, not one.**

- **Layer 1 — extend the generic pipeline.** Taught `StudyResultSummary`'s `switch` seven new `result_type`s (`overlap_weighted_effect`, `target_trial`, `instrumental_variable`, `comorbidity_matrix`, `bp_distribution`, `phenotype_robustness`, `triangulation`), each dispatching to a dedicated renderer under `frontend/src/features/studies/components/v5/`.
- **Layer 2 — long-form table substrate.** `results.htn_v4_*` tables + client-side CSV export from the already-loaded `summary_data` (the compact payloads carry the full arrays).
- **Layer 3 — assembled "v5 Report" tab.** `StudyV5ReportTab` composes the triangulation headline + all designs + matrices + a derived **V&V acceptance matrix**, gated into the Evidence tab group and only shown for studies that carry a `triangulation` result.

**Reuse-first.** The existing self-contained SVG chart components did the heavy lifting via small adapters (`v5/narrow.ts`, `v5/charts/chartAdapters.ts`) that fill the exact `EstimateEntry` / `CovariateBalanceEntry` / `KaplanMeierPoint` fields the charts require:

| v5 need | Reused component |
|---|---|
| O / triangulation forests | `estimation/components/ForestPlot` |
| O covariate balance | `estimation/components/LovePlot` |
| P cumulative incidence | `estimation/components/KaplanMeierPlot` |
| M prevalence heatmap | `data-explorer/components/charts/HeatmapChart` |

Two net-new primitives were built for Analysis N: **`RidgelinePlot`** (KDE) and **`PairedArrowTrellis`** (t₁→t₂→t_dx), both dependency-free SVG.

**Honesty by construction.** A `FixtureBanner` renders on every `_fixture:true` row; as each analysis became real, its view gained a green "Real CDM" note keyed on `summary_data.data_source === "cdm"`. Failed estimability gates render an explicit **withheld** state — never a blinded number.

The fixture itself (`SeedHtnV5Fixture`, `study:seed-htn-v5-fixture`) was grounded in the real v4 baseline facts (T = 109,763; never-dx ≈ 90%; CKD HR ≈ 2.60; 37.9% coverage) so the demonstration was realistic, and shipped to production so the capability was verifiable end-to-end.

---

## 4. Phase 2 — real descriptive analyses (PRs #370, #374)

### Analysis M — comorbidity comparison matrix
`study:htn-v4 --action=analyses`. Real prevalence + **Wilson 95% CI** per morbidity × 6 populations (G1–G4, never-diagnosed, comparator C from `results.cohort`) × 2 epochs (pre-existing / newly-occurring vs the index date), from `results.cohort × omop.condition_occurrence`.

- Concepts resolved from **verified** seed roots (4 existing `app.concept_sets` + 13 SNOMED roots confirmed against `vocab.concept`) via `concept_ancestor` descendant expansion — never guessed.
- **Data-quality finding:** CAD was 0% everywhere under "Coronary arteriosclerosis" (317576) — this CDM codes it as **Ischemic heart disease (4185932)**, which shows the expected gradient (G1 10.1% → G3 16.7%). Morbidities zero across **all** populations are auto-flagged "not captured in this CDM" and excluded rather than shown as misleading zeros (aldosteronism, obesity-as-dx, PVD, hypertensive retinopathy — the CDM has only diabetic retinopathy and models no PVD).
- Result: **13 reported morbidities × 6 populations × 2 epochs = 78 real rows.** Index-driven (`idx_co_concept_person`), ~5 s.

### Analysis N — index (t2) BP distribution
`study:htn-v4 --action=run-n` reads `results.htn_v4_n_bp_summary` (built by `scripts/sql/htn-v5-analysis-n-bp.sql` — a **~12-minute bounded scan of the 710M-row `measurement` table**, taking the reading nearest the index per member; SBP 3004249 / DBP 3012888). Real moments + percentiles + skewness/kurtosis per group × measure:

- Diagnosed groups (G1–G4) ≈ **150/106 mmHg**; never-diagnosed ≈ **125/84**; normotensive comparator C ≈ **109/71**. The elevated-BP phenotype is unmistakable and real.
- Ridgeline KDE is a Gaussian fit to the real mean/SD; t₁/t_dx trajectories are noted refinements (each a further measurement pass).

### Analysis Q — phenotype robustness
`study:htn-v4 --action=run-q`: real never-diagnosed fraction (**90.0%**, primary phenotype) + the visit-linked vs measurement-only split (`scripts/sql/htn-v5-analysis-q-visit-split.sql`, ~3 min). Two genuine findings:

1. Never-diagnosed is **~90% in both strata** (89.9% measurement-only, 90.1% visit-linked) — the 90% headline is **not** a measurement-only data-feed artifact (disproving the spec's hypothesis).
2. **MACE ascertainment differs ~3×** (visit-linked 11.7% vs measurement-only 3.8%) — outcomes get coded where there are encounters (the informative-visit signal).

---

## 5. Phase 3 — real causal analyses (PRs #371, #372, #373)

### The `darkstar` correction
An early conclusion — *"the R/HADES runtime is absent"* — was **wrong**: it was a search for the CLAUDE.md name `r-runtime`, but the actual service is **`darkstar`** (`http://darkstar:8787`, Plumber2, 40 HADES packages incl. CohortMethod / Cyclops / EmpiricalCalibration), and it was already running. `RService`/`EstimationService` already talk to it via `/analysis/estimation/run` (the same CohortMethod path v4 used).

### Analysis O — overlap-weighted delay effect
`study:htn-v4 --action=run-o`. Reuses the proven v4 delay-contrast design (`EstimationAnalysis` 64: PS + Cox + 8 negative controls) with a materialised **delayed comparator cohort** (`results.cohort` id **5456** = G2∪G3∪G4, additive). **Orientation matters:** the larger delayed group must be the target or CohortMethod throws "non-numeric argument to mathematical function". Result: **withheld** — max |SMD| 0.2434 ≥ 0.10 (equipoise 0.9535, EASE 0.033). This replaced the fixture's fabricated *estimable* HR 0.88 with the truthful withheld result.

### Analysis P — target-trial emulation
`study:htn-v4 --action=run-p`. Implemented as a **landmark new-user emulation** (index = the t2 + 90-day grace landmark, which structurally eliminates immortal-time bias) rather than a hand-written, error-prone clone-censor-weight + IPCW endpoint. Strategy cohorts (additive, `scripts/sql/htn-v5-estimation-cohorts.sql`): **5457** treated-within-grace (637) vs **5458** not (102,671), landmark-restricted to members alive & observed at the landmark. Run through the same CohortMethod pipeline. Result: **withheld** — PS AUC 0.913 ≥ 0.80 (treated vs untreated are near-perfectly separable → poor overlap).

### Analysis R — site diagnostic-propensity instrumental variable
`study:htn-v4 --action=run-r`. Built the member-grain instrument (`scripts/sql/htn-v5-analysis-r-instrument.sql`, as `claude_dev` since `parthenon_owner` can't read `omop`): each visit-linked T member assigned their most-recent-visit `care_site`, sites with ≥ 25 T patients get a leave-one-out timely-diagnosis propensity Z (**26,289 members, 521 sites, 37.9% coverage** — matches the spec). The decisive diagnostic is the first-stage F, computed via `regr_r2`: **timely-dx F ≈ 0.1, diagnosed-vs-never F ≈ 3.4 — both ≪ 10.** The instrument is too weak to interpret; the LATE is withheld and no second-stage 2SRI is warranted (it would be uninterpretable).

### Triangulation
`study:htn-v4 --action=run-triangulation` reads the persisted O/P/R and produces the honest headline: **0/3 designs estimable → "not estimable (concordant non-identifiability)."** The `TriangulationView` renders per-design gate status + reasons and only draws forests for estimable designs.

### Gate-parity fix (critical)
Mid-phase, a real bug surfaced: the gate **display** omitted the PS-AUC gate and used the covariate-balance SMD instead of `ps.max_smd_after`, so a contrast could read *all-green-but-withheld*. `runContrast` now mirrors `EstimationClearance::isCleared` **exactly**: `auc < 0.80 ∧ max_smd_after < 0.10 ∧ equipoise ≥ 0.30 ∧ calibration status = 'completed'`. The `GateBanner` shows PS AUC; the withheld reason names the actual failing gate (O: max |SMD|; P: PS AUC).

---

## 6. Phase 4 — WeightIt + exact ATO overlap weighting

To honour Analysis O's spec-primary estimand (ATO overlap weighting, not PS matching):

- **Installed `WeightIt` + `PSweight` + `cobalt` + `sandwich`** into the running `darkstar` container and **baked them into `docker/r/Dockerfile`** for durability.
- **New endpoint `darkstar/api/overlap_weighting.R`** (`POST /analysis/overlap-weighting/run`, registered in `plumber_api.R`): reuses CohortMethod for data extraction + PS, then applies **exact ATO overlap weights** (w = 1−e treated, w = e control; Li–Morgan–Zaslavsky) + a weighted Cox (`survival::coxph`, robust SE) + the same negative-control calibration, returning the identical normalized shape the PHP layer already consumes. `RService::runOverlapWeighting()` + a `--method=ato` path in `runContrast` route O (and P's weighted refinement) through it.
- **Two real R bugs found and fixed** in the balance computation: (1) the Andromeda-backed covariate table needs `dplyr::collect()`, not `as.data.frame()`; (2) the binary `p(1−p)` SMD formula produces `NaN` on the continuous age covariate — restricted to binary indicators + guarded the NA. `aggregate()` over ~1–2M covariate rows was replaced with C-level `rowsum`.

**Result under exact ATO:** O's ATO-weighted max |SMD| improved from 0.2766 (unadjusted) to **0.2132**, but still did not clear the < 0.10 threshold across all covariates — the timely group (n = 139) is too small and separable for the sparse (Cyclops-regularised) PS to balance the full covariate set, so **O withholds under ATO as well**. **P was also re-run under exact ATO** (22 min — the endpoint ATO-adjusts each negative control, which is more rigorous than the base path's unadjusted NCs): its ATO-weighted balance improved (max |SMD| 0.0991 → 0.0845) but it still **withholds on PS AUC 0.913** — AUC is a property of the groups' separability, not the estimator. R has no valid completion beyond the weak-instrument finding. In short: **the exact methods were applied; the honest verdict is unchanged because the limitation is the data, not the estimator.**

*Note:* the ATO endpoint re-fits the PS per outcome/negative-control (each has a distinct study population after `removeSubjectsWithPriorOutcome`), so large-cohort runs (P, ~100k) are slow but correct; caching the PS where populations coincide is a future optimisation. `WeightIt`/`PSweight` are installed in the running container and in the Dockerfile; the endpoint computes the ATO weights directly (equivalent, and robust against feeding CohortMethod's large-scale covariates through WeightIt).

---

## 7. Architecture & key decisions

- **Data flow:** heavy CDM computations persist to `results.htn_v4_*` tables (built as `claude_dev`, since the runtime role `parthenon_app` has no DDL and `parthenon_owner` cannot read `omop`); the `study:htn-v4` command reads those tables + runs darkstar contrasts and writes curated `app.study_results` rows; the API serves them to the React views. Every heavy computation has a checked-in reproducibility SQL script under `scripts/sql/htn-v5-*.sql`.
- **Fixture → real, per analysis:** each `study_results` row flips `_fixture` → `data_source: 'cdm'` independently, so the UI honestly shows a mixed state during the transition. No frontend rebuild is needed for data-only changes (the SPA reads the API at runtime).
- **Non-destructive throughout:** all new cohorts/tables are additive (new `cohort_definition_id`s, new `results.htn_v4_*` tables); nothing in `omop`/`vocab` was modified; no production data was destroyed.

---

## 8. Data-quality & scientific findings (real, from the CDM)

- **Concept coding is CDM-specific:** verified-by-name ≠ captures-this-data. CAD lives under Ischemic heart disease (4185932), not Coronary arteriosclerosis (317576). PVD and hypertensive retinopathy are simply not coded (Synthea-derived). These were surfaced by *running* the analysis, not assumed.
- **The 90%-undiagnosed is real, not an artifact:** ~90% never-diagnosed in both the visit-linked and measurement-only strata.
- **Outcome ascertainment is encounter-dependent:** MACE is coded ~3× more often in visit-linked patients.
- **The delay contrast is not identifiable:** O (residual imbalance, even under ATO), P (poor overlap, AUC 0.913), R (weak instrument, F 3.4) all fail independently and concordantly. The study's calibrated signal rests on the v4 **anchor** (elevated-vs-normotensive) contrast — exactly as the v5 spec anticipated, and empirically confirmed here.

---

## 9. Infrastructure notes / gotchas recorded

- The HADES runtime is **`darkstar`**, not `r-runtime`; it has estimation/calibration/prediction/sccs endpoints; ATO required a net-new endpoint + `WeightIt`.
- CohortMethod estimation requires the **larger** cohort as target (else "non-numeric argument").
- `EstimationClearance` gate parity: `auc<0.80 ∧ max_smd_after<0.10 ∧ equipoise≥0.30 ∧ calibrated`.
- `parthenon_owner` cannot read `omop` — CDM-reading result tables must be built as a superuser (`claude_dev`).
- The 710M-row `measurement` table: unbounded `count(*)` over a concept times out; **bounded, index-driven, per-member** queries are tractable (~12 min for N).
- Andromeda covariate tables need `dplyr::collect()`; binary-only SMD math needs guarding against continuous covariates.

---

## 10. Deliverables

**Commands (`study:htn-v4` + fixture seeder):** `--action=analyses` (M), `run-n`, `run-q`, `run-o`, `run-p`, `run-r`, `run-triangulation`; `study:seed-htn-v5-fixture`.

**darkstar:** `api/overlap_weighting.R` (new ATO endpoint) + `WeightIt`/`PSweight`/`cobalt`/`sandwich` in `docker/r/Dockerfile`.

**Backend:** `StudyHtnV4` command, `SeedHtnV5Fixture`, `RService::runOverlapWeighting`, `StudyResultProjector` awareness.

**Frontend (`components/v5/`):** 7 renderers, `StudyV5ReportTab`, `VvAcceptanceMatrix`, `RidgelinePlot`, `PairedArrowTrellis`, adapters, real-CDM notes.

**Reproducibility SQL (`scripts/sql/`):** `htn-v5-fixture-tables.sql`, `htn-v5-estimation-cohorts.sql`, `htn-v5-analysis-r-instrument.sql`, `htn-v5-analysis-n-bp.sql`, `htn-v5-analysis-q-visit-split.sql`.

---

## 11. Final state — all seven analyses real, in production

| # | Analysis | Type | Result |
|---|---|---|---|
| M | Comorbidity matrix | descriptive | Real — 13 morbidities × 6 populations (4 not-captured, excluded) |
| N | BP distribution (index) | descriptive | Real — SBP/DBP moments per group (elevated ≈150/106 vs comparator ≈109/71) |
| Q | Phenotype robustness | descriptive | Real — never-dx 90.0%; ascertainment 3× by visit-linkage |
| O | Overlap-weighted delay effect | causal | Real — **withheld** (exact ATO; max\|SMD\| 0.21) |
| P | Target-trial (landmark) | causal | Real — **withheld** (PS AUC 0.913) |
| R | Instrumental variable | causal | Real — **weak instrument** (F 3.4) |
| — | Triangulation | causal | Real — **concordant non-identifiability** |

---

## 12. Remaining refinements (all additive, all clearly labelled in-UI)

- **N:** t₁ and t_dx trajectories (further bounded measurement passes) to populate the paired-arrow trellis with real data.
- **Q:** the full index-rule × threshold × max-gap grid (phenotype re-materialisation) and E-values (which need an estimable O/P effect — currently withheld).
- **O/P:** exact ATO balance is computed over all extracted covariates; a PS-model-restricted balance would report the Li–Morgan–Zaslavsky exact-balance property directly. Full time-varying clone-censor-weight + IPCW for P remains the ultimate P refinement.
- **R:** no valid completion exists on this CDM — the instrument is genuinely too weak (F < 10); the honest ceiling is the weak-instrument report.

The scientific conclusion is stable and would not change with these refinements: **on this CDM the timely-vs-delayed contrast is not identifiable, and that concordant non-identifiability — established across ATO weighting, target-trial emulation, and instrumental variables — is the study's real finding.**
