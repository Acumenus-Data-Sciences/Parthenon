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

  old_wd <- getwd()
  setwd(export_folder)
  on.exit(setwd(old_wd), add = TRUE)

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

  # ROMOPAPI writes intermediate files to the current working directory.
  # setwd() to export_folder so those writes succeed (container root dir is read-only).
  old_wd <- getwd()
  setwd(export_folder)
  on.exit(setwd(old_wd), add = TRUE)

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(
      step = "create_tables", pct = 10,
      message = "Materializing stratified_code_counts table..."
    ))
    ROMOPAPI::createCodeCountsTables(handler)

    write_progress(progress_path, list(step = "verify_tables", pct = 85))
    results_schema <- source_envelope$schemas$results
    conn <- handler$connectionHandler$getConnection()
    row_count_raw <- tryCatch({
      rs <- DatabaseConnector::querySql(
        conn,
        SqlRender::render(
          "SELECT COUNT(*) AS n FROM @results.stratified_code_counts",
          results = results_schema
        )
      )
      rs$N[1]
    }, error = function(e) NA)
    # Coerce to scalar integer — jsonlite otherwise serializes NA_integer_ as [].
    row_count <- if (is.null(row_count_raw) || length(row_count_raw) == 0 || is.na(row_count_raw[1])) {
      0L
    } else {
      as.integer(row_count_raw[1])
    }

    # Grant read access to finngen_ro and parthenon_app. ROMOPAPI-created tables
    # are owned by parthenon_finngen_rw; other roles need explicit SELECT.
    # ALTER DEFAULT PRIVILEGES ensures future tables this role creates are also readable.
    write_progress(progress_path, list(
      step = "grant_read_access", pct = 95,
      message = "Granting SELECT to parthenon_finngen_ro + parthenon_app"
    ))
    tryCatch({
      DatabaseConnector::executeSql(conn, sprintf(
        "GRANT SELECT ON ALL TABLES IN SCHEMA %s TO parthenon_finngen_ro;", results_schema
      ))
      DatabaseConnector::executeSql(conn, sprintf(
        "GRANT SELECT ON ALL TABLES IN SCHEMA %s TO parthenon_app;", results_schema
      ))
      DatabaseConnector::executeSql(conn, sprintf(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA %s GRANT SELECT ON TABLES TO parthenon_finngen_ro;",
        results_schema
      ))
      DatabaseConnector::executeSql(conn, sprintf(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA %s GRANT SELECT ON TABLES TO parthenon_app;",
        results_schema
      ))
    }, error = function(e) {
      # Non-fatal — setup itself succeeded. Admin can grant manually if needed.
      message(sprintf("[setup-source GRANTs] non-fatal: %s", conditionMessage(e)))
    })

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
