# ──────────────────────────────────────────────────────────────────
# Empirical calibration helpers (Abby / ADR-0020 Phase 2)
#
# Wraps OHDSI EmpiricalCalibration to turn a study's negative-control
# estimates into a systematic-error model, then calibrates each outcome
# estimate's confidence interval and p-value and reports the Expected
# Absolute Systematic Error (EASE).
#
# Because Parthenon studies carry NEGATIVE controls only (all true
# logRR = 0), the systematic-error model is derived from the empirical
# null via convertNullToErrorModel() — a constant-bias model — rather
# than fitSystematicErrorModel(), whose slope is unidentifiable without
# positive controls spanning a range of true effects.
# ──────────────────────────────────────────────────────────────────

library(EmpiricalCalibration)

# Minimum informative negative controls required to fit a stable null.
CALIBRATION_MIN_CONTROLS <- 5L

# Coerce a possibly-NULL value to a scalar numeric (NA on failure).
.cal_num <- function(x) {
  if (is.null(x)) {
    return(NA_real_)
  }
  suppressWarnings(as.numeric(x)[1])
}

# Pull the first numeric out of whatever shape an EmpiricalCalibration
# helper returned (scalar, vector, list, or data.frame).
.cal_scalar <- function(x) {
  tryCatch({
    if (is.list(x) || is.data.frame(x)) {
      return(as.numeric(x[[1]])[1])
    }
    as.numeric(x)[1]
  }, error = function(e) NA_real_)
}

# Normalise an estimates/controls payload into a list-of-row-lists.
# jsonlite simplifies a uniform JSON array-of-objects into a data.frame,
# while the inline R caller passes a list of lists — handle both so each
# row is a named list addressable with `row$key`.
.cal_rows <- function(x) {
  if (is.null(x)) {
    return(list())
  }
  if (is.data.frame(x)) {
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (is.list(x)) {
    return(x)
  }
  list()
}

# Negative-control scatter series for the calibration plot.
.cal_nc_points <- function(log_rr, se) {
  pts <- list()
  for (i in seq_along(log_rr)) {
    if (is.finite(log_rr[i]) && is.finite(se[i]) && se[i] > 0) {
      pts[[length(pts) + 1]] <- list(
        log_rr    = round(log_rr[i], 4),
        se_log_rr = round(se[i], 4)
      )
    }
  }
  pts
}

# Compute empirical calibration for a set of outcome estimates given the
# study's negative-control estimates.
#
# estimates: list of {outcome_id, outcome_name, log_hr|log_rr, se_log_hr|se_log_rr}
# negative_controls: list of {outcome_id, log_rr, se_log_rr}
# Returns a list whose `status` is "completed" or "insufficient_controls".
compute_calibration <- function(estimates, negative_controls, min_controls = CALIBRATION_MIN_CONTROLS) {
  negative_controls <- .cal_rows(negative_controls %||% list())
  estimates <- .cal_rows(estimates %||% list())
  min_controls <- as.integer(min_controls)

  nc_log_rr <- vapply(negative_controls, function(x) .cal_num(x$log_rr), numeric(1))
  nc_se     <- vapply(negative_controls, function(x) .cal_num(x$se_log_rr), numeric(1))

  informative   <- is.finite(nc_log_rr) & is.finite(nc_se) & nc_se > 0
  n_informative <- sum(informative)
  plot_points   <- .cal_nc_points(nc_log_rr, nc_se)

  if (n_informative < min_controls) {
    return(list(
      status                        = "insufficient_controls",
      min_negative_controls         = min_controls,
      informative_negative_controls = as.integer(n_informative),
      message = sprintf(
        paste0("Only %d informative negative control(s) (need >= %d) — empirical ",
               "calibration was not performed. Report uncalibrated estimates with caution."),
        n_informative, min_controls
      ),
      systematic_error_model = NULL,
      ease                   = NA_real_,
      calibrated_estimates   = list(),
      calibration_plot       = list(negative_controls = plot_points)
    ))
  }

  ncLogRr <- nc_log_rr[informative]
  ncSe    <- nc_se[informative]

  null_dist <- EmpiricalCalibration::fitNull(logRr = ncLogRr, seLogRr = ncSe)
  model     <- EmpiricalCalibration::convertNullToErrorModel(null_dist)
  # EASE is computed from the null distribution (not the error model — the
  # generic has no method for systematicErrorModel objects).
  ease      <- .cal_scalar(tryCatch(
    EmpiricalCalibration::computeExpectedAbsoluteSystematicError(null_dist),
    error = function(e) NA_real_
  ))

  calibrated <- list()
  for (est in estimates) {
    lr <- .cal_num(est$log_hr %||% est$log_rr)
    se <- .cal_num(est$se_log_hr %||% est$se_log_rr)

    if (!is.finite(lr) || !is.finite(se) || se <= 0) {
      calibrated[[length(calibrated) + 1]] <- list(
        outcome_id   = est$outcome_id %||% NA,
        outcome_name = est$outcome_name %||% NA,
        calibrated   = FALSE
      )
      next
    }

    ci <- tryCatch(
      EmpiricalCalibration::calibrateConfidenceInterval(logRr = lr, seLogRr = se, model = model, ciWidth = 0.95),
      error = function(e) NULL
    )
    cp <- .cal_scalar(tryCatch(
      EmpiricalCalibration::calibrateP(null_dist, logRr = lr, seLogRr = se),
      error = function(e) NA_real_
    ))

    if (is.null(ci)) {
      calibrated[[length(calibrated) + 1]] <- list(
        outcome_id   = est$outcome_id %||% NA,
        outcome_name = est$outcome_name %||% NA,
        calibrated   = FALSE
      )
      next
    }

    calibrated[[length(calibrated) + 1]] <- list(
      outcome_id        = est$outcome_id %||% NA,
      outcome_name      = est$outcome_name %||% NA,
      calibrated_log_rr = round(as.numeric(ci$logRr)[1], 4),
      calibrated_hr     = round(exp(as.numeric(ci$logRr)[1]), 4),
      cal_ci_lower      = round(exp(as.numeric(ci$logLb95Rr)[1]), 4),
      cal_ci_upper      = round(exp(as.numeric(ci$logUb95Rr)[1]), 4),
      calibrated_p      = round(cp, 6),
      calibrated        = TRUE
    )
  }

  list(
    status                        = "completed",
    min_negative_controls         = min_controls,
    informative_negative_controls = as.integer(n_informative),
    systematic_error_model = list(
      null_mean = round(.cal_num(null_dist["mean"]), 4),
      null_sd   = round(.cal_num(null_dist["sd"]), 4),
      model     = lapply(as.list(model), function(v) round(.cal_num(v), 6))
    ),
    ease                 = round(ease, 4),
    calibrated_estimates = calibrated,
    calibration_plot     = list(negative_controls = plot_points)
  )
}
