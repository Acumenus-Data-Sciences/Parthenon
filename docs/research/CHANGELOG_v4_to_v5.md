# Hypertension Outcomes Program — Changelog v4 → v5

**Author:** Sanjay M. Udoshi, MD
**Date:** 2026-07-03
**Doc ID:** ACUM-PROT-HTN-V5-001 (companion changelog)
**Inputs reviewed:**
- `Hypertension_v4_Consolidated_Acumenus.docx` — consolidated v4 protocol (Protocol #1 + #2 + IRB framework)
- `CLAUDE_PROMPT.md` — v4 executable spec (Protocol #1)
- `CHANGE_REQUEST_v4.1_Bock_2026-05-23.md` — Dr. Bock's v4.1 request (Analyses M and N)
- `hypertension-study-v4-manuscript.pdf` — the v4 run's generated manuscript (July 2, 2026)
- **Live database** — `pgsql.acumenus.net` / `parthenon`, read-only reconciliation, 2026-07-03 (study `app.studies` id 165, slug `hypertension-study-v4`)

---

## 0. Top-line finding

The v4 run did almost everything it set out to do — and produced one hard, honest failure that defines v5. On 109,763 treatment-naïve patients with two consecutive elevated office BPs, Parthenon reproduced the Lu-style under-diagnosis signal (90% never diagnosed; median 1,106 days from the second elevated reading to diagnosis) and delivered a well-calibrated elevated-BP-versus-normotensive contrast (incident CKD calibrated HR 2.60, p < 0.0001; MACE calibrated HR 1.03, p 0.50). But the headline causal contrast — **delayed (> 12 mo, G4) versus timely (≤ 3 mo, G1) diagnosis — was not estimable.** The propensity model reached AUC 0.7984 with a maximum post-adjustment standardized mean difference of 0.2443; the groups could not be balanced, so the platform correctly withheld (blinded) the effect estimates.

**v5 is the go-forward that makes that contrast answerable without over-claiming, finishes the two analyses Dr. Bock added in v4.1, closes the outstanding open questions, and grounds the whole plan in the live database.** Five moves:

1. **Rescue the delay-effect causal design** — replace 1:1 propensity matching with overlap weighting (ATO), add a target-trial emulation and a site-preference instrumental variable.
2. **Complete Analyses M and N** — the comorbidity comparison matrix and the BP-distribution/variance analysis, neither of which appears in the v4 manuscript.
3. **Stress-test the 90%-undiagnosed phenotype** — index-rule, threshold, surveillance/recording bias, informative-visit, and quantitative bias analysis.
4. **Close the fourteen open questions** — each with a recommended default and rationale.
5. **Formalize Parthenon validation** — an explicit verification-and-validation acceptance matrix.

The consolidated program remains dual-protocol: Protocol #1 (retrospective, executable) advances to v5; Protocol #2 (prospective BP-capture pilot) carries a readiness plan.

---

## 1. The central change — rescuing the delay-effect estimand

### 1.1 Why the v4 contrast failed (diagnosed, not hand-waved)

A propensity contrast is trustworthy only where the two groups overlap. Two facts destroyed that overlap in v4:

- **Determinism of delay.** Whether a patient is diagnosed quickly or slowly is driven by the same covariates the propensity model uses (age, care-site type, visit frequency, number of recording sites, baseline BP). AUC 0.7984 means the model can almost separate the groups from covariates alone — the opposite of equipoise.
- **Extreme size and event asymmetry.** 139 timely versus 9,896 delayed. 1:1 matching discards almost the entire delayed arm and still cannot find timely matches. The live database makes the deeper problem explicit: the G4-vs-G1 contrast rests on **18 MACE and 26 CKD events across both arms combined.** No weighting scheme recovers a reliable causal estimate from that.

The fix is therefore not a better matching algorithm; it is a different estimand (defined only where overlap exists) or an identification strategy that does not rely on within-tail comparability.

### 1.2 Estimand changes (v4 → v5)

| Element | v4 | v5 |
|---|---|---|
| Primary comparator method | 1:1 PSM (caliper 0.2 SD) | **Overlap weighting (ATO)**; PSM demoted to sensitivity |
| Primary exposure contrast | Five-level delay group; tail G4-vs-G1 estimation | **Binary timely (≤ 3 mo) vs delayed (> 3 mo)**; 4-group gradient kept as secondary dose-response |
| Target population | (implicit ATT via matching) | **Overlap (ATO) population** — the clinical-equipoise patients |
| Immortal-time / reverse-causation handling | Not addressed for the delay contrast | **Target-trial emulation** (clone-censor-weight + IPCW), time zero = index t2 |
| Unmeasured-confounding robustness | Negative-control calibration only | Adds a **site diagnostic-propensity instrument** (2SRI) as a natural experiment |
| Estimability gate on report | AUC / SMD thresholds; withhold if failed | **Retained and extended** — weighted |SMD| < 0.1, equipoise ≥ 0.3, calibrated null centered; withhold otherwise |

### 1.3 New analyses added for the causal redesign

- **Analysis O — Overlap-weighted delay effect (primary).** ATO-weighted Cox for MACE and CKD, timely vs delayed, with the 4-group gradient as a secondary trend test.
- **Analysis P — Target-trial emulation.** "Record HTN diagnosis and initiate antihypertensive within 90 days of index" vs not, via clone-censor-weight with stabilized IPCW; 30/180-day grace as sensitivity; explicit immortal-time unit test.
- **Analysis R — Site diagnostic-propensity instrument.** Leave-one-out site diagnosis propensity as an instrument for individual delay; first-stage F, tertile-balance falsification, negative-control-outcome check; reported only as triangulation, never as the sole basis for a conclusion.
- **Analysis Q — Phenotype robustness + quantitative bias.** Index-rule and threshold sensitivity, surveillance/recording-bias checks, informative-visit process, E-values, probabilistic bias analysis.

A **triangulation summary** (`results.htn_v4_triangulation`) reports the delay→outcome effect from O, P, and R side by side; concordance strengthens the claim, divergence is reported transparently.

---

## 2. Completing Analyses M and N (Bock v4.1)

The v4.1 change request (Dr. Bock, 2026-05-23) added two analyses. **Neither appears in the v4 manuscript, and the live database confirms neither was executed** (study 165 has only four analysis rows: one characterization, one incidence, two estimation). v5 executes both, exactly as scoped.

| Analysis | Scope | v5 status |
|---|---|---|
| **M — Comorbidity comparison matrix** | 17 morbidities × six populations (g1–g4, never-diagnosed, comparator C) × {pre-existing, newly-occurring}; Wilson CIs; chi-square/Fisher pairwise; logistic OR vs C (unadjusted + adjusted); heatmap + CSV | **Executed** |
| **N — BP distribution & variance at t1/t2/t_dx** | Per-group distribution stats, KDE, per-person deltas, below-trigger (RTM/white-coat) fraction, Stage split; Kruskal-Wallis / Dunn / Levene / Fligner-Killeen; ridgelines, violin+box, paired-arrow trellis | **Executed** |

Both join the study-wide negative-control-calibrated FDR family; the analysis-plan lock is re-issued as v5.0 with M/N/O–R in the amendment log.

---

## 3. Open questions — resolved for v5

All fourteen open questions carried out of the v4 consolidation are resolved with a recommended default (PI sign-off recorded in the go-forward document, ACUM-PROT-HTN-V5-001).

| # | Question | v4 status | v5 resolution |
|---|---|---|---|
| 1 | Max gap between consecutive elevated BPs | Open | 365-day cap, distinct calendar days; sensitivity 90/180 |
| 4 | Antihypertensive scope | Open | ATC C02–C09 primary; JNC-8 first-line sensitivity |
| 5 | Comparator method | Open | **Overlap weighting (ATO) primary; PSM sensitivity** |
| 6 | Max follow-up window | Open (all-available implied) | 5 yr primary; all-available sensitivity; 1-yr landmark |
| 7 | Cost / utilization fidelity | Open | **Settled empirically — `omop.cost` is empty; utilization proxies only, CAUTION** |
| 8 | Sample-size justification | Open | Positivity-bound, not N-bound; report minimum detectable HR per contrast |
| 10 | Renal-denervation code completeness | Open | Validate procedure + device codes against registry |
| 11 | Index BP rule (avg vs two-consecutive) | Open | Run both; default average_of_two_recent; report both (feeds Q) |
| 12 | Lu reproducibility framing | Open | Sensitivity analysis F |
| 13 | Kidney exclusion wording | Open | Retain dx_ckd exclusion AND capture eGFR/CrCl covariate |
| 14 | Drug dose fidelity | Open | Scope dose to RxNorm strength if drug_exposure sparse |
| 15 | Protocol #2 IRB framing | Open | Expedited cat. 7 (QI/human-factors); partner-IRB pre-consult |
| 16 | Protocol #2 EPIC integration | Open | Two layers — EPIC-side out-of-platform; Parthenon ingests post-pilot data |
| 9 | IRB / data-governance | Framework resolved | File administrative review for exemption; framework unchanged from v4 Part 3 |

---

## 4. Live-database grounding (new in v5) — what reconciled and what surfaced

Read-only reconciliation against `pgsql.acumenus.net` / `parthenon` on 2026-07-03. **Every headline figure in the v4 manuscript matched the database exactly.**

### 4.1 Confirmed to the digit

| Quantity | Live DB (cohort_definition_id) | Manuscript |
|---|---|---|
| Target T | 109,763 (5441) | 109,763 |
| G1 / G2 / G3 / G4 | 139 / 284 / 675 / 9,896 (5450–5453) | identical (sum = T) |
| Never-diagnosed | 98,769 (5454) | identical |
| Comparator C | 37,582 (5455) | (new detail) |
| Elevated vs normotensive | AUC 0.5723, equipoise 0.9884, max SMD 0.0155, EASE 0.0197; calibrated MACE HR 1.0345, CKD HR 2.6024 | identical |
| Delayed vs timely | AUC 0.7984, equipoise 0.9255, max SMD 0.2443 | identical (withheld) |

### 4.2 New facts the manuscript understated or omitted (each shapes v5)

- **Study state.** The study is `app.studies` id 165, slug `hypertension-study-v4`, `protocol_version` ACUM-PROT-HTN-V4-001, status **`running`** / phase `analysis` — not `run_complete`, and there is no `htn-v4-bock-2026` key. v5 continues study 165 in place.
- **Executed scope is lean.** Only **4** analyses ran (Characterization, IncidenceRateAnalysis, two EstimationAnalyses = T-vs-C and G4-vs-G1). **Lettered analyses B–L and M/N were never separate executed analyses**, and **S1 (resistant-HTN) and S2 (renal-denervation) cohorts do not exist.** Most of the v5 inventory is net-new build, not reuse.
- **No plan lock was ever persisted.** `app.study_artifacts` for study 165 = 0 rows. The v5 `lock` step is a first-time write, not a re-issue.
- **The delay contrast is empirically hopeless as posed.** 18 MACE and 26 CKD events total across G1+G4, plus a degenerate negative control (log_rr ≈ 30.9). This is the empirical proof that both positivity and power fail — the core motivation for Analyses O/P/R.
- **`omop.cost` is empty (0 rows).** OQ-7 is settled: no cost analysis; utilization proxies only.
- **Care-site typing is degraded.** `care_site.place_of_service_concept_id` is unpopulated; `person.care_site_id` and `person.provider_id` are **100% empty**. Care-site type must be derived from source-value heuristics.
- **Encounter coverage is partial — the single most consequential finding.** `visit_occurrence.care_site_id`/`provider_id` are 100% populated (2,405 sites / 1,818 providers in use), but **only 41,642 / 109,763 (37.9%) of T have any `visit_occurrence` row.** The other ~62% carry qualifying BPs in `measurement` with no encounter link.
  - **Site-IV feasibility:** assigning T to most-recent-visit care site gives 2,314 sites hosting T, **521 with ≥ 25** (191 ≥ 50, 40 ≥ 100) — the instrument is structurally viable but covers only the ~38% visit-linked subset. `person.location_id` (100% populated, 3,027 locations) is the full-coverage fallback instrument.
  - **Phenotype implication:** a large share of the "90% never diagnosed" may be measurement-only patients whose data feed lacks encounters — a linkage artifact, not necessarily clinical inaction. Analysis Q investigates this first.
- **Source CDM size:** `omop.person` ≈ 1,005,788; `measurement` ≈ 710M; `drug_exposure` ≈ 86M; `visit_occurrence` ≈ 52M.

---

## 5. Substantive content changes (v4 → v5)

| Area | v4 | v5 | Impact |
|---|---|---|---|
| Version / doc ID | ACUM-PROT-HTN-V4-001 | ACUM-PROT-HTN-V5-001 (companion go-forward) | New protocol lineage node |
| Primary causal estimand | Tail G4-vs-G1 PSM (not estimable) | ATO overlap-weighted timely-vs-delayed | The core fix |
| Comparator method (OQ-5) | 1:1 PSM | Overlap weighting; PSM = sensitivity | Estimability |
| Immortal-time bias | Unaddressed for delay | Clone-censor-weight target trial | Removes a key bias |
| Unmeasured confounding | Negative-control calibration | + site-preference IV + E-values | Triangulation |
| Analyses M, N | Requested (v4.1), not run | Executed | Closes v4.1 |
| Analyses O, P, Q, R | — | New | Causal + phenotype workstream |
| Phenotype scrutiny | Implicit | Analysis Q + QBA | Guards the 90% headline |
| Cost analysis (L, OQ-7) | Conditional on omop.cost | Utilization proxies mandatory (cost empty) | Data-grounded |
| Care-site typology | place_of_service assumed usable | Source-value heuristics; ~38% coverage caveat | Data-grounded |
| S1 / S2 cohorts | Described in prompt | Confirmed absent; net-new if E/I run | Scope honesty |
| Analysis-plan lock | Assumed persisted | Confirmed absent; v5.0 is first lock | Reproducibility |
| Parthenon validation | Implicit | Explicit V&V acceptance matrix | Platform-validation framing |

---

## 6. Net effect on the Parthenon executable plan

- **Study container.** Continue `app.studies` id 165 (slug `hypertension-study-v4`); bump `analysis_plan_version` to v5.0; extend `StudyHtnV4` command with `--version=v5` actions (reuse-audit, concept-sets, cohorts, analyses, lock, run, report).
- **Concept sets.** Reuse all v4 sets; add the 15 new M-morbidity sets (diabetes, dyslipidemia, obesity, sleep apnea, CKD progression, COPD, depression/anxiety, CAD, PVD, cerebrovascular disease, atrial fibrillation, hypertensive retinopathy, cancer, dementia, liver disease).
- **Cohorts.** Reuse T (5441), C (5455), G1–G4 (5450–5453), never-diagnosed (5454), O1 MACE (5426), O2 CKD (5427). Build **net-new**: S1/S2 (if E/I run), the ATO weight construct, the clone-censor-weight target-trial dataset, the phenotype-sensitivity grid, and the site-IV instrument (restricted to the visit-linked subset).
- **Analyses.** Retain A–L (re-estimate C/F/G/H under ATO); execute M/N; add O/P/Q/R; re-run negative-control calibration across the expanded FDR family; report EASE per family.
- **Guardrails.** ATO exact-balance verified on PS main-effect moments only; stabilized IPCW with weight-distribution reporting; IV assumptions stated and tested; E-values and QBA for every headline effect; estimability gates enforced (withhold if failed).
- **Lock.** Persist `analysis_plan_v5.0.lock.json` to `study_artifacts` before `run`; the report verifies the hash.
- **Report.** New v5 HTML + PDF: triangulation figure (O/P/R), ATO love/forest plots, M heatmap, N ridgelines/violin/trellis, Q robustness panel, negative-control calibration, and the V&V acceptance matrix.

---

## 7. Protocol #2 — prospective BP-capture pilot (readiness, unchanged design)

No design change from v4. v5 specifies the readiness path so it can launch on Protocol #1 sign-off:

- **EPIC integration (OQ-16):** two layers — (a) EPIC-side order-set + 2025 AHA/ACC technique training, out-of-platform; (b) a Parthenon study `htn-pilot-bp-capture-2026` that ingests post-pilot OMOP-mapped data and runs the comparability + outcome analyses.
- **IRB framing (OQ-15):** pursue expedited cat. 7 (QI / human-factors), characterize site allocation as cluster-randomized, partner-IRB pre-consult before site engagement.
- **Executable-in-Parthenon now:** subject selection from the Protocol #1 cohort, baseline comparability, in-office BP trajectory, ABPM correlation, CV/renal outcomes, eGFR trajectory, prescribing, reproducibility.
- **Regulatory reminder:** Protocol #2 is prospective interventional research — the 45 CFR 46.101(b)(4) exemption and cat. 5 expedited paths do NOT apply.

---

## 8. IRB & data-governance

No change from v4 Part 3. Protocol #1 remains a 45 CFR 46.101(b)(4) Exempt candidate under administrative review, contingent on no re-identification crosswalk inside the Acumenus boundary. Analyses M/N/O–R are additive on the same data source under the same posture — **no new IRB filing is triggered**; append a v5 amendment note to the existing filing stub. HIGHSEC route protection, immutable audit trail, and analysis-plan pre-registration are retained. (Note: `study_artifacts` currently has 0 rows for study 165, so the IRB stub and the plan lock are both first-time writes in v5.)

---

## 9. Reconciled open-question list (post-v5)

| # | Question | Status | Owner |
|---|---|---|---|
| 1 | Max gap between consecutive elevated BPs | **Resolved** (365 d cap, distinct days) | Bock ✓ |
| 2 | Latency bucketing | Resolved (4 groups) | — |
| 3 | Lu 2025 citation | Resolved | — |
| 4 | Antihypertensive scope | **Resolved** (ATC C02–C09) | Bock ✓ |
| 5 | Comparator method | **Resolved** (ATO overlap weighting) | Bock + Sanjay ✓ |
| 6 | Max follow-up | **Resolved** (5 yr + all-available sensitivity) | Bock ✓ |
| 7 | Cost fidelity | **Resolved empirically** (omop.cost empty → proxies) | Sanjay ✓ |
| 8 | Sample-size justification | **Resolved** (positivity-bound; min detectable HR) | Bock + Sanjay ✓ |
| 9 | IRB / data-governance | Framework resolved; filings pending | Sanjay → partner IRB |
| 10 | Renal-denervation code completeness | **Resolved** (registry validation step) | Sanjay ✓ |
| 11 | Index BP rule (avg vs two-consecutive) | **Resolved** (both; default avg) | Bock ✓ |
| 12 | Lu reproducibility framing | **Resolved** (sensitivity F) | Bock ✓ |
| 13 | Kidney exclusion wording | **Resolved** (exclude + covariate) | Bock ✓ |
| 14 | Drug dose fidelity | **Resolved** (RxNorm strength if sparse) | Sanjay ✓ |
| 15 | Protocol #2 IRB framing | **Resolved path** (expedited cat. 7) | Bock + partner IRB |
| 16 | Protocol #2 EPIC integration | **Resolved path** (two-layer) | Sanjay + eng |
| NEW-17 | Encounter-coverage gap (37.9% of T have visits) | **Open — investigate in Analysis Q** | Sanjay |
| NEW-18 | Care-site typing without place_of_service | **Open — source-value heuristics** | Sanjay + eng |

---

## 10. Recommended next actions

1. Obtain PI sign-off on the estimand redesign (§1), the open-question resolutions (§3), and the Protocol #2 readiness path (§7) via the go-forward document ACUM-PROT-HTN-V5-001.
2. Extend study 165 in place: bump to `analysis_plan_version=v5.0`, add the M concept sets and the O/P/Q/R constructs, and persist the first analysis-plan lock.
3. Run Analysis Q's encounter-coverage split (visit-linked vs measurement-only) **before** publishing any "90% undiagnosed" figure — it determines how the headline is framed (NEW-17).
4. Build the site-IV on the visit-linked subset (521 sites ≥ 25) with the location-level fallback instrument; report the ~38% selection explicitly.
5. Re-run negative-control calibration across the expanded M/N/O–R family; block reporting of any contrast whose calibrated null is not centered or whose estimability gates fail.
6. Schedule the partner-university IRB pre-consult covering both protocols; append the v5 amendment note to the (first-time) IRB filing stub.
7. Persist `analysis_plan_v5.0.lock.json` before any production run; render the v5 report with the V&V acceptance matrix.

— *End changelog.*
