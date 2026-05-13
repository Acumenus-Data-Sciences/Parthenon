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

# Hypertension v3 — Dr. Bock's Answers to Open Questions

**Received:** 2026-05-12
**Source:** Dr. Glenn H. Bock, MD
**Reconciled into v2 intent_json on:** 2026-05-12 (this turn)

---

## Resolution table

| # | Topic | Default proposed | Dr. Bock's decision | Action |
|---|---|---|---|---|
| 1 | BP threshold operator | `≥` (AHA 2017) | **Use ACC/AHA 2017 definitions** → `≥` | ✓ Default adopted |
| 2 | Max gap between consecutive elevated BPs | 365 days | **Use 365 days** | ✓ Default adopted |
| 3 | Latency cutoff scheme | tertiles primary; 16-mo sensitivity | "These criteria are suitable for BP pre-index date including results on index date and all BP measurements post index date" | Comment addresses BP temporal window, not the cutoff scheme. **Default adopted** for cutoffs (tertiles primary, 16-mo sensitivity). His comment captured as a cohort-SQL requirement: include all BPs pre-index AND post-index. |
| 4 | Lu 2025 citation | DOI/PMID needed | **"Complete citation in document"** | Citation IS in the v3 .docx; our protocol-import didn't fully extract it. **Pending:** Dr. Bock to paste citation OR we re-extract from the original file. |
| 5 | Antihypertensive scope | RxNorm C02–C09 (broad) | **"Include all antihypertensive agents" / "Use broad scope"** | ✓ Default adopted |
| 6 | Comparator matching | PSM primary; greedy sensitivity | **"Use PSM"** | ✓ Default adopted |
| 7 | Resistant HTN definition | apparent (no diuretic requirement) | **"Use (a)"** → apparent treatment-resistant HTN | ✓ Default adopted |
| 8 | HF outcome qualifier | inpatient `visit_occurrence` required | **"Use default"** | ✓ Default adopted |
| 9 | Treatment-naive lookback | ever-before-index primary | **"(use a)"** → ever-before-index | ✓ Default adopted |
| 10 | Undiagnosed-patient latency | competing-risk model | **"Use (b)"** → competing-risk | ✓ Default adopted |
| 11 | Baseline CKD handling | exclude any CKD code | **"Use Stage 2 CKD (Use calculated GFR) as < 60 (measured or estimated -eGFR) for exclusion"** | **CHANGE.** Exclusion criterion is now **eGFR < 60** (measured or estimated). Added `lab_egfr` concept set (LOINC 33914-3, 48642-3, 62238-1, 98979-8, and other variants). Cohort SQL exclusion = any pre-index eGFR measurement < 60 OR a documented CKD Stage 3+ diagnosis. Existing `dx_abnormal_kidney_function` concept set retained for the diagnosis-side check. |
| 12 | Censoring window | 5-year primary | **"Use 5 year from index"** | ✓ Default adopted |
| 13 | Cost analysis | demote to encounter-counts if cost table sparse | **"pause this variable from analysis"** | **CHANGE.** Drop analysis L (Cost) from the analysis plan entirely. |
| 14 | Sample size approach | feasibility-first | **"Use (a)"** | ✓ Default adopted |
| 15 | IRB / data governance | confirm coverage | **"Skip for now"** | Mark deferred — does not block analysis run; required before publication. |
| 16 | RDN pre-2018 codes | accept low recall | **"Accept (a)"** | ✓ Default adopted |

---

## Operational impact

### Changes to the protocol implementation

1. **Baseline-kidney exclusion (Q11)** is now eGFR-based, not diagnosis-code-based as primary criterion. We added a `lab_egfr` concept set with all standard eGFR LOINC variants (MDRD, CKD-EPI, CKD-EPI 2021, race/sex-stratified). The cohort SQL exclusion combines: (a) any pre-index eGFR measurement with `value_as_number < 60`, OR (b) any documented CKD Stage 3+ diagnosis (from the existing `dx_abnormal_kidney_function` concept set, which covers CKD all stages + AKI).

2. **Cost analysis (Q13)** is removed from the analysis plan. Drop analysis L. Goal G is paused. The HEOR service is not invoked. The report will note that cost/utilization analysis was deferred per PI request.

3. **BP measurement temporal window (Q3 clarification)** is locked: the cohort SQL pulls BPs from the entire pre-index history (for the consecutive-elevated rule) AND from the post-index follow-up window (for the treatment-trajectory analysis D and the latency-b interval).

### Unchanged from defaults

All other 13 decisions match the proposed defaults. No additional rework needed.

### Still pending

- **Lu 2025 citation (Q4).** Dr. Bock confirmed the citation IS in the v3 protocol document. Our protocol-import service extracted only fragments mentioning "Lu et al." but not the full reference. **Two paths:** (a) Dr. Bock pastes the DOI/PMID in his next reply; (b) we re-fetch the original .docx and parse the references section. Implementation continues with the Lu replication analysis (F) labeled "pending citation confirmation" until resolved.
- **IRB confirmation (Q15)** marked deferred — required before publication, not before analysis run.

---

## Locked-in parameters going into Phase 5 (cohorts)

```yaml
target_cohort_T:
  bp_threshold_operator: ">="     # Q1
  bp_threshold_sbp: 130
  bp_threshold_dbp: 80
  max_gap_consecutive_bps_days: 365   # Q2
  min_bp_count: 3
  lookback_days: 730   # 24-month window for the three pre-index BPs
  min_age_years: 18
  treatment_naive_scope: "ATC C02-C09 (broad)"   # Q5
  treatment_naive_lookback: "ever_before_index"   # Q9
  baseline_kidney_exclusion: "eGFR < 60 (measured or estimated) OR CKD Stage 3+ dx"   # Q11
  cv_exclusion: "any prior MI/stroke/HF/PVD/CABG/PCI"
  thyroid_exclusion: true
  secondary_htn_exclusion: true

comparator_cohort_C:
  matching: "PSM (logistic + 0.2 SD caliper)"   # Q6
  match_vars: [age (±2yr), sex, race, calendar quarter of index]
  ratio: "1:1"

resistant_htn_S1:
  definition: "apparent treatment-resistant"   # Q7
  classes_required: ">= 3 overlapping >= 30 days"
  diuretic_required: false   # but tracked as a flag

outcome_O1_MACE:
  components: [MI, stroke_ischemic, stroke_hemorrhagic, HF_hospitalization_inpatient, all_cause_death]   # Q8
  hf_qualifier: "inpatient visit_occurrence required"

latency_analysis:
  cutoff_scheme: "tertiles [6, 12] primary"   # Q3 default kept
  sensitivity_cutoff: "16 months (Lu 2025)"
  undiagnosed_handling: "competing_risk_model (diagnosis as event)"   # Q10

follow_up:
  censoring_window_days: 1825   # Q12
  sensitivity: "all_available"

dropped_from_plan:
  - analysis_L_cost   # Q13
```

---

## Next phase

Cohort drafting (Phase 5) can now proceed with locked parameters. See `CLAUDE_PROMPT.md` §6 for the canonical cohort definitions to translate into Circe-style JSON drafts.

— Acumenus Informatics Team
