# Hypertension v3 Outcomes Study — Open Questions for Dr. Bock

**Protocol:** "The failure of hypertension interventions in a large study population (V3)"
**Drafted by:** Acumenus informatics team (claude-code agent)
**Date:** 2026-05-12
**Study slug:** `hypertension-study-v3-2`
**Target data source:** Acumenus OMOP CDM (~1.0 million adults)

---

## What this document is

While translating the v3 protocol into an executable study design in Parthenon, several methodological choices came up that aren't fully specified in the protocol or that involve trade-offs you should sign off on before we generate cohorts and run analyses. For each question below we've proposed a working default with our reasoning. Please mark **agree / disagree / different choice** for each, and feel free to leave a note. We will not begin cohort generation until you've replied.

If you only have time to skim, the **highest-stakes items** are #1, #4, #7, and #8 — these change which patients are counted, what counts as an event, and how we match comparators. Everything else is sensitivity-analysis territory and easy to revisit.

---

## 1. Blood pressure threshold — strict `>` or inclusive `≥`?

**Question.** Protocol v3 defines the index BP as **SBP > 130 mmHg OR DBP > 80 mmHg**. ACC/AHA 2017 defines Stage 1 hypertension as **SBP ≥ 130 OR DBP ≥ 80**. Which do you want us to use as the operational threshold?

**Why it matters.** Patients with exactly 130/80 readings are a non-trivial slice of the population. Excluding them (strict `>`) gives a cleaner Stage 2-leaning cohort; including them (`≥`) aligns with current guideline language and increases sample size. Boundary patients are also clinically the ones most likely to be missed for diagnosis — which is the entire point of the latency analysis.

**Our proposed default.** **`≥`** (inclusive), per ACC/AHA 2017.

**Decision blocks:** target cohort (T), comparator (C). Affects the symmetric exclusion in the comparator definition too (currently `SBP ≤ 130 AND DBP ≤ 80`, which would need to become `SBP < 130 AND DBP < 80` if we adopt `≥` for T).

**Dr. Bock's answer:**

---

## 2. Maximum gap between the two consecutive elevated BPs

**Question.** The index event requires two consecutive elevated office BP measurements on distinct calendar days within a 24-month observation window. What is the **maximum acceptable gap** between those two readings before we stop calling them "consecutive"?

**Why it matters.** This is the operational definition of what counts as a persistent elevation versus a one-off reading that happened to repeat months apart. A tight window (e.g., 30 days) is closer to a clinic follow-up cadence; a loose window (e.g., 365 days) captures patients whose primary care visits are annual. Lu 2025 doesn't specify this explicitly, as far as we can tell.

**Our proposed default.** **365 days.** Loose enough to capture an annual-physical population; tight enough that we don't pair readings two years apart.

**Decision blocks:** target cohort (T). Cohort size will scale roughly with this parameter.

**Dr. Bock's answer:**

---

## 3. Latency cutoff scheme — single 16-month cutoff or tertiles?

**Question.** Lu 2025 reported a median diagnostic delay of 16–18 months and used a **single cutoff at 16 months** (or possibly 12 — the citation is unclear; see Q4). For our analyses, do you want to:

- (a) Stick with the Lu 2025 single cutoff (16 months) for direct replication, or
- (b) Use **tertiles** (≤ 6 months / 6–12 months / > 12 months) to characterize a dose–response, or
- (c) Run both — tertiles as primary, Lu's 16-month as sensitivity?

**Why it matters.** Tertiles let us see whether the relationship is monotonic with delay or shows a threshold effect. A single cutoff is simpler and reproduces Lu's published finding head-to-head. Doing both is a moderate amount of extra work.

**Our proposed default.** **(c)** — tertiles primary, Lu 16-month as sensitivity. Best of both worlds; the survival models share the same inputs.

**Decision blocks:** latency analyses (C, F, G, H in the analysis plan).

**Dr. Bock's answer:**

---

## 4. Lu et al. 2025 — exact citation needed

**Question.** The v3 protocol cites Lu et al. 2025 as reference 5 but the citation is incomplete. Please provide the **DOI, PMID, or journal/page** so we can confirm Lu's exact cohort definition (BP thresholds, gap windows, antihypertensive scope, etc.) before we claim "reproduces Lu 2025" in our report.

**Why it matters.** Without confirming Lu's exact methodology, we may publish a "reproduction" that differs from theirs on a parameter we didn't realize was different. The 29% cardiovascular risk delta is our reproduction target; we need to match their cohort definition closely or the comparison is meaningless.

