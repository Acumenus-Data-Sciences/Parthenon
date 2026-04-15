# darkstar/tests/testthat/test-finngen-romopapi-setup.R
#
# Destructive test for finngen_romopapi_setup_source_execute — creates
# stratified_code_counts in eunomia_results, then drops it in on.exit.

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi_async.R")

testthat::test_that("finngen_romopapi_setup_source_execute materializes the counts table", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")

  src <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "host.docker.internal/parthenon", port = 5432,
      user = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )

  cd <- DatabaseConnector::createConnectionDetails(
    dbms = "postgresql",
    server = src$connection$server, port = src$connection$port,
    user = src$connection$user, password = src$connection$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  )
  conn <- DatabaseConnector::connect(cd)
  tryCatch(DatabaseConnector::executeSql(conn, "DROP TABLE IF EXISTS eunomia_results.stratified_code_counts"),
           error = function(e) NULL)
  DatabaseConnector::disconnect(conn)

  run_id <- paste0("test-setup-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  on.exit({
    unlink(export_folder, recursive = TRUE)
    conn2 <- DatabaseConnector::connect(cd)
    tryCatch(DatabaseConnector::executeSql(conn2, "DROP TABLE IF EXISTS eunomia_results.stratified_code_counts"),
             error = function(e) NULL)
    DatabaseConnector::disconnect(conn2)
  }, add = TRUE)

  result <- finngen_romopapi_setup_source_execute(
    source_envelope = src,
    run_id          = run_id,
    export_folder   = export_folder,
    params          = list()
  )

  testthat::expect_true(result$ok)
  testthat::expect_gt(result$result$stratified_row_count, 0)
})
