# ──────────────────────────────────────────────────────────────────
# HADES DatabaseConnector wrapper
# Creates connectionDetails compatible with CohortMethod, PLP, etc.
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)

#' Build HADES-compatible connectionDetails from the spec$source block
#' sent by the Laravel backend.
#'
#' @param source_spec  List with: dialect, connection (list of host/port/database/user/password
#'                     OR a connection string), cdm_schema, vocab_schema, results_schema
#' @return A DatabaseConnector connectionDetails object
create_hades_connection <- function(source_spec) {
  conn <- source_spec$connection

  # The backend may send connection details as a nested list or as a DSN string

  if (is.list(conn) && !is.null(conn$host)) {
    server <- paste0(conn$host, "/", conn$database)
    port   <- as.integer(conn$port %||% 5432)
    user   <- conn$user
    pw     <- conn$password
  } else {
    # Parse a DSN: postgresql://user:pw@host:port/database
    dsn <- as.character(conn)
    parts <- regmatches(dsn, regexec(
      "postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)", dsn
    ))[[1]]
    if (length(parts) != 6) stop("Cannot parse connection DSN: ", dsn)
    user   <- parts[2]
    pw     <- parts[3]
    server <- paste0(parts[4], "/", parts[6])
    port   <- as.integer(parts[5])
  }

  DatabaseConnector::createConnectionDetails(
    dbms           = "postgresql",
    server         = server,
    port           = port,
    user           = user,
    password       = pw,
    pathToDriver   = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/app/jdbc")
  )
}

#' Convenience: NULL-coalescing operator (same as rlang %||%)
`%||%` <- function(a, b) if (!is.null(a)) a else b
