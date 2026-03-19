#* @root /analysis/characterization
NULL

# ──────────────────────────────────────────────────────────────────
# OHDSI Characterization — Full Characterization Package Pipeline
# POST /analysis/characterization/run
# ──────────────────────────────────────────────────────────────────

source("/app/R/connection.R")
source("/app/R/progress.R")

# Default time windows: 365d pre-index, 30d pre-index, day-of
DEFAULT_TIME_WINDOWS <- list(
  list(start_day = -365L, end_day = -1L),
  list(start_day = -30L,  end_day = -1L),
  list(start_day = 0L,    end_day = 0L)
)

MIN_CELL_COUNT_DEFAULT    <- 5L
MIN_PRIOR_OBS_DEFAULT     <- 365L

#' Apply min-cell-count suppression to a numeric value.
#' Returns the integer if >= threshold, otherwise the string "<N".
.suppress <- function(n, threshold) {
  n <- as.integer(n)
  if (!is.na(n) && n > 0L && n < threshold) paste0("<", threshold) else n
}

#' Convert a data.frame to a list-of-rows for JSON serialisation.
.df_to_rows <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(list())
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

#' Build FeatureExtraction covariate settings for a set of time windows.
.build_covariate_settings <- function(time_windows) {
  library(FeatureExtraction)

  # One settings object per time window; Characterization will combine them
  lapply(time_windows, function(tw) {
    FeatureExtraction::createCovariateSettings(
      useDemographicsGender              = TRUE,
      useDemographicsAge                 = TRUE,
      useDemographicsAgeGroup            = TRUE,
      useConditionGroupEraLongTerm       = TRUE,
      useConditionGroupEraShortTerm      = TRUE,
      useDrugGroupEraLongTerm            = TRUE,
      useDrugGroupEraShortTerm           = TRUE,
      useProcedureOccurrenceLongTerm     = TRUE,
      useMeasurementLongTerm             = TRUE,
      useCharlsonIndex                   = TRUE,
      longTermStartDays                  = as.integer(tw$start_day),
      endDays                            = as.integer(tw$end_day)
    )
  })
}

