# ──────────────────────────────────────────────────────────────────
# ETL-Synthea — Synthea CSV → OMOP CDM converter
# GET  /etl/synthea/status   — package availability + version info
# POST /etl/synthea/generate — run full ETL pipeline from Synthea CSVs
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/progress.R")

# ── Helpers ──────────────────────────────────────────────────────────────────

#' Build a DBI connection from HADES connectionDetails for ETLSyntheaBuilder.
#' ETLSyntheaBuilder uses DBI/odbc-style connections rather than
#' DatabaseConnector JDBC connections directly.
.etl_dbi_connection <- function(connectionDetails) {
  DatabaseConnector::connect(connectionDetails)
}

#' Count rows in a schema's tables and return a named list.
#' Silently returns 0 for any table that does not exist yet.
.count_cdm_tables <- function(connection, cdm_schema, tables) {
  counts <- list()
  for (tbl in tables) {
    counts[[tbl]] <- tryCatch({
      sql <- sprintf("SELECT COUNT(*) AS n FROM %s.%s", cdm_schema, tbl)
      result <- DatabaseConnector::querySql(connection, sql)
      as.integer(result$N[1])
    }, error = function(e) 0L)
  }
  counts
}

# Core CDM event tables populated by ETL-Synthea
CDM_EVENT_TABLES <- c(
  "person", "observation_period", "visit_occurrence", "condition_occurrence",
  "drug_exposure", "procedure_occurrence", "measurement", "observation",
  "device_exposure", "death"
)

# ── GET /status ───────────────────────────────────────────────────────────────

#* Return ETL-Synthea package availability and version info
#* @get /etl/synthea/status
#* @serializer unboxedJSON
function() {
  pkg_available <- requireNamespace("ETLSyntheaBuilder", quietly = TRUE)

  pkg_version <- tryCatch({
    if (pkg_available) {
      as.character(utils::packageVersion("ETLSyntheaBuilder"))
    } else {
      NA_character_
    }
  }, error = function(e) NA_character_)

  list(
    status            = if (pkg_available) "available" else "unavailable",
    package           = "ETLSyntheaBuilder",
    version           = pkg_version,
    github_source     = "OHDSI/ETL-Synthea@v2.1.0",
    supported_cdm_versions    = c("5.3", "5.4"),
    supported_synthea_versions = c("2.7.0", "3.0.0", "3.1.0", "3.2.0", "3.3.0"),
    capabilities = list(
      create_cdm_tables    = TRUE,
      create_synthea_tables = TRUE,
      load_synthea_csv     = TRUE,
      load_event_tables    = TRUE,
      load_vocabulary      = FALSE   # vocab load requires separate vocab files
    )
  )
}

# ── POST /generate ────────────────────────────────────────────────────────────

