---
slug: dev-diary-2026-03-15-analyses-pipeline
title: "11 Studies, 26 Analyses, and the Bugs That Only Surface with Real Data"
authors: [mudoshi, claude]
tags: [development, analyses, cohort-method, frontend, bug-fixes, ohdsi]
date: 2026-03-15
---

We stood up the full Parthenon analyses pipeline end-to-end: 11 comparative effectiveness studies across 10 disease areas, 46 generated cohorts, and 26 executed analyses including R-based CohortMethod propensity score matching on populations up to 68,000 patients. Along the way, we found and fixed every null-safety bug that only surfaces when real analysis results hit the frontend.

<!-- truncate -->

## The Studies

Starting from 1 million Synthea patients in the Acumenus CDM, we created comparative effectiveness studies for every major disease population:

| Study | Target | N | Comparator | N | Status |
|-------|--------|---|-----------|---|--------|
| HTN: ACEi vs CCB | Lisinopril | 23,861 | Amlodipine | 19,217 | All analyses complete |
| IHD: Beta-Blocker vs Antiplatelet | Metoprolol | 67,634 | Clopidogrel | 50,805 | All analyses complete |
| Hyperlipidemia: Statin comparison | Simvastatin | 39,297 | Atorvastatin | 158 | Running |
| Heart Failure: BB vs ACEi | Carvedilol | 5,435 | Lisinopril | 5,761 | Running |
| Knee OA: NSAID safety | Naproxen | 17,366 | Ibuprofen | 450 | Running |
| CKD: Early vs Late stage | Stage 1-2 | 56,521 | Stage 3-4 | 36,236 | Running |
| AFib: Dual vs Mono antithrombotic | Dual therapy | 89 | Monotherapy | 2,179 | All analyses complete |

Each study includes concept sets, target/comparator cohorts, outcome cohorts, a CohortMethod estimation (PS 1:4 matching, Cox PH), two incidence rate analyses (age/gender stratified), and a baseline characterization.

## The HTN Estimation Results

The first completed estimation — ACE inhibitor (lisinopril) vs calcium channel blocker (amlodipine) in essential hypertension — produced real CohortMethod results:

- **Target:** 12,340 patients after attrition
- **Comparator:** 7,755 patients after attrition
- **CV Composite outcome:** HR = 1.20, 95% CI [1.06, 1.36], p = 0.005
- **CKD Progression outcome:** HR = 1.03, 95% CI [0.95, 1.12], p = 0.42
- **Kaplan-Meier curves:** 198 time points per arm
- **R execution time:** 10 minutes 24 seconds

The results include full attrition tables, propensity score diagnostics, and Kaplan-Meier survival data — all viewable in the Parthenon UI.

## Bugs Found and Fixed

Real analysis results exposed a cascade of null-safety issues across the frontend. Every one of these bugs existed before today but was invisible because no real executions had been run against these components with actual R output.

### Cohort Expression Schema: `ConceptSets` vs `conceptSets`

The Atlas expression format uses `ConceptSets` (uppercase C), but our SQL compiler expected `conceptSets` (lowercase). Cohort generation was producing SQL that referenced `codesetId_0` as a temp table instead of a CTE because the concept sets were silently dropped during normalization.

**Fix:** Added case normalization in `CohortExpressionSchema.php` to accept both formats.

### DemographicCriteria: Object vs Array

Our cohort expressions store `DemographicCriteria` as an object (`{"Age": {"Value": 18, "Op": "gte"}}`), but the expression editor expected an array of filter objects. Every `.map()` call crashed because you can't `.map()` an object.

**Fix:** Added `asDemographicArray()` normalizer that handles undefined, single object, and array formats.

### Characterization Results: Unrecognized Format

The characterization execution returns `{targetCohorts: {cohortId: {domain: rows}}}`, but the frontend parser only recognized `[{features: {...}}]` format. Result: "Execution completed but no results were returned."

**Fix:** Added `parseTargetComparatorFormat()` to handle both result shapes, with correct field mapping (`person_count` -> `count`, `percent_value` / 100 -> `mean`, `concept_name` -> `covariate_name`).

### Estimation Results: Undefined Array Access

The `EstimationResults` component accessed `result.estimates.length`, `result.attrition.map()`, `result.kaplan_meier.target`, etc. without null guards. When any nested result property was absent (partial R output), the page crashed.

**Fix:** Added safe local variables with `?? []` / `?? {}` fallbacks for all 8 result properties.

### Estimation Verdict Dashboard: Empty KM Arrays

The NNT/NNH calculation accessed `sortedArray[0].survival` without checking if the Kaplan-Meier arrays were empty.

**Fix:** Added length guard before `[0]` access.

### Feature Comparison Table: Undefined Category/Name

The `classifyDomain()` function called `.toLowerCase()` on `category` and `featureName` that could be undefined from the API.

**Fix:** Nullish coalescing: `(category ?? "").toLowerCase()`.

### Cohort Expression Editor: Multiple Unsafe Accesses

`expression.ConceptSets.length`, `expression.PrimaryCriteria.CriteriaList.length`, `group.CriteriaList.length`, `group.Groups.length` — all crashed when the expression had missing keys.

**Fix:** Optional chaining throughout, plus fallback to `expression.conceptSets` for the lowercase variant.

### Horizon Queue Worker: Missing Broadcast Connection

Horizon crashed on startup with "Broadcast connection [redis] is not defined" because `broadcasting.php` had no `redis` driver configured (only `reverb`).

**Fix:** Added `redis` broadcast connection to `broadcasting.php`.

## Infrastructure

- **Horizon is now healthy** and processing R estimation jobs automatically
- **Broadcasting fixed** — real-time updates work for analysis execution status
- All **incidence rates and characterizations** complete in under 5 seconds
- **R-based estimations** take 30s (small cohorts) to 10+ minutes (large cohorts with PS matching)

## What's Still Running

4 estimation analyses are still processing through R/CohortMethod — the larger population studies (IHD 68K+51K, Statin 39K, OA 17K, CKD 57K+36K). These are processing sequentially through Horizon and should all complete within the hour.
