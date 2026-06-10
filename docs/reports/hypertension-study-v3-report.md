# Hypertension Study (V3) — Analysis Report & Interpretation

**Study ID:** 114 (`hypertension-study-v3-2`)
**Study type:** Characterization
**Data source:** OHDSI Acumenus CDM (`source_id = 47`, key `ACUMENUS`), OMOP CDM v5.4
**Status:** running
**Origin:** Created from protocol upload `Hypertension study (v3).docx`
**Report compiled:** 2026-06-09
**Latest analysis run:** 2026-06-09 (post-fix re-run — executions 264 / 266 / 267)

> **Scope note.** This report reflects the analyses currently *linked* to study 114 in `app.study_analyses` and their executions in `app.analysis_executions`. The study record itself carries no populated objective/hypothesis text (it was imported from a protocol document), so the interpretation below is derived from the analysis designs and their results rather than from a stated protocol.
>
> **Two snapshots.** §0 below is the **current state** after the 2026-06-09 platform fixes and re-run. §§1–7 are the **original as-found snapshot** (pre-fix executions 259–262, 2026-05-19) preserved for the forensic record and the before→after comparison.

---

## 0. Current State — Post-Fix Re-Run (2026-06-09)

After the four platform defects were corrected (estimation sidecar, separation handling, age-binning, incidence CIs — see `docs/research/hypertension-v3/reports/v4-readiness-assessment.md`), all four analyses were re-run on source 47. The current results supersede §§1–7 below where they differ.

| Analysis | Before (259–262) | Now (264/266/267) |
|----------|------------------|-------------------|
| **Characterization** age groups | 100% "Unknown" (binning bug) | **Real**: 18–34 59.3%, 35–49 30.0%, 50–64 9.5%, 65+ 1.2% |
| **Incidence rate** 95% CIs | `0 / 0` placeholders | **Real Byar CIs**: MACE 1.12 **[1.06, 1.18]**, CKD 19.56 **[19.32, 19.81]**, zero-event NCs **[0, 0.003]** |
| **Estimation** | FAILED ("cannot open the connection") | **Completes** — full CohortMethod pipeline produces HR estimates |

### Population-level estimation (execution 266) — now runs, but not yet interpretable

| Outcome | HR [95% CI] | p | Plausibility |
|---------|-------------|---|--------------|
| MACE composite | **0.086** [0.076, 0.096] | <0.0001 | Implausible — implies HTN patients have ~91% *lower* MACE risk than normotensives |
| Incident CKD | **7.96** [7.35, 8.63] | <0.0001 | Direction plausible, magnitude inflated |

Propensity diagnostics: **AUC = 0.50** (no discrimination), **max SMD after matching 0.312 ≈ before 0.311** (matching did *not* improve balance); 0 of 12 negative controls fitted (≈0 events). **Read: the engine is reliable, but these estimates are invalid because comparator 5425 is structurally non-comparable** (the separation escape-hatch dropped the separating covariates, leaving the PS model with nothing to balance on). Fixing this requires the comparator redesign — open question **OQ-5**, still pending — not a platform change.

> The sections below (§§1–7) describe the **pre-fix** state and remain accurate as the as-found baseline; their "data-quality flags" (age = Unknown, CIs = 0/0) and the estimation **failure** are the defects that §0 confirms are now resolved.

---

## 1. Study Design Summary

The study is built around a treatment-naïve incident-hypertension target compared against an always-normotensive pool, with a MACE composite and incident CKD as the outcomes of interest, plus a panel of 12 negative-control outcomes for empirical calibration.

### Cohorts

| Role | ID | Name | Generated size |
|------|----|------|---------------:|
| **Target (T)** | 5424 | Incident essential hypertension, treatment-naive | 265,498 |
| **Comparator (C)** | 5425 | Always-normotensive comparator pool (pre-PSM) | 648,216 |
| **Outcome O1** | 5426 | MACE composite (MI + stroke + inpatient HF + death) | 118,262 |
| **Outcome O2** | 5427 | Incident CKD | 160,819 |
| **Negative controls** | 5428–5439 | 12 control outcomes (acne, URI, allergic rhinitis, atopic dermatitis, cellulitis, bunion, hemorrhoids, onychomycosis, otitis media, plantar fasciitis, sciatica, verruca) | (see §3) |

