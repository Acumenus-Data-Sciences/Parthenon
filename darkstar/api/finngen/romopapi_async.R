# darkstar/api/finngen/romopapi_async.R
#
# Async execute functions for Code Explorer (SP2):
#   finngen_romopapi_report_execute()      — ROMOPAPI::createReport + copy HTML to artifacts
#   finngen_romopapi_setup_source_execute() — ROMOPAPI::createCodeCountsTables (one-time)
#
# Both follow SP1's common.R pattern: run_with_classification wraps the body,
# write_progress emits newline-JSON to progress.json, summary.json + result.json
# land in the run's export_folder.
#
# Spec: docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md §4.2

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
  library(ROMOPAPI)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

# ── finngen_romopapi_report_execute ────────────────────────────────────

finngen_romopapi_report_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    concept_id <- as.integer(params$concept_id)

    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cdm_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(
      step = "createReport", pct = 20,
      message = sprintf("Generating report for concept %d", concept_id)
    ))

    src_html <- ROMOPAPI::createReport(handler, conceptId = concept_id)

    write_progress(progress_path, list(step = "copy_artifact", pct = 90))
    dst_html <- file.path(export_folder, "report.html")
    if (!is.null(src_html) && file.exists(src_html) && src_html != dst_html) {
      file.copy(src_html, dst_html, overwrite = TRUE)
    } else if (!file.exists(dst_html)) {
      stop("ROMOPAPI::createReport did not produce an HTML file at ", src_html %||% "<NULL>")
    }

    report_size <- file.size(dst_html)
    .write_summary(export_folder, list(
      analysis_type = "romopapi.report",
      concept_id    = concept_id,
      report_bytes  = report_size,
      report_path   = sprintf("runs/%s/report.html", run_id)
    ))

    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      concept_id   = concept_id,
      report_bytes = report_size
    )
  })
}

# ── finngen_romopapi_setup_source_execute ──────────────────────────────

finngen_romopapi_setup_source_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(
      step = "create_tables", pct = 10,
      message = "Materializing stratified_code_counts table..."
    ))
    ROMOPAPI::createCodeCountsTables(handler)

    write_progress(progress_path, list(step = "verify_tables", pct = 90))
    results_schema <- source_envelope$schemas$results
    conn <- handler$connectionHandler$getConnection()
    row_count <- tryCatch({
      rs <- DatabaseConnector::querySql(
        conn,
        SqlRender::render(
          "SELECT COUNT(*) AS n FROM @results.stratified_code_counts",
          results = results_schema
        )
      )
      as.integer(rs$N[1])
    }, error = function(e) NA_integer_)

    .write_summary(export_folder, list(
      analysis_type        = "romopapi.setup",
      source_key           = source_envelope$source_key,
      results_schema       = results_schema,
      stratified_row_count = row_count
    ))

    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      source_key           = source_envelope$source_key,
      stratified_row_count = row_count
    )
  })
}
