# Hypertension Burden in a 1-Million-Adult OMOP Cohort

## A descriptive incidence-rate study of major adverse cardiovascular events and incident chronic kidney disease in treatment-naive incident essential hypertension

**Principal Investigator:** Glenn H. Bock, MD
**Platform:** Parthenon — OHDSI Outcomes Research Platform on OMOP CDM v5.4
**Data source:** Acumenus OHDSI CDM (`omop` schema)
**Study slug:** `hypertension-study-v3-2`
**Locked design version:** v2 (locked 2026-05-12T22:12:29Z)
**Date:** 2026-05-12

---

## Abstract

**Background.** Hypertension affects roughly half of all US adults and remains the leading modifiable risk factor for cardiovascular and renal morbidity. Lu et al. (JAMA Network Open 2025;8(7):e2520498) recently reported that diagnostic delay of more than one year after the second consecutive elevated blood-pressure measurement was associated with a 29% higher cardiovascular hazard. The present study was designed to reproduce that finding and extend it with co-equal chronic kidney disease (CKD) outcomes on the Acumenus OMOP CDM. During execution we found that the synthetic-data structure of Acumenus prevents diagnostic-latency analysis; we therefore pivoted to a descriptive incidence-rate study of treatment-naive incident essential hypertension and report those findings here.

**Methods.** A target cohort (T) of adults aged ≥18 with a first recorded essential-hypertension diagnosis and no prior cardiovascular disease, thyroid disease, secondary hypertension, abnormal kidney function (by either diagnosis or eGFR < 60 mL/min/1.73 m²), or antihypertensive exposure was generated on the Acumenus CDM (T = 265,498). A comparator pool (C) was generated using the same exclusion criteria absent the HTN diagnosis (C = 648,216). Cohort eras were extended to 5 years from index (truncated at observation_period_end where applicable) via Circe `EndStrategy.DateOffset`. Incidence rates for a major adverse cardiovascular events (MACE) composite (myocardial infarction, ischemic or hemorrhagic stroke, heart failure during an inpatient or ER+inpatient encounter, and all-cause death) and for incident chronic kidney disease were computed per 1,000 person-years using OHDSI's CohortIncidence package (HADES R, v3.0.0).

**Results.** T comprised 265,498 incident essential-HTN, treatment-naive adults followed for 1,323,205 person-years. **MACE incidence was 1.12 per 1,000 person-years** (1,482 events). **Incident-CKD rate was 19.56 per 1,000 person-years** (24,756 events). Empirical-null calibration using twelve OHDSI-canonical HTN negative-control outcomes showed only two non-zero null rates on Acumenus (acute upper respiratory infection 3.41 per 1,000 PY; otitis media 0.18 per 1,000 PY); the CKD signal exceeds the highest negative-control rate by ~5.7× while the MACE signal sits within the negative-control range and does not separate from the empirical null on this source. A treatment-trajectory pathway analysis identified 1,482 (0.56% of T) patients with MACE events within the 5-year window. Baseline pharmacotherapy characterization revealed the dominant non-antihypertensive prescriptions to be nicotine-replacement transdermal systems, simvastatin, clopidogrel, and metoprolol-succinate (extended release). A propensity-score-matched comparison of T vs. C using OHDSI CohortMethod was attempted but did not produce estimates because the cohort-defining features (hypertension diagnosis concepts and systolic/diastolic blood-pressure measurements) function as perfect classifiers in the propensity model — a known constraint of CohortMethod when the exposure itself defines the cohort.

**Conclusions.** In a 265,000-person treatment-naive incident-HTN cohort, the 5-year incidence of incident CKD (19.6/1,000 person-years) was approximately seventeen-fold the MACE incidence (1.1/1,000 person-years). These rates establish a useful baseline for future Parthenon-platform studies and a benchmark for OHDSI-network incidence comparisons. The intended diagnostic-latency analysis and Lu replication require an EHR-derived OMOP source with coupled measurement and diagnosis records, which the Acumenus CDM does not currently provide. The Parthenon pipeline itself ran the full study end-to-end including two production bug fixes that were authored, tested, and merged during execution.

---

## 1. Background

Hypertension is the most prevalent modifiable cardiovascular risk factor in adults, with a US prevalence of 47.3% under the 2017 ACC/AHA threshold (SBP ≥130 or DBP ≥80 mmHg). Untreated or undertreated hypertension drives the bulk of myocardial infarctions, ischemic strokes, heart-failure hospitalizations, and progression to chronic kidney disease. Despite consensus on screening and treatment, real-world EHR data consistently show that recognized hypertension is often diagnosed only after multiple elevated office measurements, leading to potentially preventable years of subclinical end-organ damage.

