---
doc_type: research
status: locked
date: 2026-06-10
owner: acumenus
module: hypertension-v4
protocol: ACUM-PROT-HTN-V4-001
lineage_anchor: true
supersedes: [hypertension-v3]
superseded_by: null
related_code: []
related_prs: []
---

# Hypertension Study v4 — Locked Analysis Plan (Protocol of Record)

**Protocol:** ACUM-PROT-HTN-V4-001 (Bock/Udoshi, consolidated v4c, 2026-05-22)
**Decisions locked:** 2026-06-10 by S. Udoshi (consolidation editor); cohort-defining OQs (OQ-11/4/13) to be confirmed with G. Bock (PI) async.
**Data source:** Acumenus OHDSI CDM — `omop` schema, `omop` connection, `source_id = 47` (key `ACUMENUS`), OMOP CDM v5.4. **Sole data source.**
**Platform target:** Abby Protocol-to-Publication pipeline (ADR-0020), stages S1→S7. htn-v4 is the **first production run** of the gated pipeline.
**Validation lineage:** Remediates the v3 separation failure (study 114, PS AUC=0.50). See `docs/research/hypertension-v3/reports/v4-readiness-assessment.md`.

---

## 1. Scope

**v4 execution = Part 1 (Retrospective Outcomes Study) ONLY.** Part 2 (prospective in-office BP pilot) is out-of-platform (prospective EPIC integration) and is split to a separate track with a placeholder record `htn-pilot-bp-capture-2026` for post-pilot ingestion. Part 3 (IRB/governance) is satisfied by §7 below. Part 2 is not executed here.

---

## 2. Locked decisions (the gating open questions)

| OQ | Decision | Value (locked) | Rationale | Authority |
|----|----------|----------------|-----------|-----------|
| **OQ-11** | Index-date rule | Index = **date of the 2nd of two consecutive qualifying elevated BPs** (SBP≥130 OR DBP≥80). | v4c "average of two" is operationally ambiguous; "2nd of two consecutive" is implementable in `CohortSqlCompiler` and matches Lu 2025's "two documented high BPs." | Udoshi → Bock confirm |
| **OQ-1** | Max gap between the two consecutive elevated BPs | **≤ 365 days** | v4c-defaulted; keeps the index pair clinically contemporaneous. | Bock (defaulted) |
| **OQ-4** | Antihypertensive scope | **JNC-8 first-line** (thiazide diuretics, ACEi, ARB, CCB) primary for treatment-naïve exclusion + pathway analysis; **broad ATC C02–C09** as sensitivity. | Honors v4c "Use JNC-8." | Udoshi → Bock confirm |
| **OQ-13** | Kidney exclusion | **eGFR < 60** (most recent pre-index, measured or estimated). CrCl / CKD-dx supplementary. | 14,963,943 eGFR measurements confirmed in CDM — decidable and data-supported. | Udoshi → Bock confirm |
| **OQ-5** | Estimation comparator | **Within-HTN delay-group contrast** (primary): delayed-Dx (>12mo) vs timely-Dx (≤3mo), both arms incident-HTN treatment-naïve. **Recording-comparable normotensive** as sensitivity. | Recording-comparable by construction → dissolves the v3 PS separation (AUC=0.50); directly answers the protocol's causal question. | Udoshi |
| **OQ-6** | Follow-up window | All-available (cohort start → last observation/death). | v4c-confirmed. | Bock |

---

## 3. Descoped goals (zero data in the synthetic Acumenus CDM)

Formally deferred pending real-world EHR ingestion. Stated explicitly in the protocol of record so the manuscript's Limitations section reproduces them.

| Goal | CDM evidence | Disposition |
|------|--------------|-------------|
| Drug **dose** (v4 primary, OQ-14) | `dose_unit_source_value` = 0 rows | Class only, no dose |
| Care-site **typology** | 5,630 sites, 1 distinct `place_of_service` | Cannot stratify — drop |
| BP **source** (office/home/ABPM) | 2 distinct `measurement_type` | Cannot distinguish — drop |
| Serum **aldosterone** | 0 measurements | Drop hyperaldosteronism workup |
| **Renal denervation** (1/3/6/12-mo BP) | 0 procedures | Drop — defer to real data |
| **Family history** of HTN | 0 observations | Drop from characterization |
| **Cost** (incremental, OQ-7) | `omop.cost` = 0 rows | Drop cost analysis |

---

## 4. Cohort specifications

### 4.1 Target — Incident essential hypertension, treatment-naïve (v4)
- **Entry:** ≥ 2 consecutive elevated office BPs (SBP≥130 OR DBP≥80), inter-reading gap ≤ 365 d (OQ-11/OQ-1). **Index = date of the 2nd reading.**
- **Age:** ≥ 18 y at index.
- **Inclusion:** ≥ 3 recorded BPs within the 24 months preceding index.
- **Exclusion:** prior CVD (MI/stroke/HF) before the first elevated BP; **eGFR < 60** pre-index (OQ-13); abnormal thyroid indicators; any JNC-8 first-line antihypertensive before index (treatment-naïve, OQ-4).
- **Two latency intervals captured:** (a) first→second elevated BP; (b) second elevated BP (index) → recorded HTN diagnosis.

> **⚠️ v3 INDEX-ARCHITECTURE DEFECT — corrected in v4 (verified 2026-06-10).** v3's target cohort (5424) used `PrimaryCriteria = First ConditionOccurrence of Essential hypertension` — i.e. it **indexed on the HTN diagnosis, not the 2nd elevated BP.** v3 therefore *could not measure the index→diagnosis latency* (its index WAS the diagnosis), so the protocol's central premise (delay from elevated BP to diagnosis) was structurally unmeasurable in v3. **v4 re-architects the target to index on the 2nd of two consecutive elevated BP Measurements** (`PrimaryCriteria` = BP Measurement with `ValueAsNumber ≥ 130/80` + a "second consecutive qualifying reading" qualifier), then measures the interval to the subsequent Essential-HTN ConditionOccurrence. The comparator (5425) already demonstrates Measurement-based entry on this CDM, so the pattern is proven. This is the central v4 cohort-engineering task (B2).

