source("docker/shiny-ohdsi/manifest.R")

fixture_dir <- "docker/shiny-ohdsi/tests/fixtures"
fixtures <- list.files(fixture_dir, pattern = "-manifest[.]json$", full.names = TRUE)

if (length(fixtures) < 6) {
  stop("Expected at least six managed Shiny fixture manifests.")
}

for (fixture in fixtures) {
  parsed <- read_managed_shiny_manifest(dirname(fixture), fixture)
  if (!isTRUE(parsed$valid)) {
    stop(sprintf("Fixture manifest failed validation: %s\n%s", fixture, paste(parsed$errors, collapse = "\n")))
  }

  if (!managed_shiny_nonempty_string(parsed$manifest$loader$key)) {
    stop(sprintf("Fixture manifest has no loader key: %s", fixture))
  }

  label <- managed_shiny_loader_label(parsed$manifest)
  if (!managed_shiny_nonempty_string(label)) {
    stop(sprintf("Fixture manifest has no loader label: %s", fixture))
  }
}

missing <- read_managed_shiny_manifest(tempdir())
if (isTRUE(missing$valid) || !any(grepl("missing", missing$errors, ignore.case = TRUE))) {
  stop("Missing manifest did not return a safe validation error.")
}

invalid_path <- tempfile(fileext = ".json")
writeLines('{"schema":"parthenon.managed_shiny_manifest","schema_version":"1.0","app":{"key":"bad"},"artifact":{"artifact_type":"results_report"},"loader":{"key":"unsupported_loader"}}', invalid_path)
invalid <- read_managed_shiny_manifest(dirname(invalid_path), invalid_path)
if (isTRUE(invalid$valid) || !any(grepl("Unsupported managed Shiny loader", invalid$errors))) {
  stop("Unsupported loader did not return a safe validation error.")
}

message(sprintf("Validated %d managed Shiny fixture manifests.", length(fixtures)))