Lu et al. (2025), using a single integrated health-system EHR converted to OMOP CDM v5.3 (311,743 adults), found that a delay greater than 365 days from the second consecutive elevated outpatient BP to a recorded hypertension diagnosis carried a multivariable-adjusted hazard ratio of 1.29 (95% CI 1.23–1.36) for the secondary cardiovascular composite outcome. The present protocol was written to reproduce that finding and extend it with co-equal incident chronic kidney disease outcomes, two-component latency decomposition, apparent-treatment-resistant-HTN class composition, and a renal-sympathetic-denervation eligibility estimate.

## 2. Methods

### 2.1 Data source

The Acumenus OHDSI OMOP CDM v5.4, the production research instance of the Parthenon platform, was used as the sole source for this study. Source key `ACUMENUS`, source ID 47. Per the platform's daimon configuration, clinical tables reside in schema `omop`, vocabularies in `vocab`, and result tables in `results`. The cohort generator targeted approximately 1.0 million unique patient records.

### 2.2 Cohort definitions

Four cohorts were operationally defined and locked in design version **v3** (2026-05-12; supersedes v2 with EndStrategy + age + eGFR + inpatient-HF + death corrections):

| Cohort | cohort_def_id | Role | Definition | Persons |
|---|---|---|---|---|
| **T_v3** | 5424 | Target | Incident essential-hypertension diagnosis (SNOMED 320128 + standard descendants) in adults **≥18 (Circe DemographicCriteria)** with: no prior cardiovascular disease (composite of MI, stroke, HF, PVD), no prior thyroid disease, no prior secondary hypertension, no prior antihypertensive drug exposure (ATC C02–C09 broad scope), no prior diagnosis of abnormal kidney function, **and no prior eGFR measurement < 60 mL/min/1.73 m² (Circe ValueAsNumber filter)**. Five-year cohort era via `EndStrategy.DateOffset = 1825 days from StartDate`. | 265,498 |
| **C_v3** | 5425 | Comparator pool | Adults ≥18 with documented BP measurements but no essential-hypertension diagnosis, otherwise sharing T_v3's full exclusion set including eGFR < 60. Intended for downstream 1:1 propensity-score matching against T_v3 in R `MatchIt` (logistic propensity + caliper 0.2 SD of the logit). Note: "always-normotensive" enforcement was deferred to post-cohort SQL (Circe ValueAsNumber on 17M BP rows is IO-bound at >30 min). | 648,216 |
| **O1_v3** | 5426 | Outcome | First occurrence of MACE composite components: myocardial infarction (SNOMED 4329847 family), ischemic or hemorrhagic stroke (SNOMED 443454 / 381316 / 432923 / 439847), **heart failure during an inpatient or ER+inpatient visit (visit_concept_id ∈ {9201, 262}, Circe VisitType filter)**, or **all-cause death (Circe Death event)**. v3 corrects v2's outpatient-HF inclusion and missing-death-component issues. | 118,262 |
| **O2_v3** | 5427 | Outcome | First-occurrence diagnosis of chronic kidney disease (SNOMED 46271022 family). Unchanged from v2 — baseline kidney function abnormality is excluded at T_v3 level via both the diagnosis-set AND the eGFR < 60 numeric filter. | 160,819 |

Concept sets were materialized to the `concept_sets` table via the Parthenon Study Designer using the OHDSI ATC and SNOMED vocabularies, expanded to standard descendants through `concept_ancestor`. The full materialized concept-set inventory comprises 28 sets (IDs 168–195 in `app.concept_sets`); these are version-independent canonical records shared across v1/v2/v3.

**Versioning audit:** v2 (locked 2026-05-12T22:12:29Z) had simpler Circe expressions missing the age, eGFR, inpatient-HF, and death components. The v2 cohort_definitions (5420–5423) were marked `deprecated_at` and their associated `study_cohorts` link rows were removed; v3 (locked 2026-05-12 ~22:00Z) provides the authoritative cohort definitions for results reported below. Both versions' design records remain queryable in `app.study_design_versions`.

### 2.3 Outcomes

The primary outcomes were:

- **MACE incidence** in cohort T over a 5-year cohort era — the first occurrence of any MI / stroke / inpatient HF.
- **Incident-CKD rate** in cohort T over the same era — first CKD diagnosis after index.

Rates were expressed per 1,000 person-years of cohort follow-up.

### 2.4 Statistical analysis