*Generated size = members in `results.cohort` DB-wide. The inferential analyses operate on the subset entering each analysis's time-at-risk window.*

### Linked analyses

| # | Analysis | ID | Design intent | Latest exec | Status |
|---|----------|----|--------------|------------:|--------|
| 1 | Baseline Characterization | 41 | Describe baseline covariates, T vs C, top-100 features per domain | 259 | ✅ completed |
| 2 | Incidence Rate | 58 | Source-specific incidence rates, TAR 1–1825 d | 260 | ✅ completed |
| 3 | Treatment Pathways | 20 | Treatment sequence patterns (TreatmentPatterns) | 261 | ✅ completed (degenerate) |
| 4 | Population-Level Estimation | 63 | CohortMethod, PS matching, Cox, T vs C on O1/O2 | 262 | ❌ error |

Each analysis has been executed four times (2026-05-13 ×3, 2026-05-19 ×1). The figures below use the **most recent** execution of each.

---

## 2. Baseline Characterization (Analysis 41, exec 259)

Target n = **265,498**; Comparator n = **648,216**. Top 100 features extracted per domain (demographics, conditions, drugs, measurements, procedures) with standardized mean differences (SMD) between T and C.

### Demographics

| Feature | Target | Comparator | SMD |
|---------|-------:|-----------:|----:|
| Male | 56.7% | 47.1% | 0.194 |
| Female | 43.3% | 53.0% | 0.194 |
| White | 78.0% | 85.0% | 0.179 |
| Black or African American | 15.7% | 9.7% | 0.179 |
| Asian | 3.8% | 3.2% | 0.030 |

**Age Group is reported as 100% "Unknown" in both cohorts** — age binning did not populate. This is a data-quality defect in the characterization output, not a true finding, and should be corrected before any age-stratified interpretation.

### Conditions — comorbidity enrichment in the HTN cohort (expected direction)

| Condition | Target | Comparator | SMD |
|-----------|-------:|-----------:|----:|
| Essential hypertension | 100.0% | 4.9% | 6.22 |
| Metabolic syndrome X | 17.1% | 1.6% | 0.55 |
| Disorder of kidney due to diabetes mellitus | 12.6% | 0.5% | 0.50 |
| Anemia | 11.8% | — | — |
| Prediabetes | 10.8% | — | — |
| Chronic kidney disease stage 1 | 8.7% | 0.5% | 0.40 |
| Hypertriglyceridemia | 5.6% | — | — |
| Type 2 diabetes mellitus | 3.4% | — | — |

The target cohort shows the expected cardiometabolic clustering around hypertension (metabolic syndrome, diabetic kidney disease, CKD, dyslipidemia). Essential hypertension at 100% in T is tautological (entry criterion).

### Drugs — antihypertensive signature in the target

Top target drugs: lisinopril 10 mg (8.3%), hydrochlorothiazide 25 mg (7.3%), amlodipine 2.5 mg (6.8%), metoprolol succinate ER 100 mg (2.6%), simvastatin (4.4% combined), clopidogrel 75 mg (1.9%), nitroglycerin spray (2.9%). This is a coherent treated cardiovascular pharmacotherapy profile.

### ⚠️ Structural imbalance between T and C (interpretation caveat)

Several of the largest SMDs run **opposite** to clinical intuition and reveal how the comparator pool was constructed rather than true biology:

- **Vital-sign / lab measurements are ~100% in the comparator vs ~10% in the target** (systolic/diastolic BP, heart rate, respiratory rate, body weight/height, BMI, CBC indices; SMD 3.7–4.2). The comparator requires *documented BP measurements* by definition, so measurement presence is near-universal there and sparse in the target.
- **Dental / minor-acute conditions are far more prevalent in the comparator** — gingivitis (5.1% vs 56.3%), viral sinusitis (2.6% vs 41.3%), dental caries, acute pharyngitis, bronchitis (SMD 0.7–1.3) — and the comparator's dominant drugs are "Unknown" (98.5%) and sodium fluoride dental gel (65%).

