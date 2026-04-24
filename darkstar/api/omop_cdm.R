# ──────────────────────────────────────────────────────────────────
# OMOP CDM Schema DDL
# POST /omop/create-cdm-schema — create OMOP CDM v5.4 on external DB
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)
library(CommonDataModel)
library(Achilles)

#* Create OMOP CDM v5.4 schema on an external database
#* @post /omop/create-cdm-schema
#* @serializer unboxedJSON
function(body, response) {
  dialect    <- body$dialect    %||% "postgresql"
  host       <- body$host
  port       <- as.integer(body$port %||% 5432L)
  database   <- body$database
  username   <- body$username   %||% ""
  password   <- body$password   %||% ""
  cdm_schema <- body$cdm_schema %||% "omop"

  if (is.null(host) || is.null(database)) {
    response$status <- 400L
    return(list(status = "error", message = "host and database are required"))
  }

  server <- if (dialect %in% c("sqlserver", "synapse")) {
    paste0(host, ";databaseName=", database)
  } else {
    paste0(host, "/", database)
  }

  jar_dir <- Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")

  connectionDetails <- DatabaseConnector::createConnectionDetails(
    dbms      = dialect,
    server    = server,
    port      = port,
    user      = username,
    password  = password,
    pathToDriver = jar_dir
  )

  tryCatch({
    CommonDataModel::executeDdl(
      connectionDetails  = connectionDetails,
      cdmVersion         = "5.4",
      cdmDatabaseSchema  = cdm_schema,
      executeDdl         = TRUE,
      executePrimaryKey  = TRUE,
      executeConstraints = FALSE,
      executeIndices     = FALSE
    )
    list(status = "ok", message = paste("CDM schema created:", cdm_schema))
  }, error = function(e) {
    response$status <- 500L
    msg <- conditionMessage(e)
    # Strip JDBC connection strings that may embed passwords
    msg <- gsub("password=[^;\" ]*", "password=***", msg, ignore.case = TRUE)
    msg <- gsub("Password=[^;\" ]*", "Password=***", msg)
    list(status = "error", message = msg)
  })
}

# ──────────────────────────────────────────────────────────────────
# OMOP Results Schema DDL
# POST /omop/create-results-schema — create Achilles results data model on external DB
# ──────────────────────────────────────────────────────────────────

#* Create Achilles results data model on an external database
#* @post /omop/create-results-schema
#* @serializer unboxedJSON
function(body, response) {
  dialect        <- body$dialect %||% "postgresql"
  host           <- body$host
  port           <- as.integer(body$port %||% 5432L)
  database       <- body$database
  username       <- body$username %||% ""
  password       <- body$password %||% ""
  results_schema <- body$results_schema

  if (is.null(host) || is.null(database) || is.null(results_schema)) {
    response$status <- 400L
    return(list(status = "error", message = "host, database, and results_schema are required"))
  }

  server <- if (dialect %in% c("sqlserver", "synapse")) {
    paste0(host, ";databaseName=", database)
  } else {
    paste0(host, "/", database)
  }

  connectionDetails <- DatabaseConnector::createConnectionDetails(
    dbms         = dialect %||% "postgresql",
    server       = server,
    port         = port,
    user         = username,
    password     = password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  )

  tryCatch({
    conn <- DatabaseConnector::connect(connectionDetails)
    on.exit(DatabaseConnector::disconnect(conn))

    Achilles::createResultsDataModel(
      connection            = conn,
      resultsDatabaseSchema = results_schema
    )
    list(status = "ok", message = paste("Results schema created:", results_schema))
  }, error = function(e) {
    response$status <- 500L
    msg <- conditionMessage(e)
    # Strip JDBC connection strings that may embed passwords
    msg <- gsub("password=[^;\" ]*", "password=***", msg, ignore.case = TRUE)
    msg <- gsub("Password=[^;\" ]*", "Password=***", msg)
    list(status = "error", message = msg)
  })
}
