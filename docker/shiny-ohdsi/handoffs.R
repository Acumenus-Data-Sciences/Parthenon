managed_shiny_official_viewer_registry <- function() {
  list(
    plp_result_bundle = list(
      module_id = "prediction",
      ui_function = "patientLevelPredictionViewer",
      server_function = "patientLevelPredictionServer",
      config_function = "createDefaultPredictionConfig",
      result_settings = list(plpTablePrefix = "plp_"),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "PatientLevelPrediction result database",
          all_of = c("plp_model_designs", "plp_performances")
        ),
        list(
          name = "PatientLevelPrediction diagnostics database",
          all_of = c("plp_model_designs", "plp_diagnostics")
        )
      )
    ),
    population_estimation_result_bundle = list(
      module_id = "estimation",
      ui_function = "estimationViewer",
      server_function = "estimationServer",
      config_function = "createDefaultEstimationConfig",
      result_settings = list(cmTablePrefix = "cm_", sccsTablePrefix = "sccs_", esTablePrefix = "es_"),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "CohortMethod result database",
          all_of = c("cm_analysis", "cm_result")
        ),
        list(
          name = "SelfControlledCaseSeries result database",
          all_of = c("sccs_analysis", "sccs_result")
        ),
        list(
          name = "EvidenceSynthesis CohortMethod result database",
          all_of = c("es_analysis", "es_cm_result")
        ),
        list(
          name = "EvidenceSynthesis SCCS result database",
          all_of = c("es_analysis", "es_sccs_result")
        )
      )
    ),
    cohort_diagnostics_result_bundle = list(
      module_id = "cohortDiagnostics",
      ui_function = "cohortDiagnosticsView",
      server_function = "cohortDiagnosticsServer",
      config_function = "createDefaultCohortDiagnosticsConfig",
      result_settings = list(cdTablePrefix = "cd_"),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "CohortDiagnostics result database",
          all_of = c("cd_cohort", "cd_cohort_count")
        )
      )
    ),
    characterization_result_bundle = list(
      module_id = "characterization",
      ui_function = "characterizationViewer",
      server_function = "characterizationServer",
      config_function = "createDefaultCharacterizationConfig",
      result_settings = list(cTablePrefix = "c_", incidenceTablePrefix = "ci_"),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "Characterization time-to-event result database",
          all_of = c("c_time_to_event_targets", "c_time_to_event")
        ),
        list(
          name = "Characterization feature result database",
          all_of = c("c_covariate_ref", "c_covariate_value")
        ),
        list(
          name = "CohortIncidence result database",
          all_of = c("ci_incidence_rate")
        )
      )
    ),
    phevaluator_result_bundle = list(
      module_id = "phevaluator",
      ui_function = "phevaluatorViewer",
      server_function = "phevaluatorServer",
      config_function = "createDefaultPhevaluatorConfig",
      result_settings = list(pvTablePrefix = "pv_"),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "PheValuator result database",
          all_of = c("pv_algorithm_performance_results", "pv_diagnostics")
        ),
        list(
          name = "PheValuator model result database",
          all_of = c("pv_model_performance", "pv_model_input_parameters")
        )
      )
    ),
    ohdsi_report_bundle = list(
      module_id = "report",
      ui_function = "reportViewer",
      server_function = "reportServer",
      config_function = "createDefaultReportConfig",
      result_settings = list(),
      required_tables = c("database_meta_data"),
      schema_variants = list(
        list(
          name = "OHDSI report PLP result database",
          all_of = c("plp_model_designs", "plp_performances")
        ),
        list(
          name = "OHDSI report CohortMethod result database",
          all_of = c("cm_analysis", "cm_result")
        ),
        list(
          name = "OHDSI report CohortDiagnostics result database",
          all_of = c("cd_cohort", "cd_cohort_count")
        ),
        list(
          name = "OHDSI report Characterization result database",
          all_of = c("c_time_to_event_targets", "c_time_to_event")
        ),
        list(
          name = "OHDSI report PheValuator result database",
          all_of = c("pv_algorithm_performance_results", "pv_diagnostics")
        )
      )
    )
  )
}

managed_shiny_official_viewer_definition <- function(loader_key) {
  if (!managed_shiny_nonempty_string(loader_key)) {
    return(NULL)
  }

  registry <- managed_shiny_official_viewer_registry()
  registry[[loader_key]]
}

managed_shiny_official_viewer_packages <- function() {
  c(
    "OhdsiShinyModules",
    "OhdsiShinyAppBuilder",
    "OhdsiReportGenerator",
    "DatabaseConnector",
    "ResultModelManager",
    "RSQLite",
    "DBI"
  )
}

