# Why OHDSI's R Packages Don't Just Work: Lessons from Building a Production HADES Runtime

*Dr. M.B. Udoshi — March 2026*

## The Promise

The OHDSI HADES ecosystem is remarkable. CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries — these R packages encode decades of pharmacoepidemiology methodology into reusable software. In theory, you point them at an OMOP CDM database, call a few functions, and get publication-ready causal inference results.

In practice, getting these packages to run correctly in a modern production environment required solving problems that no documentation warned us about.

This is the story of what we encountered building Parthenon's R runtime — a Plumber API sidecar that executes HADES analyses against a 1-million-patient CDM — and the specific, reproducible bugs we had to fix before a single analysis could complete.

## The Architecture

Parthenon wraps each HADES pipeline (estimation, prediction, SCCS) in an R Plumber endpoint. A Laravel backend dispatches analysis jobs via Redis/Horizon queues. The PHP service calls the R Plumber API over HTTP, passing a JSON spec with database connection details, cohort IDs, model parameters, and covariate settings. The R endpoint connects to PostgreSQL via JDBC (DatabaseConnector), runs the HADES pipeline, and returns structured JSON results.

Simple enough. Here's what actually happened.

## Bug 1: The Silent Covariate Exclusion Bypass

**The symptom:** Every CohortMethod estimation with propensity score matching failed with "High correlation between covariate(s) and treatment detected."

**The investigation:** This error means a covariate perfectly predicts treatment assignment — usually because the treatment drug itself appears as a covariate. The standard fix is `excludedCovariateConceptIds` in `createCovariateSettings()`. We were passing it. It wasn't working.

**The root cause:** Our covariate settings builder had two code paths. When the frontend sends FeatureExtraction parameter names directly (`useDemographicsAge: true`, `useConditionOccurrenceLongTerm: true`), an early-return path collected these `use*` keys and called `createCovariateSettings()`. This path checked the function's `exclude_concept_ids` parameter but **completely ignored** `spec$excludedConceptIds` from the JSON payload.

```r
# BEFORE: excludedConceptIds from the spec was silently dropped
use_keys <- grep("^use", names(spec), value = TRUE)
if (length(use_keys) > 0) {
  args <- lapply(spec[use_keys], as.logical)
  if (length(exclude_concept_ids) > 0) {  # only checked function param!
    args$excludedCovariateConceptIds <- as.integer(exclude_concept_ids)
  }
  return(do.call(FeatureExtraction::createCovariateSettings, args))
}
```

The fix was three lines — merge both sources of exclusions:

```r
all_exclude <- c(
  as.integer(exclude_concept_ids),
  as.integer(spec$excludedConceptIds %||% c())
)
```

But finding those three lines required tracing the full data flow from the frontend React form through the Laravel controller, through the HTTP call to R, through the covariate builder, and into `createCovariateSettings()`. The error message from CohortMethod gives no indication of *which* covariate caused the correlation. You just get a wall of text telling you to exclude something, with no guidance on what.

**The deeper lesson:** Even after fixing the exclusion bypass, Lisinopril vs ACE-I comparisons still failed. The reason: `useDrugGroupEraLongTerm` creates ATC-class-level covariates, and both Lisinopril and other ACE inhibitors share the same ATC class. We had to exclude all 18 ACE-I and ARB ingredient concept IDs AND remove drug group era covariates entirely. The final working comparison was Lisinopril vs ARB users — a standard OHDSI study design, but one that required iterating through four different covariate configurations before the propensity score model would converge.

## Bug 2: CohortMethod v6 Changed Every PS Adjustment Function Signature

**The symptom:** After 12 minutes of propensity score fitting (on 100K subjects with thousands of covariates), the pipeline crashed with "unused arguments (maxRatio = match_ratio, caliper = match_caliper)."

**The root cause:** CohortMethod v6 adopted an "Args objects" pattern. Every function that previously accepted parameters directly now requires a pre-built Args object:

```r
# v5 (what the docs and examples often show):
matchOnPs(population = ps, maxRatio = 1, caliper = 0.2)

# v6 (what actually works):
matchArgs <- createMatchOnPsArgs(caliper = 0.2, maxRatio = 1)
matchOnPs(population = ps, matchOnPsArgs = matchArgs)
```

This applied to `matchOnPs`, `stratifyByPs`, `trimByPs`, `createStudyPopulation`, `fitOutcomeModel`, and `getDbCohortMethodData`. Every single PS adjustment call needed refactoring.

**Why this matters:** The HADES package documentation is extensive but version-specific examples are hard to find. The v6 migration guide exists but doesn't emphasize that the old calling conventions will silently pass R's argument matching and then fail at runtime. You won't discover these until you actually run an analysis — which, with real data, means waiting 15-20 minutes for feature extraction and PS fitting before hitting the error.

## Bug 3: jsonlite Turns Your Arrays Into DataFrames

**The symptom:** SCCS pipeline crashed with "$ operator is invalid for atomic vectors."

**The investigation:** The error pointed to code iterating over risk windows:

```r
era_settings_list <- lapply(risk_windows, function(rw) {
  SelfControlledCaseSeries::createEraCovariateSettings(
    label = rw$label,  # CRASH: $ operator is invalid for atomic vectors
    ...
  )
})
```

**The root cause:** When R's Plumber framework receives a JSON request body, it uses `jsonlite::fromJSON()` with `simplifyVector = TRUE` (the default). This means a JSON array of objects:

```json
[
  {"label": "Acute risk", "start": 1, "end": 30},
  {"label": "Extended risk", "start": 31, "end": 60}
]
```

gets parsed not as a list of lists, but as a **data.frame**:

```
     label start end
1 Acute risk     1  30
2 Extended risk    31  60
```

