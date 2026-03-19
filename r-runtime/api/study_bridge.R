#* @root /study
NULL

# ──────────────────────────────────────────────────────────────────
# Study Bridge — Parthenon Study Orchestrator ↔ HADES
# These endpoints accept study-level specs from the Laravel backend
# and delegate to the appropriate HADES analysis pipelines.
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/progress.R")
source("/app/R/results.R")

# Minimum cell count for privacy — suppress any counts below this
MIN_CELL_COUNT <- 5L

#* Feasibility check — run cohort counts against a site's CDM
#* @post /feasibility
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec) || is.null(spec$source) || is.null(spec$cohort_ids)) {
    response$status <- 400L
    return(list(status = "error", message = "Required: source (connection details) + cohort_ids"))
  }

  safe_execute(response, logger, {
    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    resultsSchema <- spec$source$results_schema
    cohortIds     <- as.integer(spec$cohort_ids)
    min_cell      <- as.integer(spec$min_cell_count %||% MIN_CELL_COUNT)

    logger$info(sprintf("Feasibility check for %d cohorts", length(cohortIds)))

    counts <- list()
    for (cid in cohortIds) {
      sql <- sprintf(
        "SELECT COUNT(DISTINCT subject_id) AS n FROM %s.cohort WHERE cohort_definition_id = %d",
        resultsSchema, cid
      )
      result <- DatabaseConnector::querySql(connection, sql)
      n <- as.integer(result$N[1])

      # Privacy: suppress small counts
      if (!is.na(n) && n > 0 && n < min_cell) {
        n <- paste0("<", min_cell)
      }

      counts[[as.character(cid)]] <- n
      logger$info(sprintf("Cohort %d: %s subjects", cid, as.character(n)))
    }

    list(
      status  = "completed",
      counts  = counts,
      source  = list(
        cdm_schema     = spec$source$cdm_schema,
        results_schema = resultsSchema
      ),
      elapsed_seconds = logger$elapsed()
    )
  })
}

#* Characterization — run FeatureExtraction for a target cohort
#* @post /characterize
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec) || is.null(spec$source) || is.null(spec$cohorts)) {
    response$status <- 400L
    return(list(status = "error", message = "Required: source + cohorts (target_cohort_id)"))
  }

  safe_execute(response, logger, {
    library(FeatureExtraction)

    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    cdmSchema     <- spec$source$cdm_schema
    vocabSchema   <- spec$source$vocab_schema   %||% cdmSchema
    resultsSchema <- spec$source$results_schema
    targetId      <- as.integer(spec$cohorts$target_cohort_id)

    logger$info(sprintf("Characterization for cohort %d", targetId))

    # Build covariate settings
    covSettings <- FeatureExtraction::createDefaultCovariateSettings()

    # Extract features
    covData <- FeatureExtraction::getDbCovariateData(
      connectionDetails     = connectionDetails,
      cdmDatabaseSchema     = cdmSchema,
      cohortDatabaseSchema  = resultsSchema,
      cohortTable           = "cohort",
      cohortId              = targetId,
      covariateSettings     = covSettings
    )

    # Summarize
    summary <- FeatureExtraction::createTable1(covData)

    # Extract top features
    covariates <- as.data.frame(covData$covariateRef)
    covValues  <- as.data.frame(covData$covariates)

    # Merge and sort by mean value
    if (nrow(covValues) > 0 && nrow(covariates) > 0) {
      merged <- merge(covValues, covariates, by = "covariateId")
      merged <- merged[order(-merged$averageValue), ]
      top_features <- head(merged, 50)

      features <- lapply(seq_len(nrow(top_features)), function(i) {
        list(
          covariate_id   = top_features$covariateId[i],
          covariate_name = as.character(top_features$covariateName[i]),
          mean_value     = round(top_features$averageValue[i], 4),
          concept_id     = top_features$conceptId[i]
        )
      })
    } else {
      features <- list()
    }

    logger$info(sprintf("Characterization complete: %d features extracted", length(features)))

    list(
      status   = "completed",
      cohort_id = targetId,
      features  = features,
      summary   = summary,
      elapsed_seconds = logger$elapsed()
    )
  })
}

