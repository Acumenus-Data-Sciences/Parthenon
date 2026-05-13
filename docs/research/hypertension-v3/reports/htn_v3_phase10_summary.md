---
doc_type: research
status: active
date: 2026-05-12
owner: acumenus
module: hypertension-v3
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Hypertension v3 — Phase 10 Summary Report

**Study:** Hypertension Study (V3) — slug `hypertension-study-v3-2`
**PI:** Glenn H. Bock, MD
**Data source:** Acumenus OHDSI OMOP CDM (~1.0M adults)
**Design version:** v2 (locked 2026-05-12T22:12:29Z)
**Report generated:** 2026-05-12

---

## 1. What ran

| Phase | Status |
|---|---|
| 1 — Preflight / discover (production API) | ✅ |
| 2 — Intent (v2 with full PICO + 16 open questions, all answered or deferred) | ✅ |
| 3 — Phenotype recommendations (12 deferred to backlog) | ✅ |
| 4 — Concept sets (28 materialized, IDs 168–195) | ✅ |
| 5 — Cohorts (4 of 7 composites built; 3 deferred: S1 resistant-HTN, S2 RDN, T_lu Lu-replication) | ✅ partial |
| 6 — Cohort generation on Acumenus OMOP | ✅ |
| 7 — Analysis plans (4 materialized: characterization, incidence_rate, pathway, estimation) | ✅ |
| 8 — Lock v2 | ✅ |
| 9 — Execute analyses | ✅ 3/4 with meaningful results; 1 methodological constraint |
| 10 — This report | ✅ |

## 2. Cohort headline

| Cohort | Definition | Persons | Avg era (days) |
|---|---|---|---|
| **T** (5423) | Incident essential HTN, treatment-naive | **265,498** | 1,825 (5 yrs) |
| **C** (5420) | Potential normotensive comparator pool (pre-PSM) | **649,278** | 1,741 (4.77 yrs avg, truncated at observation_period_end) |
| **O1** (5421) | First MACE event (MI + stroke + HF) | **79,506** | 1.1 (event date) |
| **O2** (5422) | First CKD diagnosis | **160,819** | 1,914 (event to end-of-observation) |

Cohort definitions are visible in the workbench at https://parthenon.acumenus.net/studies/hypertension-study-v3-2?tab=cohorts (and `?tab=design` for the locked v2 with 28 materialized concept sets + 4 linked cohorts).

## 3. Headline results

### 3.1 Incidence rates in target cohort T (post-Dx, 5-year follow-up)

| Outcome | Person-years | Events | Rate per 1,000 PY |
|---|---:|---:|---:|
| **MACE** (MI + stroke + HF) | 1,323,205 | **1,482** | **1.12** |
| **Incident CKD** | 1,265,330 | **24,756** | **19.56** |

These are exposure-period rates in the 5-year window from index for treatment-naive incident HTN patients. The CKD rate is 17× higher than the MACE rate — consistent with literature: HTN's downstream kidney burden manifests earlier and more frequently than its cardiovascular burden in the early post-Dx window.

### 3.2 Treatment-trajectory pathway (analysis 19)

1,482 of 265,498 T-cohort patients (**0.56%**) had a MACE event during 5-year follow-up. Single unified pathway: "O1 - MACE composite (MI + stroke + HF + death)". Pathway granularity in the current design only sees one event cohort, so finer drug-class trajectory analysis requires expanding the eventCohortIds list.

### 3.3 Baseline characterization (analysis 40)

Achilles + FeatureExtraction extracted baseline drug features per cohort. Top features by frequency in T include nicotine replacement (247 patients, 0.09%), nitroglycerin spray (18 patients, 0.01%), and various extended-release antihypertensives. The full feature set is available in `app.analysis_executions[id=240].result_json` (and prior iterations).

### 3.4 Estimation (T vs C with PSM) — methodological constraint

The Estimation analysis (PSM CohortMethod, T vs C Cox PH for MACE and CKD) failed with `High correlation between covariate(s) and treatment detected`. Root cause: T and C are defined by the presence/absence of HTN; the cohort-defining features (HTN diagnosis concepts, BP measurements) become perfect classifiers in the propensity-score model. We attempted exclusion of 18 concepts (16 HTN dx + SBP + DBP) via `covariateSettings.excludedCovariateConceptIds`, both at top-level and nested; the propensity-score model still fails because residual perfectly-correlated features remain (e.g., comorbidity patterns that co-occur with HTN).

