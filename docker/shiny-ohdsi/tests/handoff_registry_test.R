source("docker/shiny-ohdsi/manifest.R")
source("docker/shiny-ohdsi/loaders.R")
source("docker/shiny-ohdsi/handoffs.R")

fixture <- "docker/shiny-ohdsi/tests/fixtures/plp-results-manifest.json"

create_zip_bundle <- function(workspace, relative_path, payload_path) {
  target <- file.path(workspace, relative_path)
  dir.create(dirname(target), recursive = TRUE, showWarnings = FALSE)

  oldwd <- setwd(workspace)
  on.exit(setwd(oldwd), add = TRUE)

  dir.create(dirname(payload_path), recursive = TRUE, showWarnings = FALSE)
  writeLines("fixture", payload_path)
  zip_status <- system2("zip", args = c("-q", relative_path, payload_path), stdout = FALSE, stderr = FALSE)
  unlink(strsplit(payload_path, "/", fixed = TRUE)[[1]][[1]], recursive = TRUE)

  if (!identical(zip_status, 0L)) {
    stop(sprintf("Could not create fixture zip bundle: %s", target))
  }

  invisible(target)
}

parsed <- read_managed_shiny_manifest(dirname(fixture), fixture)
if (!isTRUE(parsed$valid)) {
  stop("PLP fixture manifest must be valid before handoff testing.")
}

workspace <- tempfile("managed-shiny-handoff-")
dir.create(workspace, recursive = TRUE)
create_zip_bundle(
  workspace,
  parsed$manifest$artifact$materialized_file$relative_path,
  "resultdb/results.sqlite"
)

readiness <- managed_shiny_loader_readiness(parsed, workspace)
if (!identical(readiness$status, "ready")) {
  stop(sprintf("PLP fixture readiness failed before handoff testing: %s", paste(readiness$messages, collapse = "\n")))
}

database <- managed_shiny_extract_result_database(readiness, tempfile("managed-shiny-handoff-extract-"))
if (!managed_shiny_nonempty_string(database$path) || !file.exists(database$path)) {
  stop("SQLite result database was not extracted from a ready zip bundle.")
}
if (!identical(database$relative_path, "resultdb/results.sqlite")) {
  stop("SQLite result database relative path was not preserved safely.")
}

direct <- parsed
direct$manifest$artifact$materialized_file$relative_path <- "artifact/results.sqlite"
direct_workspace <- tempfile("managed-shiny-handoff-direct-")
dir.create(file.path(direct_workspace, "artifact"), recursive = TRUE)
writeLines("fixture", file.path(direct_workspace, "artifact", "results.sqlite"))
direct_readiness <- managed_shiny_loader_readiness(direct, direct_workspace)
direct_database <- managed_shiny_extract_result_database(direct_readiness)
if (!identical(direct_database$path, normalizePath(file.path(direct_workspace, "artifact", "results.sqlite"), winslash = "/", mustWork = FALSE))) {
  stop("Direct SQLite bundle was not accepted as a result database handoff.")
}

no_database_workspace <- tempfile("managed-shiny-handoff-no-db-")
dir.create(no_database_workspace, recursive = TRUE)
create_zip_bundle(
  no_database_workspace,
  parsed$manifest$artifact$materialized_file$relative_path,
  "metadata/readme.txt"
)
no_database_readiness <- managed_shiny_loader_readiness(parsed, no_database_workspace)
no_database <- managed_shiny_extract_result_database(no_database_readiness, tempfile("managed-shiny-handoff-empty-"))
if (managed_shiny_nonempty_string(no_database$path)) {
  stop("Zip bundle without a SQLite result database should not produce a handoff database.")
}

package_status <- managed_shiny_official_viewer_package_status()
packages_missing <- managed_shiny_official_viewer_missing_packages(package_status)
handoff <- managed_shiny_prepare_official_viewer_handoff(readiness, tempfile("managed-shiny-handoff-prepare-"))

if (length(packages_missing) > 0 && any(packages_missing)) {
  if (!identical(handoff$status, "blocked") || !any(grepl("Missing OHDSI viewer runtime packages", handoff$messages))) {
    stop("Missing official OHDSI packages did not block viewer handoff safely.")
  }
} else {
  if (!identical(handoff$status, "ready")) {
    stop(sprintf("Official OHDSI viewer handoff did not become ready: %s", paste(handoff$messages, collapse = "\n")))
  }
  if (!identical(handoff$module_id, "prediction") || !identical(handoff$ui_function, "patientLevelPredictionViewer")) {
    stop("Official OHDSI viewer handoff selected the wrong PLP module.")
  }
}

if (!is.null(managed_shiny_official_viewer_definition("managed_shiny_result_bundle"))) {
  stop("Generic managed Shiny bundles should not claim an official OHDSI viewer handoff.")
}

message("Validated managed Shiny official viewer handoff detection.")
