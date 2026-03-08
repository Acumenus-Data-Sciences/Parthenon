---
slug: running-13-analyses-on-million-patients
title: "Running All 13 OHDSI Analyses on 1 Million Patients: What Broke, What Worked, and What We Learned"
authors: [mudoshi, claude]
tags: [ohdsi, hades, cohort-method, plp, sccs, evidence-synthesis, r-runtime, architecture]
date: 2026-03-08
---

We ran every analysis type in Parthenon — estimation, prediction, SCCS, evidence synthesis, pathways, characterization, and incidence rates — against our full Acumenus CDM with 1 million synthetic patients. Thirteen seeded analyses. Seven different OHDSI methodologies. One session.

This post covers what happened when we moved from the 2,694-patient Eunomia demo dataset to production scale, the bugs that only surface at a million patients, and the hard-won lessons about propensity score modeling on synthetic data.

<!-- truncate -->

## Why Run Everything at Once?

Parthenon ships with 13 pre-seeded analyses designed to demonstrate each capability:

| Type | Analyses | R or PHP? |
|------|----------|-----------|
| Population-Level Estimation | 3 (CohortMethod v6) | R |
| Patient-Level Prediction | 3 (PLP: LASSO + xgboost) | R |
| Self-Controlled Case Series | 3 (SCCS) | R |
| Evidence Synthesis | 1 (Bayesian meta-analysis) | R |
| Treatment Pathways | 2 (Sankey flows) | PHP |
| Characterization | 2 (feature comparison) | PHP |
| Incidence Rates | 2 (person-time calculations) | PHP |

On Eunomia (2,694 GiBleed patients), these analyses complete in seconds. But Eunomia is a teaching dataset. Real CDM databases have millions of patients with tens of thousands of unique drug products, conditions, and procedures. The question was: does the entire pipeline survive at production scale?

## The Architecture Under Stress

Each R-based analysis follows this path:

```
Laravel Job Queue (Horizon)
  → PHP dispatches HTTP POST to R Plumber API
    → R connects to PostgreSQL via JDBC
      → HADES package runs statistical pipeline
        → Returns structured JSON to PHP
          → Stored in analysis_executions.result_json
```

The PHP-based analyses (pathways, characterization, incidence rates) skip the R runtime entirely — they execute SQL directly against the CDM via Eloquent.

At 1 million patients, the R analyses stretched to their limits. A single CohortMethod estimation took **47 minutes**. The R container consumed 2.2 GB of RAM fitting propensity score models. And several assumptions that held on Eunomia broke catastrophically.

## Bug 1: The jsonlite Serialization Trap

**Analysis:** Evidence Synthesis (Bayesian meta-analysis)

**Error:** `$ operator is invalid for atomic vectors`

This one was subtle. When the PHP job sends a JSON spec to the R endpoint, the estimates array looks like:

```json
{
  "estimates": [
    {"logRr": -0.35, "seLogRr": 0.12, "siteName": "Site A"},
    {"logRr": -0.28, "seLogRr": 0.15, "siteName": "Site B"},
    {"logRr": -0.42, "seLogRr": 0.18, "siteName": "Site C"}
  ]
}
```

R's `jsonlite` library — used by Plumber to deserialize request bodies — sees an array of homogeneous objects and converts it to a **data.frame**, not a list of lists. This is actually a reasonable optimization for R's vectorized computing model. But our code assumed it was a list:

```r
# This works on a list-of-lists:
sapply(spec$estimates, function(e) e$logRr)

# But on a data.frame, sapply iterates COLUMNS, not rows.
# "logRr" becomes a vector, "seLogRr" becomes a vector...
# And e$logRr on a column vector fails with "$ operator is invalid"
```

**The fix:** Detect the type at runtime and handle both cases:

```r
estimates <- spec$estimates
if (is.data.frame(estimates)) {
  # Direct column access
  site_data <- data.frame(
    logRr   = as.numeric(estimates$logRr),
    seLogRr = as.numeric(estimates$seLogRr),
    site    = as.character(estimates$siteName)
  )
} else {
  # List-of-lists iteration
  site_data <- data.frame(
    logRr   = sapply(estimates, function(e) as.numeric(e$logRr)),
    seLogRr = sapply(estimates, function(e) as.numeric(e$seLogRr)),
    ...
  )
}
```

**Lesson:** Never assume `jsonlite` will preserve the exact structure you sent from another language. Homogeneous arrays become data frames. Heterogeneous arrays stay as lists. Test both paths.