These patterns are characteristic of **synthetic (Synthea-style) data** with heavy preventive/dental encounter generation, and they indicate the comparator and target differ structurally in *what was recorded*, not only in disease status. This has direct consequences for the estimation step (§5).

---

## 3. Incidence Rate (Analysis 58, exec 260)

Persons at risk = 265,498 (the target cohort). Time-at-risk 1–1825 days from cohort start. Rates expressed per 1,000 person-years.

| Outcome | Cohort | Events | Person-years | Rate /1,000 PY |
|---------|-------:|-------:|-------------:|---------------:|
| **Incident CKD** | 5427 | 24,756 | 1,265,330 | **19.56** |
| **MACE composite** | 5426 | 1,482 | 1,323,205 | **1.12** |
| NC: Allergic rhinitis | 5429 | 4,495 | 1,319,894 | 3.41 |
| NC: Otitis media | 5436 | 232 | 1,326,235 | 0.17 |
| NC: Acne, URI, atopic dermatitis, cellulitis, bunion, hemorrhoids, onychomycosis, plantar fasciitis, sciatica, verruca | 5428, 5430–5435, 5437–5439 | 0 | ~1,326,581 | 0.00 |

**Interpretation.**
- Within the hypertensive target cohort, **incident CKD (~19.6 /1,000 PY) is roughly 17× more frequent than the MACE composite (~1.1 /1,000 PY)**. The high CKD rate is consistent with the comorbidity profile in §2 (diabetic kidney disease 12.6%, CKD stage 1 8.7%) — renal endpoints accrue much faster than hard cardiovascular events in this population.
- **10 of 12 negative controls returned zero events**, and only 2 (allergic rhinitis, otitis media) fired. For empirical calibration you want negative controls that actually occur at non-trivial frequency; this panel is effectively non-informative in this dataset, which undermines the calibration design (§5).

### ⚠️ Confidence intervals not computed
Every row reports `rate_95_ci_lower = 0` and `rate_95_ci_upper = 0`. The point estimates are valid but the CI fields are unpopulated placeholders — do not read them as "CI includes zero." This is an output limitation of the incidence-rate executor.

### Note on the apparent count discrepancy
The outcome cohorts contain 118,262 (MACE) and 160,819 (CKD) members *DB-wide*, but the incidence analysis counts 1,482 and 24,756. This is expected: the incidence step counts only first outcomes occurring **within the 1–1825-day at-risk window for members of the target cohort**, not every member of the outcome cohort across the whole database.

---

## 4. Treatment Pathways (Analysis 20, exec 261) — degenerate output

The pathway analysis completed but produced a **single, non-informative pathway**:

- Target = 265,498; persons with events = 1,482; persons without events = 264,016.
- Unique pathways = 1: `["MACE composite"]`, n = 1,482 (0.56%).

**Root cause: misconfigured event cohorts.** The design's `eventCohortIds` are `[5425, 5426]` — the *comparator pool* and the *MACE outcome*. A treatment-pathway analysis needs the event cohorts to be **treatment cohorts** (e.g., antihypertensive drug classes — ACE inhibitors, thiazides, CCBs, beta-blockers), so it can describe drug-sequence patterns. As configured, it simply re-discovered who experienced MACE. This analysis should be re-specified with antihypertensive treatment cohorts as the events before it yields anything meaningful.

---

## 5. Population-Level Estimation (Analysis 63, exec 262) — FAILED

Design: CohortMethod, T (5424) vs C (5425), outcomes MACE (5426) and CKD (5427), propensity-score **matching**, Cox proportional-hazards model, TAR 1–1825 days, demographics + long-term condition-occurrence covariates, with BP/vital measurement concepts placed on the `excludedCovariateConceptIds` list.

**No effect estimate was produced.** Two distinct failure modes across runs:

| Run | Date | Failure | Type |
|-----|------|---------|------|
| exec 258 | 2026-05-13 | "High correlation between covariate(s) and treatment detected. Perhaps you forgot to exclude part of the exposure definition from the covariates?" | **Statistical (separation)** |
| exec 262 | 2026-05-19 | "cannot open the connection" (after 12.9 s, during CohortMethod data extraction) | **Infrastructure (R sidecar / DB connection)** |

**Interpretation.**
1. The most recent attempt (262) died on an **infrastructure error** — the R/CohortMethod sidecar could not open its database connection during data extraction. This is a transient/environmental failure, not a result, and should be retried once the sidecar connection is healthy.
2. The earlier, statistically-meaningful attempt (258) failed with **complete/quasi-complete separation** in the propensity model: covariates predict treatment status almost perfectly. This is the direct, predictable consequence of the structural T-vs-C imbalance documented in §2 — the comparator is defined by having BP measurements and carries a very different recording profile, so the PS model can separate the groups trivially. Excluding the BP measurement concept IDs was not sufficient because the separation is driven by the broader recording-pattern difference (near-universal measurements and dental/acute conditions in C), not just the BP concepts themselves.

**Bottom line:** the comparative-effectiveness estimate (HR for MACE/CKD, treated HTN vs normotensive) is **not available**. Even if the connection error is fixed, the separation problem will likely recur until the comparator is redesigned to be recording-comparable to the target.

---

## 6. Overall Interpretation

**What the study credibly shows today:**
- A large incident-hypertension cohort (265k) on the Acumenus CDM with a clinically coherent comorbidity and pharmacotherapy profile (metabolic syndrome, diabetic kidney disease, CKD, statins + standard antihypertensives).
- Within that cohort, **incident CKD accrues ~17× faster than hard MACE events** over a 5-year at-risk window (19.6 vs 1.1 per 1,000 PY) — renal burden dominates the measurable outcome signal in this population.

**What it does not yet show, and why:**
- **No causal/comparative effect estimate.** The estimation step failed on infrastructure (latest run) and, before that, on propensity-model separation driven by a structurally non-comparable comparator.
- **No meaningful treatment pathways** — the pathway analysis was pointed at the comparator pool and the MACE outcome instead of antihypertensive treatment cohorts.
- **Weak empirical calibration footing** — 10 of 12 negative controls produced zero events, so the calibration panel cannot currently characterize residual bias.

**Data-quality flags to resolve:**
1. Age Group renders as 100% "Unknown" in characterization — age stratification is broken.
2. Incidence-rate 95% CI bounds are unpopulated (reported as 0/0).
3. Strong evidence the source is synthetic/Synthea-style data (dental-gel dominance, universal preventive measurements) — interpret all absolute prevalences as synthetic, not epidemiologic.

---

## 7. Recommended Next Actions

1. **Re-run the estimation (Analysis 63)** once the R sidecar DB connection is confirmed healthy — the 2026-05-19 failure was environmental. Verify the connection before declaring any statistical result.
2. **Redesign the comparator (5425)** to be recording-comparable to the target — e.g., require the same baseline observation/measurement footprint — to eliminate propensity-model separation. Alternatively, switch to a treated-vs-treated (active comparator) design, which is the LEGEND-HTN pattern already present in this platform (study 55).
3. **Re-specify the treatment-pathway analysis (20)** with antihypertensive drug-class event cohorts instead of `[5425, 5426]`.
4. **Replace or supplement the negative-control panel** with controls that actually occur in this dataset, so empirical calibration can function.
5. **Fix the characterization age-binning** and the incidence-rate CI computation in the executors.

---

### Appendix — Provenance

| Artifact | Value |
|----------|-------|
| Study | `app.studies.id = 114` |
| Linked analyses | `app.study_analyses` ids 119–122 → Characterization 41, IncidenceRate 58, Pathway 20, Estimation 63 |
| Executions (latest) | char 259, incidence 260, pathway 261, estimation 262 (all `source_id = 47`) |
| Result payloads | `app.analysis_executions.result_json` |
| Cohort generation counts | `results.cohort` for definitions 5424–5427 |

*All figures read directly from the production database (host PG17, `parthenon`) on 2026-06-09. No data was modified.*