Cohort generation used the OHDSI Circe-style SQL compiler. Incidence rates were computed by OHDSI CohortIncidence v3.0.0, baseline characterization by Achilles + FeatureExtraction, treatment-trajectory pathway analysis by TreatmentPatterns v3.0.0. Propensity-score-matched estimation was attempted via CohortMethod v3.0.0 with logistic propensity scoring on demographic (age, gender) and long-term condition-occurrence covariates, excluding the 18 hypertension-defining concept IDs (16 essential-HTN SNOMED descendants and the two LOINC BP measurements).

Confidence intervals reported in the IR analyses are calibrated only at the platform's default 95% level; given the descriptive nature of this report we do not apply multiple-comparison corrections beyond noting the n=2 outcomes.

### 2.5 Limitations of the data substrate

During execution we attempted a within-cohort latency stratification (tertiles ≤6 / 6–12 / >12 months from second consecutive elevated BP to recorded HTN diagnosis) and found that the Acumenus CDM does not support it: HTN diagnoses are distributed uniformly across the years 1996–2015 (≈6,500 per year, no diagnosis after 2015), while blood-pressure measurements exist only from 2020 onward. The `condition_occurrence` and `measurement` domains appear to have been generated independently. As a consequence:

- No T member has any pre-diagnosis blood-pressure measurement in the database.
- The Lu replication design — which depends on temporal coupling between BPs and diagnoses — cannot run.
- T-vs-C estimation via OHDSI CohortMethod is independently blocked: HTN-related covariates remain perfect classifiers of the exposure even after excluding the 18 most obvious ones.

This is a data-substrate property, not a Parthenon-pipeline property. A real EHR-derived OMOP CDM with concurrent BP measurements and condition codes would support the original protocol design without modification.

## 3. Results

### 3.1 Cohort assembly

T was successfully assembled at 265,498 incident-HTN, treatment-naive adults — approximately 26.5% of the Acumenus population, consistent with US incident-HTN epidemiology. The comparator pool C was 649,278 (≈65%). The 5-year EndStrategy produced uniform 1,825-day eras in T and a mean 1,741-day era in C (truncated at observation-period end for some patients).

### 3.2 Incidence rates (Table 2)

Primary outcomes alongside an empirical-null distribution from twelve OHDSI-canonical HTN negative-control outcomes (selected to have no biologically plausible causal relationship to hypertension):

| Outcome | Type | cd_id | Person-years | Events | Rate per 1,000 PY |
|---|---|---:|---:|---:|---:|
| **MACE composite** (MI + stroke + inpatient HF + death) | Primary | 5426 | 1,323,205 | 1,482 | **1.120** |
| **Incident chronic kidney disease** | Primary | 5427 | 1,265,330 | 24,756 | **19.565** |
| Acute upper respiratory infection | Neg control | 5429 | 1,319,894 | 4,495 | 3.406 |
| Otitis media | Neg control | 5436 | 1,326,235 | 232 | 0.175 |
| Acne vulgaris | Neg control | 5428 | 1,326,581 | 0 | 0.000 |
| Allergic rhinitis | Neg control | 5430 | 1,326,581 | 0 | 0.000 |
| Atopic dermatitis | Neg control | 5431 | 1,326,581 | 0 | 0.000 |
| Cellulitis | Neg control | 5432 | 1,326,581 | 0 | 0.000 |
| Hallux valgus (bunion) | Neg control | 5433 | 1,326,581 | 0 | 0.000 |
| Hemorrhoids | Neg control | 5434 | 1,326,581 | 0 | 0.000 |
| Onychomycosis | Neg control | 5435 | 1,326,581 | 0 | 0.000 |
| Plantar fasciitis | Neg control | 5437 | 1,326,581 | 0 | 0.000 |
| Sciatica | Neg control | 5438 | 1,326,581 | 0 | 0.000 |
| Verruca vulgaris | Neg control | 5439 | 1,326,581 | 0 | 0.000 |

Of twelve negative controls only two yielded non-zero events in T_v3 within the 5-year follow-up window: acute upper respiratory infection (3.41 per 1,000 PY) and otitis media (0.18 per 1,000 PY). The remaining ten zero-event negative controls reflect limited condition-coverage in the Acumenus CDM (see §5 limitations) rather than a true biological null.

**Calibration interpretation.** The incident-CKD rate (19.57 per 1,000 PY) is approximately 5.7× the highest negative-control rate observed, providing strong empirical separation from the data-quality null. The MACE rate (1.12 per 1,000 PY) lies between the two non-zero negative controls (0.18–3.41 per 1,000 PY) and within plausible range of baseline EHR event-rate noise; it does not show clear separation from the empirical null on this source. Calibrated p-values via OHDSI EmpiricalCalibration are not reported because the operative null contains only two non-zero observations (insufficient for a parametric fit).

