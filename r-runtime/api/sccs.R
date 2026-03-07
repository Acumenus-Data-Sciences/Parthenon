# ──────────────────────────────────────────────────────────────────
# Self-Controlled Case Series (SCCS) Pipeline
# POST /analysis/sccs/run
# ──────────────────────────────────────────────────────────────────

library(SelfControlledCaseSeries)
library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/progress.R")

#* Run Self-Controlled Case Series analysis
#* @post /run
#* @serializer unboxedJSON
function(req, res) {
  spec   <- req$body
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    res$status <- 400L
    return(list(status = "error", message = "No specification provided"))
  }

  required_keys <- c("source", "cohorts")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    res$status <- 400L
    return(list(status = "error", message = paste("Missing:", paste(missing, collapse = ", "))))
  }

  logger$info("SCCS pipeline started")

  safe_execute(res, logger, {
    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(DatabaseConnector::disconnect(connection), add = TRUE)

    cdmSchema     <- spec$source$cdm_schema
    resultsSchema <- spec$source$results_schema
    exposureId    <- as.integer(spec$cohorts$exposure_cohort_id)
    outcomeId     <- as.integer(spec$cohorts$outcome_cohort_id)
    naive_period  <- as.integer(spec$naive_period %||% spec$naivePeriod %||% 180)

    # ── Extract SCCS data ─────────────────────────────────────
    logger$info("Extracting SCCS data")
    sccsData <- SelfControlledCaseSeries::getDbSccsData(
      connectionDetails   = connectionDetails,
      cdmDatabaseSchema   = cdmSchema,
      outcomeDatabaseSchema = resultsSchema,
      outcomeTable        = "cohort",
      outcomeIds          = outcomeId,
      exposureDatabaseSchema = resultsSchema,
      exposureTable       = "cohort",
      getDbSccsDataArgs   = SelfControlledCaseSeries::createGetDbSccsDataArgs(
        exposureIds = exposureId
      )
    )

    # ── Study population ──────────────────────────────────────
    logger$info("Creating study population")
    first_only <- isTRUE(spec$first_outcome_only) || isTRUE(spec$firstOutcomeOnly)
    popArgs <- SelfControlledCaseSeries::createCreateStudyPopulationArgs(
      naivePeriod      = naive_period,
      firstOutcomeOnly = first_only
    )
    studyPop <- SelfControlledCaseSeries::createStudyPopulation(
      sccsData = sccsData,
      outcomeId = outcomeId,
      createStudyPopulationArgs = popArgs
    )

    # ── Define era covariates (risk windows) ──────────────────
    risk_windows <- spec$risk_windows %||% spec$riskWindows %||% list(
      list(label = "On treatment", start = 0, end = 0, endAnchor = "era end")
    )

    era_settings_list <- lapply(risk_windows, function(rw) {
      SelfControlledCaseSeries::createEraCovariateSettings(
        label        = rw$label %||% "Exposure",
        includeEraIds = exposureId,
        start        = as.integer(rw$start %||% 0),
        end          = as.integer(rw$end   %||% 0),
        endAnchor    = rw$endAnchor %||% rw$end_anchor %||% "era end"
      )
    })

    # ── Create interval data ──────────────────────────────────
    logger$info("Creating interval data")
    interval_args <- SelfControlledCaseSeries::createCreateSccsIntervalDataArgs(
      eraCovariateSettings = era_settings_list,
      eventDependentObservation = isTRUE(spec$event_dependent_observation %||%
                                         spec$eventDependentObservation %||% TRUE)
    )

    sccsIntervalData <- SelfControlledCaseSeries::createSccsIntervalData(
      studyPopulation = studyPop,
      sccsData        = sccsData,
      createSccsIntervalDataArgs = interval_args
    )

    # ── Fit model (v6 API) ──────────────────────────────────
    logger$info("Fitting SCCS model")
    fitArgs <- SelfControlledCaseSeries::createFitSccsModelArgs()
    sccsModel <- SelfControlledCaseSeries::fitSccsModel(
      sccsIntervalData = sccsIntervalData,
      fitSccsModelArgs = fitArgs
    )

    # Extract estimates
    estimates_df <- sccsModel$estimates
    estimates <- list()
    if (!is.null(estimates_df) && nrow(estimates_df) > 0) {
      for (i in seq_len(nrow(estimates_df))) {
        row <- estimates_df[i, ]
        estimates[[i]] <- list(
          name       = as.character(row$covariateName %||% paste0("Covariate ", row$covariateId)),
          irr        = round(exp(as.numeric(row$logRr)), 4),
          ci_lower   = round(exp(as.numeric(row$logLb95Ci %||% row$logRr - 1.96 * row$seLogRr)), 4),
          ci_upper   = round(exp(as.numeric(row$logUb95Ci %||% row$logRr + 1.96 * row$seLogRr)), 4),
          log_rr     = round(as.numeric(row$logRr), 4),
          se_log_rr  = round(as.numeric(row$seLogRr), 4)
        )
      }
    }

    logger$info("SCCS pipeline complete", list(elapsed_seconds = logger$elapsed()))

    list(
      status    = "completed",
      estimates = estimates,
      summary   = list(
        cases     = tryCatch(as.integer(nrow(studyPop$outcomes)), error = function(e) NA),
        events    = tryCatch(as.integer(sum(studyPop$outcomes$outcomeCount > 0)), error = function(e) NA)
      ),
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
