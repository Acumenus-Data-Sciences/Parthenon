source("docker/shiny-ohdsi/manifest.R")
source("docker/shiny-ohdsi/loaders.R")
source("docker/shiny-ohdsi/handoffs.R")

fixture_cases <- list(
  plp_result_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/plp-results-manifest.json",
    tables = c("database_meta_data", "plp_model_designs", "plp_performances"),
    bad_tables = c("database_meta_data", "plp_model_designs"),
    expected_variant = "PatientLevelPrediction result database"
  ),
  population_estimation_result_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/population-estimation-manifest.json",
    tables = c("database_meta_data", "cm_analysis", "cm_result"),
    bad_tables = c("database_meta_data", "cm_analysis"),
    expected_variant = "CohortMethod result database"
  ),
  cohort_diagnostics_result_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/cohort-diagnostics-manifest.json",
    tables = c("database_meta_data", "cd_cohort", "cd_cohort_count"),
    bad_tables = c("database_meta_data", "cd_cohort"),
    expected_variant = "CohortDiagnostics result database"
  ),
  characterization_result_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/characterization-manifest.json",
    tables = c("database_meta_data", "c_time_to_event_targets", "c_time_to_event"),
    bad_tables = c("database_meta_data", "c_time_to_event_targets"),
    expected_variant = "Characterization time-to-event result database"
  ),
  phevaluator_result_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/phevaluator-manifest.json",
    tables = c("database_meta_data", "pv_algorithm_performance_results", "pv_diagnostics"),
    bad_tables = c("database_meta_data", "pv_algorithm_performance_results"),
    expected_variant = "PheValuator result database"
  ),
  ohdsi_report_bundle = list(
    fixture = "docker/shiny-ohdsi/tests/fixtures/ohdsi-report-manifest.json",
    tables = c("database_meta_data", "plp_model_designs", "plp_performances"),
    bad_tables = c("database_meta_data", "plp_model_designs"),
    expected_variant = "OHDSI report PLP result database"
  )
)

create_sqlite_fixture <- function(path, tables) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  statements <- paste(sprintf("CREATE TABLE %s (id INTEGER);", tables), collapse = " ")

  if (requireNamespace("RSQLite", quietly = TRUE) && requireNamespace("DBI", quietly = TRUE)) {
    con <- DBI::dbConnect(RSQLite::SQLite(), path)
    on.exit(DBI::dbDisconnect(con), add = TRUE)
    for (table in tables) {
      DBI::dbExecute(con, sprintf("CREATE TABLE %s (id INTEGER);", table))
    }
    return(invisible(path))
  }

  sqlite <- Sys.which("sqlite3")
  if (nzchar(sqlite)) {
    status <- system2(sqlite, args = path, input = statements, stdout = FALSE, stderr = FALSE)
    if (!identical(status, 0L)) {
      stop(sprintf("Could not create SQLite fixture: %s", path))
    }
    return(invisible(path))
  }

  writeLines("fixture", path)
  invisible(path)
}

create_zip_bundle <- function(workspace, relative_path, payload_path, sqlite_tables = NULL) {
  target <- file.path(workspace, relative_path)
  dir.create(dirname(target), recursive = TRUE, showWarnings = FALSE)

  oldwd <- setwd(workspace)
  on.exit(setwd(oldwd), add = TRUE)

  if (is.null(sqlite_tables)) {
    dir.create(dirname(payload_path), recursive = TRUE, showWarnings = FALSE)
    writeLines("fixture", payload_path)
  } else {
    create_sqlite_fixture(payload_path, sqlite_tables)
  }

  zip_status <- system2("zip", args = c("-q", relative_path, payload_path), stdout = FALSE, stderr = FALSE)
  unlink(strsplit(payload_path, "/", fixed = TRUE)[[1]][[1]], recursive = TRUE)

  if (!identical(zip_status, 0L)) {
    stop(sprintf("Could not create fixture zip bundle: %s", target))
  }

  invisible(target)
}

prepare_readiness <- function(case, tables, workspace_prefix = "managed-shiny-handoff-") {
  parsed <- read_managed_shiny_manifest(dirname(case$fixture), case$fixture)
  if (!isTRUE(parsed$valid)) {
    stop(sprintf("Fixture manifest must be valid before handoff testing: %s", case$fixture))
  }

  workspace <- tempfile(workspace_prefix)
  dir.create(workspace, recursive = TRUE)
  create_zip_bundle(
    workspace,
    parsed$manifest$artifact$materialized_file$relative_path,
    "resultdb/results.sqlite",
    sqlite_tables = tables
  )

  readiness <- managed_shiny_loader_readiness(parsed, workspace)
  if (!identical(readiness$status, "ready")) {
    stop(sprintf("Fixture readiness failed before handoff testing: %s\n%s", case$fixture, paste(readiness$messages, collapse = "\n")))
  }

  list(parsed = parsed, workspace = workspace, readiness = readiness)
}

