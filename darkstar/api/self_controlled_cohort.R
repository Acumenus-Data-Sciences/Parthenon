# ──────────────────────────────────────────────────────────────────
# SelfControlledCohort — OHDSI Self-Controlled Cohort Analysis
# POST /analysis/self-controlled-cohort/run
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)
library(DBI)
library(SelfControlledCohort)
source("/app/R/connection.R")
source("/app/R/progress.R")

.ensure_list <- function(x) {
  if (is.null(x)) return(x)
  if (is.data.frame(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) {
      .ensure_list(as.list(x[i, , drop = FALSE]))
    })
    if (nrow(x) == 1) return(rows[[1]])
    return(rows)
  }
  if (is.list(x)) return(lapply(x, .ensure_list))
  x
}

.parse_cohort_table <- function(source, result_schema) {
  raw <- as.character(source$cohort_table %||% "cohort")
  raw <- sub('^"', "", raw)
  raw <- sub('"$', "", raw)

  if (grepl("\\.", raw, fixed = FALSE)) {
    parts <- strsplit(raw, "\\.", fixed = FALSE)[[1]]
    list(schema = parts[1], table = parts[length(parts)])
  } else {
    list(schema = result_schema, table = raw)
  }
}

.qualified_table <- function(connection, schema, table) {
  paste(
    as.character(DBI::dbQuoteIdentifier(connection, schema)),
    as.character(DBI::dbQuoteIdentifier(connection, table)),
    sep = "."
  )
}

.bool <- function(value, default = FALSE) {
  if (is.null(value) || length(value) == 0 || is.na(value)) return(default)
  isTRUE(as.logical(value))
}

.int <- function(value, default = 0L) {
  if (is.null(value) || length(value) == 0 || is.na(value)) return(as.integer(default))
  as.integer(value)
}

.age <- function(value) {
  if (is.null(value) || length(value) == 0 || is.na(value) || !nzchar(as.character(value))) return("")
  as.integer(value)
}

.finite_or_null <- function(value, digits = NULL, default = 0) {
  if (is.null(value) || length(value) == 0) return(default)
  numeric_value <- suppressWarnings(as.numeric(value[[1]]))
  if (is.na(numeric_value) || !is.finite(numeric_value)) return(default)
  if (!is.null(digits)) return(round(numeric_value, digits))
  numeric_value
}

.int_or_zero <- function(value) {
  numeric_value <- .finite_or_null(value, default = 0)
  as.integer(numeric_value)
}