**Our proposed default.** **Cannot proceed to reproduce without this.** If unavailable, we will publish as a **stand-alone outcomes analysis** rather than a Lu replication and remove the "29% delta" replication claim from the report.

**Decision blocks:** the Lu replication head-to-head analysis (analysis F). Other analyses unaffected.

**Dr. Bock's answer:**

---

## 5. Antihypertensive scope — RxNorm class C02–C09 or first-line only?

**Question.** For the "treatment-naive" exclusion (no prior antihypertensive ever), should we use:

- (a) **Broad scope** — any drug in ATC classes C02–C09 (all antihypertensives, including alpha-blockers, central agonists, vasodilators), or
- (b) **First-line-only** — restrict to JNC-8 first-line agents (thiazides, ACEi/ARB, CCB, beta-blocker)?

**Why it matters.** Many drugs in C02–C09 are used for non-HTN indications (beta-blockers for arrhythmia/migraine prophylaxis/post-MI, ACEi for diabetic nephropathy, alpha-blockers for BPH). Excluding patients ever exposed to these drugs is over-inclusive and may bias toward a sicker, more recently-diagnosed-only population. Restricting to first-line agents is more conservative about indication.

**Our proposed default.** **(a) broad scope (C02–C09)** as primary, **(b) first-line-only** as sensitivity. The "ever-before-index" exclusion is conservative either way; the broader scope is closer to standard OHDSI HTN cohort definitions in the phenotype library.

**Decision blocks:** target cohort (T), comparator (C). Cohort size will be larger under (b).

**Dr. Bock's answer:**

---

## 6. Comparator matching method — propensity score or greedy?

**Question.** For the 1:1 matched normotensive comparator (C), which matching method should be primary?

- (a) **Propensity score matching (PSM)** with logistic propensity model + caliper of 0.2 SD of the logit, using R `MatchIt`.
- (b) **Greedy 1:1 matching** on age (±2 yr), sex, race, and calendar quarter of index, without a propensity model.

**Why it matters.** PSM is the OHDSI / pharmacoepi standard; it handles many covariates simultaneously and is published-defensible. Greedy is faster, simpler, and easier to explain to clinicians but doesn't balance unobserved confounders represented in the propensity score. Either way the matched-pair structure feeds into the same downstream Cox models.

**Our proposed default.** **(a) PSM primary, greedy as sensitivity.** PSM is what OHDSI guidelines recommend for outcomes research and is what reviewers will expect.

**Decision blocks:** comparator cohort (C). Affects sample size of matched pairs.

**Dr. Bock's answer:**

---

## 7. Resistant hypertension — apparent or AHA-canonical?

**Question.** The canonical AHA definition of resistant hypertension requires uncontrolled BP on **≥ 3 antihypertensive classes including a diuretic at maximum tolerated doses**. The v3 protocol describes ≥ 3 classes with ≥ 30-day overlap but doesn't explicitly require a diuretic.

- (a) Implement as **apparent treatment-resistant hypertension** (≥ 3 classes overlapping ≥ 30 days, no diuretic requirement). Capture diuretic membership as a descriptive attribute.
- (b) Implement as **AHA-canonical resistant hypertension** (≥ 3 classes including a diuretic).

**Why it matters.** (a) is more inclusive and matches the literature on **apparent** treatment-resistant HTN (which is what most EHR-based studies report). (b) is the formal AHA definition but typically yields much smaller cohorts and is harder to ascertain from EHR data alone (need dose information, not just exposure).

**Our proposed default.** **(a) apparent** as primary, labeled clearly as "apparent" in the report. **(b) AHA-canonical** as sensitivity if numbers permit.

**Decision blocks:** subgroup S1 definition. Strongly affects S2 (renal denervation eligibility) downstream.

**Dr. Bock's answer:**

---

## 8. Heart failure outcome — inpatient hospitalization required?

**Question.** The MACE composite outcome includes "heart failure hospitalization." Should we:

- (a) **Require an inpatient `visit_occurrence`** with HF diagnosis (true hospitalization, OHDSI MACE convention), or
- (b) Count **any HF diagnosis** (inpatient or outpatient) as a MACE event?

**Why it matters.** (a) is the strict, published MACE convention — events are clinically severe, well-ascertained, and comparable to claims-based MACE studies. (b) over-counts: outpatient HF codes include chronic HF management mentions and substantially inflate the event rate without clinical correspondence to "an event happened today."

**Our proposed default.** **(a) inpatient `visit_occurrence` required.** This is the standard MACE definition.

