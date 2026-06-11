# Hypertension Study (V4)
**Authors:** Sanjay Udoshi
**Template:** strobe-record  
**Effect estimates included:** True · **Estimation contrasts:** 2 · **Gating enabled:** False

*Auto-composed by ManuscriptComposer (ADR-0020). Every figure traces to a stored result. Rendered 2026-06-11.*

## Abstract

Determine the prevalence, characteristics, and diagnostic timeliness of incident hypertension, indexing on the date of the 2nd consecutive elevated BP; quantify two latency intervals (first->second elevated BP; second elevated BP->recorded HTN diagnosis). Results: 90% of treatment-naïve elevated-BP patients never recorded a diagnosis; among the diagnosed, median delay to diagnosis was 1,106 days; elevated BP was associated with a calibrated HR of 2.6024 for incident CKD versus recording-comparable normotensives.

## Introduction

In US adults with hypertension, >3/4 remain uncontrolled and many go undiagnosed for years after documented elevated BP. Lu et al. 2025 (JAMA Netw Open 2025;8(7):e2520498) reported a median 16-18 month delay from two documented high BPs to a recorded HTN diagnosis, with delayed patients showing higher CV risk and event rates. This study quantifies the prevalence, latency, and outcome consequences of delayed diagnosis against the Acumenus CDM, indexing on the 2nd of two consecutive elevated office BPs.

## Methods

This was a retrospective_cohort observational study on the OMOP CDM. Prevalence, diagnostic latency, baseline characteristics, incidence, treatment utilization, and outcome consequences were analysed. Each effect-estimation contrast was propensity-score matched and empirically calibrated against the negative-control panel, and reported only when its own diagnostics cleared. Cohorts: T — Incident elevated BP, treatment-naive (2nd reading index) (target); G2 — Delayed Dx 3-6mo (subgroup); G3 — Delayed Dx 7-12mo (subgroup); Never-diagnosed (undiagnosed elevated BP) (subgroup); O1 — MACE composite (outcome); O2 — Incident CKD (outcome); NC — Gingivitis (negative_control); NC — Viral sinusitis (negative_control); NC — Primary dental caries (negative_control); NC — Acute viral pharyngitis (negative_control); NC — Acute bronchitis (negative_control); NC — Chronic sinusitis (negative_control); NC — Loss of teeth (negative_control); NC — Otitis media (negative_control); Recording-comparable normotensive (sensitivity) (comparator); G1 — Timely Dx <=3mo (delay stratum) (subgroup); G4 — Delayed Dx >12mo (delay stratum) (subgroup). Pre-specified diagnostic gates required propensity-score AUC below 0.8, maximum post-adjustment SMD below 0.1, and equipoise of at least 0.3.

## Results

### Prevalence of under-diagnosis
Of 109,763 treatment-naïve patients entering on a second consecutive elevated blood-pressure reading, 98,769 (90%) never recorded a hypertension diagnosis within their observation period; only 10,994 were ever diagnosed. Timely diagnosis was rare: among the diagnosed, 139 were recorded within 90 days, 284 within 3–6 months, 675 within 7–12 months, and 9,896 only after more than a year.

### Diagnostic latency
The interval between the first and second elevated blood-pressure readings had a median of 175 days (IQR 84–266). Among patients who were eventually diagnosed (n=10,994), the interval from the second elevated reading to the recorded hypertension diagnosis had a median of 1,106 days (IQR 704–1,862) — roughly 3 years.

### Baseline characteristics by delay stratum
Baseline characteristics were compared across the five delay strata — timely (≤3mo, n=139), 3–6 months (n=284), 7–12 months (n=675), delayed (>12mo, n=9,896), and never diagnosed (n=98,769). By demographics, the timely stratum was 51.08% female with 44.6% aged ≥50; the delayed (>12mo) stratum was 45.2% female with 37.3% aged ≥50; the never diagnosed stratum was 53.09% female with 27.9% aged ≥50. Full distributions of demographics, conditions, drugs, measurements, and procedures, with standardized mean differences against the full treatment-naïve elevated-BP cohort, are reported in the characterization result.