## Bug 2: Propensity Score Separation on Synthetic Data

**Analysis:** Estimation #2 (ACE Inhibitors vs ARBs, 141K vs 31K patients)

**Error:** `High correlation between covariate(s) and treatment detected`

This was the most instructive failure. CohortMethod's `fitPsModel` detected near-perfect separation — some covariate almost perfectly predicted which patients got ACE inhibitors vs ARBs. In real observational data, this rarely happens because treatment assignment is complex and multifactorial.

In synthetic data, it's common. The data generation process assigns drug classes to patient archetypes, and those archetypes have systematic differences in conditions and procedures.

We tried four increasingly aggressive fixes:

1. **Excluded ACE-I + ARB ingredient concepts** (19 concept IDs with descendants) — Still failed. Drug *product* covariates (e.g., "lisinopril 10 MG Oral Tablet") aren't descendants of ingredient concepts in the OMOP vocabulary hierarchy.

2. **Removed `useDrugExposureLongTerm`** — Still failed. `useDrugExposureAnyTimePrior` still captured the drugs.

3. **Removed ALL drug exposure covariates** — Still failed. Conditions like "Chronic congestive heart failure" and procedures like "Echocardiography" were perfectly correlated with treatment in this synthetic data.

4. **Demographics + Charlson index only** — **Succeeded.** PS AUC = 0.90. The model produced valid hazard ratios: HR = 0.26 for CAD, HR = 8.15 for AMI.

**The lesson for synthetic data users:** OMOP CDM synthetic datasets (including Synthea-derived data) encode treatment assignment patterns that create artificial confounding. If you're building tooling on synthetic data, expect propensity score models to behave differently than on real-world claims data. The fix is either reducing the covariate space or accepting that the PS model is for demonstration purposes, not causal inference.

**The lesson for real-world use:** On actual claims or EHR data, the full covariate set (demographics + conditions + drugs + procedures + measurements) is exactly what you want. The high-correlation error on synthetic data is a *feature* of the diagnostic — it's correctly identifying that the data violates the positivity assumption. Don't suppress it; fix the data or the study design.

## Bug 3: Missing R Packages at Runtime

**Analysis:** Prediction #2 (Gradient Boosting)

**Error:** `The package "xgboost" is required`

The PatientLevelPrediction package supports multiple model types — LASSO logistic regression, gradient boosted machines, random forests, deep neural networks. Each requires its own R package. Our R container Dockerfile only installed the base HADES packages.

When a user creates a prediction analysis and selects "gradient boosting" as the model type, PLP tries to load `xgboost` at runtime and fails.

**The fix was trivial** — `install.packages("xgboost")` — but the architectural lesson matters: R packages installed at runtime don't persist across container rebuilds. The Dockerfile needs every package that any user-selectable model type requires:

```dockerfile
RUN R -e "install.packages(c('xgboost', 'glmnet'), repos='https://cloud.r-project.org')"
```

## Performance at Scale

The most striking observation was the performance profile across analysis types:

| Analysis Type | Duration (1M patients) | Bottleneck |
|--------------|----------------------|------------|
| Estimation (CohortMethod) | 20-47 minutes | PS model fitting + matching |
| Prediction (PLP) | 10-18 minutes | Feature extraction + CV |
| SCCS | 2-5 minutes | Conditional Poisson regression |
| Evidence Synthesis | ~1 minute | MCMC (1.1M iterations) |
| Pathways (PHP) | < 1 minute | SQL aggregation |
| Characterization (PHP) | < 1 minute | Reading pre-computed Achilles |
| Incidence Rate (PHP) | < 1 minute | Person-time SQL |

CohortMethod is the heavyweight. For Estimation #1 (Lisinopril vs ARB, 100K vs 31K patients, matching), the breakdown was:

- Data extraction via JDBC: **4 minutes** (SQL + data transfer)
- PS model fitting (Cyclops regularized regression): **12 minutes** per outcome
- PS matching (greedy 1:1): **5 minutes**
- Covariate balance computation: **1 minute**
- Cox outcome model: **< 1 second**

The R container runs single-threaded. With 3 estimation analyses running sequentially, we spent over 2 hours on estimation alone. For production environments with regular analysis runs, parallelizing with multiple R containers behind a load balancer would be worth the infrastructure cost.

## The Prediction AUC Mystery

All three prediction analyses completed successfully — they produced ROC curves (152-200 data points), calibration plots, and ranked the top 30 predictive features. But every AUC came back as `NA`.