**Decision blocks:** outcome O1 (MACE composite). Materially changes event counts.

**Dr. Bock's answer:**

---

## 9. Treatment-naive lookback window

**Question.** Related to Q5: when we say "no prior antihypertensive," is "prior" defined as:

- (a) **Ever before the index date** (entire observation history), or
- (b) **Within 12 months before index**?

**Why it matters.** (a) is conservative and definitively treatment-naive. (b) accommodates patients who had a brief BB course for migraine 10 years ago but are functionally untreated for HTN now. Patients with short-duration historical exposures are operationally indistinguishable from the truly untreated for the present analysis.

**Our proposed default.** **(a) ever-before-index** as primary, **(b) 12-month lookback** as sensitivity. Same logic as Q5.

**Decision blocks:** target cohort (T) sample size.

**Dr. Bock's answer:**

---

## 10. Patients never diagnosed — how to handle latency-b?

**Question.** Some patients in the target cohort will have two consecutive elevated BPs but **never** receive a recorded HTN diagnosis during follow-up. For them, the "latency-b" interval (second-elevated → recorded diagnosis) is undefined.

- (a) Treat undiagnosed patients as **censored** at their last follow-up for the latency analysis (right-censoring; their true latency is at least their observed follow-up duration).
- (b) Treat the **diagnosis event** itself as the outcome in a competing-risk model where death and end-of-follow-up are competing events. Latency becomes a time-to-event variable.
- (c) Exclude undiagnosed patients from the latency analysis entirely.

**Why it matters.** This is methodologically important and not trivially obvious from the protocol. The choice changes whether undiagnosed patients contribute information (and how) to the analysis.

**Our proposed default.** **(b) competing-risk model.** This is the methodologically rigorous answer; (a) loses information; (c) introduces selection bias.

**Decision blocks:** latency analyses (C, F).

**Dr. Bock's answer:**

---

## 11. Baseline CKD — exclude or covariate?

**Question.** The v3 protocol excludes patients with prior `dx_abnormal_kidney_function` (CKD, AKI, abnormal creatinine) from the target cohort. But CKD is also one of our co-equal primary outcomes (O2 — incident CKD). The current exclusion makes the CKD outcome trivially "first CKD code" by construction.

- (a) **Keep the baseline CKD exclusion**; treat O2 as "incident CKD in a previously CKD-free population."
- (b) **Drop the baseline CKD exclusion**, include baseline CKD as a stratification covariate, treat O2 as "new CKD progression event."

**Why it matters.** (a) is the cleaner study design but excludes patients with mild Stage 1/2 CKD who are clinically interesting for HTN management. (b) is closer to a real-world clinical population but requires more careful adjustment.

**Our proposed default.** **(a) exclude baseline CKD** as primary cohort, **(b)** as sensitivity. Cleaner primary; more inclusive sensitivity.

**Decision blocks:** target cohort (T), outcome O2.

**Dr. Bock's answer:**

---

## 12. Censoring window — 5 years or all available follow-up?

**Question.** How long should we follow each matched pair (T member + C member) for outcomes?

- (a) **5 years** from index, censored at end of observation or death.
- (b) **All available follow-up**, no truncation.

**Why it matters.** (a) gives clean per-pair comparisons and matches typical pharmacoepi convention. (b) maximizes power but creates differential follow-up across the cohort that requires more careful adjustment. Acumenus CDM coverage varies by patient (some have 10+ years, some have 2).

**Our proposed default.** **(a) 5-year primary**, **(b) all-available** as sensitivity.

**Decision blocks:** outcome analyses (G MACE, H CKD).

**Dr. Bock's answer:**

---

## 13. Cost analysis — is Acumenus `cost` table populated?

**Question.** The protocol's Goal G asks for a cost / resource-utilization analysis. The OMOP `cost` table is sparsely populated in many EHR-derived sources.

- (a) If the Acumenus `cost` table has **>50% coverage**, run the full cost analysis (charges, payments, OOP).
- (b) If it has **<50% coverage**, demote to an **encounter-count and resource-utilization proxy** (number of office visits, ED visits, hospitalizations, labs ordered) and clearly mark this in the report as "cost analysis not feasible on this source."

**Why it matters.** Reporting cost numbers from a sparse source is misleading; the encounter-count proxy is honest and reproducible.

**Our proposed default.** Inspect `cost` table fidelity in Phase 6 (feasibility) and decide based on coverage. Default to (b) unless coverage is high.

**Decision blocks:** analysis L. Does not block other analyses.

**Dr. Bock's answer:**

---

