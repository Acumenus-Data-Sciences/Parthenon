managed_shiny_loader_registry <- function() {
  list(
    plp_result_bundle = list(
      label = "PatientLevelPrediction result bundle",
      family = "Prediction module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "rdata", "json"),
      expected_result_types = c("PatientLevelPrediction"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultPredictionConfig"
    ),
    population_estimation_result_bundle = list(
      label = "Population-level estimation result bundle",
      family = "Estimator module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "rdata", "json"),
      expected_result_types = c("CohortMethod", "SelfControlledCaseSeries", "EvidenceSynthesis"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultEstimationConfig"
    ),
    cohort_diagnostics_result_bundle = list(
      label = "CohortDiagnostics result bundle",
      family = "Cohort Diagnostic module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "rdata", "json"),
      expected_result_types = c("CohortDiagnostics"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultCohortDiagnosticsConfig"
    ),
    characterization_result_bundle = list(
      label = "Characterization or CohortIncidence result bundle",
      family = "Characterization module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "rdata", "json"),
      expected_result_types = c("Characterization", "CohortIncidence"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultCharacterizationConfig"
    ),
    phevaluator_result_bundle = list(
      label = "PheValuator result bundle",
      family = "PheValuator module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "rdata", "json"),
      expected_result_types = c("PheValuator"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultPhevaluatorConfig"
    ),
    ohdsi_report_bundle = list(
      label = "OHDSI report or sharing bundle",
      family = "Report module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "html", "htm", "json"),
      expected_result_types = c("OhdsiReportGenerator", "OhdsiSharing"),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = "OhdsiShinyAppBuilder::createDefaultReportConfig"
    ),
    managed_shiny_result_bundle = list(
      label = "Managed Shiny result bundle",
      family = "Generic managed result module",
      accepted_extensions = c("zip", "sqlite", "sqlite3", "db", "rds", "rda", "csv", "json", "html", "htm"),
      expected_result_types = character(),
      expected_packages = c("OhdsiShinyModules", "OhdsiShinyAppBuilder"),
      entrypoint = NULL
    )
  )
}

managed_shiny_loader_definition <- function(loader_key) {
  if (!managed_shiny_nonempty_string(loader_key)) {
    return(NULL)
  }

  registry <- managed_shiny_loader_registry()
  registry[[loader_key]]
}

managed_shiny_safe_relative_path <- function(path) {
  if (!managed_shiny_nonempty_string(path)) {
    return(FALSE)
  }

  path <- gsub("\\\\", "/", path)

  if (grepl("^/", path) || grepl("^[A-Za-z]:/", path)) {
    return(FALSE)
  }

  parts <- strsplit(path, "/", fixed = TRUE)[[1]]
  if (length(parts) == 0 || any(parts %in% c("", ".", ".."))) {
    return(FALSE)
  }

  TRUE
}

managed_shiny_workspace_file <- function(workspace_path, relative_path) {
  if (!managed_shiny_nonempty_string(workspace_path) || !managed_shiny_safe_relative_path(relative_path)) {
    return("")
  }

  base <- normalizePath(workspace_path, winslash = "/", mustWork = FALSE)
  path <- normalizePath(file.path(base, relative_path), winslash = "/", mustWork = FALSE)
  prefix <- paste0(sub("/+$", "", base), "/")

  if (!startsWith(path, prefix)) {
    return("")
  }

  path
}

managed_shiny_archive_entries <- function(path) {
  tryCatch(
    {
      entries <- utils::unzip(path, list = TRUE)
      as.character(entries$Name)
    },
    error = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_archive_error")
    },
    warning = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_archive_error")
    }
  )
}

managed_shiny_safe_archive_entry <- function(path) {
  path <- sub("/+$", "", gsub("\\\\", "/", path))

  managed_shiny_safe_relative_path(path)
}

managed_shiny_loader_package_status <- function(packages) {
  packages <- unique(as.character(packages))
  packages <- packages[nzchar(packages)]

  lapply(packages, function(pkg) {
    installed <- suppressWarnings(suppressPackageStartupMessages(requireNamespace(pkg, quietly = TRUE)))
    list(
      package = pkg,
      installed = installed,
      version = if (installed) as.character(utils::packageVersion(pkg)) else NULL
    )
  })
}

managed_shiny_readiness_result <- function(
  status,
  loader_key = "",
  definition = NULL,
  messages = character(),
  bundle_relative_path = "",
  bundle_absolute_path = "",
  extension = "",
  archive_entries = character(),
  package_status = list()
) {
  status_labels <- c(
    ready = "Ready",
    incomplete = "Incomplete bundle",
    unsupported = "Unsupported bundle"
  )

  list(
    status = status,
    status_label = unname(status_labels[[status]] %||% status),
    loader_key = loader_key,
    loader_label = if (!is.null(definition)) definition$label else "Unknown loader",
    family = if (!is.null(definition)) definition$family else "",
    entrypoint = if (!is.null(definition)) definition$entrypoint else NULL,
    expected_result_types = if (!is.null(definition)) definition$expected_result_types else character(),
    expected_packages = if (!is.null(definition)) definition$expected_packages else character(),
    accepted_extensions = if (!is.null(definition)) definition$accepted_extensions else character(),
    messages = messages,
    bundle_relative_path = bundle_relative_path,
    bundle_absolute_path = bundle_absolute_path,
    extension = extension,
    archive = list(
      readable = length(archive_entries) > 0,
      entries_count = length(archive_entries),
      entries_preview = utils::head(archive_entries, 12)
    ),
    package_status = package_status
  )
}

managed_shiny_loader_readiness <- function(parsed_manifest, workspace_path = NULL, check_packages = FALSE) {
  if (is.null(parsed_manifest) || !isTRUE(parsed_manifest$valid)) {
    return(managed_shiny_readiness_result(
      status = "unsupported",
      messages = parsed_manifest$errors %||% c("Managed Shiny manifest is invalid.")
    ))
  }

  manifest <- parsed_manifest$manifest
  loader_key <- manifest$loader$key
  definition <- managed_shiny_loader_definition(loader_key)

  if (is.null(definition)) {
    return(managed_shiny_readiness_result(
      status = "unsupported",
      loader_key = loader_key,
      messages = c(paste("No managed Shiny loader is registered for", loader_key))
    ))
  }

  materialized <- manifest$artifact$materialized_file
  if (!isTRUE(materialized$present)) {
    return(managed_shiny_readiness_result(
      status = "incomplete",
      loader_key = loader_key,
      definition = definition,
      messages = c("The artifact did not materialize a local result bundle.")
    ))
  }

  relative_path <- materialized$relative_path
  if (!managed_shiny_safe_relative_path(relative_path)) {
    return(managed_shiny_readiness_result(
      status = "unsupported",
      loader_key = loader_key,
      definition = definition,
      messages = c("The result bundle path in the manifest is not a safe workspace-relative path.")
    ))
  }

  if (!managed_shiny_nonempty_string(workspace_path)) {
    workspace_path <- dirname(parsed_manifest$path)
  }

  bundle_path <- managed_shiny_workspace_file(workspace_path, relative_path)
  if (!managed_shiny_nonempty_string(bundle_path)) {
    return(managed_shiny_readiness_result(
      status = "unsupported",
      loader_key = loader_key,
      definition = definition,
      bundle_relative_path = relative_path,
      messages = c("The result bundle path could not be resolved inside the launch workspace.")
    ))
  }

  if (!file.exists(bundle_path) || dir.exists(bundle_path)) {
    return(managed_shiny_readiness_result(
      status = "incomplete",
      loader_key = loader_key,
      definition = definition,
      bundle_relative_path = relative_path,
      bundle_absolute_path = bundle_path,
      messages = c("The manifest references a result bundle that is not present in the launch workspace.")
    ))
  }

  extension <- tolower(tools::file_ext(bundle_path))
  if (!extension %in% definition$accepted_extensions) {
    return(managed_shiny_readiness_result(
      status = "unsupported",
      loader_key = loader_key,
      definition = definition,
      bundle_relative_path = relative_path,
      bundle_absolute_path = bundle_path,
      extension = extension,
      messages = c(paste("The result bundle extension is not supported for this loader:", extension))
    ))
  }

  archive_entries <- character()
  if (identical(extension, "zip")) {
    archive_entries <- managed_shiny_archive_entries(bundle_path)

    if (inherits(archive_entries, "managed_shiny_archive_error")) {
      return(managed_shiny_readiness_result(
        status = "incomplete",
        loader_key = loader_key,
        definition = definition,
        bundle_relative_path = relative_path,
        bundle_absolute_path = bundle_path,
        extension = extension,
        messages = c("The result bundle is not a readable zip archive.")
      ))
    }

    unsafe_entries <- archive_entries[!vapply(archive_entries, managed_shiny_safe_archive_entry, logical(1))]
    if (length(unsafe_entries) > 0) {
      return(managed_shiny_readiness_result(
        status = "unsupported",
        loader_key = loader_key,
        definition = definition,
        bundle_relative_path = relative_path,
        bundle_absolute_path = bundle_path,
        extension = extension,
        archive_entries = archive_entries,
        messages = c("The result bundle zip archive contains unsafe entry paths.")
      ))
    }
  }

  package_status <- if (isTRUE(check_packages)) {
    managed_shiny_loader_package_status(definition$expected_packages)
  } else {
    list()
  }

  missing_packages <- vapply(package_status, function(pkg) !isTRUE(pkg$installed), logical(1))
  if (length(missing_packages) > 0 && any(missing_packages)) {
    return(managed_shiny_readiness_result(
      status = "incomplete",
      loader_key = loader_key,
      definition = definition,
      bundle_relative_path = relative_path,
      bundle_absolute_path = bundle_path,
      extension = extension,
      archive_entries = archive_entries,
      package_status = package_status,
      messages = c("The result bundle is present, but one or more expected OHDSI runtime packages are missing.")
    ))
  }

  managed_shiny_readiness_result(
    status = "ready",
    loader_key = loader_key,
    definition = definition,
    bundle_relative_path = relative_path,
    bundle_absolute_path = bundle_path,
    extension = extension,
    archive_entries = archive_entries,
    package_status = package_status,
    messages = c("The result bundle is present and matches the registered loader contract.")
  )
}

`%||%` <- function(left, right) {
  if (is.null(left) || length(left) == 0) {
    return(right)
  }

  left
}
