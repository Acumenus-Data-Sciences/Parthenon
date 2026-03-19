# ──────────────────────────────────────────────────────────────────
# HADES DatabaseConnector wrapper
# Creates connectionDetails compatible with CohortMethod, PLP, etc.
# Supported dialects: postgresql, redshift, oracle, sqlserver, synapse,
#                     snowflake, databricks, bigquery, duckdb
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)

#' Build HADES-compatible connectionDetails from the spec$source block
#' sent by the Laravel backend.
#'
#' @param source_spec  List with: dialect, connection (nested list or DSN string),
#'                     cdm_schema, vocab_schema, results_schema
#' @return A DatabaseConnector connectionDetails object
create_hades_connection <- function(source_spec) {
  dialect <- tolower(source_spec$dialect %||% source_spec$dbms %||% "postgresql")
  conn    <- source_spec$connection
  jar_dir <- Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")

  # ── PostgreSQL / Redshift ─────────────────────────────────────────────────
  if (dialect %in% c("postgresql", "redshift")) {
    if (!is.null(source_spec$server)) {
      # Flat format from HadesBridgeService::buildSourceSpec()
      # server = "host/database", port, user, password at top level
      server <- source_spec$server
      port   <- as.integer(source_spec$port %||% if (dialect == "redshift") 5439L else 5432L)
      user   <- source_spec$user %||% source_spec$username
      pw     <- source_spec$password
    } else if (is.list(conn) && !is.null(conn$host)) {
      server <- paste0(conn$host, "/", conn$database)
      port   <- as.integer(conn$port %||% if (dialect == "redshift") 5439L else 5432L)
      user   <- conn$user %||% conn$username
      pw     <- conn$password
    } else {
      # Parse a DSN: postgresql://user:pw@host:port/database
      parts <- .parse_pg_dsn(as.character(conn))
      user  <- parts$user; pw <- parts$password
      server <- paste0(parts$host, "/", parts$database)
      port  <- parts$port
    }

    dbms <- if (dialect == "redshift") "redshift" else "postgresql"

    # Build JDBC URL with socket/connect timeouts to prevent hung connections
    parts <- strsplit(server, "/")[[1]]
    host_part <- parts[1]
    db_part   <- if (length(parts) > 1) parts[2] else ""
    jdbc_url  <- sprintf(
      "jdbc:postgresql://%s:%d/%s?socketTimeout=300&connectTimeout=30&loginTimeout=30&tcpKeepAlive=true",
      host_part, port, db_part
    )

    return(DatabaseConnector::createConnectionDetails(
      dbms             = dbms,
      connectionString = jdbc_url,
      user             = user,
      password         = pw,
      pathToDriver     = jar_dir
    ))
  }

  # ── SQL Server / Synapse ──────────────────────────────────────────────────
  if (dialect %in% c("sqlserver", "synapse")) {
    dbms   <- if (dialect == "synapse") "synapse" else "sql server"
    server <- paste0(conn$host %||% conn$server, "\\", conn$instance %||% "")
    # For Azure endpoints the instance is often empty — trim trailing backslash
    server <- sub("\\\\$", "", server)

    return(DatabaseConnector::createConnectionDetails(
      dbms         = dbms,
      server       = server,
      port         = as.integer(conn$port %||% 1433L),
      user         = conn$user %||% conn$username,
      password     = conn$password,
      pathToDriver = jar_dir
    ))
  }

  # ── Oracle ────────────────────────────────────────────────────────────────
  if (dialect == "oracle") {
    server <- paste0(conn$host, "/", conn$database)  # host/service_name

    return(DatabaseConnector::createConnectionDetails(
      dbms         = "oracle",
      server       = server,
      port         = as.integer(conn$port %||% 1521L),
      user         = conn$user %||% conn$username,
      password     = conn$password,
      pathToDriver = jar_dir
    ))
  }

  # ── Snowflake ─────────────────────────────────────────────────────────────
  if (dialect == "snowflake") {
    account   <- conn$account %||% sub("\\.snowflakecomputing\\.com$", "", conn$host %||% "")
    warehouse <- conn$warehouse %||% conn$db_options$warehouse %||% ""
    schema    <- conn$schema %||% conn$db_options$schema %||% "PUBLIC"
    role      <- conn$role %||% conn$db_options$role %||% ""

    extra <- paste0(
      "warehouse=", warehouse,
      if (nchar(role) > 0) paste0(";role=", role) else "",
      ";schema=", schema
    )

    return(DatabaseConnector::createConnectionDetails(
      dbms           = "snowflake",
      connectionString = paste0(
        "jdbc:snowflake://", account, ".snowflakecomputing.com/",
        "?db=", conn$database, "&", extra
      ),
      user         = conn$user %||% conn$username,
      password     = conn$password,
      pathToDriver = jar_dir
    ))
  }

  # ── Databricks (SparkSQL) ─────────────────────────────────────────────────
  if (dialect == "databricks") {
    http_path <- conn$http_path %||% conn$db_options$http_path %||%
      stop("db_options.http_path required for Databricks")
    catalog <- conn$catalog %||% conn$db_options$catalog %||% ""

    jdbc_url <- paste0(
      "jdbc:spark://", conn$host, ":443/",
      if (nchar(catalog) > 0) catalog else conn$database %||% "default",
      ";transportMode=http;ssl=1;httpPath=", http_path,
      ";AuthMech=3;UID=token;PWD=", conn$password
    )

    return(DatabaseConnector::createConnectionDetails(
      dbms             = "spark",
      connectionString = jdbc_url,
      pathToDriver     = jar_dir
    ))
  }

  # ── DuckDB ────────────────────────────────────────────────────────────────
  if (dialect == "duckdb") {
    file_path <- conn$file_path %||% conn$host %||% ":memory:"

    return(DatabaseConnector::createConnectionDetails(
      dbms         = "duckdb",
      server       = file_path,
      pathToDriver = jar_dir
    ))
  }

  # ── BigQuery ──────────────────────────────────────────────────────────────
  if (dialect == "bigquery") {
    project <- conn$project %||% conn$db_database %||%
      stop("project ID required for BigQuery")
    dataset <- conn$dataset %||% conn$schema %||% "omop"

    sa_key <- conn$service_account_key %||%
      Sys.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

    jdbc_url <- paste0(
      "jdbc:bigquery://https://www.googleapis.com/bigquery/v2:443",
      ";ProjectId=", project,
      ";OAuthType=0",
      ";OAuthServiceAcctEmail=", conn$service_account_email %||% "",
      ";OAuthPvtKeyPath=", sa_key,
      ";DefaultDataset=", dataset
    )

    return(DatabaseConnector::createConnectionDetails(
      dbms             = "bigquery",
      connectionString = jdbc_url,
      pathToDriver     = jar_dir
    ))
  }

  stop("Unsupported dialect: ", dialect)
}

# ── Internal helpers ──────────────────────────────────────────────────────────

#' Parse a PostgreSQL DSN string: postgresql://user:pw@host:port/database
.parse_pg_dsn <- function(dsn) {
  parts <- regmatches(dsn, regexec(
    "(?:postgresql|redshift)://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)", dsn
  ))[[1]]
  if (length(parts) != 6) stop("Cannot parse connection DSN: ", dsn)
  list(
    user     = parts[2],
    password = parts[3],
    host     = parts[4],
    port     = as.integer(parts[5]),
    database = parts[6]
  )
}

#' Safely disconnect a DatabaseConnector connection, ignoring errors.
safe_disconnect <- function(connection) {
  tryCatch(
    DatabaseConnector::disconnect(connection),
    error = function(e) {
      cat(sprintf("[WARN] Disconnect failed (non-fatal): %s\n", e$message))
    }
  )
}

# NOTE: R 4.4+ has %||% in base. We do NOT override it.
# Use base::`%||%` (NULL-coalescing) throughout.
# For empty-string coalescing, use %|% below.
`%|%` <- function(a, b) {
  if (!is.null(a) && length(a) > 0 && !anyNA(a) && nzchar(as.character(a[1]))) a else b
}