packages_missing <- managed_shiny_official_viewer_missing_packages(managed_shiny_official_viewer_package_status())
package_complete_runtime <- !(length(packages_missing) > 0 && any(packages_missing))

for (loader_key in names(fixture_cases)) {
  case <- fixture_cases[[loader_key]]
  prepared <- prepare_readiness(case, case$tables)
  database <- managed_shiny_extract_result_database(prepared$readiness, tempfile("managed-shiny-handoff-extract-"))

  if (!managed_shiny_nonempty_string(database$path) || !file.exists(database$path)) {
    stop(sprintf("SQLite result database was not extracted from a ready zip bundle: %s", loader_key))
  }
  if (!identical(database$relative_path, "resultdb/results.sqlite")) {
    stop(sprintf("SQLite result database relative path was not preserved safely: %s", loader_key))
  }

  handoff <- managed_shiny_prepare_official_viewer_handoff(prepared$readiness, tempfile("managed-shiny-handoff-prepare-"))

  if (!package_complete_runtime) {
    if (!identical(handoff$status, "blocked") || !any(grepl("Missing OHDSI viewer runtime packages", handoff$messages))) {
      stop(sprintf("Missing official OHDSI packages did not block viewer handoff safely: %s", loader_key))
    }
    next
  }

  if (!identical(handoff$status, "ready")) {
    stop(sprintf("Official OHDSI viewer handoff did not become ready for %s: %s", loader_key, paste(handoff$messages, collapse = "\n")))
  }
  if (!identical(handoff$schema$matched_variant, case$expected_variant)) {
    stop(sprintf("Official OHDSI viewer handoff matched the wrong schema variant for %s.", loader_key))
  }
  if (!isTRUE(handoff$schema$valid) || handoff$schema$table_count < length(case$tables)) {
    stop(sprintf("Official OHDSI viewer handoff did not validate the SQLite schema guard for %s.", loader_key))
  }

  bad_schema <- prepare_readiness(case, case$bad_tables, "managed-shiny-handoff-bad-schema-")
  bad_schema_handoff <- managed_shiny_prepare_official_viewer_handoff(
    bad_schema$readiness,
    tempfile("managed-shiny-handoff-bad-schema-extract-")
  )
  if (!identical(bad_schema_handoff$status, "incomplete") || !any(grepl("expected result schema variant", bad_schema_handoff$messages))) {
    stop(sprintf("SQLite database without complete result tables did not fail the schema guard for %s.", loader_key))
  }
}

plp_case <- fixture_cases$plp_result_bundle
direct <- read_managed_shiny_manifest(dirname(plp_case$fixture), plp_case$fixture)
direct$manifest$artifact$materialized_file$relative_path <- "artifact/results.sqlite"
direct_workspace <- tempfile("managed-shiny-handoff-direct-")
dir.create(file.path(direct_workspace, "artifact"), recursive = TRUE)
create_sqlite_fixture(file.path(direct_workspace, "artifact", "results.sqlite"), plp_case$tables)
direct_readiness <- managed_shiny_loader_readiness(direct, direct_workspace)
direct_database <- managed_shiny_extract_result_database(direct_readiness)
if (!identical(direct_database$path, normalizePath(file.path(direct_workspace, "artifact", "results.sqlite"), winslash = "/", mustWork = FALSE))) {
  stop("Direct SQLite bundle was not accepted as a result database handoff.")
}

no_database_parsed <- read_managed_shiny_manifest(dirname(plp_case$fixture), plp_case$fixture)
no_database_workspace <- tempfile("managed-shiny-handoff-no-db-")
dir.create(no_database_workspace, recursive = TRUE)
create_zip_bundle(
  no_database_workspace,
  no_database_parsed$manifest$artifact$materialized_file$relative_path,
  "metadata/readme.txt"
)
no_database_readiness <- managed_shiny_loader_readiness(no_database_parsed, no_database_workspace)
no_database_database <- managed_shiny_extract_result_database(no_database_readiness, tempfile("managed-shiny-handoff-empty-"))
if (managed_shiny_nonempty_string(no_database_database$path)) {
  stop("Zip bundle without a SQLite result database should not produce a handoff database.")
}

if (!is.null(managed_shiny_official_viewer_definition("managed_shiny_result_bundle"))) {
  stop("Generic managed Shiny bundles should not claim an official OHDSI viewer handoff.")
}

message(sprintf(
  "Validated managed Shiny official viewer handoff detection for %d loader families.",
  length(fixture_cases)
))
