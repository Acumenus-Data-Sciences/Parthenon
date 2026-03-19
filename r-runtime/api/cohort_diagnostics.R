#* @root /analysis/cohort-diagnostics
NULL

# ── CohortDiagnostics endpoint ──────────────────────────────────────
# POST /run — Execute cohort diagnostics for specified cohorts
# Returns: incidence rates, orphan concepts, index event breakdown,
#          temporal characterization, inclusion rule statistics
# ─────────────────────────────────────────────────────────────────────

source("/app/R/connection.R")
source("/app/R/progress.R")

#* Run cohort diagnostics
#* @post /run
#* @serializer unboxedJSON
function(body, response) {
  spec <- body
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "Request body required"))
  }

  logger <- create_analysis_logger()

  safe_execute(response, logger, {
    logger$info("Starting CohortDiagnostics analysis")

    # ── Validate required fields ──
    required <- c("connection", "cohort_ids", "cdm_database_schema",
                   "cohort_database_schema", "database_id")
    missing <- setdiff(required, names(spec))
    if (length(missing) > 0) {
      stop(paste("Missing required fields:", paste(missing, collapse = ", ")))
    }

    # ── Build connection ──
    connectionDetails <- create_hades_connection(spec$connection)
    logger$info("Database connection configured")

    # ── Build cohort definition set ──
    # Expects: list of objects with cohortId, cohortName, json, sql
    cohortDefinitionSet <- data.frame(
      cohortId = sapply(spec$cohort_definitions, function(x) x$cohortId),
      cohortName = sapply(spec$cohort_definitions, function(x) x$cohortName),
      json = sapply(spec$cohort_definitions, function(x) {
        if (is.list(x$json)) jsonlite::toJSON(x$json, auto_unbox = TRUE) else x$json
      }),
      sql = sapply(spec$cohort_definitions, function(x) x$sql %||% ""),
      stringsAsFactors = FALSE
    )

    # ── Configure diagnostics options ──
    runIncidenceRate <- spec$run_incidence_rate %||% TRUE
    runOrphanConcepts <- spec$run_orphan_concepts %||% TRUE
    runBreakdownIndexEvents <- spec$run_breakdown_index_events %||% TRUE
    runTemporalCharacterization <- spec$run_temporal_characterization %||% FALSE
    runInclusionStatistics <- spec$run_inclusion_statistics %||% TRUE
    runVisitContext <- spec$run_visit_context %||% TRUE
    minCellCount <- spec$min_cell_count %||% 5L

    # ── Create temp export folder ──
    exportFolder <- tempfile(pattern = "cd_export_")
    dir.create(exportFolder, recursive = TRUE)
    on.exit(unlink(exportFolder, recursive = TRUE), add = TRUE)

    logger$info(paste("Running diagnostics for", nrow(cohortDefinitionSet), "cohorts"))

    # ── Execute diagnostics ──
    CohortDiagnostics::executeDiagnostics(
      cohortDefinitionSet = cohortDefinitionSet,
      exportFolder = exportFolder,
      databaseId = spec$database_id,
      connectionDetails = connectionDetails,
      cdmDatabaseSchema = spec$cdm_database_schema,
      cohortDatabaseSchema = spec$cohort_database_schema,
      cohortTable = spec$cohort_table %||% "cohort",
      vocabularyDatabaseSchema = spec$vocabulary_database_schema %||% spec$cdm_database_schema,
      cohortIds = spec$cohort_ids,
      runInclusionStatistics = runInclusionStatistics,
      runIncludedSourceConcepts = TRUE,
      runOrphanConcepts = runOrphanConcepts,
      runBreakdownIndexEvents = runBreakdownIndexEvents,
      runIncidenceRate = runIncidenceRate,
      runVisitContext = runVisitContext,
      runTemporalCohortCharacterization = runTemporalCharacterization,
      runCohortRelationship = FALSE,
      runTimeSeries = FALSE,
      minCellCount = minCellCount,
      incremental = FALSE
    )

    logger$info("Diagnostics execution complete, reading results")

    # ── Read result CSV files ──
    results <- list()

    read_csv_safe <- function(filename) {
      path <- file.path(exportFolder, filename)
      if (file.exists(path)) {
        tryCatch(
          readr::read_csv(path, show_col_types = FALSE),
          error = function(e) NULL
        )
      } else NULL
    }

    # Cohort counts
    cohort_count <- read_csv_safe("cohort_count.csv")
    if (!is.null(cohort_count)) {
      results$cohort_counts <- as.list(as.data.frame(cohort_count))
    }

    # Incidence rates
    incidence <- read_csv_safe("incidence_rate.csv")
    if (!is.null(incidence)) {
      results$incidence_rates <- jsonlite::fromJSON(
        jsonlite::toJSON(incidence, auto_unbox = TRUE)
      )
    }

    # Orphan concepts
    orphans <- read_csv_safe("orphan_concept.csv")
    if (!is.null(orphans)) {
      # Limit to top 500 for response size
      orphans <- orphans[order(-orphans$conceptCount), ]
      if (nrow(orphans) > 500) orphans <- orphans[1:500, ]
      results$orphan_concepts <- jsonlite::fromJSON(
        jsonlite::toJSON(orphans, auto_unbox = TRUE)
      )
    }

    # Index event breakdown
    breakdown <- read_csv_safe("index_event_breakdown.csv")
    if (!is.null(breakdown)) {
      results$index_event_breakdown <- jsonlite::fromJSON(
        jsonlite::toJSON(breakdown, auto_unbox = TRUE)
      )
    }

    # Visit context
    visits <- read_csv_safe("visit_context.csv")
    if (!is.null(visits)) {
      results$visit_context <- jsonlite::fromJSON(
        jsonlite::toJSON(visits, auto_unbox = TRUE)
      )
    }

    # Inclusion statistics
    inc_stats <- read_csv_safe("cohort_inc_stats.csv")
    if (!is.null(inc_stats)) {
      results$inclusion_statistics <- jsonlite::fromJSON(
        jsonlite::toJSON(inc_stats, auto_unbox = TRUE)
      )
    }

    # Temporal characterization (if run)
    temporal <- read_csv_safe("temporal_covariate_value.csv")
    if (!is.null(temporal)) {
      # Limit size
      if (nrow(temporal) > 1000) temporal <- temporal[1:1000, ]
      results$temporal_characterization <- jsonlite::fromJSON(
        jsonlite::toJSON(temporal, auto_unbox = TRUE)
      )
    }

    logger$info("Results packaged successfully")

    list(
      status = "completed",
      database_id = spec$database_id,
      cohort_count = nrow(cohortDefinitionSet),
      results = results,
      logs = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
