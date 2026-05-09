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

managed_shiny_detect_convertible_entry <- function(entries) {
  entries <- entries[vapply(entries, managed_shiny_safe_archive_entry, logical(1))]
  candidates <- entries[grepl("[.](rds|rda|rdata|json)$", entries, ignore.case = TRUE)]

  if (length(candidates) == 0) {
    return("")
  }

  candidates[[1]]
}

managed_shiny_sql_identifier <- function(value) {
  value <- as.character(value)
  if (!grepl("^[A-Za-z][A-Za-z0-9_]*$", value)) {
    stop(sprintf("Unsafe SQLite identifier: %s", value))
  }

  sprintf("\"%s\"", gsub("\"", "\"\"", value, fixed = TRUE))
}

managed_shiny_sql_literal <- function(value) {
  if (length(value) == 0 || is.na(value)) {
    return("NULL")
  }

  if (inherits(value, "POSIXt")) {
    return(sprintf("'%s'", gsub("'", "''", format(value, usetz = TRUE), fixed = TRUE)))
  }

  if (inherits(value, "Date")) {
    return(sprintf("'%s'", gsub("'", "''", as.character(value), fixed = TRUE)))
  }

  if (is.logical(value)) {
    return(if (isTRUE(value)) "1" else "0")
  }

  if (is.numeric(value)) {
    return(if (is.finite(value)) as.character(value) else "NULL")
  }

  sprintf("'%s'", gsub("'", "''", as.character(value), fixed = TRUE))
}

managed_shiny_sqlite_column_type <- function(values) {
  if (is.logical(values)) {
    return("INTEGER")
  }

  if (is.integer(values)) {
    return("INTEGER")
  }

  if (is.numeric(values)) {
    return("REAL")
  }

  "TEXT"
}

managed_shiny_table_like <- function(value) {
  is.data.frame(value) || (is.list(value) && length(value) > 0 && all(vapply(value, is.atomic, logical(1))))
}

managed_shiny_coerce_table <- function(value) {
  if (is.data.frame(value)) {
    return(as.data.frame(value, stringsAsFactors = FALSE))
  }

  if (managed_shiny_table_like(value)) {
    return(as.data.frame(value, stringsAsFactors = FALSE, optional = TRUE))
  }

  NULL
}

managed_shiny_collect_result_tables <- function(value, prefix = "") {
  tables <- list()

  if (!is.list(value)) {
    return(tables)
  }

  for (name in names(value) %||% character()) {
    if (!grepl("^[A-Za-z][A-Za-z0-9_]*$", name)) {
      next
    }

    item <- value[[name]]
    table <- managed_shiny_coerce_table(item)
    if (!is.null(table)) {
      tables[[name]] <- table
      next
    }

    if (is.list(item)) {
      nested <- managed_shiny_collect_result_tables(item, name)
      if (length(nested) > 0) {
        tables <- c(tables, nested)
      }
    }
  }

  tables
}

managed_shiny_read_result_table_bundle <- function(path) {
  extension <- tolower(tools::file_ext(path))

  if (identical(extension, "rds")) {
    return(managed_shiny_collect_result_tables(readRDS(path)))
  }

  if (extension %in% c("rda", "rdata")) {
    env <- new.env(parent = emptyenv())
    loaded <- load(path, envir = env)
    objects <- mget(loaded, envir = env, inherits = FALSE)
    names(objects) <- loaded

    return(managed_shiny_collect_result_tables(objects))
  }

  if (identical(extension, "json")) {
    if (!requireNamespace("jsonlite", quietly = TRUE)) {
      stop("jsonlite is required to convert JSON result bundles into SQLite result databases.")
    }

    return(managed_shiny_collect_result_tables(jsonlite::fromJSON(path, simplifyDataFrame = TRUE)))
  }

  list()
}

