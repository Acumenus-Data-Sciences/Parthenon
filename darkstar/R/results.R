# ──────────────────────────────────────────────────────────────────
# Result serialization helpers
# Converts HADES R objects into JSON-serializable lists that match
# the frontend's EstimationResult / PredictionResult types.
# ──────────────────────────────────────────────────────────────────

source("/app/R/connection.R")  # for %||%

# ── CohortMethod helpers ────────────────────────────────────────

#' Extract KM curve data from a CohortMethod study population.
#' Returns a list with $target and $comparator arrays of {time, survival, lower, upper}.
extract_km_data <- function(population) {
  tryCatch({
    # Use survival package (dependency of CohortMethod)
    if (!requireNamespace("survival", quietly = TRUE)) {
      return(NULL)
    }

    pop <- as.data.frame(population)
    surv_obj <- survival::survfit(
      survival::Surv(survivalTime, outcomeCount > 0) ~ treatment,
      data = pop
    )

    # Extract per-stratum data
    strata_names <- names(surv_obj$strata)
    result <- list()

    cum_n <- 0
    for (i in seq_along(surv_obj$strata)) {
      n <- surv_obj$strata[i]
      idx <- (cum_n + 1):(cum_n + n)
      cum_n <- cum_n + n

      times    <- surv_obj$time[idx]
      surv     <- surv_obj$surv[idx]
      lower    <- surv_obj$lower[idx]
      upper    <- surv_obj$upper[idx]

      # Subsample for JSON size (max 200 points per arm)
      if (length(times) > 200) {
        sample_idx <- sort(unique(c(1, seq(1, length(times), length.out = 198), length(times))))
        times <- times[sample_idx]
        surv  <- surv[sample_idx]
        lower <- lower[sample_idx]
        upper <- upper[sample_idx]
      }

      points <- mapply(function(t, s, lo, hi) {
        list(time = t, survival = round(s, 4), lower = round(lo, 4), upper = round(hi, 4))
      }, times, surv, lower, upper, SIMPLIFY = FALSE, USE.NAMES = FALSE)

      # treatment=1 → target, treatment=0 → comparator
      if (grepl("1$", strata_names[i])) {
        result$target <- points
      } else {
        result$comparator <- points
      }
    }

    result
  }, error = function(e) {
    NULL
  })
}

#' Extract top covariate balance entries as a list of named lists.
extract_balance_summary <- function(balance, n = 50) {
  if (is.null(balance)) return(list())

  tryCatch({
    bal_df <- as.data.frame(balance)

    # Sort by absolute afterMatchingStdDiff descending
    if ("afterMatchingStdDiff" %in% names(bal_df)) {
      bal_df <- bal_df[order(-abs(bal_df$beforeMatchingStdDiff)), ]
    } else if ("stdDiffAfter" %in% names(bal_df)) {
      bal_df <- bal_df[order(-abs(bal_df$stdDiffBefore)), ]
    }

    bal_df <- head(bal_df, n)

    lapply(seq_len(nrow(bal_df)), function(i) {
      row <- bal_df[i, ]
      list(
        covariate_name     = as.character(row$covariateName %||% row$covariateId),
        concept_id         = as.integer(row$conceptId %||% NA),
        smd_before         = round(as.numeric(row$beforeMatchingStdDiff %||% row$stdDiffBefore %||% 0), 4),
        smd_after          = round(as.numeric(row$afterMatchingStdDiff  %||% row$stdDiffAfter  %||% 0), 4),
        mean_target_before = round(as.numeric(row$beforeMatchingMeanTarget    %||% row$meanBefore1 %||% 0), 4),
        mean_comp_before   = round(as.numeric(row$beforeMatchingMeanComparator %||% row$meanBefore0 %||% 0), 4),
        mean_target_after  = round(as.numeric(row$afterMatchingMeanTarget     %||% row$meanAfter1 %||% 0), 4),
        mean_comp_after    = round(as.numeric(row$afterMatchingMeanComparator  %||% row$meanAfter0 %||% 0), 4)
      )
    })
  }, error = function(e) list())
}

#' Extract attrition table from a study population.
extract_attrition <- function(population) {
  tryCatch({
    att <- CohortMethod::getAttritionTable(population)
    if (is.null(att)) return(list())
    lapply(seq_len(nrow(att)), function(i) {
      list(
        step       = as.character(att$description[i]),
        target     = as.integer(att$targetPersons[i] %||% att$treatedPersons[i] %||% 0),
        comparator = as.integer(att$comparatorPersons[i] %||% att$untreatedPersons[i] %||% 0)
      )
    })
  }, error = function(e) list())
}

