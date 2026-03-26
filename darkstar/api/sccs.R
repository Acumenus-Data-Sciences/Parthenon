# ──────────────────────────────────────────────────────────────────
# Self-Controlled Case Series (SCCS) Pipeline
# POST /analysis/sccs/run
# ──────────────────────────────────────────────────────────────────

library(SelfControlledCaseSeries)
library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/progress.R")

#* Run Self-Controlled Case Series analysis
#* @post /analysis/sccs/run
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided"))
  }

  required_keys <- c("source", "cohorts")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing:", paste(missing, collapse = ", "))))
  }

  logger$info("SCCS pipeline started")

  safe_execute(response, logger, {
    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

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

    # Log data summary for debugging
    logger$info(sprintf(
      "SccsData class: %s, cases: %s",
      paste(class(sccsData), collapse = ","),
      tryCatch(
        as.character(sccsData$metaData$outcomeCount),
        error = function(e) "unknown"
      )
    ))

    first_only <- isTRUE(spec$first_outcome_only) ||
      isTRUE(spec$firstOutcomeOnly)
    popArgs <- SelfControlledCaseSeries::createCreateStudyPopulationArgs(
      naivePeriod      = naive_period,
      firstOutcomeOnly = first_only
    )
    studyPop <- SelfControlledCaseSeries::createStudyPopulation(
      sccsData = sccsData,
      outcomeId = outcomeId,
      createStudyPopulationArgs = popArgs
    )
    logger$info(sprintf(
      "Study population created: %s class",
      paste(class(studyPop), collapse = ",")
    ))

    # ── Define era covariates (risk windows) ──────────────────
    raw_rw <- spec$risk_windows %||% spec$riskWindows %||% list(
      list(label = "On treatment", start = 0,
           end = 0, endAnchor = "era end")
    )

    # Normalize underscore anchors to space-separated
    normalize_anchor <- function(val, default = "era end") {
      val <- val %||% default
      gsub("_", " ", val)
    }

    # jsonlite may parse array-of-objects as data.frame;
    # convert to list-of-lists for safe row iteration
    if (is.data.frame(raw_rw)) {
      risk_windows <- lapply(
        seq_len(nrow(raw_rw)),
        function(i) as.list(raw_rw[i, ])
      )
    } else {
      risk_windows <- raw_rw
    }

    era_settings_list <- lapply(risk_windows, function(rw) {
      lbl <- rw$label %||% rw[["label"]] %||% "Exposure"
      logger$info(sprintf(
        "  Risk window: %s [%d, %d]",
        lbl,
        as.integer(rw$start %||% 0),
        as.integer(rw$end %||% 0)
      ))
      SelfControlledCaseSeries::createEraCovariateSettings(
        label         = lbl,
        includeEraIds = exposureId,
        start         = as.integer(rw$start %||% 0),
        startAnchor   = normalize_anchor(
          rw$startAnchor %||% rw$start_anchor,
          "era start"
        ),
        end           = as.integer(rw$end %||% 0),
        endAnchor     = normalize_anchor(
          rw$endAnchor %||% rw$end_anchor,
          "era end"
        )
      )
    })
    logger$info(sprintf(
      "Created %d era covariate settings", length(era_settings_list)
    ))

    # ── Create interval data ──────────────────────────────────
    logger$info("Creating interval data")
    interval_args <-
      SelfControlledCaseSeries::createCreateSccsIntervalDataArgs(
        eraCovariateSettings = era_settings_list
      )

    sccsIntervalData <- SelfControlledCaseSeries::createSccsIntervalData(
      studyPopulation = studyPop,
      sccsData        = sccsData,
      createSccsIntervalDataArgs = interval_args
    )
    logger$info("Interval data created")

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

    # Extract summary counts safely (SCCS v6 changed studyPop structure)
    n_cases  <- tryCatch({
      pop_df <- as.data.frame(studyPop)
      as.integer(nrow(pop_df))
    }, error = function(e) NA_integer_)
    n_events <- tryCatch({
      pop_df <- as.data.frame(studyPop)
      if ("outcomeCount" %in% names(pop_df)) {
        as.integer(sum(pop_df$outcomeCount > 0))
      } else {
        n_cases
      }
    }, error = function(e) NA_integer_)

    list(
      status    = "completed",
      estimates = estimates,
      summary   = list(
        cases     = n_cases,
        events    = n_events
      ),
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