managed_shiny_write_sqlite_with_cli <- function(tables, database_path) {
  sqlite <- Sys.which("sqlite3")
  if (!nzchar(sqlite)) {
    stop("RSQLite or sqlite3 is required to convert tabular result bundles into SQLite result databases.")
  }

  statements <- c("PRAGMA journal_mode=OFF;", "PRAGMA synchronous=OFF;", "BEGIN;")

  for (table_name in names(tables)) {
    table <- as.data.frame(tables[[table_name]], stringsAsFactors = FALSE)
    if (ncol(table) == 0) {
      next
    }

    column_names <- names(table)
    if (is.null(column_names) || any(!grepl("^[A-Za-z][A-Za-z0-9_]*$", column_names))) {
      next
    }

    columns <- sprintf(
      "%s %s",
      vapply(column_names, managed_shiny_sql_identifier, character(1)),
      vapply(table, managed_shiny_sqlite_column_type, character(1))
    )
    statements <- c(
      statements,
      sprintf("DROP TABLE IF EXISTS %s;", managed_shiny_sql_identifier(table_name)),
      sprintf("CREATE TABLE %s (%s);", managed_shiny_sql_identifier(table_name), paste(columns, collapse = ", "))
    )

    if (nrow(table) > 0) {
      column_sql <- paste(vapply(column_names, managed_shiny_sql_identifier, character(1)), collapse = ", ")
      for (row_idx in seq_len(nrow(table))) {
        row_values <- lapply(column_names, function(column_name) table[[column_name]][row_idx])
        values <- vapply(row_values, managed_shiny_sql_literal, character(1))
        statements <- c(
          statements,
          sprintf(
            "INSERT INTO %s (%s) VALUES (%s);",
            managed_shiny_sql_identifier(table_name),
            column_sql,
            paste(values, collapse = ", ")
          )
        )
      }
    }
  }

  statements <- c(statements, "COMMIT;")
  status <- system2(sqlite, args = database_path, input = statements, stdout = FALSE, stderr = FALSE)
  if (!identical(status, 0L)) {
    stop("sqlite3 failed while writing the converted result database.")
  }

  invisible(database_path)
}

managed_shiny_write_sqlite_result_database <- function(tables, database_path) {
  tables <- tables[names(tables) != ""]
  tables <- tables[vapply(tables, function(table) ncol(as.data.frame(table)) > 0, logical(1))]

  if (length(tables) == 0) {
    stop("No named tabular result objects were found for SQLite conversion.")
  }

  if (file.exists(database_path)) {
    unlink(database_path)
  }

  if (requireNamespace("RSQLite", quietly = TRUE) && requireNamespace("DBI", quietly = TRUE)) {
    con <- DBI::dbConnect(RSQLite::SQLite(), database_path)
    on.exit(DBI::dbDisconnect(con), add = TRUE)

    for (table_name in names(tables)) {
      if (!grepl("^[A-Za-z][A-Za-z0-9_]*$", table_name)) {
        next
      }

      DBI::dbWriteTable(con, table_name, as.data.frame(tables[[table_name]], stringsAsFactors = FALSE), overwrite = TRUE)
    }

    return(invisible(database_path))
  }

  managed_shiny_write_sqlite_with_cli(tables, database_path)
}

managed_shiny_convert_table_bundle_to_sqlite <- function(source_path, extract_root) {
  result <- tryCatch(
    {
      tables <- managed_shiny_read_result_table_bundle(source_path)
      database_path <- file.path(extract_root, "converted-result.sqlite")
      managed_shiny_write_sqlite_result_database(tables, database_path)

      list(
        path = normalizePath(database_path, winslash = "/", mustWork = FALSE),
        relative_path = basename(database_path),
        extract_directory = extract_root,
        conversion = list(
          source_extension = tolower(tools::file_ext(source_path)),
          source_file = basename(source_path),
          table_count = length(tables),
          tables_preview = utils::head(names(tables), 12)
        )
      )
    },
    error = function(err) {
      list(
        path = "",
        relative_path = "",
        extract_directory = extract_root,
        conversion_error = conditionMessage(err)
      )
    }
  )

  result
}