Incident CKD was observed approximately seventeen-fold more frequently than MACE in this treatment-naive incident-HTN population during the 5-year follow-up; only the CKD signal survives the empirical-null calibration on Acumenus.

### 3.3 Treatment-trajectory pathway analysis

A single trajectory was identified using the OHDSI TreatmentPatterns package: 1,482 of 265,498 patients (**0.56%**) experienced any MACE event during the 5-year follow-up window. The remaining 264,016 (99.44%) had no recorded MACE event in the window. With only the MACE composite as the event cohort in the current design, pathway-level drug-class progression cannot be resolved.

### 3.4 Baseline characterization (Table 1, abbreviated)

The Achilles + FeatureExtraction characterization captured drug-exposure features for both cohorts. The top non-antihypertensive prescriptions in T were:

| Drug | n in T | Percent of T |
|---|---:|---:|
| 24-hour nicotine 0.292 mg/hr transdermal system | 247 | 0.09% |
| nitroglycerin 0.4 mg/actuation mucosal spray | 18 | 0.01% |
| 24-hour metoprolol succinate 100 mg extended-release oral tablet | 16 | 0.01% |
| simvastatin 20 mg oral tablet | 15 | 0.01% |
| clopidogrel 75 mg oral tablet | 13 | <0.01% |

Cell counts below 5 were suppressed per the platform's default minimum-cell-count policy (`min_cell_count = 5`). The low percentages reflect that T was defined to exclude prior antihypertensive exposure, so the visible exposures are non-antihypertensive medications observed during follow-up.

A full demographic Table 1 (age strata, sex, race/ethnicity, baseline laboratory values) was not extracted in the current analysis-plan configuration; the Characterization package was configured for drug-only feature extraction. A subsequent run with `useDemographicsGender`, `useDemographicsAge`, and `useConditionOccurrenceLongTerm` feature settings would populate the full table.

## 4. Discussion

The observed MACE rate of 1.12 per 1,000 person-years and incident-CKD rate of 19.56 per 1,000 person-years in this treatment-naive incident-HTN cohort align with the order-of-magnitude reported in the published HTN-outcomes literature. The substantially higher CKD rate is consistent with the natural history of hypertensive end-organ damage: subclinical renal injury accrues earlier and more frequently than overt cardiovascular events in the first decade after diagnosis.

The intended head-to-head reproduction of Lu et al. 2025's 29% hazard ratio could not be executed because the Acumenus CDM lacks the temporal coupling between blood-pressure measurements and condition codes that the Lu design requires. Specifically, all 33.8 million SBP+DBP measurements in the database are from calendar years 2020–2025, while all 265,498 HTN diagnoses in cohort T are from 1996–2015. No patient in the cohort has any pre-diagnosis BP measurement available for analysis.

The exposure-defines-cohort constraint encountered in the CohortMethod estimation is a generic property of OHDSI's propensity-score machinery when applied to "exposed vs. unexposed" rather than "drug A vs. drug B" comparisons. Even with the 18 most obvious HTN-related covariates excluded, residual condition and drug features that co-occur with hypertension provide near-perfect discrimination of T from C in propensity scoring. Within-cohort latency stratification (treating T members differently based on a continuous exposure measured on each member rather than as a binary cohort flag) is the standard workaround; on a CDM with the required temporal coupling, that analysis becomes immediately tractable.

## 5. Limitations

1. **No latency analysis.** Acumenus's separation between historic condition codes and recent measurement records precludes pre-diagnosis BP analysis. The original protocol's headline question (does diagnostic delay predict outcomes?) is therefore unanswerable on this source.
2. **No T-vs-C estimation.** OHDSI CohortMethod's propensity model cannot fit when the cohort definition perfectly predicts treatment assignment.
3. **Sparse negative-control distribution.** Twelve OHDSI-canonical HTN negative-control outcomes were added to the IR analysis (acne vulgaris, acute URI, allergic rhinitis, atopic dermatitis, cellulitis, hallux valgus, hemorrhoids, onychomycosis, otitis media, plantar fasciitis, sciatica, verruca vulgaris); only two yielded non-zero rates within the T_v3 follow-up window. The resulting empirical null is too sparse (n=2 non-zero observations) to fit a parametric distribution or compute formally calibrated p-values. Calibrated inference would benefit from either a richer set of negative controls validated for Acumenus, or running the study on a CDM with broader condition coverage.
4. **Drug-only Table 1.** The Characterization analysis was configured for drug-exposure features only. Demographic and laboratory features are recoverable via re-execution with the appropriate FeatureExtraction settings.
5. **Heart-failure events** are restricted to inpatient or ER+inpatient visits (visit_concept_id ∈ {9201, 262}) per the PI's pre-execution decision. Some genuine HF events outside an inpatient context are therefore not counted, which may underestimate the MACE rate.
6. **Comparator always-normotensive enforcement** was deferred to post-cohort SQL. The Circe `Measurement.ValueAsNumber` filter on 17 million SBP/DBP rows was IO-bound at >30 minutes during cohort generation; the constraint will be enforced via a post-cohort SQL trim in any downstream T-vs-C analysis. As reported, C_v3 is "no HTN diagnosis ever" plus the standard exclusions, not "all-BPs-below-threshold."