When you call `lapply` on a data.frame, it iterates over **columns**, not rows. So `rw` in the lambda is the character vector `c("Acute risk", "Extended risk")`, and `rw$label` fails because you can't use `$` on an atomic vector.

The fix:

```r
if (is.data.frame(raw_rw)) {
  risk_windows <- lapply(seq_len(nrow(raw_rw)), function(i) as.list(raw_rw[i, ]))
} else {
  risk_windows <- raw_rw
}
```

**This is a landmine in every R API that accepts JSON arrays of objects.** It's not a bug in jsonlite — `simplifyVector = TRUE` is useful in many contexts. But when you're building an API that receives structured specs from a non-R client, the automatic simplification silently changes your data structures in ways that break downstream code.

## Bug 4: PLP Returns Non-Serializable S3 Objects

**The symptom:** PLP pipeline completed successfully (17 seconds of model training), then crashed during JSON serialization with "No method asJSON S3 class: modelSettings."

**The root cause:** `plpResult$model$modelDesign$modelSettings` is an S3 object with a custom class. Plumber uses `jsonlite::toJSON()` to serialize the response, and jsonlite doesn't know how to serialize arbitrary S3 classes.

The fix was to strip the class before returning:

```r
ms <- plpResult$model$modelDesign$modelSettings
if (is.list(ms)) {
  ms <- unclass(ms)
  lapply(ms, function(x) if (is.list(x)) unclass(x) else x)
}
```

**The pattern:** Any HADES result object that contains nested S3 classes will crash jsonlite serialization. You need to defensively `unclass()` every nested structure before returning from a Plumber endpoint. The HADES packages weren't designed for JSON serialization — they were designed for interactive R sessions where S3 dispatch is a feature, not a bug.

## Bug 5: The Anchor Normalization Nobody Documents

**The symptom:** SCCS `createEraCovariateSettings()` failed with invalid anchor values.

**The root cause:** The frontend sent anchor values with underscores (`era_start`, `era_end`), but the R function expects spaces (`era start`, `era end`). A trivial fix:

```r
normalize_anchor <- function(val, default = "era end") {
  gsub("_", " ", val %||% default)
}
```

But this is symptomatic of a broader problem: the HADES packages accept specific string literals for enum-like parameters, and those strings are often space-separated multi-word values. When you're passing these through JSON from a web frontend through a PHP backend into R, the impedance mismatch between JavaScript/PHP naming conventions (camelCase, snake_case) and R's space-separated string literals creates a whole category of silent failures.

## The Meta-Problem: Error Discovery Time

Each of these bugs has a straightforward fix. The hard part is **finding** them.

A single CohortMethod estimation with propensity score matching takes 15-35 minutes on 100K subjects:
- Feature extraction: 4 minutes (SQL queries against the CDM)
- PS model fitting: 12 minutes (Cyclops optimizer with thousands of covariates)
- PS matching: 1 minute
- Outcome model: 30 seconds

If the error is in PS matching (Bug 2), you wait 16 minutes before discovering it. If it's in covariate settings (Bug 1), the PS fitting itself crashes after 12 minutes. If it's in JSON serialization (Bug 4), the model trains for 17 seconds but you lose all results.

We went through 14 execution attempts before all three analysis types completed successfully. Each attempt required: modify R code → restart R container (12 seconds for HADES package loading) → dispatch job → wait 5-35 minutes → read error from `result_json` → diagnose → repeat.

## What We'd Tell Our Past Selves

1. **Test R code with direct function calls first.** Don't route through Plumber/JSON/HTTP until the core HADES calls work in an interactive R session. The JSON serialization layer adds an entire category of bugs.

2. **Pin exact HADES package versions and read the changelogs.** The v5→v6 API changes are significant. `args(CohortMethod::matchOnPs)` is your friend.

3. **Never trust `lapply` on data parsed from JSON.** Always check `is.data.frame()` before iterating. Better yet, explicitly convert to list-of-lists at the API boundary.

4. **Exclude aggressively.** For comparative effectiveness studies, exclude not just the treatment drug but all drugs in the same pharmacological class, AND consider removing drug group era covariates entirely. The "high correlation" error gives you zero diagnostic information about which covariate caused it.

5. **Build a fast feedback loop.** We eventually learned to test covariate settings with a small utility function before committing to a full 30-minute estimation run. If `createCovariateSettings()` and `createPs()` succeed on a subset, the full pipeline will likely work.

6. **`unclass()` everything before JSON return.** HADES result objects are deeply nested S3 structures. Wrap every result extraction in `tryCatch()` and `unclass()`.

## The Result

After fixing these five bugs, Parthenon now runs real HADES analyses against a 1-million-patient CDM:

- **CohortMethod estimation** with 1:1 propensity score matching: Lisinopril vs ARB, HR=1.02 for CAD, HR=0.77 for AMI, PS AUC=0.95, post-matching SMD=0.017
- **PatientLevelPrediction** with LASSO logistic regression: 24,501 subjects, 30 top predictors, full ROC and calibration curves
- **Self-Controlled Case Series**: 3 risk window IRR estimates with confidence intervals

The OHDSI ecosystem is powerful. But "powerful" and "production-ready" are different things. The R packages encode brilliant epidemiological methodology. The challenge is in the last mile — getting structured results out of R and into a modern web application where clinicians and researchers can actually see them.

That last mile took us 14 iterations, 5 bug fixes, and about 6 hours of wall-clock time. But the result is a platform that can run real population-level studies at the click of a button, which is exactly what OHDSI's tools were built to enable.

---

*Parthenon is an open-source unified OHDSI outcomes research platform. The R runtime fixes described here are available in the project repository.*
