# darkstar/api/finngen/cohort_ops.R
#
# Async cohort-materialization endpoints. Used by SP4 Cohort Workbench
# (not by SP1 UI, but the endpoints must exist for Part B API shape stability).
#
# Each writes to the bound results schema via parthenon_finngen_rw role.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
  library(HadesExtras)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

finngen_cohort_generate_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "generateCohortSet", pct = 30, message = "Materializing cohorts"))
    handler$generateCohortSet(cohortDefinitionSet = params$cohort_definition_set)

    write_progress(progress_path, list(step = "getCohortCounts", pct = 90))
    counts <- handler$getCohortCounts()

    .write_summary(export_folder, list(
      analysis_type = "cohort.generate",
      counts        = counts
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(counts = counts)
  })
}

finngen_cohort_match_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "build_matching_operator", pct = 30))
    matched <- HadesExtras::CohortGenerator_MatchingSubsetOperator(
      targetCohortId      = as.integer(params$primary_cohort_id),
      comparatorCohortIds = as.integer(params$comparator_cohort_ids),
      ratio               = params$ratio %||% 1L,
      matchSex            = params$match_sex %||% TRUE,
      matchBirthYear      = params$match_birth_year %||% TRUE,
      maxYearDifference   = params$max_year_difference %||% 1L
    )

    write_progress(progress_path, list(step = "generateCohortSet", pct = 60, message = "Materializing matched cohort"))
    handler$generateCohortSet(cohortDefinitionSet = list(matched))

    write_progress(progress_path, list(step = "getCohortCounts", pct = 90))
    counts <- handler$getCohortCounts()

    .write_summary(export_folder, list(
      analysis_type       = "cohort.match",
      primary_cohort_id   = params$primary_cohort_id,
      comparator_cohort_ids = params$comparator_cohort_ids,
      ratio               = params$ratio %||% 1L,
      counts              = counts
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(counts = counts)
  })
}

# SP4 Phase B.3 — sync preview-counts. Receives a precompiled subject_id SQL
# fragment from PHP (CohortOperationCompiler::compileSql), opens a connection
# against the source, and returns COUNT(DISTINCT subject_id). PHP validates
# the operation tree and whitelists the schema name before compiling, so the
# SQL fragment is trusted at this layer.
finngen_cohort_preview_count <- function(source_envelope, sql) {
  if (!is.character(sql) || length(sql) != 1 || nchar(sql) == 0) {
    stop("preview_count requires a non-empty SQL fragment")
  }
  connection_details <- DatabaseConnector::createConnectionDetails(
    dbms     = source_envelope$dbms %||% "postgresql",
    server   = source_envelope$connection$server,
    port     = source_envelope$connection$port,
    user     = source_envelope$connection$user,
    password = source_envelope$connection$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  )
  connection <- DatabaseConnector::connect(connection_details)
  on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

  wrapped <- sprintf("SELECT COUNT(DISTINCT subject_id) AS total FROM (%s) result_set", sql)
  res <- DatabaseConnector::querySql(connection, wrapped)
  names(res) <- tolower(names(res))
  total <- as.integer(res$total[1])
  list(total = total)
}