managed_shiny_official_viewer_result <- function(
  status,
  messages,
  definition = NULL,
  database_path = "",
  database_relative_path = "",
  extract_directory = "",
  connection_details = NULL,
  result_database_settings = NULL,
  packages = list(),
  schema = list()
) {
  status_labels <- c(
    ready = "Official OHDSI viewer ready",
    incomplete = "Official OHDSI viewer waiting for result database",
    blocked = "Official OHDSI viewer blocked",
    unsupported = "Official OHDSI viewer unsupported"
  )

  list(
    status = status,
    status_label = unname(status_labels[[status]] %||% status),
    messages = messages,
    module_id = if (!is.null(definition)) definition$module_id else "",
    ui_function = if (!is.null(definition)) definition$ui_function else "",
    server_function = if (!is.null(definition)) definition$server_function else "",
    config_function = if (!is.null(definition)) definition$config_function else "",
    database_path = database_path,
    database_relative_path = database_relative_path,
    extract_directory = extract_directory,
    connection_details = connection_details,
    result_database_settings = result_database_settings,
    packages = packages,
    schema = schema
  )
}

managed_shiny_official_viewer_package_status <- function() {
  managed_shiny_loader_package_status(managed_shiny_official_viewer_packages())
}

managed_shiny_official_viewer_missing_packages <- function(package_status) {
  vapply(package_status, function(pkg) !isTRUE(pkg$installed), logical(1))
}

managed_shiny_detect_sqlite_entry <- function(entries) {
  entries <- entries[vapply(entries, managed_shiny_safe_archive_entry, logical(1))]
  candidates <- entries[grepl("[.](sqlite|sqlite3|db)$", entries, ignore.case = TRUE)]

  if (length(candidates) == 0) {
    return("")
  }

  candidates[[1]]
}

managed_shiny_extract_result_database <- function(readiness, extract_root = NULL) {
  if (readiness$extension %in% c("sqlite", "sqlite3", "db")) {
    if (nzchar(Sys.readlink(readiness$bundle_absolute_path))) {
      return(list(path = "", relative_path = "", extract_directory = ""))
    }

    return(list(
      path = readiness$bundle_absolute_path,
      relative_path = readiness$bundle_relative_path,
      extract_directory = ""
    ))
  }

  if (!identical(readiness$extension, "zip")) {
    return(list(path = "", relative_path = "", extract_directory = ""))
  }

  sqlite_entry <- managed_shiny_detect_sqlite_entry(readiness$archive$entries_preview)
  if (!managed_shiny_nonempty_string(sqlite_entry)) {
    sqlite_entry <- managed_shiny_detect_sqlite_entry(managed_shiny_archive_entries(readiness$bundle_absolute_path))
  }

  if (!managed_shiny_nonempty_string(sqlite_entry)) {
    return(list(path = "", relative_path = "", extract_directory = ""))
  }

  if (!managed_shiny_nonempty_string(extract_root)) {
    extract_root <- tempfile("managed-shiny-official-viewer-")
  }
  dir.create(extract_root, recursive = TRUE, showWarnings = FALSE)

  tryCatch(
    utils::unzip(readiness$bundle_absolute_path, files = sqlite_entry, exdir = extract_root, unzip = "internal"),
    error = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_handoff_error")
    }
  ) -> extracted

  if (inherits(extracted, "managed_shiny_handoff_error")) {
    return(list(path = "", relative_path = "", extract_directory = extract_root, error = extracted$message))
  }

  database_path <- file.path(extract_root, sqlite_entry)
  if (!file.exists(database_path) || dir.exists(database_path) || nzchar(Sys.readlink(database_path))) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  extract_base <- normalizePath(extract_root, winslash = "/", mustWork = FALSE)
  database_abs <- normalizePath(database_path, winslash = "/", mustWork = FALSE)
  if (!startsWith(database_abs, paste0(sub("/+$", "", extract_base), "/"))) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  list(
    path = database_abs,
    relative_path = sqlite_entry,
    extract_directory = extract_root
  )
}

managed_shiny_create_result_database_settings <- function(definition) {
  args <- c(list(schema = "main", vocabularyDatabaseSchema = "main"), definition$result_settings)
  do.call(OhdsiShinyAppBuilder::createDefaultResultDatabaseSettings, args)
}

managed_shiny_result_database_tables <- function(database_path) {
  con <- DBI::dbConnect(RSQLite::SQLite(), database_path)
  on.exit(DBI::dbDisconnect(con), add = TRUE)

  tolower(DBI::dbListTables(con))
}

managed_shiny_variant_matches <- function(tables, variant) {
  required <- tolower(variant$all_of %||% character())
  length(required) > 0 && all(required %in% tables)
}