## 14. Sample size — feasibility-first or pre-registered minimum?

**Question.** Approach to sample size:

- (a) **Feasibility-first.** Run on the full available Acumenus population (~1M adults; cohort T likely tens of thousands), compute retrospective power for the published findings.
- (b) **Pre-register a minimum N** before running, with explicit pre-specified power calculations (e.g., "need ≥ 5,000 in T to detect 25% MACE rate difference with 80% power at α=0.05").

**Why it matters.** (a) is what most retrospective OMOP studies do — you take what the data gives you. (b) is closer to prospective-trial discipline and what some journals expect for a Lu replication.

**Our proposed default.** **(a) feasibility-first** with retrospective power reported in the manuscript. This is conventional for retrospective OMOP outcomes work.

**Decision blocks:** report (Phase 10). Does not block the run.

**Dr. Bock's answer:**

---

## 15. IRB / data governance — Acumenus retrospective use confirmed?

**Question.** Please confirm that the Acumenus OMOP CDM authorization covers a retrospective outcomes study of this scope (incident HTN cohort with 5-year MACE/CKD follow-up). We will capture this confirmation as a study artifact (`artifact_type='irb_submission'`) so it appears in the audit trail.

**Why it matters.** HIGHSEC compliance; the study writes to `app.*` and `results.htn_v3_*` and pulls from `omop.*`. The OMOP person_id pseudonymization handles HIPAA on the data side; we still need explicit authorization for the study itself.

**Our proposed default.** Assume covered until confirmed; capture as `irb_data_governance` open question; do not publish until confirmed.

**Decision blocks:** publication, not the analysis run.

**Dr. Bock's answer:**

---

## 16. Renal sympathetic denervation — pre-2018 codes

**Question.** The catheter-based renal denervation procedure codes (**CPT 0338T, 0339T**) were **Category III codes deleted in 2018**. Patients who underwent the procedure before 2018 may have been billed under the unlisted code **CPT 33999** or device-specific HCPCS codes (Symplicity, Recor). After 2018, there is no Category I CPT code; coverage is via clinical trials.

Should we:

- (a) Accept the **expected low recall** for the RDN-eligibility cohort (S2), document the limitation, and report whatever we find.
- (b) Invest engineering time in **device-code chart review** to catch pre-2018 procedures.

**Why it matters.** S2 may have a very small N (possibly zero) on the Acumenus source regardless of approach. RDN is a low-volume procedure outside trial centers.

**Our proposed default.** **(a) accept low recall**, document the limitation. Investing in device-code review is high-cost / low-yield unless this study is the headline RDN analysis (it isn't).

**Decision blocks:** subgroup S2. Does not block T/C/S1 cohorts.

**Dr. Bock's answer:**

---

## Quick-decision summary (for skim review)

If you want, you can answer just this table and we'll proceed with our defaults on the rest:

| # | Topic | Default | Agree? |
|---|---|---|---|
| 1 | BP threshold operator | `≥` (AHA 2017) | |
| 2 | Max gap between consecutive elevated BPs | 365 days | |
| 3 | Latency cutoff scheme | tertiles primary; 16-mo sensitivity | |
| 4 | Lu 2025 citation | **need DOI/PMID** | |
| 5 | Antihypertensive scope | RxNorm C02–C09 | |
| 6 | Comparator matching | PSM primary; greedy sensitivity | |
| 7 | Resistant HTN definition | **apparent** (no diuretic requirement) | |
| 8 | HF outcome qualifier | **inpatient visit_occurrence required** | |
| 9 | Treatment-naive lookback | ever-before-index primary | |
| 10 | Undiagnosed-patient latency | competing-risk model | |
| 11 | Baseline CKD handling | exclude (primary); covariate (sensitivity) | |
| 12 | Censoring window | 5 years primary | |
| 13 | Cost analysis fidelity | demote to encounter-counts if coverage < 50% | |
| 14 | Sample size approach | feasibility-first | |
| 15 | IRB / data governance | confirm coverage | |
| 16 | RDN pre-2018 codes | accept low recall | |

---

## What happens next

Once you've replied (even partially), the informatics team will:

1. Update the study's open-question records in Parthenon (each answer flips one `open_question` asset from `pending_pi` to `answered`).
2. Adjust the cohort and analysis definitions accordingly.
3. Generate the cohorts on the Acumenus OMOP CDM and run feasibility counts.
4. Send you preliminary counts and Table 1 demographics for review before executing the survival analyses.

Thank you — please reply at your convenience.

— Acumenus Informatics Team
