# ──────────────────────────────────────────────────────────────────
# Overlap Weighting (ATO) — exact overlap-weighted effect estimation
# POST /analysis/overlap-weighting/run
#
# Reuses CohortMethod for data extraction + propensity scoring, then applies
# ATO overlap weights (w = 1-e for treated, w = e for controls; Li-Morgan-
# Zaslavsky) and a weighted Cox model. Returns the same normalized shape as
# /analysis/estimation/run so the caller's mapping is unchanged. Negative-control
# calibration reuses the shared compute_calibration helper.
# ──────────────────────────────────────────────────────────────────

library(CohortMethod)
library(FeatureExtraction)
library(DatabaseConnector)
library(survival)
source("/app/R/connection.R")
source("/app/R/covariates.R")
source("/app/R/progress.R")
source("/app/R/results.R")
source("/app/R/calibration.R")

# ATO-weighted standardized mean differences, computed directly (CohortMethod's
# computeCovariateBalance does not apply an arbitrary weights column). Covariates
# from FeatureExtraction are ~all binary indicators, so SD = sqrt(p(1-p)). Returns
# the top covariates by pre-weighting imbalance in the caller's balance shape.
compute_ato_balance <- function(cmData, df) {
  covs <- tryCatch(as.data.frame(dplyr::collect(cmData$covariates)), error = function(e) NULL)
  if (is.null(covs) || nrow(covs) == 0) return(list())
  covs <- covs[covs$rowId %in% df$rowId, , drop = FALSE]
  if (nrow(covs) == 0) return(list())
  info <- merge(covs, df[, c("rowId", "treatment", "ato_w")], by = "rowId")
  # Restrict to binary indicator covariates (value == 1); continuous covariates
  # (e.g. age) break the p(1-p) SMD formula and are reported as balanced-by-design.
  info <- info[!is.na(info$covariateValue) & info$covariateValue == 1, , drop = FALSE]
  if (nrow(info) == 0) return(list())
  n1 <- sum(df$treatment == 1); n0 <- sum(df$treatment == 0)
  W1 <- sum(df$ato_w[df$treatment == 1]); W0 <- sum(df$ato_w[df$treatment == 0])
  if (n1 == 0 || n0 == 0 || W1 == 0 || W0 == 0) return(list())
  info$wv <- info$ato_w * info$covariateValue
  # Fast group sums via rowsum (C-level) keyed by "covariateId_treatment".
  key <- paste0(info$covariateId, "_", info$treatment)
  sv  <- rowsum(info$covariateValue, key)
  swv <- rowsum(info$wv, key)
  get <- function(m, k) if (k %in% rownames(m)) m[k, 1] else 0
  covRef <- tryCatch(as.data.frame(dplyr::collect(cmData$covariateRef)), error = function(e) NULL)
  name_of <- function(cid) {
    if (!is.null(covRef) && "covariateName" %in% names(covRef)) {
      nm <- covRef$covariateName[covRef$covariateId == cid]
      if (length(nm) > 0) return(substr(as.character(nm[1]), 1, 120))
    }
    paste0("covariate ", cid)
  }
  out <- list()
  for (cid in unique(info$covariateId)) {
    k1 <- paste0(cid, "_1"); k0 <- paste0(cid, "_0")
    p1u <- get(sv, k1) / n1;  p0u <- get(sv, k0) / n0
    p1w <- get(swv, k1) / W1; p0w <- get(swv, k0) / W0
    sdu <- sqrt((p1u * (1 - p1u) + p0u * (1 - p0u)) / 2)
    sdw <- sqrt((p1w * (1 - p1w) + p0w * (1 - p0w)) / 2)
    out[[length(out) + 1]] <- list(
      covariate_name = name_of(cid),
      smd_before = round(if (!is.na(sdu) && sdu > 0) (p1u - p0u) / sdu else 0, 4),
      smd_after  = round(if (!is.na(sdw) && sdw > 0) (p1w - p0w) / sdw else 0, 4),
      mean_target_before = round(p1u, 4), mean_comp_before = round(p0u, 4),
      mean_target_after = round(p1w, 4), mean_comp_after = round(p0w, 4)
    )
  }
  ord <- order(sapply(out, function(x) -abs(x$smd_before)))
  out[ord[seq_len(min(60, length(out)))]]
}