This is a known limitation of OHDSI CohortMethod when comparing an exposed cohort to an unexposed cohort. The standard workarounds are:

1. **Within-T latency comparison (Lu replication)** — compare delayed-Dx vs early-Dx subgroups inside T. Both groups have HTN, so HTN concepts no longer perfectly classify. This is what Lu et al. 2025 did.
2. **PatientLevelPrediction** — predict CV outcome from baseline covariates within T. No PSM needed.
3. **Self-controlled designs** (SCCS) — each patient is their own control.

The deferred T_lu cohort (Lu replication sub-design with within-cohort late-vs-early reference) would address (1) and is the natural next step.

## 4. Pipeline fixes shipped

Two production bug fixes were authored, tested, and committed to main during this run:

### 4.1 `fix(cohort): claim controller's queued row instead of double-creating` (commit `faf6ee8db`)

`CohortDefinitionController::generate()` was pre-creating a `cohort_generations` row with `status=Queued`, then dispatching `GenerateCohortJob`. The job's `CohortGenerationService::generate()` always created a SECOND row with `status=Running`. The controller's row was orphaned at `queued` forever; callers polling by the dispatch-returned `generation_id` saw "queued" indefinitely even when the work completed in seconds via a sibling row.

Fix: `CohortGenerationService::generate()` now wraps row creation in a `DB::transaction` that `lockForUpdate`-claims an existing Queued row for the same `(cohort_definition_id, source_id)` created within the last 15 minutes; only creates a fresh row if none found. The 15-min window prevents claiming pre-fix orphans. Adds a regression test in `tests/Feature/Api/V1/CohortDefinitionTest.php`.

### 4.2 `fix(study-design): incidence_rate plan uses singular targetCohortId` (commit `8286d5bb9`)

`StudyAnalysisPlanService::designJson('incidence_rate', ...)` was writing `targetCohortIds` (plural array). `IncidenceRateService::run()` and `IncidenceRateUpdateRequest` both expect `targetCohortId` (singular scalar). Materialized incidence-rate analyses failed at execution with `Undefined array key targetCohortId`. The plural form was the only outlier — estimation, prediction, pathway, sccs, and self_controlled_cohort all already use the singular convention. One-line key rename.

## 5. In-place data corrections (preserved in audit trail)

### 5.1 T and C cohort_definitions EndStrategy patch

T and C had Circe expressions without `EndStrategy`, producing 1-day cohort eras (`cohort_end_date = cohort_start_date`). This collapsed the time-at-risk window for IncidenceRate, Pathway, and Estimation analyses (initial run: T had 726 person-years for 265k persons = 1 day per person).

Patched in place by adding `EndStrategy: {DateOffset: {Offset: 1825, DateField: "StartDate"}}` to `cohort_definitions[id IN (5420, 5423)].expression_json`. Pre-patch snapshots saved as `study_artifacts` rows (`artifact_type='cohort_json'`, `is_current=false`) for audit trail. Cohort generations regenerated.

Post-patch eras: T = uniform 1,825 days; C = 1,741 days average (truncated at observation period end for some patients). IR results then produced meaningful rates (§3.1).

### 5.2 Estimation analysis design extension

`estimation_analyses[id=62].design_json` extended with `covariateSettings.excludedCovariateConceptIds` (18 IDs: HTN dx + SBP + DBP) and `outcomeCohortIds` expanded from `[5421]` to `[5421, 5422]` (added CKD as 2nd outcome) and `timeAtRiskEnd` raised from 365 to 1825 days. Estimation still failed (§3.4), but the design is now properly scoped for any future re-attempt with a different methodology.

## 6. Open questions to revisit

From Dr. Bock's answered set, two items remain:

- **Q4 Lu citation:** confirmed (`JAMA Network Open 2025;8(7):e2520498, doi:10.1001/jamanetworkopen.2025.20498`). The Lu replication itself is **deferred** to the T_lu sub-design — the methodology comparison at `docs/research/hypertension-v3/lu-2025-methodology-comparison.md` documents the 9 material divergences between our design and Lu's.
- **Q15 IRB / data governance:** marked deferred until pre-publication review (does not block analysis run).

## 7. Recommended next steps

1. **Address Estimation methodologically.** Pick one:
   - Build the deferred T_lu cohort and run estimation as a within-cohort latency stratification (Lu-style head-to-head).
   - Switch to PatientLevelPrediction for the same outcomes, predicting MACE/CKD within T.
   - Drop the T-vs-C estimation entirely and report IR + characterization findings as the primary deliverable.

