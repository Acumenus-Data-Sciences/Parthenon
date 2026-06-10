---
doc_type: research
status: active
date: 2026-06-09
owner: acumenus
module: hypertension-v3
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Hypertension Study — Technical Reliability Confirmation & v4 Readiness Assessment

**Date:** 2026-06-09
**Author:** Acumenus Informatics (assessment)
**Inputs:** `Hypertension_v4c_Consolidated_Acumenus.docx` (Bock/Udoshi, 2026-05-22); live Acumenus OHDSI CDM (`omop`, source 47); re-run analysis executions 264–267.
**Scope of this document:** (1) confirm the v3 technical issues are corrected and reliable; (2) determine whether the v4c consolidated protocol is ready to advance the study to v4.

---

## 1. Executive Verdict

**Platform reliability: CONFIRMED.** All four technical defects identified in the v3 results report are fixed and verified end-to-end against live data. The population-level estimation sidecar — the headline failure — now runs the full CohortMethod pipeline and produces effect estimates.

**v4c readiness: CONDITIONALLY READY for Part 1; NOT a platform target for Part 2; document needs editorial cleanup.**

- **Part 1 (retrospective outcomes, v4)** is scientifically sound and the *core* analyses are data-supported, but it **cannot be built into `htn-v4` yet** — it is blocked on four cohort-defining open questions (all Dr. Bock's call) and a cluster of v4-specific goals that have **zero supporting data** in the Acumenus CDM.
- **Part 2 (prospective in-office BP pilot)** is, by the protocol's own admission, not executable end-to-end in Parthenon (prospective EPIC integration). It should be split into a separate out-of-platform track.
- **Part 3 (IRB/governance)** is complete and sound.
- The document carries **consolidation artifacts** (duplicated paragraphs, an empty Appendix 3, a BP-table boundary error) that should be cleaned before it is treated as the locked v4 protocol of record.

**Recommendation:** Do **not** stand up `htn-v4` yet. Close the four gating open questions, descope (or defer pending richer data) the goals the synthetic CDM cannot support, and clean the document. The platform is ready; the protocol inputs are not yet locked.

---

## 2. Technical Reliability — Fixes Verified

| # | Defect | Fix | Verification (live) | Status |
|---|--------|-----|---------------------|--------|
| 1 | **Estimation sidecar** "cannot open the connection" | Root cause was **missing `omop.*` vocabulary views** (FeatureExtraction emits `{cdmSchema}.concept`; vocab lives in the shared `vocab` schema; the views were lost in the Mar-22 CDM recovery). Restored 10 vocab views in `omop` + added an R connection-retry helper for genuine transient blips. | Execution **266** ran the full pipeline: data extraction → PS matching → Cox models → completed with 2 estimates. | ✅ Fixed |
| 2 | **Estimation hard-abort on covariate separation** | `errorOnHighCorrelation=FALSE` + `stopOnError=FALSE` in `createCreatePsArgs` (both estimation.R and the async worker). | PS model now fits and degrades gracefully instead of aborting (was the 2026-05-13 failure mode). | ✅ Fixed |
| 3 | **Age-binning → 100% "Unknown"** | Reversed `DATEDIFF` arg order in the `DemographicFeatureBuilder` guard (`DATEDIFF(start,end)` renders to `end−start`, so the guard was always-true). Replaced with a `year_of_birth` guard. | Characterization **267** now reports real groups: 18–34 **59.3%**, 35–49 **30.0%**, 50–64 **9.5%**, 65+ **1.2%**. | ✅ Fixed |
| 4 | **Incidence-rate CIs = 0/0** | Added Byar's Poisson 95% CI in the normalizer (accurate at small counts, defined at zero events). 4 unit tests added. | Incidence **264**: MACE 1.12 **[1.06, 1.18]**, CKD 19.56 **[19.32, 19.81]**, zero-event NCs **[0, 0.003]**. | ✅ Fixed |

**Files changed (working tree, uncommitted):**
`backend/app/Services/Analysis/Features/DemographicFeatureBuilder.php`, `backend/app/Support/IncidenceRateResultNormalizer.php` (+ test), `darkstar/R/connection.R`, `darkstar/api/estimation.R`, `darkstar/api/estimation_worker.R`, `scripts/sql/omop-vocab-views.sql` (new — the vocab-view DDL, idempotent, for re-application after any future recovery). Pint + PHPStan(level 8) + R parse all clean; touched tests pass.

### 2.1 Honest caveat on the estimation result

The engine is fixed; the *current estimates are not scientifically usable*, and that is a **comparator-design** problem, not a platform problem:

| Outcome | HR [95% CI] | Plausibility |
|---|---|---|
| MACE composite | **0.086** [0.076, 0.096] | Implausible — implies HTN patients have ~91% *lower* MACE risk than normotensives |
| Incident CKD | **7.96** [7.35, 8.63] | Direction plausible, magnitude inflated |

Propensity diagnostics: **AUC = 0.50** (no discrimination), **max SMD after matching 0.312 ≈ before 0.311** (matching did **not** improve balance). Because the separation escape-hatch dropped the structurally-separating covariates, the PS model has nothing left to balance on. This is the exact signature of the **non-comparable comparator (5425)** flagged in the v3 report (open question OQ-5). **The pipeline is reliable; the comparator must be redesigned before any estimate is interpretable.**

---

## 3. v4c Document Assessment

### 3.1 Structure & scope

The v4c file consolidates **two protocols + governance + open questions**:

- **Part 1** — Retrospective Outcomes Study (v4; lineage v1→v2→v3→v4a/b/c). Parthenon-executable. Candidate for 45 CFR 46.101(b)(4) Exempt.
- **Part 2** — Prospective In-Office BP Measurement Pilot. Cluster-randomized at EPIC sites; prospective interventional research. **Self-described as not end-to-end executable in Parthenon.**
- **Part 3** — IRB & data-governance framework (Bock regulatory summary, 2026-05-22). Complete.
- **Part 4** — Changelog (v3→v4) + 16 open/resolved questions + 4 appendices.

### 3.2 v3→v4 scientific changes (material)

Well-specified and reasonable: primary goal adds **drug dose**; Lu-2025 reproducibility demoted to a sensitivity analysis (citation now complete: *JAMA Netw Open 2025;8(7):e2520498*); secondary characterization expands to **four explicit delay groups** (≤3 / 3–6 / 7–12 / >12 mo) plus BMI, family-Hx, care-site typology; labs window −4 to +4 weeks of index; kidney exclusion moved to **eGFR/CrCl**; **all BP readings over 24 months** (no synthetic averaging windows); **two latency intervals** (first→second elevated, second→Dx); analysis by **BP stage** (not percentiles).

### 3.3 Gating open questions (BLOCKERS to building `htn-v4`)

These define the cohort and cannot be deferred to sensitivity analysis:

| OQ | Decision needed | Why it blocks | Owner |
|----|-----------------|---------------|-------|
| **OQ-11** | Index rule: "**average of two most recent consecutive** recordings" (v4c) vs "two consecutive elevated BPs" (v3). | Defines the **index date** and therefore the entire target cohort and both latency intervals. | Bock |
| **OQ-4** | Antihypertensive scope: "**Use JNC-8** first-line" (v4c) vs "ATC C02–C09 broad" (v3-adopted). | Defines the **treatment-naïve exclusion** AND the treatment-pathway/trajectory analysis. A direct reversal of the v3 answer. | Bock |
| **OQ-5** | Comparator matching: **PSM vs greedy 1:1** (age±2y, sex, race, index quarter). | The comparator-redesign blocker (§2.1). No interpretable estimate without it. | Bock + Udoshi |
| **OQ-13** | Kidney exclusion wording: **eGFR<60** (measured/estimated) vs CrCl vs CKD-dx. | Defines a cohort exclusion criterion. eGFR data exists (§3.5), so this is decidable. | Bock |

Lower-stakes still-open: OQ-1 (BP gap, defaulted 365d), OQ-6 (follow-up, confirmed all-available), OQ-7 (cost — see §3.5), OQ-8 (sample size), OQ-10/14/15/16.

### 3.4 Document-quality / consolidation defects (fix before locking)

- **§3 (Secondary goals):** the line *"Also should include a data poinrt of 0 for those patients assigned a HTN diagnosis after the first elevated office BP"* is **repeated 4×**, mid-sentence, with a typo ("poinrt"). Intent unclear — needs a clean single statement.
- **Part 2 → Part 3 boundary:** the sentence *"Before embarking on Part 2 project… EHR modifications."* is **repeated 4×**, and the **"Part 3 — IRB and Data-Governance Framework" heading is merged into a body paragraph** (a heading/paragraph collision).
- **Appendix 3 (EHR-embedded protocol for Study 2)** is **empty** — yet Part 2 repeatedly references "Appendix 3", "Figure 1", and "the embedded algorithm." Part 2 is not specifiable without it.
- **Appendix 1 BP table:** Stage 1 DBP listed as **"80–90"** and Stage 2 as **"≥90"** — a boundary **overlap at 90** (Stage 1 should be 80–89). Minor but a protocol classification table must be unambiguous.
- Authoring placeholders remain: *"(need procedural flow chart)"*, *"***do we need to document… what the embedded code will look like?)"*.
- Scattered typos/spacing ("EHR -driven", "Combinator", double spaces).

### 3.5 Data feasibility against the Acumenus CDM (the decisive factor)

Probed live against `omop` (1,005,788 persons). **Core retrospective machinery is well-supported; a cluster of v4-specific asks has _zero_ data.**

| Protocol element | CDM evidence | Feasible? |
|---|---|---|
| Source population | 1,005,788 persons | ✅ |
| Office BP (SBP/DBP) | 17,057,332 each | ✅ abundant |
| HTN diagnoses (essential HTN tree) | 380,336 rows | ✅ |
| Antihypertensive exposure | 86,071,493 drug rows; quantity & days_supply fully populated | ✅ |
| eGFR (OQ-13 exclusion) | 14,963,943 measurements | ✅ |
| BMI | 14,720,962 measurements | ✅ |
| Mortality outcomes | 54,205 death rows | ✅ |
| **Drug _dose_** (new v4 primary goal, OQ-14) | **`dose_unit_source_value` = 0 rows** | ❌ **no dose units** |
| **Care-site typology** (Medicaid/office/trainee/hospital — sec goal) | 5,630 care sites but **1 distinct `place_of_service`** | ❌ **cannot stratify** |
| **BP source** (office vs home vs ABPM) | **2 distinct `measurement_type` values** | ❌ **cannot distinguish** |
| **Serum aldosterone** (hyperaldosteronism workup) | **0 measurements** | ❌ |
| **Renal denervation** (eligibility + 1/3/6/12-mo BP goal) | **0 procedures** | ❌ |
| **Family history of HTN** (characterization) | **0 observations** | ❌ |
| **Cost** (incremental-cost analysis, OQ-7) | `omop.cost` exists, **0 rows** | ❌ |

The zero-data cluster is the same failure mode as the v3 negative-control outcomes (which returned 0 events): the Acumenus CDM is **synthetic (Synthea-derived)**, so concepts requiring real-world EHR provenance (dose units, place-of-service variety, BP-device/source flags, specialty labs, novel procedures, family history, cost) are absent.

---

## 4. Readiness Verdict by Protocol Part

**Part 1 — Retrospective Outcomes (v4): CONDITIONALLY READY.**
Buildable once (a) the four gating OQs (§3.3) are answered, and (b) the data-blocked goals (§3.5) are descoped or deferred. The **executable v4 core** is: prevalence of delayed diagnosis, the two latency intervals, the four delay-group characterization (age/sex/race/BMI/region, **not** care-site type or family-Hx), antihypertensive selection (class — **not dose**), BP-stage trajectory, MACE & CKD incidence/outcomes, and mortality. With a **redesigned comparator (OQ-5)**, the population-level estimation is now technically ready to run.

**Part 2 — Prospective BP Pilot: NOT A PARTHENON BUILD TARGET.**
Prospective EPIC integration is out-of-platform. Recommended split (per the doc itself): EPIC-side protocol + training out-of-platform; a separate Parthenon record (`htn-pilot-bp-capture-2026`) for post-pilot ingestion + comparability/outcome analysis. Appendix 3 (the embedded algorithm) must be authored before Part 2 is specifiable at all.

**Part 3 — IRB/Governance: READY.** Exempt-path framing, no master-link list, analysis-plan pre-registration to `study_artifacts`, HIGHSEC route protection — all consistent with platform capabilities. Per-protocol IRB filings remain a process task, not a platform blocker.

**Part 4 — Open Questions: 4 gating + several sensitivity-level still open.**

---

## 5. What Must Close Before Building `htn-v4` (checklist)

1. **OQ-11** — lock the index-date rule (average-of-two vs two-consecutive). *Cohort-defining.*
2. **OQ-4** — lock antihypertensive scope (JNC-8 vs ATC broad). *Treatment-naïve + pathways.*
3. **OQ-5** — choose comparator matching and **redesign cohort 5425 to be recording-comparable** so the PS model can balance (fixes the §2.1 AUC-0.50 problem). *Estimation validity.*
4. **OQ-13** — lock the eGFR/CrCl exclusion (eGFR data confirmed available).
5. **Descope on this CDM** (or gate on richer ingestion): drug **dose**, **care-site typology**, **office/home/ABPM** distinction, **aldosterone**, **renal denervation**, **family history**, **cost**. State explicitly in the protocol which goals are deferred pending real-world data.
6. **Replace the negative-control panel** with controls that actually occur in this CDM (the current 12 return ~0 events → empirical calibration is non-functional).
7. **Document cleanup** — de-duplicate §3 and the Part-2/3 boundary, author Appendix 3, fix the Appendix 1 BP-stage boundary, resolve placeholders.

Once 1–4 and 6 are resolved and 5/7 are acknowledged, the platform can build and run `htn-v4` Part 1 reliably.

---

### Appendix — Evidence provenance
Executions: characterization **267**, incidence **264**, estimation **266** (source 47, `omop`). Feasibility counts queried live against `omop`/`vocab` on 2026-06-09. Estimation diagnostics from `analysis_executions.result_json` (266). No CDM data modified; the only schema change was additive vocab views in `omop` (`scripts/sql/omop-vocab-views.sql`).
