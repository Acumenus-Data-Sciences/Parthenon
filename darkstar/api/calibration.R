# ──────────────────────────────────────────────────────────────────
# Empirical Calibration — standalone endpoint (Abby / ADR-0020 Phase 2)
# POST /analysis/calibrate
#
# Calibrates effect estimates against a study's negative controls without
# re-running CohortMethod. Accepts the outcome estimates and negative
# controls produced by the estimation pipeline and returns calibrated
# confidence intervals, calibrated p-values, the systematic-error model,
# and EASE. Used both by the orchestrator (discrete re-calibration) and
# inline at the end of the estimation pipeline.
# ──────────────────────────────────────────────────────────────────

source("/app/R/calibration.R")

#* Empirically calibrate effect estimates against negative controls
#* @post /analysis/calibrate
#* @serializer unboxedJSON
function(body, response) {
  spec <- body

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  estimates <- spec$estimates %||% spec$outcome_estimates %||% list()

  negative_controls <- spec$negative_controls %||% spec$negativeControls %||% list()
  # Accept either a bare list or the estimation pipeline's {estimates: [...]} shape.
  if (is.list(negative_controls) && !is.null(negative_controls$estimates)) {
    negative_controls <- negative_controls$estimates
  }

  min_controls <- as.integer(spec$min_controls %||% spec$minControls %||% CALIBRATION_MIN_CONTROLS)

  tryCatch(
    compute_calibration(estimates, negative_controls, min_controls),
    error = function(e) {
      response$status <- 500L
      list(status = "error", message = paste("Calibration failed:", e$message))
    }
  )
}