#* Run package-native SelfControlledCohort and return Parthenon-normalized results
#* @post /analysis/self-controlled-cohort/run
#* @serializer unboxedJSON
function(body, response) {
  spec <- .ensure_list(body)
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("source", "cohorts")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  if (is.null(spec$cohorts$exposure_cohort_id) || is.null(spec$cohorts$outcome_cohort_id)) {
    response$status <- 400L
    return(list(status = "error", message = "cohorts.exposure_cohort_id and cohorts.outcome_cohort_id are required"))
  }

  safe_execute(response, logger, {
    source <- spec$source
    cdm_schema <- source$cdm_schema
    result_schema <- source$results_schema
    write_schema <- source$write_schema %||% result_schema
    table_parts <- .parse_cohort_table(source, result_schema)

    exposure_id <- as.integer(spec$cohorts$exposure_cohort_id)
    outcome_id <- as.integer(spec$cohorts$outcome_cohort_id)

    first_exposure_only <- .bool(spec$first_exposure_only %||% spec$firstExposureOnly, TRUE)
    first_outcome_only <- .bool(spec$first_outcome_only %||% spec$firstOutcomeOnly, TRUE)
    min_age <- .age(spec$min_age %||% spec$minAge)
    max_age <- .age(spec$max_age %||% spec$maxAge)

    risk_window_start_exposed <- .int(spec$risk_window_start_exposed %||% spec$riskWindowStartExposed, 1L)
    risk_window_end_exposed <- .int(spec$risk_window_end_exposed %||% spec$riskWindowEndExposed, 30L)
    add_length_exposed <- .bool(spec$add_length_of_exposure_exposed %||% spec$addLengthOfExposureExposed, TRUE)
    risk_window_start_unexposed <- .int(spec$risk_window_start_unexposed %||% spec$riskWindowStartUnexposed, -30L)
    risk_window_end_unexposed <- .int(spec$risk_window_end_unexposed %||% spec$riskWindowEndUnexposed, -1L)
    add_length_unexposed <- .bool(spec$add_length_of_exposure_unexposed %||% spec$addLengthOfExposureUnexposed, TRUE)

    washout_period <- .int(spec$washout_period %||% spec$washoutPeriod, 0L)
    followup_period <- .int(spec$followup_period %||% spec$followupPeriod, 0L)
    has_full_time_at_risk <- .bool(spec$has_full_time_at_risk %||% spec$hasFullTimeAtRisk, FALSE)
    compute_tar_distribution <- .bool(spec$compute_tar_distribution %||% spec$computeTarDistribution, FALSE)
    compute_threads <- .int(spec$compute_threads %||% spec$computeThreads, 1L)

    logger$info("SelfControlledCohort pipeline started", list(
      exposure_cohort_id = exposure_id,
      outcome_cohort_id = outcome_id,
      cohort_table = paste(table_parts$schema, table_parts$table, sep = ".")
    ))

    connection_details <- create_hades_connection(source)
    connection <- DatabaseConnector::connect(connection_details)
    on.exit(safe_disconnect(connection), add = TRUE)

    cohort_table_sql <- .qualified_table(connection, table_parts$schema, table_parts$table)
    cohort_counts <- DBI::dbGetQuery(
      connection,
      sprintf(
        paste(
          "SELECT cohort_definition_id, COUNT(DISTINCT subject_id) AS person_count",
          "FROM %s WHERE cohort_definition_id IN (%d, %d)",
          "GROUP BY cohort_definition_id"
        ),
        cohort_table_sql,
        exposure_id,
        outcome_id
      )
    )
    exposure_count <- 0L
    outcome_count <- 0L
    if (nrow(cohort_counts) > 0) {
      exposure_count <- .int_or_zero(cohort_counts$person_count[cohort_counts$cohort_definition_id == exposure_id][1])
      outcome_count <- .int_or_zero(cohort_counts$person_count[cohort_counts$cohort_definition_id == outcome_id][1])
    }

    logger$info("Running SelfControlledCohort package")
    results <- SelfControlledCohort::runSelfControlledCohort(
      connectionDetails = connection_details,
      cdmDatabaseSchema = cdm_schema,
      tempEmulationSchema = write_schema,
      exposureIds = exposure_id,
      outcomeIds = outcome_id,
      exposureDatabaseSchema = table_parts$schema,
      exposureTable = table_parts$table,
      outcomeDatabaseSchema = table_parts$schema,
      outcomeTable = table_parts$table,
      firstExposureOnly = first_exposure_only,
      firstOutcomeOnly = first_outcome_only,
      minAge = min_age,
      maxAge = max_age,
      riskWindowStartExposed = risk_window_start_exposed,
      riskWindowEndExposed = risk_window_end_exposed,
      addLengthOfExposureExposed = add_length_exposed,
      riskWindowStartUnexposed = risk_window_start_unexposed,
      riskWindowEndUnexposed = risk_window_end_unexposed,
      addLengthOfExposureUnexposed = add_length_unexposed,
      hasFullTimeAtRisk = has_full_time_at_risk,
      washoutPeriod = washout_period,
      followupPeriod = followup_period,
      computeTarDistribution = compute_tar_distribution,
      computeThreads = compute_threads,
      riskWindowsTable = "#risk_windows",
      resultsTable = "#results",
      returnEstimates = TRUE
    )

    estimates_df <- as.data.frame(results$estimates)
    estimates <- list()
    if (!is.null(estimates_df) && nrow(estimates_df) > 0) {
      estimates <- lapply(seq_len(nrow(estimates_df)), function(i) {
        row <- estimates_df[i, , drop = FALSE]
        list(
          covariate = sprintf("Exposure %s / Outcome %s", exposure_id, outcome_id),
          irr = .finite_or_null(row$irr, 4),
          ci_lower = .finite_or_null(row$irrLb95, 4),
          ci_upper = .finite_or_null(row$irrUb95, 4),
          log_rr = .finite_or_null(row$logRr, 4),
          se_log_rr = .finite_or_null(row$seLogRr, 4),
          p_value = .finite_or_null(row$p, 6),
          exposure_cohort_id = .int_or_zero(row$exposureId %||% exposure_id),
          outcome_cohort_id = .int_or_zero(row$outcomeId %||% outcome_id),
          num_persons = .int_or_zero(row$numPersons),
          num_exposures = .int_or_zero(row$numExposures),
          num_outcomes_exposed = .int_or_zero(row$numOutcomesExposed),
          num_outcomes_unexposed = .int_or_zero(row$numOutcomesUnexposed),
          time_at_risk_exposed = .finite_or_null(row$timeAtRiskExposed, 2),
          time_at_risk_unexposed = .finite_or_null(row$timeAtRiskUnexposed, 2)
        )
      })
    }

    num_persons <- if (nrow(estimates_df) > 0 && "numPersons" %in% names(estimates_df)) {
      .int_or_zero(max(estimates_df$numPersons, na.rm = TRUE))
    } else {
      min(exposure_count, outcome_count)
    }
    outcomes <- if (nrow(estimates_df) > 0) {
      exposed <- if ("numOutcomesExposed" %in% names(estimates_df)) sum(estimates_df$numOutcomesExposed, na.rm = TRUE) else 0
      unexposed <- if ("numOutcomesUnexposed" %in% names(estimates_df)) sum(estimates_df$numOutcomesUnexposed, na.rm = TRUE) else 0
      .int_or_zero(exposed + unexposed)
    } else {
      outcome_count
    }
    exposures <- if (nrow(estimates_df) > 0 && "numExposures" %in% names(estimates_df)) {
      .int_or_zero(sum(estimates_df$numExposures, na.rm = TRUE))
    } else {
      exposure_count
    }

    logger$info("SelfControlledCohort pipeline completed", list(
      persons = num_persons,
      outcomes = outcomes,
      estimates = length(estimates)
    ))

    list(
      status = "completed",
      engine = "self_controlled_cohort",
      package = "SelfControlledCohort",
      package_version = as.character(utils::packageVersion("SelfControlledCohort")),
      estimates = estimates,
      summary = list(
        cases = num_persons,
        events = outcomes,
        outcomes = outcomes,
        exposures = exposures,
        exposure_cohort_persons = exposure_count,
        outcome_cohort_persons = outcome_count
      ),
      population = list(
        cases = num_persons,
        outcomes = outcomes,
        observation_periods = 0L
      ),
      risk_windows = list(
        exposed = list(
          start = risk_window_start_exposed,
          end = risk_window_end_exposed,
          add_length_of_exposure = add_length_exposed
        ),
        unexposed = list(
          start = risk_window_start_unexposed,
          end = risk_window_end_unexposed,
          add_length_of_exposure = add_length_unexposed
        )
      ),
      logs = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
