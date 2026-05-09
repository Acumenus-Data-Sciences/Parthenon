source("docker/shiny-ohdsi/manifest.R")
source("docker/shiny-ohdsi/loaders.R")

fixture_dir <- "docker/shiny-ohdsi/tests/fixtures"
fixtures <- list.files(fixture_dir, pattern = "-manifest[.]json$", full.names = TRUE)

if (length(fixtures) < 6) {
  stop("Expected at least six managed Shiny fixture manifests.")
}

create_zip_bundle <- function(workspace, relative_path) {
  target <- file.path(workspace, relative_path)
  dir.create(dirname(target), recursive = TRUE, showWarnings = FALSE)

  oldwd <- setwd(dirname(target))
  on.exit(setwd(oldwd), add = TRUE)

  writeLines('{"fixture":true}', "bundle-metadata.json")
  zip_status <- utils::zip(zipfile = basename(target), files = "bundle-metadata.json", flags = "-q")
  unlink("bundle-metadata.json")

  if (!identical(zip_status, 0L)) {
    stop(sprintf("Could not create fixture zip bundle: %s", target))
  }

  target
}

fixture_workspace <- function(parsed) {
  workspace <- tempfile("managed-shiny-loader-")
  dir.create(workspace, recursive = TRUE)
  create_zip_bundle(workspace, parsed$manifest$artifact$materialized_file$relative_path)
  workspace
}

ready_count <- 0L

for (fixture in fixtures) {
  parsed <- read_managed_shiny_manifest(dirname(fixture), fixture)
  if (!isTRUE(parsed$valid)) {
    stop(sprintf("Fixture manifest failed validation before loader test: %s", fixture))
  }

  workspace <- fixture_workspace(parsed)
  readiness <- managed_shiny_loader_readiness(parsed, workspace)

  if (!identical(readiness$status, "ready")) {
    stop(sprintf(
      "Fixture loader did not become ready: %s\n%s",
      fixture,
      paste(readiness$messages, collapse = "\n")
    ))
  }

  if (!managed_shiny_nonempty_string(readiness$loader_key)) {
    stop(sprintf("Ready loader result omitted loader key: %s", fixture))
  }

  if (!managed_shiny_nonempty_string(readiness$bundle_relative_path)) {
    stop(sprintf("Ready loader result omitted bundle relative path: %s", fixture))
  }

  if (!isTRUE(readiness$archive$readable) || readiness$archive$entries_count < 1) {
    stop(sprintf("Ready loader result did not inspect zip entries: %s", fixture))
  }

  ready_count <- ready_count + 1L
}

parsed <- read_managed_shiny_manifest(dirname(fixtures[[1]]), fixtures[[1]])
workspace <- tempfile("managed-shiny-loader-missing-")
dir.create(workspace, recursive = TRUE)
missing <- managed_shiny_loader_readiness(parsed, workspace)
if (!identical(missing$status, "incomplete") || !any(grepl("not present", missing$messages))) {
  stop("Missing result bundle did not return incomplete readiness.")
}

unsafe <- parsed
unsafe$manifest$artifact$materialized_file$present <- TRUE
unsafe$manifest$artifact$materialized_file$relative_path <- "../secret.zip"
unsafe_readiness <- managed_shiny_loader_readiness(unsafe, workspace)
if (!identical(unsafe_readiness$status, "unsupported") || !any(grepl("safe workspace-relative", unsafe_readiness$messages))) {
  stop("Unsafe relative path did not return unsupported readiness.")
}

unsupported <- parsed
unsupported$manifest$artifact$materialized_file$present <- TRUE
unsupported$manifest$artifact$materialized_file$relative_path <- "artifact/bad.exe"
dir.create(file.path(workspace, "artifact"), recursive = TRUE, showWarnings = FALSE)
writeLines("not a supported bundle", file.path(workspace, "artifact", "bad.exe"))
unsupported_readiness <- managed_shiny_loader_readiness(unsupported, workspace)
if (!identical(unsupported_readiness$status, "unsupported") || !any(grepl("extension", unsupported_readiness$messages))) {
  stop("Unsupported extension did not return unsupported readiness.")
}

invalid_zip <- parsed
invalid_zip$manifest$artifact$materialized_file$present <- TRUE
invalid_zip$manifest$artifact$materialized_file$relative_path <- "artifact/invalid.zip"
writeLines("not a zip", file.path(workspace, "artifact", "invalid.zip"))
invalid_zip_readiness <- managed_shiny_loader_readiness(invalid_zip, workspace)
if (!identical(invalid_zip_readiness$status, "incomplete") || !any(grepl("readable zip", invalid_zip_readiness$messages))) {
  stop("Invalid zip did not return incomplete readiness.")
}

unsafe_zip <- parsed
unsafe_zip$manifest$artifact$materialized_file$present <- TRUE
unsafe_zip$manifest$artifact$materialized_file$relative_path <- "artifact/unsafe.zip"
writeLines("unsafe", file.path(workspace, "bad-entry.txt"))
oldwd <- setwd(file.path(workspace, "artifact"))
zip_status <- utils::zip(zipfile = "unsafe.zip", files = "../bad-entry.txt", flags = "-q")
setwd(oldwd)
if (!identical(zip_status, 0L)) {
  stop("Could not create unsafe archive entry fixture.")
}
unsafe_zip_readiness <- managed_shiny_loader_readiness(unsafe_zip, workspace)
if (!identical(unsafe_zip_readiness$status, "unsupported") || !any(grepl("unsafe entry", unsafe_zip_readiness$messages))) {
  stop("Unsafe zip entry did not return unsupported readiness.")
}

message(sprintf("Validated loader readiness for %d managed Shiny fixture manifests.", ready_count))