#* Incidence rate analysis
#* @post /incidence
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec) || is.null(spec$source) || is.null(spec$cohorts)) {
    response$status <- 400L
    return(list(status = "error", message = "Required: source + cohorts (target_cohort_id, outcome_cohort_id)"))
  }

  safe_execute(response, logger, {
    connectionDetails <- create_hades_connection(spec$source)
    connection <- DatabaseConnector::connect(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    cdmSchema     <- spec$source$cdm_schema
    resultsSchema <- spec$source$results_schema
    targetId      <- as.integer(spec$cohorts$target_cohort_id)
    outcomeId     <- as.integer(spec$cohorts$outcome_cohort_id)
    min_cell      <- as.integer(spec$min_cell_count %||% MIN_CELL_COUNT)

    logger$info(sprintf("Incidence rate: target=%d outcome=%d", targetId, outcomeId))

    # Query target cohort person-time
    sql_pt <- sprintf("
      SELECT
        COUNT(DISTINCT subject_id) AS n_persons,
        SUM(DATEDIFF(day, cohort_start_date, cohort_end_date)) / 365.25 AS person_years
      FROM %s.cohort
      WHERE cohort_definition_id = %d
    ", resultsSchema, targetId)
    pt_data <- DatabaseConnector::querySql(connection, sql_pt)

    # Count outcomes within target cohort
    sql_events <- sprintf("
      SELECT COUNT(DISTINCT t.subject_id) AS n_events
      FROM %s.cohort t
      JOIN %s.cohort o ON t.subject_id = o.subject_id
        AND o.cohort_start_date >= t.cohort_start_date
        AND o.cohort_start_date <= t.cohort_end_date
      WHERE t.cohort_definition_id = %d
        AND o.cohort_definition_id = %d
    ", resultsSchema, resultsSchema, targetId, outcomeId)
    event_data <- DatabaseConnector::querySql(connection, sql_events)

    n_persons     <- as.integer(pt_data$N_PERSONS[1])
    person_years  <- as.numeric(pt_data$PERSON_YEARS[1])
    n_events      <- as.integer(event_data$N_EVENTS[1])

    # Privacy suppression
    if (n_events > 0 && n_events < min_cell) {
      n_events <- paste0("<", min_cell)
      ir_per_1000 <- NA
    } else {
      ir_per_1000 <- if (person_years > 0) round(n_events / person_years * 1000, 4) else NA
    }

    logger$info(sprintf("IR = %s per 1000 PY", as.character(ir_per_1000)))

    list(
      status       = "completed",
      target_id    = targetId,
      outcome_id   = outcomeId,
      n_persons    = n_persons,
      person_years = round(person_years, 2),
      n_events     = n_events,
      incidence_rate_per_1000_py = ir_per_1000,
      elapsed_seconds = logger$elapsed()
    )
  })
}

#* Meta-analysis / evidence synthesis
#* @post /synthesis
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec) || is.null(spec$estimates)) {
    response$status <- 400L
    return(list(status = "error", message = "Required: estimates (array of {log_rr, se_log_rr})"))
  }

  safe_execute(response, logger, {
    library(EvidenceSynthesis)

    method <- tolower(spec$method %||% "random_effects")

    log_rrs   <- sapply(spec$estimates, function(e) as.numeric(e$log_rr))
    se_log_rrs <- sapply(spec$estimates, function(e) as.numeric(e$se_log_rr))

    valid <- !is.na(log_rrs) & !is.na(se_log_rrs) & se_log_rrs > 0
    if (sum(valid) < 2) {
      response$status <- 400L
      return(list(status = "error", message = "Need at least 2 valid estimates with non-NA log_rr and se_log_rr"))
    }

    log_rrs    <- log_rrs[valid]
    se_log_rrs <- se_log_rrs[valid]

    logger$info(sprintf("Evidence synthesis: %d estimates, method=%s", length(log_rrs), method))

    if (method == "fixed_effects") {
      result <- EvidenceSynthesis::computeFixedEffectMetaAnalysis(
        data.frame(logRr = log_rrs, seLogRr = se_log_rrs)
      )
    } else if (method == "bayesian") {
      result <- EvidenceSynthesis::computeBayesianMetaAnalysis(
        data.frame(logRr = log_rrs, seLogRr = se_log_rrs)
      )
    } else {
      # Default: random effects (DerSimonian-Laird)
      result <- EvidenceSynthesis::computeRandomEffectMetaAnalysis(
        data.frame(logRr = log_rrs, seLogRr = se_log_rrs)
      )
    }

    pooled_log_rr <- result$logRr
    pooled_se     <- result$seLogRr
    pooled_hr     <- exp(pooled_log_rr)
    pooled_ci_lo  <- exp(pooled_log_rr - 1.96 * pooled_se)
    pooled_ci_hi  <- exp(pooled_log_rr + 1.96 * pooled_se)
    pooled_p      <- 2 * pnorm(-abs(pooled_log_rr / pooled_se))

    # Heterogeneity (I-squared)
    tau <- if (!is.null(result$tau)) result$tau else NA_real_
    i_squared <- NA_real_
    if (length(log_rrs) > 1) {
      Q <- sum((log_rrs - pooled_log_rr)^2 / se_log_rrs^2)
      df <- length(log_rrs) - 1
      i_squared <- max(0, round((Q - df) / Q * 100, 1))
    }

    logger$info(sprintf("Pooled HR=%.3f [%.3f, %.3f], I2=%.1f%%",
      pooled_hr, pooled_ci_lo, pooled_ci_hi, i_squared))

    list(
      status = "completed",
      method = method,
      n_estimates = length(log_rrs),
      pooled = list(
        hazard_ratio = round(pooled_hr, 4),
        ci_95_lower  = round(pooled_ci_lo, 4),
        ci_95_upper  = round(pooled_ci_hi, 4),
        p_value      = round(pooled_p, 6),
        log_rr       = round(pooled_log_rr, 4),
        se_log_rr    = round(pooled_se, 4)
      ),
      heterogeneity = list(
        i_squared = i_squared,
        tau       = round(tau, 4)
      ),
      forest_plot_data = lapply(seq_along(log_rrs), function(i) {
        list(
          index    = i,
          log_rr   = round(log_rrs[i], 4),
          se       = round(se_log_rrs[i], 4),
          hr       = round(exp(log_rrs[i]), 4),
          ci_lower = round(exp(log_rrs[i] - 1.96 * se_log_rrs[i]), 4),
          ci_upper = round(exp(log_rrs[i] + 1.96 * se_log_rrs[i]), 4)
        )
      }),
      elapsed_seconds = logger$elapsed()
    )
  })
}

#* Study bridge health check
#* @get /health
#* @serializer unboxedJSON
function() {
  list(
    status  = "ok",
    service = "study-bridge",
    endpoints = c("feasibility", "characterize", "incidence", "synthesis")
  )
}
