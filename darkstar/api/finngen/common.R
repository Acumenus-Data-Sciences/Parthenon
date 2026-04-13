# darkstar/api/finngen/common.R
#
# Shared utilities for all FinnGen Plumber routes (SP1 Runtime Foundation).
#
# Design invariants (from docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md §5.5):
#   - PHP does NO error-message pattern matching. All error classification
#     happens here and is surfaced as result$error$category.
#   - Adding a new category = one R branch + one translation key in Laravel.

suppressPackageStartupMessages({
  library(jsonlite)
  library(HadesExtras)
})

# ---- Null-coalescing (export for downstream files) ----------------------

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

# ---- Error classification ----------------------------------------------

finngen_error <- function(category, cond, export_folder = NULL) {
  list(
    ok = FALSE,
    error = list(
      category = category,
      class    = paste(class(cond), collapse = "/"),
      message  = conditionMessage(cond),
      call     = tryCatch(format(conditionCall(cond)), error = function(e) ""),
      stack    = paste(capture.output(traceback()), collapse = "\n"),
      reproducer_params_path = if (!is.null(export_folder)) file.path(export_folder, "params.json") else NA_character_
    )
  )
}

classify_simple_error <- function(e, export_folder = NULL) {
  msg <- conditionMessage(e)
  if (grepl("java\\.lang\\.OutOfMemoryError|Java heap space", msg, ignore.case = TRUE)) {
    return(finngen_error("OUT_OF_MEMORY", e, export_folder))
  }
  if (grepl("No space left on device|disk full", msg, ignore.case = TRUE)) {
    return(finngen_error("DISK_FULL", e, export_folder))
  }
  finngen_error("ANALYSIS_EXCEPTION", e, export_folder)
}

run_with_classification <- function(export_folder, fn) {
  result <- tryCatch({
    res <- fn()
    list(ok = TRUE, result = res)
  },
    DatabaseConnectorError = function(e) finngen_error("DB_CONNECTION_FAILED", e, export_folder),
    SqlRenderError         = function(e) finngen_error("DB_SCHEMA_MISMATCH",   e, export_folder),
    OutOfMemoryError       = function(e) finngen_error("OUT_OF_MEMORY",        e, export_folder),
    error = function(e) classify_simple_error(e, export_folder)
  )

  if (!is.null(export_folder) && dir.exists(export_folder)) {
    writeLines(
      jsonlite::toJSON(result, auto_unbox = TRUE, null = "null", force = TRUE),
      file.path(export_folder, "result.json")
    )
  }
  result
}

# ---- Progress writer (rotating buffer, 500-line cap) --------------------

.PROGRESS_MAX_LINES  <- 500L
.PROGRESS_DROP_LINES <- 100L

write_progress <- function(path, obj) {
  obj$updated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")
  line <- jsonlite::toJSON(obj, auto_unbox = TRUE, null = "null", force = TRUE)

  existing <- if (file.exists(path)) readLines(path, warn = FALSE) else character(0)
  if (length(existing) >= .PROGRESS_MAX_LINES) {
    existing <- tail(existing, .PROGRESS_MAX_LINES - .PROGRESS_DROP_LINES)
  }
  new_lines <- c(existing, line)

  tmp <- paste0(path, ".tmp")
  writeLines(new_lines, tmp)
  file.rename(tmp, path)
  invisible(NULL)
}

# ---- source → HadesExtras handlers -------------------------------------

.build_connection_details <- function(source_envelope) {
  conn <- source_envelope$connection
  DatabaseConnector::createConnectionDetails(
    dbms         = source_envelope$dbms,
    server       = conn$server,
    port         = conn$port,
    user         = conn$user,
    password     = conn$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/runner-state/jdbc")
  )
}

build_cohort_table_handler <- function(source_envelope) {
  stopifnot(is.list(source_envelope))
  sch <- source_envelope$schemas
  HadesExtras::createCohortTableHandlerFromList(list(
    connectionHandlerSettings = list(connectionDetailsSettings = .build_connection_details(source_envelope)),
    cdm = list(
      cdmDatabaseSchema        = sch$cdm,
      vocabularyDatabaseSchema = sch$vocab
    ),
    cohortTable = list(
      cohortDatabaseSchema = sch$cohort,
      cohortTableName      = "cohort"
    ),
    resultsDatabaseSchema = sch$results
  ))
}

build_cdm_handler <- function(source_envelope) {
  stopifnot(is.list(source_envelope))
  sch <- source_envelope$schemas
  HadesExtras::createCDMdbHandlerFromList(list(
    connectionHandlerSettings = list(connectionDetailsSettings = .build_connection_details(source_envelope)),
    cdm = list(
      cdmDatabaseSchema        = sch$cdm,
      vocabularyDatabaseSchema = sch$vocab
    )
  ))
}
