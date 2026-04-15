# darkstar/api/finngen/co2_analysis.R
#
# Async analysis endpoints wrapping CO2AnalysisModules::execute_*.
# Per spec §0.1 handoff: we NEVER library(CO2AnalysisModules) because its
# Shiny deps pollute the runtime — we call functions via CO2AnalysisModules::
# qualified prefix only.
#
# Each function:
#   1. Creates the export folder (artifact sink)
#   2. Wraps everything in run_with_classification so DB/OOM/etc errors are
#      surfaced via result$error$category
#   3. Writes newline-JSON progress via write_progress (rotating buffer)
#   4. Writes a summary.json with per-analysis metadata
#
# Called from Plumber routes (B6) inside a mirai::mirai task. The mirai
# task's return value is what the Plumber /jobs/{id} endpoint surfaces.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

finngen_co2_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5, message = "Opening DB connection"))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CodeWAS", pct = 10, message = "Running CodeWAS association scan"))
    res <- CO2AnalysisModules::execute_CodeWAS(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = analysis_settings
    )

    write_progress(progress_path, list(step = "write_summary", pct = 95))
    rows <- if (!is.null(res$codeWASCounts)) nrow(res$codeWASCounts) else NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.codewas",
      rows          = rows,
      case_cohort   = analysis_settings$cohortIdCases %||% NA_integer_,
      control_cohort = analysis_settings$cohortIdControls %||% NA_integer_,
      covariate_ids = analysis_settings$analysisIds %||% integer()
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(rows = rows)
  })
}

finngen_co2_time_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_timeCodeWAS", pct = 10, message = "Running temporal CodeWAS"))
    res <- CO2AnalysisModules::execute_timeCodeWAS(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = analysis_settings
    )

    rows <- if (!is.null(res$timeCodeWASCounts)) nrow(res$timeCodeWASCounts) else NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.time_codewas",
      rows          = rows,
      temporal_windows = analysis_settings$temporalStartDays %||% integer()
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(rows = rows)
  })
}

finngen_co2_overlaps_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CohortOverlaps", pct = 10))
    res <- CO2AnalysisModules::execute_CohortOverlaps(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = analysis_settings
    )

    .write_summary(export_folder, list(
      analysis_type = "co2.overlaps",
      cohort_ids    = analysis_settings$cohortIds %||% integer()
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    res
  })
}

finngen_co2_demographics_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CohortDemographics", pct = 10))
    res <- CO2AnalysisModules::execute_CohortDemographics(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = analysis_settings
    )

    total <- res$total %||% NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.demographics",
      total         = total,
      cohort_ids    = analysis_settings$cohortIds %||% integer()
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(total = total)
  })
}