### 4.2 Delay-group strata (characterization secondary goal)
Four mutually-exclusive strata by index→diagnosis interval: **G1 ≤3 mo (reference) · G2 3–6 mo · G3 7–12 mo · G4 >12 mo.**

### 4.3 Estimation design (OQ-5)
- **Primary (causal):** exposure = **delayed diagnosis (G4, >12mo)** vs **timely (G1, ≤3mo)**; outcomes MACE / CKD. Both arms are incident-HTN treatment-naïve → recording-comparable.
  - **Time-at-risk starts at the DIAGNOSIS date** (not index) to avoid immortal-time bias (delay is only defined at diagnosis). Encode in D1.
- **Sensitivity:** recording-comparable always-normotensive comparator (matched baseline measurement/visit footprint to the target).

### 4.4 Outcomes
- **O1 — MACE composite** (MI + stroke + inpatient HF + death).
- **O2 — Incident CKD.**

### 4.5 Negative-control panel (S6 calibration) — LOCKED to data-supported controls
≥ 5 **informative** controls required by the S6 gate. The v3 panel returned 0 events for 10/12 (dermatologic/podiatric). Replaced 2026-06-10 with HTN-unrelated outcomes verified to have high event frequency in *this* CDM, deliberately excluding cardiometabolic concepts (prediabetes, anemia, metabolic syndrome, IHD, diabetic kidney disease) which are HTN-correlated and invalid as controls:

| Concept ID | Control | Persons (CDM) |
|-----------|---------|---------------|
| 4281516 | Gingivitis | 822,823 |
| 40481087 | Viral sinusitis | 639,723 |
| 40274283 | Primary dental caries | 450,103 |
| 4112343 | Acute viral pharyngitis | 446,560 |
| 260139 | Acute bronchitis | 392,634 |
| 257012 | Chronic sinusitis | 213,802 |
| 434073 | Loss of teeth | 162,558 |
| 372328 | Otitis media | 115,754 |

8 controls (target ≥5 informative after time-at-risk filtering). All HTN-unrelated; all high-frequency → empirical calibration will be functional, unlike v3.

---

## 5. Analysis plan mapped to Abby S1→S7

| Stage | Key | Analysis | Gate check |
|-------|-----|----------|-----------|
| **S1** | `design` | Study design extraction | Design well-formed |
| **S2** | `phenotype` | Concept sets + cohort defs verified | Phenotypes verify |
| **S3** | `cohort_diagnostics` | Attrition, index-event breakdown, orphan concepts | Cohorts non-empty/non-degenerate |
| **S4** | `data_quality` | DQD | Severe failures = 0 |
| **S5** | `study_diagnostics` | PS diagnostics on delay-group contrast | AUC, max-SMD < 0.10 **or** equipoise ≥ 0.30 |
| **S6** | `estimation_calibration` | CohortMethod + Cox → EmpiricalCalibration; BH multiplicity | ≥ 5 informative negative controls |
| **S7** | `publication` | STROBE/RECORD manuscript + provenance appendix | Every number traces to `result_json` |

Supporting (non-gated) analyses: baseline characterization (age-binning fix verified), incidence rates (Byar CIs), prevalence of delayed diagnosis, two latency intervals, four-group comparison, treatment pathways re-specified onto **JNC-8 drug-class** event cohorts (v3 pointed them at `[5425,5426]` → degenerate).

---

## 6. Gate thresholds (`config/studies.php`, overridable per study)

- **S4 data_quality:** DQD severe failures = 0.
- **S5 study_diagnostics:** PS AUC < 0.80 **or** max-SMD-after < 0.10 **or** equipoise ≥ 0.30.
- **S6 calibration:** ≥ 5 informative negative controls.
- Override/approve require PI or statistician role with non-null rationale; uncalibrated estimates stay blinded until S5 clears.

---

## 7. Governance (Part 3 framework)

- **Pre-registration:** persist this locked plan (`analysis_plan.lock.json`) to `study_artifacts` before any production run.
- **HIGHSEC:** every endpoint surfacing cohort/person data gated by `auth:sanctum` + `permission:studies.*`.
- **No master-link list** inside Acumenus; `person_id` is a synthetic surrogate only.
- **No `omop`-schema writes.** Additive-nullable migrations only; never `migrate --force`. All DB ops via `claude_dev` on host PG17.
- **Regulatory posture:** Part 1 candidate for 45 CFR 46.101(b)(4) Exempt (administrative review); fallback 45 CFR 46.110 cat. 5 Expedited.

---

## 8. Provenance & reproducibility

- `DefinitionHasher` stamps `expression_sha256` on concept sets + cohort defs (identical inputs → identical hash).
- `CohortGenerationService` pins `compiled_sql`, `vocabulary_version`, `cdm_source_release`.
- `study_results.study_design_version_id` binds every result to the design that produced it.
- `StudyPackageService.build()` → portable bundle for the manuscript provenance appendix.

---

## 9. Deferred to sensitivity / async Bock confirmation

OQ-11/OQ-4/OQ-13 locked to defaults above pending Bock written confirmation (does not block the build). OQ-8 (sample size) and OQ-10 (renal-denervation codes) deferred. Lu-2025 reproducibility retained as a sensitivity analysis, not a named goal.