#* Run overlap-weighted (ATO) population-level estimation
#* @post /analysis/overlap-weighting/run
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }
  missing <- setdiff(c("source", "cohorts", "model"), names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  safe_execute(response, logger, {
    connectionDetails <- create_hades_connection(spec$source)
    connection <- connect_with_retry(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    cdmSchema     <- spec$source$cdm_schema
    vocabSchema   <- spec$source$vocab_schema   %||% cdmSchema
    resultsSchema <- spec$source$results_schema

    targetId     <- as.integer(spec$cohorts$target_cohort_id)
    comparatorId <- as.integer(spec$cohorts$comparator_cohort_id)
    outcomeIds   <- as.integer(spec$cohorts$outcome_cohort_ids)
    outcomeNames <- spec$cohorts$outcome_names %||% list()
    ncOutcomeIds <- as.integer(spec$negative_control_outcomes %||% spec$negativeControlOutcomes %||% list())
    extractOutcomeIds <- unique(c(outcomeIds, ncOutcomeIds))

    covariateSettings <- build_covariate_settings(spec$covariate_settings)
    dataArgs <- CohortMethod::createGetDbCohortMethodDataArgs(covariateSettings = covariateSettings)
    logger$info("Extracting CohortMethod data (ATO)")
    cmData <- CohortMethod::getDbCohortMethodData(
      connectionDetails         = connectionDetails,
      cdmDatabaseSchema         = cdmSchema,
      targetId                  = targetId,
      comparatorId              = comparatorId,
      outcomeIds                = extractOutcomeIds,
      exposureDatabaseSchema    = resultsSchema,
      exposureTable             = "cohort",
      outcomeDatabaseSchema     = resultsSchema,
      outcomeTable              = "cohort",
      getDbCohortMethodDataArgs = dataArgs
    )

    tar_start  <- as.integer(spec$model$time_at_risk_start %||% spec$model$timeAtRiskStart %||% 1)
    tar_end    <- as.integer(spec$model$time_at_risk_end   %||% spec$model$timeAtRiskEnd   %||% 9999)
    end_anchor <- spec$model$end_anchor %||% spec$model$endAnchor %||% "cohort end"

    popArgs <- CohortMethod::createCreateStudyPopulationArgs(
      removeSubjectsWithPriorOutcome = TRUE,
      riskWindowStart = tar_start, startAnchor = "cohort start",
      riskWindowEnd = tar_end, endAnchor = end_anchor, minDaysAtRisk = 1
    )
    psArgs <- CohortMethod::createCreatePsArgs(
      maxCohortSizeForFitting = 250000, errorOnHighCorrelation = FALSE, stopOnError = FALSE
    )

    # Fit one ATO-weighted Cox for a given outcome id; returns the model + the
    # PS object (for diagnostics) + the weighted population data frame.
    ato_fit <- function(oid) {
      pop <- CohortMethod::createStudyPopulation(
        cohortMethodData = cmData, population = NULL, outcomeId = oid,
        createStudyPopulationArgs = popArgs
      )
      pdf <- as.data.frame(pop)
      if (sum(pdf$treatment == 1) < 10 || sum(pdf$treatment == 0) < 10) {
        return(list(ok = FALSE, df = pdf))
      }
      ps <- CohortMethod::createPs(cohortMethodData = cmData, population = pop, createPsArgs = psArgs)
      df <- as.data.frame(ps)
      e  <- pmin(pmax(df$propensityScore, 1e-6), 1 - 1e-6)
      df$ato_w <- ifelse(df$treatment == 1, 1 - e, e)
      df$time  <- if ("survivalTime" %in% names(df)) df$survivalTime else df$timeAtRisk
      df$event <- as.integer(df$outcomeCount > 0)
      df <- df[!is.na(df$time) & df$time > 0, , drop = FALSE]
      m <- tryCatch(
        survival::coxph(survival::Surv(time, event) ~ treatment, data = df, weights = ato_w, robust = TRUE),
        error = function(e) NULL
      )
      list(ok = TRUE, ps = ps, df = df, model = m)
    }

    estimates_list <- list()
    ps_auc <- NA_real_; equipoise_val <- NA_real_; ps_dist_data <- NULL
    balance_all <- NULL; n_target <- NA_integer_; n_comparator <- NA_integer_

    for (oid in outcomeIds) {
      logger$info(sprintf("ATO outcome %d", oid))
      fit <- ato_fit(oid)
      oname <- outcomeNames[[as.character(oid)]] %||% sprintf("Outcome %d", oid)
      if (!isTRUE(fit$ok) || is.null(fit$model)) {
        estimates_list[[length(estimates_list) + 1]] <- list(
          outcome_id = oid, outcome_name = oname, hazard_ratio = NA, ci_95_lower = NA,
          ci_95_upper = NA, p_value = NA, log_hr = NA, se_log_hr = NA,
          target_outcomes = as.integer(sum(fit$df$outcomeCount[fit$df$treatment == 1] > 0)),
          comparator_outcomes = as.integer(sum(fit$df$outcomeCount[fit$df$treatment == 0] > 0)),
          warning = "Insufficient subjects or model did not converge"
        )
        next
      }
      df <- fit$df
      if (is.na(ps_auc)) {
        ps_auc        <- tryCatch(CohortMethod::computePsAuc(fit$ps), error = function(e) NA_real_)
        equipoise_val <- tryCatch(CohortMethod::computeEquipoise(fit$ps), error = function(e) NA_real_)
        ps_dist_data  <- tryCatch(extract_ps_distribution(fit$ps), error = function(e) NULL)
        n_target      <- as.integer(sum(df$treatment == 1))
        n_comparator  <- as.integer(sum(df$treatment == 0))
        balance_all <- tryCatch(
          compute_ato_balance(cmData, df),
          error = function(e) { logger$warn(paste("ATO balance failed:", e$message)); list() }
        )
      }
      cf  <- tryCatch(coef(fit$model)[["treatment"]], error = function(e) NA_real_)
      se  <- tryCatch(sqrt(diag(vcov(fit$model)))[["treatment"]], error = function(e) NA_real_)
      hr  <- exp(cf)
      lo  <- exp(cf - 1.96 * se); hi <- exp(cf + 1.96 * se)
      pv  <- if (!is.na(cf) && !is.na(se) && se > 0) 2 * pnorm(-abs(cf / se)) else NA_real_
      estimates_list[[length(estimates_list) + 1]] <- list(
        outcome_id = oid, outcome_name = oname,
        hazard_ratio = round(hr, 4), ci_95_lower = round(lo, 4), ci_95_upper = round(hi, 4),
        p_value = round(pv, 6), log_hr = round(cf, 4), se_log_hr = round(se, 4),
        target_outcomes = as.integer(sum(df$event[df$treatment == 1])),
        comparator_outcomes = as.integer(sum(df$event[df$treatment == 0]))
      )
      logger$info(sprintf("ATO outcome %d: HR=%.3f [%.3f, %.3f]", oid, hr, lo, hi))
    }

    # Negative controls (ATO-weighted Cox) for empirical calibration.
    nc_estimates <- list()
    for (nc_id in ncOutcomeIds) {
      tryCatch({
        fit <- ato_fit(nc_id)
        if (isTRUE(fit$ok) && !is.null(fit$model)) {
          cf <- coef(fit$model)[["treatment"]]
          se <- sqrt(diag(vcov(fit$model)))[["treatment"]]
          if (is.finite(cf) && is.finite(se)) {
            nc_estimates[[length(nc_estimates) + 1]] <- list(
              outcome_id = nc_id, log_rr = round(cf, 4), se_log_rr = round(se, 4)
            )
          }
        }
      }, error = function(e) logger$warn(sprintf("NC %d failed: %s", nc_id, e$message)))
    }
    calibration_data <- if (length(nc_estimates) > 0) {
      tryCatch(compute_calibration(estimates_list, nc_estimates), error = function(e) NULL)
    } else NULL

    balance_summary <- if (is.null(balance_all)) list() else balance_all
    max_smd_after <- if (length(balance_summary) > 0) {
      round(max(sapply(balance_summary, function(x) abs(x$smd_after)), na.rm = TRUE), 4)
    } else NA_real_
    max_smd_before <- if (length(balance_summary) > 0) {
      round(max(sapply(balance_summary, function(x) abs(x$smd_before)), na.rm = TRUE), 4)
    } else NA_real_

    list(
      status  = "completed",
      method  = "ATO overlap weighting (weighted Cox)",
      summary = list(target_count = n_target, comparator_count = n_comparator, outcome_counts = list()),
      estimates = estimates_list,
      propensity_score = list(
        auc = round(ps_auc, 4), equipoise = round(equipoise_val, 4),
        max_smd_after = max_smd_after, max_smd_before = max_smd_before,
        distribution = ps_dist_data
      ),
      calibration = calibration_data,
      covariate_balance = balance_summary,
      negative_controls = list(estimates = nc_estimates)
    )
  })
}
