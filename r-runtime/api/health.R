#* Deep health check — validates JVM, memory, core packages, and uptime
#* @get /health
#* @serializer unboxedJSON
function() {
  checks <- list()

  # Check core HADES packages are loadable
  checks$packages <- tryCatch({
    requireNamespace("CohortMethod", quietly = TRUE) &&
    requireNamespace("PatientLevelPrediction", quietly = TRUE) &&
    requireNamespace("DatabaseConnector", quietly = TRUE)
  }, error = function(e) FALSE)

  # Check JVM is alive (rJava must work for JDBC)
  checks$jvm <- tryCatch({
    rJava::.jnew("java.lang.String", "healthcheck")
    TRUE
  }, error = function(e) FALSE)

  # Check memory usage
  mem <- gc(verbose = FALSE)
  checks$memory_used_mb <- round(sum(mem[, 2]), 1)
  checks$memory_ok <- checks$memory_used_mb < 28000  # alert at ~87% of 32GB limit

  # Check JDBC driver exists
  jar_dir <- Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  checks$jdbc_driver <- file.exists(file.path(jar_dir, "postgresql-42.7.3.jar"))

  # Uptime
  uptime_secs <- if (exists(".r_start_time", envir = globalenv())) {
    as.integer(difftime(Sys.time(), get(".r_start_time", envir = globalenv()), units = "secs"))
  } else {
    NA_integer_
  }

  # Clean up expired async job results on each health check (every 30s)
  if (exists("cleanup_expired_jobs", mode = "function")) {
    tryCatch(cleanup_expired_jobs(), error = function(e) NULL)
  }

  overall <- all(unlist(checks[c("packages", "jvm", "memory_ok", "jdbc_driver")]))

  list(
    status = if (overall) "ok" else "degraded",
    service = "parthenon-r-runtime",
    version = "0.2.0",
    r_version = paste(R.version$major, R.version$minor, sep = "."),
    uptime_seconds = uptime_secs,
    checks = checks
  )
}