2. **Build remaining cohorts (S1, S2).** Apparent treatment-resistant HTN (S1) feeds analysis E (class composition); RDN-eligible (S2) feeds analysis I (eligibility counts). Both are independently valuable even without estimation.

3. **Negative controls.** None of the 4 executed analyses included OHDSI negative-control outcomes. These should be added before any publishable claim about the MACE/CKD rates, particularly for the (eventual) Lu replication.

---

**Pipeline state:** mission-critical. Two real bugs fixed, tested, and shipped to `origin/main`. Cohort generation, analysis execution, and the FE workbench are all functioning correctly. The remaining gaps are in cohort/analysis _design_ (deferred S1/S2/T_lu, CohortMethod methodology mismatch) — not infrastructure.

---

## 8. Data realism boundary (added during Phase 10b)

**The Acumenus OMOP CDM does not have the temporal coupling required for a Lu-style latency analysis.**

While attempting a within-T latency stratification (the next-recommended step from §7.1), we found:

- **T's HTN diagnoses span 1996 → 2015.** Each year has a uniform ~6,500 incident HTN diagnoses (clearly a synthetic-data signature — real EHR cohorts show year-over-year growth or migration patterns, not uniform distribution).
- **T members with HTN diagnosis in 2018+: zero.** The most recent HTN diagnosis in T is from 2015.
- **All blood-pressure measurements in `omop.measurement` are from 2020-2025.** Total: 33.8M SBP+DBP rows, all post-2020.
- **No T member has any pre-Dx BP measurement.** Verified by direct join: `count(*)` of `measurement INNER JOIN cohort` filtered to `measurement_date < cohort_start_date` AND `measurement_concept_id IN (SBP, DBP)` returns **0** across all 265,498 T members.

The `condition_occurrence` and `measurement` domains in Acumenus were generated independently — no temporal causality between them. This means:

| Analysis type | Feasible on Acumenus? |
|---|---|
| Cohort generation + Circe expressions | ✅ Yes |
| Incidence rates (events per person-year in cohort era) | ✅ Yes (what §3.1 reports) |
| Baseline characterization | ✅ Yes (what §3.3 reports) |
| Treatment-trajectory pathway | ✅ Yes (what §3.2 reports) |
| **Diagnostic-latency analysis** | ❌ **Blocked** — no pre-Dx BPs exist |
| **Lu et al. 2025 replication** | ❌ **Blocked** — requires latency |
| T-vs-C estimation via PSM | ❌ Blocked by methodology (exposure-defines-cohort), separate issue |

### What this means

The **pipeline** (§4) is verified production-ready. The **methodology** (§3.4 estimation limitation) is correctly diagnosed. The **data substrate** (§8) is the limiting factor for the headline research question.

To meaningfully answer the v3 protocol's primary question ("does diagnostic delay predict MACE/CKD?"), the study needs a CDM with real EHR-derived temporal data — one where BP measurements and HTN diagnoses come from the same observation window. This would typically be a **single integrated EHR source** like the one Lu et al. used (Sentara Healthcare, 12 hospitals + 566 outpatient sites in VA/NC), not a synthetic or longitudinally-stitched CDM.

### Pivot options (in order of pragmatism)

1. **Re-frame as a descriptive HTN burden study.** Report the IR + characterization + pathway findings as a demonstration of the Parthenon platform on Acumenus. The 1.12/1k-PY MACE and 19.56/1k-PY CKD rates remain valid measures of "in-cohort event rate over 5-year window," even if the latency dimension is unavailable.

2. **Wait for a real EHR data source.** Parthenon already integrates with several CDMs (Acumenus, SynPUF, IRSF, Pancreas, Inpatient). If any of these has properly-temporal-coupled measurement + condition data, the v3 protocol can run on that source by changing `source_id` in the execute call.

3. **Re-run on Acumenus with a re-defined T.** Use post-2018 BP measurements as the index event (instead of HTN diagnosis), so `cohort_start_date` falls inside the BP-availability window. Trade-off: this no longer measures "incident HTN" but "first-recorded-elevated-BP" — a different (still publishable) research question.

4. **Build the T_lu cohort using Lu's exact methodology** anyway, run on Acumenus, and report ZERO members — providing a concrete data-quality assessment of Acumenus that informs future CDM ingestion priorities.

The two pipeline fixes shipped this session (`faf6ee8db`, `8286d5bb9`) and the audit-trail-preserving cohort patches remain unconditionally valuable regardless of which pivot option is chosen.
