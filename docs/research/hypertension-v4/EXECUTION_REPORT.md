---
doc_type: research
status: active
date: 2026-06-11
owner: acumenus
module: hypertension-v4
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Hypertension Study v4 — Execution Report

**Date:** 2026-06-11
**Study:** `hypertension-study-v4` (id 165) · Source 47 (OHDSI Acumenus CDM, `omop`)
**Pipeline:** Abby protocol-to-publication (ADR-0020), S1→S7 — first production run on real study data.
**Protocol of record:** [`ANALYSIS_PLAN.md`](./ANALYSIS_PLAN.md) (locked) · [`analysis_plan.lock.json`](./analysis_plan.lock.json)

---

## 1. Headline finding (descriptive, gate-independent)

Of **109,763** treatment-naïve patients with two consecutive elevated office BP readings,
**98,769 (90.0%) never recorded a hypertension diagnosis** within their observation period.
Among the 10,994 who were diagnosed, the delay distribution is heavily right-skewed:

| Stratum | Definition (days from 2nd elevated BP → HTN Dx) | n |
|---|---|---|
| G1 timely | ≤ 90 | 139 |
| G2 | 91–180 | 284 |
| G3 | 181–365 | 675 |
| G4 delayed | > 365 | 9,896 |
| Never diagnosed | — | 98,769 |

Timely diagnosis (≤3 months) is **vanishingly rare** in this CDM (139 / 109,763 = 0.13%).
This is the central result and it is independent of any estimation gate.

Crude incidence of the composite (MACE + CKD), time-at-risk from the BP index:
male 7.9 / female 6.2 per 1,000 py; monotonic age gradient 1.9 (18–34) → 22.5 (65+).

---

## 2. The v3 index defect this study corrects

v3 (study 114) indexed the target on the **first Condition Occurrence of essential HTN** —
i.e., on the diagnosis itself — making the index→diagnosis latency structurally unmeasurable.
v4 indexes on the **2nd of two consecutive elevated BP measurements**, so diagnostic delay is
observable by construction. The BP-indexed target required a hand-tuned parallel-bitmap scan of
`omop.measurement` (710M rows / 120 GB) to avoid the value-scan I/O pathology
([`target_generation.sql`](./target_generation.sql)).

---

## 3. Estimation (OQ-5) — what was planned, what happened

**Planned primary:** within-HTN delay contrast, delayed-Dx (G4, >12mo) vs timely-Dx (G1, ≤3mo),
time-at-risk anchored at the diagnosis date.

**Result — S5 study-diagnostics FAILED.** With G1 = 139, the propensity model could not balance
the arms: max post-match SMD **0.244** (> 0.10 threshold). AUC 0.798 and equipoise 0.926 passed,
but the balance criterion did not. The estimate was correctly **blinded** by the gate-aware
manuscript composer. Events were tiny (18 MACE / 26 CKD; MDRR 3.0–3.7) — the contrast is
inestimable in this CDM because timely diagnosis is too rare.

**Resolution (PI decision): build the recording-comparable normotensive comparator** — the
sensitivity arm pre-specified in OQ-5. An always-normotensive, treatment-naïve cohort built to
mirror the target exactly (≥2 BP readings all normal, indexed on the 2nd, identical exclusions),
so it shares the target's BP-screening footprint and is balanceable
([`normotensive_comparator_generation.sql`](./normotensive_comparator_generation.sql),
cohort 5455, **37,582** subjects).

**Sensitivity contrast — treatment-naïve elevated BP (5441) vs recording-comparable normotensive (5455):**

| Diagnostic | Value | Gate |
|---|---|---|
| PS AUC | 0.572 | ✓ |
| Max post-match SMD | **0.0155** | ✓ |
| Equipoise | 0.988 | ✓ |
| Informative negative controls | 8 / 8 | ✓ (S6) |
| EASE (systematic error) | 0.020 | — |

**Calibrated effect estimates** (108,137 vs 37,106 matched; both BP-reading-anchored → symmetric
time-zero, no immortal-time bias):

| Outcome | Calibrated HR | 95% CI | p |
|---|---|---|---|
| **Incident CKD** | **2.60** | 2.01–3.38 | < 0.001 |
| MACE composite | 1.03 | 0.94–1.14 | 0.50 |

Treatment-naïve elevated BP — a population 90% of whom are never diagnosed — carries **2.6× the
rate of incident CKD** versus recording-comparable normotensives, empirically calibrated against
8 HTN-unrelated negative controls. MACE is null over the 5-year window.

The within-HTN delay contrast (est 64) remains in the database as a documented, blinded analysis;
it was unlinked from study 165 so the gate ledger and manuscript reflect the estimable contrast.

---

## 4. Gate ledger (S1→S7)

| Stage | Verdict |
|---|---|
| S5 study_diagnostics | **PASSED** (AUC 0.572, max-SMD 0.0155, equipoise 0.988) |
| S6 estimation_calibration | **PASSED** (8 informative NCs, EASE 0.020) |
| S7 publication | STROBE-RECORD manuscript composed, `effect_estimates_included: true`; reproducible study package v1 (`bundle_sha256`) created |

Negative-control panel (replaced v3's 10/12-zero-event panel): gingivitis, viral sinusitis,
primary dental caries, acute viral pharyngitis, acute bronchitis, chronic sinusitis, loss of
teeth, otitis media (cohorts 5442–5449).

---

## 5. Platform fixes made during this run

The first real estimation+calibration run surfaced four latent platform defects, all fixed:

1. **NC outcomes never extracted into `cmData`** (`darkstar/api/estimation*.R`) — `getDbCohortMethodData`
   pulled only the primary outcomes, so every negative control failed with "non-numeric argument
   to mathematical function". Fixed by extracting the union of primary + NC outcome ids.
2. **NC standard error read from a non-existent field** — `summary(model)$seLogRr` is not populated
   by CohortMethod, leaving every NC with a null SE (calibration impossible). Switched to the
   `confint()`-derived SE the primary-outcome loop already uses; diverged NC fits (complete
   separation) now yield non-finite SE and are dropped as uninformative.
3. **Async worker never computed calibration** — `estimation_worker.R` (mirai path) did not source
   `calibration.R` or call `compute_calibration`, so the async path always returned
   `calibration: null`. Added both.
4. **`study_gates` / `study_packages` + 7 other app tables had no runtime grants** — created by
   `parthenon_migrator` without GRANTing `parthenon_app`; gate evaluation and packaging 500'd.
   Codified in migration `2026_06_11_120000_grant_adr0020_study_tables_to_parthenon_app`.

---

## 6. Artifact index

| Artifact | ID / path |
|---|---|
| Study | 165 `hypertension-study-v4` |
| Target (elevated BP) | cohort 5441 — 109,763 |
| Delay strata | 5450 (G1) / 5451 (G2) / 5452 (G3) / 5453 (G4) / 5454 (never-Dx) |
| Normotensive comparator | cohort 5455 — 37,582 |
| Outcomes | 5426 (MACE) / 5427 (CKD) |
| Negative controls | 5442–5449 |
| Characterization | analysis 42 (exec 269) |
| Incidence rates | analysis 59 (exec 270) |
| Estimation — within-HTN (blinded) | analysis 64 (exec 275) — unlinked |
| Estimation — recording-comparable (reported) | analysis 65 (exec 276) |
| Study package | v1 |
