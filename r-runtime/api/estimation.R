#* @root /analysis/estimation
NULL

# ──────────────────────────────────────────────────────────────────
# Population-Level Estimation — CohortMethod Pipeline
# POST /analysis/estimation/run
# ──────────────────────────────────────────────────────────────────

library(CohortMethod)
library(FeatureExtraction)
library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/covariates.R")
source("/app/R/progress.R")
source("/app/R/results.R")

#* Run population-level estimation via CohortMethod
#* @post /run
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # ── Validate input ──────────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("source", "cohorts", "model")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  logger$info("Estimation pipeline started", list(
    target  = spec$cohorts$target_cohort_id,
    comparator = spec$cohorts$comparator_cohort_id,
    outcomes = length(spec$cohorts$outcome_cohort_ids)
  ))

  # Wrap the entire pipeline in safe_execute for clean error handling
  safe_execute(response, logger, {

    # ── Step 1: Establish database connection ──────────────────
    logger$info("Connecting to CDM database")
    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    cdmSchema     <- spec$source$cdm_schema
    vocabSchema   <- spec$source$vocab_schema   %||% cdmSchema
    resultsSchema <- spec$source$results_schema
    cohortTable   <- spec$source$cohort_table    %||% paste0(resultsSchema, ".cohort")

    targetId     <- as.integer(spec$cohorts$target_cohort_id)
    comparatorId <- as.integer(spec$cohorts$comparator_cohort_id)
    outcomeIds   <- as.integer(spec$cohorts$outcome_cohort_ids)
    outcomeNames <- spec$cohorts$outcome_names %||% list()

    logger$info(sprintf("CDM=%s, Vocab=%s, Results=%s", cdmSchema, vocabSchema, resultsSchema))

    # ── Step 2: Build covariate settings ──────────────────────
    logger$info("Building covariate settings")
    covariateSettings <- build_covariate_settings(spec$covariate_settings)

    # ── Step 3: Extract cohort method data (CohortMethod v6 API) ──
    logger$info("Extracting CohortMethod data from database")
    dataArgs <- CohortMethod::createGetDbCohortMethodDataArgs(
      covariateSettings = covariateSettings
    )
    cmData <- CohortMethod::getDbCohortMethodData(
      connectionDetails        = connectionDetails,
      cdmDatabaseSchema        = cdmSchema,
      targetId                 = targetId,
      comparatorId             = comparatorId,
      outcomeIds               = outcomeIds,
      exposureDatabaseSchema   = resultsSchema,
      exposureTable            = "cohort",
      outcomeDatabaseSchema    = resultsSchema,
      outcomeTable             = "cohort",
      getDbCohortMethodDataArgs = dataArgs
    )
    logger$info("Data extraction complete")

    # ── Step 4: Loop over outcomes ────────────────────────────
    model_type   <- tolower(spec$model$type %||% "cox")
    tar_start    <- as.integer(spec$model$time_at_risk_start %||% spec$model$timeAtRiskStart %||% 1)
    tar_end      <- as.integer(spec$model$time_at_risk_end   %||% spec$model$timeAtRiskEnd   %||% 9999)
    end_anchor   <- spec$model$end_anchor %||% spec$model$endAnchor %||% "cohort end"
    ps_spec      <- spec$propensity_score %||% spec$propensityScore %||% list()
    ps_enabled   <- isTRUE(ps_spec$enabled)
    ps_method    <- tolower(ps_spec$method %||% "matching")

    estimates_list <- list()
    balance_all    <- NULL
    km_data        <- NULL
    attrition_data <- list()
    ps_dist_data   <- NULL
    ps_auc         <- NA_real_
    equipoise_val  <- NA_real_
    mdrr_map       <- list()

    for (oid in outcomeIds) {
      logger$info(sprintf("Processing outcome %d", oid))

      # ── Study population (CohortMethod v6 API) ─────────────
      popArgs <- CohortMethod::createCreateStudyPopulationArgs(
        removeSubjectsWithPriorOutcome = TRUE,
        riskWindowStart  = tar_start,
        startAnchor      = "cohort start",
        riskWindowEnd    = tar_end,
        endAnchor        = end_anchor,
        minDaysAtRisk    = 1
      )
      studyPop <- CohortMethod::createStudyPopulation(
        cohortMethodData = cmData,
        population       = NULL,
        outcomeId        = oid,
        createStudyPopulationArgs = popArgs
      )

      pop_df <- as.data.frame(studyPop)
      n_target     <- sum(pop_df$treatment == 1)
      n_comparator <- sum(pop_df$treatment == 0)

      if (n_target < 10 || n_comparator < 10) {
        logger$warn(sprintf("Outcome %d: insufficient subjects (target=%d, comparator=%d)", oid, n_target, n_comparator))
        estimates_list[[length(estimates_list) + 1]] <- list(
          outcome_id       = oid,
          outcome_name     = outcomeNames[[as.character(oid)]] %||% sprintf("Outcome %d", oid),
          hazard_ratio     = NA,
          ci_95_lower      = NA,
          ci_95_upper      = NA,
          p_value          = NA,
          target_outcomes  = as.integer(sum(pop_df$outcomeCount[pop_df$treatment == 1] > 0)),
          comparator_outcomes = as.integer(sum(pop_df$outcomeCount[pop_df$treatment == 0] > 0)),
          log_hr           = NA,
          se_log_hr        = NA,
          warning          = "Insufficient subjects"
        )
        next
      }

      # ── Propensity score ──────────────────────────────────
      adjusted_pop <- studyPop
      if (ps_enabled) {
        logger$info(sprintf("Fitting propensity score model (method=%s)", ps_method))
        psArgs <- CohortMethod::createCreatePsArgs(
          maxCohortSizeForFitting = 250000
        )
        ps <- CohortMethod::createPs(
          cohortMethodData = cmData,
          population       = studyPop,
          createPsArgs     = psArgs
        )

        # Capture PS diagnostics (only once, from first outcome)
        if (is.na(ps_auc)) {
          ps_auc <- tryCatch(CohortMethod::computePsAuc(ps), error = function(e) NA_real_)
          equipoise_val <- tryCatch(CohortMethod::computeEquipoise(ps), error = function(e) NA_real_)
          ps_dist_data  <- extract_ps_distribution(ps)
        }

        # Apply PS adjustment
        if (ps_method == "matching") {
          match_ratio  <- as.integer(ps_spec$matching$ratio  %||% 1)
          match_caliper <- as.numeric(ps_spec$matching$caliper %||% 0.2)
          matchArgs <- CohortMethod::createMatchOnPsArgs(
            caliper  = match_caliper,
            maxRatio = match_ratio
          )
          adjusted_pop <- CohortMethod::matchOnPs(
            population     = ps,
            matchOnPsArgs  = matchArgs
          )
        } else if (ps_method == "stratification") {
          n_strata <- as.integer(ps_spec$stratification$num_strata %||% ps_spec$stratification$numStrata %||% 5)
          stratArgs <- CohortMethod::createStratifyByPsArgs(
            numberOfStrata = n_strata
          )
          adjusted_pop <- CohortMethod::stratifyByPs(
            population        = ps,
            stratifyByPsArgs  = stratArgs
          )
        } else {
          # IPTW — trim extreme values
          trim_frac <- as.numeric(ps_spec$trimming %||% 0.05)
          trimArgs <- CohortMethod::createTrimByPsArgs(
            trimFraction = trim_frac
          )
          adjusted_pop <- CohortMethod::trimByPs(
            population    = ps,
            trimByPsArgs  = trimArgs
          )
        }

        # Covariate balance (first outcome only)
        if (is.null(balance_all)) {
          logger$info("Computing covariate balance")
          balance_all <- tryCatch(
            CohortMethod::computeCovariateBalance(
              population       = adjusted_pop,
              cohortMethodData = cmData
            ),
            error = function(e) { logger$warn(paste("Balance failed:", e$message)); NULL }
          )
        }
      }

      # ── KM data (first outcome only) ─────────────────────
      if (is.null(km_data)) {
        km_data <- extract_km_data(adjusted_pop)
      }

      # ── Attrition ─────────────────────────────────────────
      if (length(attrition_data) == 0) {
        attrition_data <- extract_attrition(adjusted_pop)
      }

      # ── Outcome model ─────────────────────────────────────
      logger$info(sprintf("Fitting %s outcome model for outcome %d", model_type, oid))
      is_stratified <- ps_enabled && ps_method %in% c("matching", "stratification")

      fitArgs <- CohortMethod::createFitOutcomeModelArgs(
        modelType  = model_type,
        stratified = is_stratified
      )
      outcomeModel <- CohortMethod::fitOutcomeModel(
        population       = adjusted_pop,
        cohortMethodData = cmData,
        fitOutcomeModelArgs = fitArgs
      )

      # Extract effect estimate
      log_rr   <- tryCatch(coef(outcomeModel), error = function(e) NA_real_)
      ci       <- tryCatch(confint(outcomeModel), error = function(e) c(NA_real_, NA_real_))
      hr       <- exp(log_rr)
      ci_lower <- exp(ci[1])
      ci_upper <- exp(ci[2])

      # p-value: derive SE from the confidence interval on the log scale
      se_log_rr <- tryCatch({
        log_ci_lower <- log(ci_lower)
        log_ci_upper <- log(ci_upper)
        if (!is.na(log_ci_lower) && !is.na(log_ci_upper) && is.finite(log_ci_lower) && is.finite(log_ci_upper)) {
          (log_ci_upper - log_ci_lower) / (2 * 1.96)
        } else NA_real_
      }, error = function(e) NA_real_)
      p_val <- tryCatch({
        if (!is.na(log_rr) && !is.na(se_log_rr) && se_log_rr > 0) {
          2 * pnorm(-abs(log_rr / se_log_rr))
        } else NA_real_
      }, error = function(e) NA_real_)

      # Event counts
      adj_df <- as.data.frame(adjusted_pop)
      target_events <- sum(adj_df$outcomeCount[adj_df$treatment == 1] > 0)
      comp_events   <- sum(adj_df$outcomeCount[adj_df$treatment == 0] > 0)

      outcome_name <- outcomeNames[[as.character(oid)]] %||% sprintf("Outcome %d", oid)
      estimates_list[[length(estimates_list) + 1]] <- list(
        outcome_id        = oid,
        outcome_name      = outcome_name,
        hazard_ratio      = round(hr, 4),
        ci_95_lower       = round(ci_lower, 4),
        ci_95_upper       = round(ci_upper, 4),
        p_value           = round(p_val, 6),
        target_outcomes   = as.integer(target_events),
        comparator_outcomes = as.integer(comp_events),
        log_hr            = round(log_rr, 4),
        se_log_hr         = round(se_log_rr %||% NA_real_, 4)
      )

      # MDRR
      mdrr_val <- tryCatch(
        CohortMethod::computeMdrr(adjusted_pop, modelType = model_type)$mdrr,
        error = function(e) NA_real_
      )
      mdrr_map[[as.character(oid)]] <- round(mdrr_val, 4)

      logger$info(sprintf("Outcome %d: HR=%.3f [%.3f, %.3f] p=%.4f", oid, hr, ci_lower, ci_upper, p_val))
    }

    # ── Negative control calibration (if provided) ──────────
    nc_outcomes   <- spec$negative_control_outcomes %||% spec$negativeControlOutcomes %||% list()
    nc_data       <- NULL
    if (length(nc_outcomes) > 0) {
      logger$info(sprintf("Running %d negative control outcomes for calibration", length(nc_outcomes)))
      nc_estimates <- list()
      for (nc_id in as.integer(nc_outcomes)) {
        tryCatch({
          nc_popArgs <- CohortMethod::createCreateStudyPopulationArgs(
            removeSubjectsWithPriorOutcome = TRUE,
            riskWindowStart  = tar_start,
            startAnchor      = "cohort start",
            riskWindowEnd    = tar_end,
            endAnchor        = end_anchor,
            minDaysAtRisk    = 1
          )
          nc_pop <- CohortMethod::createStudyPopulation(
            cohortMethodData = cmData,
            outcomeId        = nc_id,
            createStudyPopulationArgs = nc_popArgs
          )
          nc_fitArgs <- CohortMethod::createFitOutcomeModelArgs(
            modelType  = model_type,
            stratified = FALSE
          )
          nc_model <- CohortMethod::fitOutcomeModel(
            population       = nc_pop,
            fitOutcomeModelArgs = nc_fitArgs
          )
          nc_lr <- tryCatch(coef(nc_model), error = function(e) NA_real_)
          nc_se <- tryCatch(summary(nc_model)$seLogRr, error = function(e) NA_real_)
          nc_estimates[[length(nc_estimates) + 1]] <- list(
            outcome_id = nc_id,
            log_rr     = round(nc_lr, 4),
            se_log_rr  = round(nc_se %||% NA_real_, 4)
          )
        }, error = function(e) {
          logger$warn(sprintf("NC outcome %d failed: %s", nc_id, e$message))
        })
      }
      nc_data <- list(estimates = nc_estimates)
    }

    # ── Compile balance summary ─────────────────────────────
    balance_summary <- extract_balance_summary(balance_all, n = 50)

    # Compute aggregate SMD stats
    mean_smd_before <- NA_real_
    mean_smd_after  <- NA_real_
    max_smd_before  <- NA_real_
    max_smd_after   <- NA_real_
    if (length(balance_summary) > 0) {
      smds_before <- sapply(balance_summary, function(x) abs(x$smd_before))
      smds_after  <- sapply(balance_summary, function(x) abs(x$smd_after))
      mean_smd_before <- round(mean(smds_before, na.rm = TRUE), 4)
      mean_smd_after  <- round(mean(smds_after,  na.rm = TRUE), 4)
      max_smd_before  <- round(max(smds_before,  na.rm = TRUE), 4)
      max_smd_after   <- round(max(smds_after,   na.rm = TRUE), 4)
    }

    # ── Summary counts ──────────────────────────────────────
    summaryPopArgs <- CohortMethod::createCreateStudyPopulationArgs(
      removeSubjectsWithPriorOutcome = TRUE,
      riskWindowStart  = tar_start,
      startAnchor      = "cohort start",
      riskWindowEnd    = tar_end,
      endAnchor        = end_anchor,
      minDaysAtRisk    = 1
    )
    all_pop <- as.data.frame(CohortMethod::createStudyPopulation(
      cohortMethodData = cmData,
      outcomeId        = outcomeIds[1],
      createStudyPopulationArgs = summaryPopArgs
    ))

    # Build outcome_counts map keyed by display name for frontend summary cards
    outcome_counts <- list()
    for (est in estimates_list) {
      outcome_key <- est$outcome_name %||% as.character(est$outcome_id)
      prior_count <- outcome_counts[[outcome_key]] %||% 0L
      target_count <- est$target_outcomes %||% 0L
      comparator_count <- est$comparator_outcomes %||% 0L
      outcome_counts[[outcome_key]] <- as.integer(prior_count + target_count + comparator_count)
    }

    logger$info("Estimation pipeline complete", list(
      elapsed_seconds = logger$elapsed(),
      outcomes_processed = length(estimates_list)
    ))

    # ── Return result ───────────────────────────────────────
    list(
      status  = "completed",
      summary = list(
        target_count     = as.integer(sum(all_pop$treatment == 1)),
        comparator_count = as.integer(sum(all_pop$treatment == 0)),
        outcome_counts   = outcome_counts
      ),
      estimates = estimates_list,
      propensity_score = list(
        auc             = round(ps_auc, 4),
        equipoise       = round(equipoise_val, 4),
        mean_smd_before = mean_smd_before,
        mean_smd_after  = mean_smd_after,
        max_smd_before  = max_smd_before,
        max_smd_after   = max_smd_after,
        distribution    = ps_dist_data
      ),
      covariate_balance  = balance_summary,
      kaplan_meier       = km_data,
      attrition          = attrition_data,
      mdrr               = mdrr_map,
      negative_controls  = nc_data,
      logs               = logger$entries(),
      elapsed_seconds    = logger$elapsed()
    )
  })
}
