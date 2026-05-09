managed_shiny_supported_loaders <- c(
  "plp_result_bundle",
  "population_estimation_result_bundle",
  "cohort_diagnostics_result_bundle",
  "characterization_result_bundle",
  "phevaluator_result_bundle",
  "ohdsi_report_bundle",
  "managed_shiny_result_bundle"
)

managed_shiny_nonempty_string <- function(value) {
  is.character(value) && length(value) == 1 && !is.na(value) && nzchar(trimws(value))
}

managed_shiny_manifest_path <- function(workspace_path, manifest_path = NULL) {
  if (managed_shiny_nonempty_string(manifest_path)) {
    return(manifest_path)
  }

  if (!managed_shiny_nonempty_string(workspace_path)) {
    return("")
  }

  file.path(workspace_path, "managed-shiny-manifest.json")
}

read_managed_shiny_manifest <- function(workspace_path, manifest_path = NULL) {
  path <- managed_shiny_manifest_path(workspace_path, manifest_path)

  if (!managed_shiny_nonempty_string(path) || !file.exists(path)) {
    return(list(
      valid = FALSE,
      path = path,
      manifest = NULL,
      errors = c("Managed Shiny manifest is missing.")
    ))
  }

  manifest <- tryCatch(
    jsonlite::fromJSON(path, simplifyVector = FALSE),
    error = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_manifest_error")
    }
  )

  if (inherits(manifest, "managed_shiny_manifest_error")) {
    return(list(
      valid = FALSE,
      path = path,
      manifest = NULL,
      errors = c(paste("Managed Shiny manifest could not be parsed:", manifest$message))
    ))
  }

  errors <- character()

  if (!identical(manifest$schema, "parthenon.managed_shiny_manifest")) {
    errors <- c(errors, "Manifest schema is unsupported.")
  }

  if (!identical(manifest$schema_version, "1.0")) {
    errors <- c(errors, "Manifest schema_version is unsupported.")
  }

  if (!managed_shiny_nonempty_string(manifest$app$key)) {
    errors <- c(errors, "Manifest app.key is missing.")
  }

  if (!managed_shiny_nonempty_string(manifest$artifact$artifact_type)) {
    errors <- c(errors, "Manifest artifact.artifact_type is missing.")
  }

  loader_key <- manifest$loader$key
  if (!managed_shiny_nonempty_string(loader_key)) {
    errors <- c(errors, "Manifest loader.key is missing.")
  } else if (!(loader_key %in% managed_shiny_supported_loaders)) {
    errors <- c(errors, paste("Unsupported managed Shiny loader:", loader_key))
  }

  list(
    valid = length(errors) == 0,
    path = path,
    manifest = manifest,
    errors = errors
  )
}

managed_shiny_loader_label <- function(manifest) {
  if (is.null(manifest)) {
    return("Unknown loader")
  }

  label <- manifest$loader$result_family
  if (managed_shiny_nonempty_string(label)) {
    return(label)
  }

  key <- manifest$loader$key
  if (managed_shiny_nonempty_string(key)) {
    return(gsub("_", " ", key))
  }

  "Unknown loader"
}