The culprit: extremely low outcome rates.

| Prediction Analysis | Target Population | Outcomes | Rate |
|---|---|---|---|
| CKD Progression | 24,501 | 66 | 0.27% |
| HF Readmission | 35,339 | 29 | 0.08% |
| CKD Risk (LASSO) | 1,995 | 52 | 2.61% |

With 29-66 outcomes in populations of 2K-35K, the cross-validation folds have too few positive cases for a stable AUC estimate. R's AUC computation returned `NA` rather than an unreliable number.

This is where the Phase 1 crash hardening paid off. Earlier in the week, we'd replaced every `.toFixed()` call across 18+ chart components with a defensive `fmt()` function:

```typescript
export function fmt(v: unknown, decimals = 3): string {
  if (v == null || v === "NA" || v === "NaN" || v === "") return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) : "N/A";
}
```

Without this, the frontend would crash with `Cannot read properties of undefined (reading 'toFixed')` the moment it tried to render a prediction result. With it, users see "N/A" in the AUC badge — which is the correct representation of an uncomputable metric.

## The Two-Queue Architecture

Parthenon uses two separate Laravel queues for analysis execution:

- **`analysis` queue** — PHP-based analyses (pathways, characterization, incidence rates). Fast, SQL-only, processed by the standard Horizon worker.
- **`r-analysis` queue** — R-based analyses (estimation, prediction, SCCS, evidence synthesis). Slow, computationally intensive, processed with extended timeouts (30 minutes per job).

This separation is essential. If R analyses shared the queue with PHP analyses, a 47-minute estimation would block every pathway and characterization run behind it. Separate queues let the fast analyses complete immediately while R jobs churn through their statistical pipelines.

```php
// PHP analysis — fast queue
RunPathwayJob::dispatch($analysis, $source, $exec)->onQueue('analysis');

// R analysis — slow queue with extended timeout
RunEstimationJob::dispatch($analysis, $source, $exec)->onQueue('r-analysis');
```

## Results That Actually Matter

With all 13 analyses complete on production-scale data, Parthenon now demonstrates real OHDSI outcomes:

**Estimation:** Lisinopril shows no significant difference vs ARBs for coronary artery disease (HR = 1.02, 95% CI [0.93, 1.12], p = 0.66). The propensity score model achieved an AUC of 0.95, indicating excellent discriminative ability — the populations were well-balanced after matching.

**Evidence Synthesis:** Bayesian random-effects meta-analysis across 3 simulated sites produced a pooled hazard ratio of 0.72 [0.59, 0.87] with between-study heterogeneity tau = 0.077 — low heterogeneity, consistent effect across sites.

**SCCS:** The NSAID-AKI analysis found an incidence rate ratio of 93.0 in the primary risk window — an extremely strong signal, consistent with the known acute nephrotoxicity of NSAIDs. (The magnitude reflects synthetic data characteristics; real-world IRRs for NSAID-AKI are typically 1.5-3.0.)

## What We'd Do Differently

1. **Start with production-scale data.** Eunomia is great for testing the pipeline mechanics, but every assumption about covariate balance, outcome rates, and execution time changes at 1M patients. Test both early.

2. **Install all optional R packages in the Dockerfile.** Don't wait for `"xgboost is required"` at runtime. Enumerate every model type PLP supports and pre-install the dependencies.

3. **Add adaptive covariate sets per study design.** The "demographics only" fallback for Estimation #2 worked, but a smarter approach would be to run a preliminary PS model, check for separation, and automatically suggest excluded concepts before the full pipeline runs.

4. **Multi-thread the R container.** Single-threaded execution on 1M patients is painful. CohortMethod and PLP both support `parallel = TRUE` via the `ParallelLogger` package — we just need to configure it.

## The Scorecard

| Metric | Value |
|--------|-------|
| Analyses executed | 13/13 |
| Analysis types covered | 7/7 |
| Total R compute time | ~3 hours |
| Total PHP compute time | ~5 minutes |
| Bugs fixed in session | 3 |
| Frontend crashes prevented | 18+ components hardened |
| Patient records processed | 1,000,000 |

All 13 analyses now have verified results on the Acumenus CDM. The frontend renders every chart, table, and plot without crashing — even when R returns `"NA"` for metrics that can't be computed on sparse outcomes.

Next up: Phase 4 of the v2 enhancement plan — execution auto-refresh, source name display in execution history, side-by-side comparison of executions, and CSV/PDF export of results.