#* Run OHDSI Characterization analysis (Table 1, Time-to-Event, Dechallenge/Rechallenge)
#* @post /run
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # ── Input validation ────────────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("connection", "target_ids", "outcome_ids",
                     "cdm_database_schema", "cohort_database_schema")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error",
                message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  target_ids  <- as.integer(spec$target_ids)
  outcome_ids <- as.integer(spec$outcome_ids)

  if (length(target_ids) == 0 || length(outcome_ids) == 0) {
    response$status <- 400L
    return(list(status = "error", message = "target_ids and outcome_ids must each have at least one element"))
  }

  logger$info("Characterization pipeline started", list(
    n_targets  = length(target_ids),
    n_outcomes = length(outcome_ids)
  ))

  safe_execute(response, logger, {
    library(Characterization)
    library(FeatureExtraction)
    library(DatabaseConnector)

    # ── Parse parameters ─────────────────────────────────────────
    cdm_schema    <- spec$cdm_database_schema
    cohort_schema <- spec$cohort_database_schema
    cohort_table  <- spec$cohort_table         %||% "cohort"
    min_cell      <- as.integer(spec$min_cell_count       %||% MIN_CELL_COUNT_DEFAULT)
    min_prior_obs <- as.integer(spec$min_prior_observation %||% MIN_PRIOR_OBS_DEFAULT)

    # Analysis toggles
    analyses_spec <- spec$analyses %||% list()
    do_aggregate  <- !isFALSE(analyses_spec$aggregate_covariates)   # default TRUE
    do_tte        <- !isFALSE(analyses_spec$time_to_event)          # default TRUE
    do_dr         <- isTRUE(analyses_spec$dechallenge_rechallenge)   # default FALSE

    # Time windows
    raw_windows <- spec$time_windows %||% DEFAULT_TIME_WINDOWS
    time_windows <- lapply(raw_windows, function(tw) {
      list(
        start_day = as.integer(tw$start_day),
        end_day   = as.integer(tw$end_day)
      )
    })

    logger$info(sprintf(
      "CDM=%s, cohort=%s.%s, min_cell=%d, min_prior_obs=%d",
      cdm_schema, cohort_schema, cohort_table, min_cell, min_prior_obs
    ))
    logger$info(sprintf(
      "Analyses: aggregate=%s, tte=%s, dechallenge=%s",
      do_aggregate, do_tte, do_dr
    ))

    # ── Establish connection ──────────────────────────────────────
    logger$info("Connecting to CDM database")
    connectionDetails <- create_hades_connection(spec$connection)

    # ── Build Characterization settings ──────────────────────────
    settings_list <- list()

    # 1. Aggregate covariate settings (Table 1)
    if (do_aggregate) {
      logger$info("Building aggregate covariate settings")
      cov_settings_list <- .build_covariate_settings(time_windows)

      agg_settings <- Characterization::createAggregateCovariateSettings(
        targetIds                 = target_ids,
        outcomeIds                = outcome_ids,
        minPriorObservation       = min_prior_obs,
        covariateSettings         = cov_settings_list,
        caseCovariateSettings     = FeatureExtraction::createCovariateSettings(
          useDemographicsGender        = TRUE,
          useDemographicsAge           = TRUE,
          useConditionGroupEraShortTerm = TRUE,
          useDrugGroupEraShortTerm     = TRUE,
          longTermStartDays            = -30L,
          endDays                      = 0L
        ),
        casePostExposureWindow    = 30L
      )
      settings_list[["aggregate"]] <- agg_settings
    }

    # 2. Time-to-event settings
    if (do_tte) {
      logger$info("Building time-to-event settings")
      tte_settings <- Characterization::createTimeToEventSettings(
        targetIds  = target_ids,
        outcomeIds = outcome_ids
      )
      settings_list[["time_to_event"]] <- tte_settings
    }

    # 3. Dechallenge/rechallenge settings
    if (do_dr) {
      logger$info("Building dechallenge/rechallenge settings")
      dr_settings <- Characterization::createDechallengeRechallengeSettings(
        targetIds                    = target_ids,
        outcomeIds                   = outcome_ids,
        dechallengeStopInterval      = 30L,
        dechallengeEvaluationWindow  = 30L
      )
      settings_list[["dechallenge_rechallenge"]] <- dr_settings
    }

    # Combine all enabled settings into one CharacterizationSettings object
    char_settings_args <- list(
      minPriorObservation = min_prior_obs
    )
    if (!is.null(settings_list[["aggregate"]]))
      char_settings_args$targetOutcomeSettings <- list(settings_list[["aggregate"]])
    if (!is.null(settings_list[["time_to_event"]]))
      char_settings_args$timeToEventSettings <- list(settings_list[["time_to_event"]])
    if (!is.null(settings_list[["dechallenge_rechallenge"]]))
      char_settings_args$dechallengeRechallengeSettings <- list(settings_list[["dechallenge_rechallenge"]])

    char_settings <- do.call(Characterization::createCharacterizationSettings, char_settings_args)

    # ── Create output table structure in a temp SQLite DB ────────
    tmp_dir  <- tempdir()
    sqlite_path <- file.path(tmp_dir, paste0("char_results_", as.integer(Sys.time()), ".sqlite"))
    on.exit(unlink(sqlite_path, force = TRUE), add = TRUE)

    logger$info(sprintf("Creating results tables in temp SQLite at %s", sqlite_path))
    result_conn_details <- DatabaseConnector::createConnectionDetails(
      dbms   = "sqlite",
      server = sqlite_path
    )
    result_conn <- DatabaseConnector::connect(result_conn_details)
    Characterization::createCharacterizationTables(
      connection         = result_conn,
      resultSchema       = "main",
      deleteExistingTables = TRUE
    )
    safe_disconnect(result_conn)

    # ── Run characterization analyses ─────────────────────────────
    logger$info("Running characterization analyses — this may take several minutes")
    Characterization::runCharacterizationAnalyses(
      connectionDetails        = connectionDetails,
      cdmDatabaseSchema        = cdm_schema,
      cohortDatabaseSchema     = cohort_schema,
      cohortTable              = cohort_table,
      characterizationSettings = char_settings,
      outputDirectory          = tmp_dir,
      executionPath            = file.path(tmp_dir, "execution"),
      minCellCount             = min_cell,
      incremental              = FALSE
    )

    # ── Insert results to SQLite for easy retrieval ───────────────
    logger$info("Inserting results into SQLite")
    Characterization::insertResultsToDatabase(
      connectionDetails = result_conn_details,
      schema            = "main",
      resultsFolder     = tmp_dir,
      tablePrefix       = "",
      minCellCount      = min_cell
    )

    # ── Read results back from SQLite ─────────────────────────────
    logger$info("Reading results from SQLite")
    result_conn2 <- DatabaseConnector::connect(result_conn_details)
    on.exit(safe_disconnect(result_conn2), add = TRUE)

    # Cohort counts
    cohort_counts_df <- tryCatch(
      DatabaseConnector::querySql(result_conn2,
        "SELECT * FROM main.cohort_counts ORDER BY target_cohort_id, outcome_cohort_id"),
      error = function(e) { logger$warn(paste("cohort_counts query failed:", e$message)); NULL }
    )

    # Aggregate covariates (Table 1 style)
    agg_cov_df <- NULL
    if (do_aggregate) {
      agg_cov_df <- tryCatch(
        DatabaseConnector::querySql(result_conn2,
          "SELECT * FROM main.aggregate_covariates ORDER BY covariate_id LIMIT 5000"),
        error = function(e) { logger$warn(paste("aggregate_covariates query failed:", e$message)); NULL }
      )
    }

    # Time-to-event results
    tte_df <- NULL
    if (do_tte) {
      tte_df <- tryCatch(
        DatabaseConnector::querySql(result_conn2,
          "SELECT * FROM main.time_to_event ORDER BY target_cohort_id, outcome_cohort_id, time_to_event"),
        error = function(e) { logger$warn(paste("time_to_event query failed:", e$message)); NULL }
      )
    }

    # Dechallenge/rechallenge results
    dr_df <- NULL
    if (do_dr) {
      dr_df <- tryCatch(
        DatabaseConnector::querySql(result_conn2,
          "SELECT * FROM main.dechallenge_rechallenge ORDER BY target_cohort_id, outcome_cohort_id"),
        error = function(e) { logger$warn(paste("dechallenge_rechallenge query failed:", e$message)); NULL }
      )
    }

    safe_disconnect(result_conn2)

    # ── Shape aggregate covariate output → Table 1 format ────────
    aggregate_covariates_out <- list()
    if (!is.null(agg_cov_df) && nrow(agg_cov_df) > 0) {
      names(agg_cov_df) <- tolower(names(agg_cov_df))

      aggregate_covariates_out <- lapply(seq_len(nrow(agg_cov_df)), function(i) {
        row <- agg_cov_df[i, ]
        list(
          target_cohort_id  = as.integer(row$target_cohort_id   %||% row$targetcohortid   %||% NA),
          outcome_cohort_id = as.integer(row$outcome_cohort_id  %||% row$outcomecohortid  %||% NA),
          covariate_id      = as.numeric(row$covariate_id       %||% row$covariateid      %||% NA),
          covariate_name    = as.character(row$covariate_name   %||% row$covariatename    %||% ""),
          mean_target       = round(as.numeric(row$mean_target  %||% row$meantarget       %||% NA), 4),
          mean_outcome      = round(as.numeric(row$mean_outcome %||% row$meanoutcome      %||% NA), 4),
          sd_target         = round(as.numeric(row$sd_target    %||% row$sdtarget         %||% NA), 4),
          smd               = round(as.numeric(row$smd          %||% NA), 4),
          time_id           = as.integer(row$time_id           %||% row$timeid           %||% NA),
          start_day         = as.integer(row$start_day         %||% row$startday         %||% NA),
          end_day           = as.integer(row$end_day           %||% row$endday           %||% NA)
        )
      })
    }

    # ── Shape time-to-event output ────────────────────────────────
    time_to_event_out <- list()
    if (!is.null(tte_df) && nrow(tte_df) > 0) {
      names(tte_df) <- tolower(names(tte_df))

      time_to_event_out <- lapply(seq_len(nrow(tte_df)), function(i) {
        row <- tte_df[i, ]
        list(
          target_cohort_id  = as.integer(row$target_cohort_id  %||% row$targetcohortid  %||% NA),
          outcome_cohort_id = as.integer(row$outcome_cohort_id %||% row$outcomecohortid %||% NA),
          time_to_event     = as.integer(row$time_to_event     %||% row$timetoevent     %||% NA),
          num_events        = as.integer(row$num_events        %||% row$numevents        %||% NA)
        )
      })
    }

    # ── Shape dechallenge/rechallenge output ─────────────────────
    dechallenge_rechallenge_out <- list()
    if (!is.null(dr_df) && nrow(dr_df) > 0) {
      names(dr_df) <- tolower(names(dr_df))
      dechallenge_rechallenge_out <- .df_to_rows(dr_df)
    }

    # ── Shape cohort counts output ────────────────────────────────
    cohort_counts_out <- list()
    if (!is.null(cohort_counts_df) && nrow(cohort_counts_df) > 0) {
      names(cohort_counts_df) <- tolower(names(cohort_counts_df))
      cohort_counts_out <- lapply(seq_len(nrow(cohort_counts_df)), function(i) {
        row <- cohort_counts_df[i, ]
        n_cases <- as.integer(row$num_persons %||% row$numpersons %||% row$n %||% NA)
        list(
          target_cohort_id  = as.integer(row$target_cohort_id  %||% row$targetcohortid  %||% NA),
          outcome_cohort_id = as.integer(row$outcome_cohort_id %||% row$outcomecohortid %||% NA),
          num_persons       = .suppress(n_cases, min_cell)
        )
      })
    }

    logger$info("Characterization pipeline complete", list(
      n_aggregate_rows   = length(aggregate_covariates_out),
      n_tte_rows         = length(time_to_event_out),
      n_dr_rows          = length(dechallenge_rechallenge_out),
      elapsed_seconds    = logger$elapsed()
    ))

    # ── Return ────────────────────────────────────────────────────
    list(
      status = "completed",
      analyses_run = list(
        aggregate_covariates     = do_aggregate,
        time_to_event            = do_tte,
        dechallenge_rechallenge  = do_dr
      ),
      cohort_counts              = cohort_counts_out,
      aggregate_covariates       = aggregate_covariates_out,
      time_to_event              = time_to_event_out,
      dechallenge_rechallenge    = dechallenge_rechallenge_out,
      logs                       = logger$entries(),
      elapsed_seconds            = logger$elapsed()
    )
  })
}

#* Characterization health check
#* @get /health
#* @serializer unboxedJSON
function() {
  list(
    status  = "ok",
    service = "characterization",
    package = tryCatch(as.character(packageVersion("Characterization")), error = function(e) "unknown"),
    endpoints = c("run")
  )
}