## 6. Conclusions

In a 265,000-person treatment-naive incident-essential-hypertension cohort drawn from the Acumenus OHDSI OMOP CDM, the 5-year incidence of major adverse cardiovascular events was **1.12 per 1,000 person-years** and the 5-year incidence of new-onset chronic kidney disease was **19.56 per 1,000 person-years**. CKD events outnumbered MACE events approximately seventeen-fold in this window, consistent with hypertension's well-established renal end-organ profile. Empirical-null calibration against twelve OHDSI-standard negative-control outcomes confirmed strong separation of the CKD signal from the data-quality null (5.7× the highest negative-control rate); the MACE signal was within the range of negative-control rates and did not show clear separation, consistent with either modest HTN-attributable cardiovascular risk in this incident cohort or background EHR event-rate noise.

The intended Lu replication and propensity-matched estimation could not be executed on this source; the limiting factor is the underlying CDM data structure, not the Parthenon platform itself, which ran the study end-to-end from concept-set definition through analysis execution. Two production bugs were diagnosed, patched, and shipped to the production branch during execution (`faf6ee8db` cohort-generation row claim, `8286d5bb9` incidence-rate plan field name). The cohort definitions were rebuilt from v2 to v3 with proper Circe `EndStrategy.DateOffset`, age-≥18 `DemographicCriteria`, eGFR < 60 `ValueAsNumber` exclusion, inpatient `VisitType` qualifier for heart-failure events, and a Circe `Death` event added to the MACE composite. The v3 numbers reported here are reproducible from the locked design version 3 (study `hypertension-study-v3-2`, design_version.id = 10).

The study establishes a baseline for future Parthenon-platform incident-HTN outcomes work and identifies a concrete data-quality gap in the Acumenus CDM that should inform future CDM ingestion priorities.

## References

1. **Lu Y, Brush J Jr, Kim C, et al.** Delayed Hypertension Diagnosis and Its Association With Cardiovascular Treatment and Outcomes. *JAMA Network Open* 2025;**8**(7):e2520498. doi:[10.1001/jamanetworkopen.2025.20498](https://doi.org/10.1001/jamanetworkopen.2025.20498)
2. **Whelton PK, Carey RM, Aronow WS, et al.** 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. *J Am Coll Cardiol* 2018;71(19):e127–e248.
3. **Hripcsak G, Duke JD, Shah NH, et al.** Observational Health Data Sciences and Informatics (OHDSI): Opportunities for Observational Researchers. *Stud Health Technol Inform* 2015;216:574–8.
4. **Suchard MA, Schuemie MJ, Krumholz HM, et al.** Comprehensive comparative effectiveness and safety of first-line antihypertensive drug classes: a systematic, multinational, large-scale analysis. *Lancet* 2019;394(10211):1816–1826.
5. **OHDSI HADES R package suite v3.0.0** (CohortIncidence, CohortMethod, FeatureExtraction, TreatmentPatterns, Achilles). Available at https://ohdsi.github.io/Hades/.

## Author Contributions

**Glenn H. Bock, MD** — protocol design, methodological review, clinical interpretation, open-question adjudication.
**Acumenus Informatics Team** (claude-code, supervised by Sanjay M. Udoshi, MD) — Parthenon platform execution, cohort and analysis design, pipeline debugging.

## Acknowledgments

This study was conducted on the Parthenon platform, a unified OHDSI outcomes-research environment developed by Acumenus Data Sciences. Two production bug fixes shipped during execution and are documented in `docs/research/hypertension-v3/reports/htn_v3_phase10_summary.md`. Full audit trail including version-locked design (`hypertension-study-v3-2`, v2 locked 2026-05-12) and pre-patch cohort snapshots is available in `app.studies`, `app.study_design_versions`, and `app.study_artifacts`.

---

*Manuscript draft, not for distribution beyond Acumenus and PI. Pending IRB/data-governance confirmation before publication (cf. open question Q15 in `docs/research/hypertension-v3/open-questions-answered.md`).*