managed_shiny_convert_result_bundle_to_sqlite <- function(readiness, extract_root = NULL) {
  if (!managed_shiny_nonempty_string(extract_root)) {
    extract_root <- tempfile("managed-shiny-official-viewer-convert-")
  }
  dir.create(extract_root, recursive = TRUE, showWarnings = FALSE)

  if (readiness$extension %in% c("rds", "rda", "rdata", "json")) {
    return(managed_shiny_convert_table_bundle_to_sqlite(readiness$bundle_absolute_path, extract_root))
  }

  if (!identical(readiness$extension, "zip")) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  entry <- managed_shiny_detect_convertible_entry(readiness$archive$entries_preview)
  if (!managed_shiny_nonempty_string(entry)) {
    entry <- managed_shiny_detect_convertible_entry(managed_shiny_archive_entries(readiness$bundle_absolute_path))
  }

  if (!managed_shiny_nonempty_string(entry)) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  extracted <- tryCatch(
    utils::unzip(readiness$bundle_absolute_path, files = entry, exdir = extract_root, unzip = "internal"),
    error = function(err) {
      structure(list(message = conditionMessage(err)), class = "managed_shiny_handoff_error")
    }
  )

  if (inherits(extracted, "managed_shiny_handoff_error")) {
    return(list(path = "", relative_path = "", extract_directory = extract_root, conversion_error = extracted$message))
  }

  source_path <- file.path(extract_root, entry)
  if (!file.exists(source_path) || dir.exists(source_path) || nzchar(Sys.readlink(source_path))) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  extract_base <- normalizePath(extract_root, winslash = "/", mustWork = FALSE)
  source_abs <- normalizePath(source_path, winslash = "/", mustWork = FALSE)
  if (!startsWith(source_abs, paste0(sub("/+$", "", extract_base), "/"))) {
    return(list(path = "", relative_path = "", extract_directory = extract_root))
  }

  managed_shiny_convert_table_bundle_to_sqlite(source_abs, extract_root)
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
    return(managed_shiny_convert_result_bundle_to_sqlite(readiness, extract_root))
  }

  sqlite_entry <- managed_shiny_detect_sqlite_entry(readiness$archive$entries_preview)
  if (!managed_shiny_nonempty_string(sqlite_entry)) {
    sqlite_entry <- managed_shiny_detect_sqlite_entry(managed_shiny_archive_entries(readiness$bundle_absolute_path))
  }

  if (!managed_shiny_nonempty_string(sqlite_entry)) {
    return(managed_shiny_convert_result_bundle_to_sqlite(readiness, extract_root))
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
  if (requireNamespace("RSQLite", quietly = TRUE) && requireNamespace("DBI", quietly = TRUE)) {
    con <- DBI::dbConnect(RSQLite::SQLite(), database_path)
    on.exit(DBI::dbDisconnect(con), add = TRUE)

    return(tolower(DBI::dbListTables(con)))
  }

  sqlite <- Sys.which("sqlite3")
  if (!nzchar(sqlite)) {
    stop("RSQLite or sqlite3 is required to inspect SQLite result database schemas.")
  }

  query <- "SELECT lower(name) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  output <- system2(sqlite, args = database_path, input = query, stdout = TRUE, stderr = TRUE)
  output <- output[nzchar(output)]

  tolower(output)
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
    conversion_message <- if (readiness$extension %in% c("rds", "rda", "rdata")) {
      "RDS/RData result bundles must contain named tabular OHDSI result tables so Parthenon can convert them into a SQLite result database before official Shiny module handoff."
    } else if (readiness$extension %in% c("html", "htm", "json")) {
      "JSON sharing bundles must contain named tabular OHDSI result tables for SQLite conversion; HTML bundles are managed artifacts only and cannot drive official module rendering without a separate result database."
    } else {
      "The ready bundle does not expose a SQLite result database for the official OHDSI module handoff."
    }
    if (managed_shiny_nonempty_string(database$conversion_error %||% "")) {
      conversion_message <- paste(conversion_message, database$conversion_error)
    }

    return(managed_shiny_official_viewer_result(
      status = "incomplete",
      definition = definition,
      packages = package_status,
      extract_directory = database$extract_directory %||% "",
      messages = c(conversion_message)
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

  ready_messages <- c("A SQLite result database is ready for the official OHDSI Shiny module handoff.")
  if (is.list(database$conversion)) {
    ready_messages <- c(
      ready_messages,
      sprintf(
        "Converted %s result bundle into SQLite with %d table(s).",
        database$conversion$source_extension %||% "tabular",
        as.integer(database$conversion$table_count %||% 0L)
      )
    )
  }

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
    messages = ready_messages
  )
}
