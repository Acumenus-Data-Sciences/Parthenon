source("docker/shiny-ohdsi/manifest.R")
source("docker/shiny-ohdsi/loaders.R")
source("docker/shiny-ohdsi/handoffs.R")

catalog_path <- "docker/shiny-ohdsi/tests/golden/catalog.json"
if (!file.exists(catalog_path)) {
  stop("Golden managed Shiny result database catalog is missing. Run docker/shiny-ohdsi/tests/golden/create_golden_result_databases.R.")
}

catalog <- jsonlite::read_json(catalog_path, simplifyVector = FALSE)
golden_dir <- dirname(catalog_path)
sqlite <- Sys.which("sqlite3")

table_row_count <- function(database_path, table) {
  if (requireNamespace("RSQLite", quietly = TRUE) && requireNamespace("DBI", quietly = TRUE)) {
    con <- DBI::dbConnect(RSQLite::SQLite(), database_path)
    on.exit(DBI::dbDisconnect(con), add = TRUE)
    return(as.integer(DBI::dbGetQuery(con, sprintf("SELECT COUNT(*) AS n FROM %s", table))$n[[1]]))
  }

  if (!nzchar(sqlite)) {
    stop("RSQLite or sqlite3 is required to inspect golden SQLite result database rows.")
  }

  as.integer(system2(sqlite, args = database_path, input = sprintf("SELECT COUNT(*) FROM %s;", table), stdout = TRUE))
}

fixture_for_loader <- function(loader_key) {
  switch(
    loader_key,
    plp_result_bundle = "docker/shiny-ohdsi/tests/fixtures/plp-results-manifest.json",
    population_estimation_result_bundle = "docker/shiny-ohdsi/tests/fixtures/population-estimation-manifest.json",
    cohort_diagnostics_result_bundle = "docker/shiny-ohdsi/tests/fixtures/cohort-diagnostics-manifest.json",
    characterization_result_bundle = "docker/shiny-ohdsi/tests/fixtures/characterization-manifest.json",
    phevaluator_result_bundle = "docker/shiny-ohdsi/tests/fixtures/phevaluator-manifest.json",
    ohdsi_report_bundle = "docker/shiny-ohdsi/tests/fixtures/ohdsi-report-manifest.json",
    stop(sprintf("No fixture manifest is registered for loader %s", loader_key))
  )
}

copy_into_workspace_zip <- function(database_path, fixture_path) {
  database_path <- normalizePath(database_path, winslash = "/", mustWork = TRUE)
  parsed <- read_managed_shiny_manifest(dirname(fixture_path), fixture_path)
  if (!isTRUE(parsed$valid)) {
    stop(sprintf("Fixture manifest is invalid: %s", fixture_path))
  }

  workspace <- tempfile("managed-shiny-golden-")
  dir.create(workspace, recursive = TRUE)
  bundle_path <- file.path(workspace, parsed$manifest$artifact$materialized_file$relative_path)
  dir.create(dirname(bundle_path), recursive = TRUE, showWarnings = FALSE)

  oldwd <- setwd(workspace)
  on.exit(setwd(oldwd), add = TRUE)

  dir.create("resultdb", recursive = TRUE, showWarnings = FALSE)
  file.copy(database_path, "resultdb/results.sqlite", overwrite = TRUE)
  status <- system2("zip", args = c("-q", parsed$manifest$artifact$materialized_file$relative_path, "resultdb/results.sqlite"), stdout = TRUE, stderr = TRUE)
  if (!identical(attr(status, "status"), NULL)) {
    stop(sprintf("Could not zip golden database %s: %s", database_path, paste(status, collapse = "\n")))
  }

  unlink("resultdb", recursive = TRUE)

  list(parsed = parsed, workspace = workspace)
}

packages_missing <- managed_shiny_official_viewer_missing_packages(managed_shiny_official_viewer_package_status())
package_complete_runtime <- !(length(packages_missing) > 0 && any(packages_missing))

for (entry in catalog$databases) {
  database_path <- file.path(golden_dir, entry$file)
  if (!file.exists(database_path)) {
    stop(sprintf("Golden database is missing: %s", database_path))
  }

  definition <- managed_shiny_official_viewer_definition(entry$loader_key)
  if (is.null(definition)) {
    stop(sprintf("Golden database references an unsupported official loader: %s", entry$loader_key))
  }

  schema <- managed_shiny_validate_result_database_schema(database_path, definition)
  if (!isTRUE(schema$valid)) {
    stop(sprintf("Golden database failed schema guard: %s\n%s", entry$file, paste(schema$messages, collapse = "\n")))
  }
  if (!identical(schema$matched_variant, entry$expected_variant)) {
    stop(sprintf("Golden database matched wrong schema variant for %s: %s", entry$file, schema$matched_variant))
  }
  if (schema$table_count < length(entry$required_nonempty_tables)) {
    stop(sprintf("Golden database has too few tables for %s.", entry$file))
  }

  for (table in entry$required_nonempty_tables) {
    if (table_row_count(database_path, table) < 1L) {
      stop(sprintf("Golden database table is empty: %s.%s", entry$file, table))
    }
  }

  workspace <- copy_into_workspace_zip(database_path, fixture_for_loader(entry$loader_key))
  readiness <- managed_shiny_loader_readiness(workspace$parsed, workspace$workspace)
  if (!identical(readiness$status, "ready")) {
    stop(sprintf("Golden bundle was not ready for loader %s: %s", entry$loader_key, paste(readiness$messages, collapse = "\n")))
  }

  extracted <- managed_shiny_extract_result_database(readiness, tempfile("managed-shiny-golden-extract-"))
  if (!managed_shiny_nonempty_string(extracted$path) || !file.exists(extracted$path)) {
    stop(sprintf("Golden bundle did not expose a SQLite result database for %s.", entry$file))
  }

  handoff <- managed_shiny_prepare_official_viewer_handoff(readiness, tempfile("managed-shiny-golden-handoff-"))
  if (package_complete_runtime && !identical(handoff$status, "ready")) {
    stop(sprintf("Golden database did not produce a ready official handoff for %s: %s", entry$file, paste(handoff$messages, collapse = "\n")))
  }
  if (!package_complete_runtime && !identical(handoff$status, "blocked")) {
    stop(sprintf("Golden database should block only on missing runtime packages for %s.", entry$file))
  }
}

message(sprintf("Validated %d golden managed Shiny SQLite result databases.", length(catalog$databases)))