#' Extract PS distribution histogram data.
extract_ps_distribution <- function(ps) {
  tryCatch({
    ps_df <- as.data.frame(ps)
    breaks <- seq(0, 1, by = 0.02)

    target_hist <- hist(ps_df$propensityScore[ps_df$treatment == 1], breaks = breaks, plot = FALSE)
    comp_hist   <- hist(ps_df$propensityScore[ps_df$treatment == 0], breaks = breaks, plot = FALSE)

    list(
      target     = mapply(function(x, y) list(x = round(x, 3), y = as.integer(y)),
                          target_hist$mids, target_hist$counts, SIMPLIFY = FALSE, USE.NAMES = FALSE),
      comparator = mapply(function(x, y) list(x = round(x, 3), y = as.integer(y)),
                          comp_hist$mids, comp_hist$counts, SIMPLIFY = FALSE, USE.NAMES = FALSE)
    )
  }, error = function(e) NULL)
}


# ── PLP helpers ─────────────────────────────────────────────────

#' Extract ROC curve points from a PLP result.
extract_roc_points <- function(plp_result) {
  tryCatch({
    # PLP stores threshold performance data
    thresh <- plp_result$performanceEvaluation$thresholdSummary
    if (is.null(thresh)) return(list())

    # Filter to test set
    test_thresh <- thresh[thresh$evaluation %in% c("Test", "test"), ]
    if (nrow(test_thresh) == 0) test_thresh <- thresh

    # Sort by FPR
    test_thresh <- test_thresh[order(test_thresh$falsePositiveRate), ]

    # Subsample for JSON size
    if (nrow(test_thresh) > 200) {
      idx <- sort(unique(c(1, seq(1, nrow(test_thresh), length.out = 198), nrow(test_thresh))))
      test_thresh <- test_thresh[idx, ]
    }

    lapply(seq_len(nrow(test_thresh)), function(i) {
      list(
        fpr = round(test_thresh$falsePositiveRate[i], 4),
        tpr = round(test_thresh$sensitivity[i], 4)
      )
    })
  }, error = function(e) list())
}

#' Extract calibration data from a PLP result.
extract_calibration_points <- function(plp_result) {
  tryCatch({
    cal <- plp_result$performanceEvaluation$calibrationSummary
    if (is.null(cal)) return(list())

    # Filter to test set
    test_cal <- cal[cal$evaluation %in% c("Test", "test"), ]
    if (nrow(test_cal) == 0) test_cal <- cal

    lapply(seq_len(nrow(test_cal)), function(i) {
      list(
        predicted = round(test_cal$averagePredictedProbability[i], 4),
        observed  = round(test_cal$observedIncidence[i], 4)
      )
    })
  }, error = function(e) list())
}

#' Extract top predictors from a PLP result.
extract_top_predictors <- function(plp_result, n = 30) {
  tryCatch({
    cov_summary <- plp_result$covariateSummary
    if (is.null(cov_summary)) return(list())

    cov_df <- as.data.frame(cov_summary)

    # Sort by absolute coefficient/importance
    if ("covariateValue" %in% names(cov_df)) {
      cov_df <- cov_df[order(-abs(cov_df$covariateValue)), ]
    } else if ("CovariateMeanWithOutcome" %in% names(cov_df)) {
      cov_df$importance <- abs(cov_df$CovariateMeanWithOutcome - cov_df$CovariateMeanWithNoOutcome)
      cov_df <- cov_df[order(-cov_df$importance), ]
    }

    cov_df <- head(cov_df, n)

    lapply(seq_len(nrow(cov_df)), function(i) {
      row <- cov_df[i, ]
      list(
        name        = as.character(row$covariateName %||% paste0("Covariate ", row$covariateId)),
        concept_id  = as.integer(row$conceptId %||% NA),
        coefficient = round(as.numeric(row$covariateValue %||% 0), 4),
        importance  = round(as.numeric(row$importance %||% abs(row$covariateValue %||% 0)), 4)
      )
    })
  }, error = function(e) list())
}

#' Extract evaluation statistics from a PLP result.
extract_plp_performance <- function(plp_result) {
  tryCatch({
    eval_stats <- plp_result$performanceEvaluation$evaluationStatistics
    if (is.null(eval_stats)) return(list())

    # Filter to test set
    test_stats <- eval_stats[eval_stats$evaluation %in% c("Test", "test"), ]
    if (nrow(test_stats) == 0) test_stats <- eval_stats

    get_metric <- function(metric_name) {
      row <- test_stats[test_stats$metric == metric_name, ]
      if (nrow(row) == 0) return(NA_real_)
      round(as.numeric(row$value[1]), 4)
    }

    list(
      auc                 = get_metric("AUC.auc") %||% get_metric("AUROC"),
      auc_ci_lower        = get_metric("AUC.auc_lb95ci"),
      auc_ci_upper        = get_metric("AUC.auc_ub95ci"),
      auprc               = get_metric("AUPRC"),
      brier_score         = get_metric("BrierScore") %||% get_metric("brierScore"),
      calibration_slope   = get_metric("CalibrationSlope") %||% get_metric("calibrationSlope"),
      calibration_intercept = get_metric("CalibrationIntercept") %||% get_metric("calibrationIntercept")
    )
  }, error = function(e) list())
}