#* Convert Synthea CSV output to OMOP CDM via ETL-Synthea
#*
#* @param body  Parsed request body. Fields:
#*   connection         object  — Source connection spec (dialect, server, user, password, etc.)
#*   cdm_database_schema string  — Target schema for OMOP CDM tables (default: "cdm")
#*   cdm_version        string  — CDM version: "5.3" or "5.4" (default: "5.4")
#*   synthea_version    string  — Synthea output version (default: "3.3.0")
#*   synthea_schema     string  — Staging schema for raw Synthea tables (default: "synthea_native")
#*   synthea_csv_folder  string  — Absolute path to folder containing Synthea CSV files
#*   vocab_schema       string  — Schema containing OMOP vocabulary tables (optional)
#*   patient_count      integer — Expected patient count (informational, default: 0)
#*   skip_cdm_create    boolean — Skip CREATE CDM tables step if tables already exist (default: false)
#*   skip_synthea_create boolean — Skip CREATE Synthea staging tables step (default: false)
#* @post /etl/synthea/generate
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # ── Input validation ──────────────────────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  if (!requireNamespace("ETLSyntheaBuilder", quietly = TRUE)) {
    response$status <- 503L
    return(list(
      status  = "error",
      message = "ETLSyntheaBuilder package is not installed. Rebuild the R runtime Docker image."
    ))
  }

  # Require at minimum a connection spec
  if (is.null(spec$connection) && is.null(spec$source)) {
    response$status <- 400L
    return(list(status = "error", message = "Missing required field: connection (or source)"))
  }

  # Synthea CSV folder must be provided and must exist
  synthea_csv_folder <- spec$synthea_csv_folder %||% spec$syntheaCsvFolder %||% NULL
  if (is.null(synthea_csv_folder) || !nzchar(synthea_csv_folder)) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = paste(
        "Missing required field: synthea_csv_folder.",
        "Provide the absolute path to a directory containing Synthea-generated CSV files.",
        "Generate them with: java -jar synthea-with-dependencies.jar -p <patient_count>"
      )
    ))
  }
  if (!dir.exists(synthea_csv_folder)) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = sprintf("synthea_csv_folder does not exist: %s", synthea_csv_folder)
    ))
  }

  # Resolve parameters with sensible defaults
  source_spec       <- spec$connection %||% spec$source
  cdm_schema        <- spec$cdm_database_schema %||% spec$cdmDatabaseSchema %||% "cdm"
  cdm_version       <- spec$cdm_version         %||% spec$cdmVersion         %||% "5.4"
  synthea_version   <- spec$synthea_version      %||% spec$syntheaVersion      %||% "3.3.0"
  synthea_schema    <- spec$synthea_schema       %||% spec$syntheaSchema       %||% "synthea_native"
  vocab_schema      <- spec$vocab_schema         %||% spec$vocabSchema         %||% cdm_schema
  patient_count     <- as.integer(spec$patient_count %||% spec$patientCount %||% 0L)
  skip_cdm_create   <- isTRUE(spec$skip_cdm_create   %||% spec$skipCdmCreate   %||% FALSE)
  skip_syn_create   <- isTRUE(spec$skip_synthea_create %||% spec$skipSyntheaCreate %||% FALSE)

  # Validate CDM + Synthea version combinations
  valid_cdm_versions     <- c("5.3", "5.4")
  valid_synthea_versions <- c("2.7.0", "3.0.0", "3.1.0", "3.2.0", "3.3.0")
  if (!cdm_version %in% valid_cdm_versions) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = sprintf("cdm_version must be one of: %s", paste(valid_cdm_versions, collapse = ", "))
    ))
  }
  if (!synthea_version %in% valid_synthea_versions) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = sprintf(
        "synthea_version must be one of: %s", paste(valid_synthea_versions, collapse = ", ")
      )
    ))
  }

  logger$info("ETL-Synthea pipeline started", list(
    cdm_schema      = cdm_schema,
    synthea_schema  = synthea_schema,
    cdm_version     = cdm_version,
    synthea_version = synthea_version,
    csv_folder      = synthea_csv_folder
  ))

  safe_execute(response, logger, {

    # ── Step 1: Establish database connection ─────────────────────────────
    logger$info("Connecting to target database")
    connectionDetails <- create_hades_connection(source_spec)
    connection        <- .etl_dbi_connection(connectionDetails)
    on.exit(safe_disconnect(connection), add = TRUE)

    logger$info(sprintf(
      "Connected. CDM schema: %s | Synthea schema: %s", cdm_schema, synthea_schema
    ))

    # ── Step 2: Create CDM tables (optional — skip if they already exist) ─
    if (!skip_cdm_create) {
      logger$info(sprintf("Creating CDM v%s tables in schema: %s", cdm_version, cdm_schema))
      ETLSyntheaBuilder::CreateCDMTables(
        connectionDetails  = connectionDetails,
        cdmSchema          = cdm_schema,
        cdmVersion         = cdm_version
      )
      logger$info("CDM tables created")
    } else {
      logger$info("Skipping CDM table creation (skip_cdm_create = TRUE)")
    }

    # ── Step 3: Create Synthea staging tables ─────────────────────────────
    if (!skip_syn_create) {
      logger$info(sprintf(
        "Creating Synthea v%s staging tables in schema: %s", synthea_version, synthea_schema
      ))
      ETLSyntheaBuilder::CreateSyntheaTables(
        connectionDetails = connectionDetails,
        syntheaSchema     = synthea_schema,
        syntheaVersion    = synthea_version
      )
      logger$info("Synthea staging tables created")
    } else {
      logger$info("Skipping Synthea table creation (skip_synthea_create = TRUE)")
    }

    # ── Step 4: Load Synthea CSV files into staging schema ────────────────
    logger$info(sprintf("Loading Synthea CSVs from: %s", synthea_csv_folder))
    csv_files <- list.files(synthea_csv_folder, pattern = "\\.csv$", full.names = FALSE)
    logger$info(sprintf("Found %d CSV file(s): %s", length(csv_files), paste(csv_files, collapse = ", ")))

    ETLSyntheaBuilder::LoadSyntheaTables(
      connectionDetails = connectionDetails,
      syntheaSchema     = synthea_schema,
      syntheaFileLoc    = synthea_csv_folder
    )
    logger$info("Synthea CSV data loaded into staging tables")

    # ── Step 5: Transform staging data → OMOP CDM event tables ───────────
    logger$info(sprintf(
      "Transforming Synthea staging data → OMOP CDM v%s (vocab: %s)", cdm_version, vocab_schema
    ))
    ETLSyntheaBuilder::LoadEventTables(
      connectionDetails  = connectionDetails,
      cdmSchema          = cdm_schema,
      syntheaSchema      = synthea_schema,
      cdmVersion         = cdm_version,
      syntheaVersion     = synthea_version,
      vocabSchema        = vocab_schema
    )
    logger$info("ETL transformation complete")

    # ── Step 6: Collect row counts from CDM tables ────────────────────────
    logger$info("Collecting CDM table row counts")
    table_counts <- .count_cdm_tables(connection, cdm_schema, CDM_EVENT_TABLES)

    total_rows   <- as.integer(Reduce("+", table_counts, 0L))
    person_count <- table_counts[["person"]] %||% 0L

    logger$info(sprintf(
      "ETL-Synthea pipeline complete: %d persons, %d total CDM rows",
      person_count, total_rows
    ))

    # ── Return result ─────────────────────────────────────────────────────
    list(
      status  = "completed",
      summary = list(
        cdm_schema        = cdm_schema,
        synthea_schema    = synthea_schema,
        cdm_version       = cdm_version,
        synthea_version   = synthea_version,
        synthea_csv_folder = synthea_csv_folder,
        csv_files_found   = as.integer(length(csv_files)),
        csv_files         = csv_files,
        patient_count_requested = patient_count,
        person_count_loaded     = as.integer(person_count),
        total_cdm_rows          = as.integer(total_rows)
      ),
      table_counts    = table_counts,
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