managed_shiny_schema_variant_names <- function(variants) {
  vapply(variants, function(variant) variant$name %||% "unnamed variant", character(1))
}

managed_shiny_validate_result_database_schema <- function(database_path, definition) {
  tables <- tryCatch(
    managed_shiny_result_database_tables(database_path),
    error = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_schema_error")
    }
  )

  if (inherits(tables, "managed_shiny_schema_error")) {
    return(list(
      valid = FALSE,
      messages = c("The SQLite result database could not be inspected."),
      table_count = 0L,
      tables_preview = character()
    ))
  }

  required_tables <- definition$required_tables %||% character()
  missing_tables <- setdiff(tolower(required_tables), tables)
  if (length(missing_tables) > 0) {
    return(list(
      valid = FALSE,
      messages = c(paste("The SQLite result database is missing required tables:", paste(missing_tables, collapse = ", "))),
      table_count = length(tables),
      tables_preview = utils::head(tables, 12)
    ))
  }

  schema_variants <- definition$schema_variants %||% list()
  if (length(schema_variants) > 0) {
    variant_matches <- vapply(schema_variants, function(variant) {
      managed_shiny_variant_matches(tables, variant)
    }, logical(1))

    if (!any(variant_matches)) {
      expected <- managed_shiny_schema_variant_names(schema_variants)
      return(list(
        valid = FALSE,
        messages = c(paste("The SQLite result database does not match any expected result schema variant:", paste(expected, collapse = "; "))),
        table_count = length(tables),
        tables_preview = utils::head(tables, 12),
        matched_variant = ""
      ))
    }

    matched_variant <- schema_variants[[which(variant_matches)[[1]]]]$name
  } else if (length(tables) == 0) {
    return(list(
      valid = FALSE,
      messages = c("The SQLite result database does not contain any tables."),
      table_count = 0L,
      tables_preview = character(),
      matched_variant = ""
    ))
  } else {
    matched_variant <- "generic SQLite result database"
  }

  list(
    valid = TRUE,
    messages = c("The SQLite result database matches the registered schema guard."),
    table_count = length(tables),
    tables_preview = utils::head(tables, 12),
    matched_variant = matched_variant
  )
}

managed_shiny_prepare_official_viewer_handoff <- function(readiness, extract_root = NULL) {
  if (is.null(readiness) || !identical(readiness$status, "ready")) {
    return(managed_shiny_official_viewer_result(
      status = "blocked",
      messages = c("The official OHDSI viewer handoff requires a ready managed result bundle.")
    ))
  }

  definition <- managed_shiny_official_viewer_definition(readiness$loader_key)
  if (is.null(definition)) {
    return(managed_shiny_official_viewer_result(
      status = "unsupported",
      messages = c("No official OHDSI viewer handoff is registered for this loader.")
    ))
  }

  package_status <- managed_shiny_official_viewer_package_status()
  missing_packages <- managed_shiny_official_viewer_missing_packages(package_status)
  if (length(missing_packages) > 0 && any(missing_packages)) {
    missing <- vapply(package_status[missing_packages], function(pkg) pkg$package, character(1))
    return(managed_shiny_official_viewer_result(
      status = "blocked",
      definition = definition,
      packages = package_status,
      messages = c(paste("Missing OHDSI viewer runtime packages:", paste(missing, collapse = ", ")))
    ))
  }

  database <- managed_shiny_extract_result_database(readiness, extract_root)
  if (!managed_shiny_nonempty_string(database$path)) {
    return(managed_shiny_official_viewer_result(
      status = "incomplete",
      definition = definition,
      packages = package_status,
      extract_directory = database$extract_directory %||% "",
      messages = c("The ready bundle does not expose a SQLite result database for the official OHDSI module handoff.")
    ))
  }

  schema <- managed_shiny_validate_result_database_schema(database$path, definition)
  if (!isTRUE(schema$valid)) {
    return(managed_shiny_official_viewer_result(
      status = "incomplete",
      definition = definition,
      packages = package_status,
      database_path = database$path,
      database_relative_path = database$relative_path,
      extract_directory = database$extract_directory,
      schema = schema,
      messages = schema$messages
    ))
  }

  connection_details <- DatabaseConnector::createConnectionDetails(
    dbms = "sqlite",
    server = database$path
  )

  managed_shiny_official_viewer_result(
    status = "ready",
    definition = definition,
    packages = package_status,
    database_path = database$path,
    database_relative_path = database$relative_path,
    extract_directory = database$extract_directory,
    connection_details = connection_details,
    result_database_settings = managed_shiny_create_result_database_settings(definition),
    schema = schema,
    messages = c("A SQLite result database is ready for the official OHDSI Shiny module handoff.")
  )
}