### Incidence of cardiovascular–renal outcomes
Crude incidence, with time at risk measured from the index reading: O1 — MACE composite — overall 6.9999/1,000 py (95% CI 6.7783–7.2269); MALE 7.888/1,000 py (95% CI 7.548–8.2394); FEMALE 6.1938/1,000 py (95% CI 5.907–6.491); 18-34 1.9017/1,000 py (95% CI 1.7248–2.0919); 35-49 6.413/1,000 py (95% CI 6.0359–6.8076); 50-64 13.4488/1,000 py (95% CI 12.7954–14.1269); 65+ 22.4961/1,000 py (95% CI 20.8416–24.2471). O2 — Incident CKD — overall 1.6676/1,000 py (95% CI 1.5611–1.7795); MALE 2.0439/1,000 py (95% CI 1.8739–2.2252); FEMALE 1.3252/1,000 py (95% CI 1.1951–1.4656); 18-34 1.0131/1,000 py (95% CI 0.8853–1.1541); 35-49 1.7411/1,000 py (95% CI 1.5483–1.9511); 50-64 2.5976/1,000 py (95% CI 2.3186–2.9009); 65+ 2.3185/1,000 py (95% CI 1.8205–2.9107).

### Treatment utilization
Only 18,930 patients (17.2%) of the elevated-BP population were ever dispensed an antihypertensive after the index reading, with a median time to first agent of 1,134 days (IQR 658–1,904). Treatment tracked diagnosis closely: 100% of the diagnosed were treated, so under-treatment mirrored under-diagnosis.

### Outcome consequences
Hypertension Study (V4): Treatment-naive elevated BP vs recording-comparable normotensive (sensitivity) — propensity-score diagnostics: AUC 0.5723, equipoise 0.9884, maximum post-adjustment SMD 0.0155. Estimates were empirically calibrated against 8 negative controls (EASE 0.0197). Calibrated effect estimates: O1_v3 - MACE composite (MI + stroke + inpatient HF + death): calibrated HR 1.0345 (95% CI 0.9365–1.1428), calibrated p 0.5039. O2_v3 - Incident CKD: calibrated HR 2.6024 (95% CI 2.0065–3.3754), calibrated p <0.0001.

Hypertension Study (V4): Delayed vs Timely Diagnosis (G4 vs G1) — propensity-score diagnostics: AUC 0.7984, equipoise 0.9255, maximum post-adjustment SMD 0.2443. This pre-specified contrast was not estimable — the diagnostics did not clear (the comparator could not be balanced), so its effect estimates are withheld (blinded) and were not interpreted.

## Limitations

The following qualify the findings. The "Hypertension Study (V4): Delayed vs Timely Diagnosis (G4 vs G1)" contrast was not estimable in this data and its effect estimates were withheld.

## Provenance & Reproducibility

This study is reproducible from its content-addressed artifacts. Cohort definitions: HTN v4 - T: Incident elevated BP, treatment-naive (2nd consecutive reading index) [sha256:c999aa520bc7]; HTN v4 - G2: Delayed Dx (3-6mo) [sha256:3a734c2f74bd]; HTN v4 - G3: Delayed Dx (7-12mo) [sha256:3a734c2f74bd]; HTN v4 - Never-diagnosed (undiagnosed elevated BP) [sha256:3a734c2f74bd]; O1_v3 - MACE composite (MI + stroke + inpatient HF + death) [sha256:unhashed]; O2_v3 - Incident CKD [sha256:unhashed]; HTN v4 - NC: Gingivitis [sha256:300122707866]; HTN v4 - NC: Viral sinusitis [sha256:db2bea927fba]; HTN v4 - NC: Primary dental caries [sha256:0f9f98d19413]; HTN v4 - NC: Acute viral pharyngitis [sha256:b973bc28cbee]; HTN v4 - NC: Acute bronchitis [sha256:1c200b788faf]; HTN v4 - NC: Chronic sinusitis [sha256:2b3df325ef3b]; HTN v4 - NC: Loss of teeth [sha256:b9f36c036271]; HTN v4 - NC: Otitis media [sha256:1501d390b9d8]; HTN v4 - C: Recording-comparable normotensive comparator (2nd normal BP reading index) [sha256:727449b430b8]; HTN v4 - G1: Timely Dx (<=3mo) [sha256:3a734c2f74bd]; HTN v4 - G4: Delayed Dx (>12mo) [sha256:3a734c2f74bd]. Gate-ledger decision trail: estimation_calibration=passed, study_diagnostics=passed.
