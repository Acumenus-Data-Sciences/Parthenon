#* Deep health check — validates JVM, memory, core packages, and uptime
#* Returns package versions for OHDSI (HADES) and Posit (infrastructure) packages
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

  # ── Package versions ────────────────────────────────────────────
  get_ver <- function(pkg) {
    tryCatch(
      as.character(utils::packageVersion(pkg)),
      error = function(e) NA_character_
    )
  }

  # OHDSI HADES packages
  ohdsi_pkgs <- c(
    "SqlRender", "DatabaseConnector", "Andromeda", "Cyclops",
    "FeatureExtraction", "ResultModelManager", "EmpiricalCalibration",
    "ParallelLogger", "CohortMethod", "PatientLevelPrediction",
    "SelfControlledCaseSeries", "EvidenceSynthesis", "CohortGenerator",
    "CohortDiagnostics", "DeepPatientLevelPrediction", "CohortIncidence",
    "Characterization", "Strategus", "ETLSyntheaBuilder",
    "DataQualityDashboard"
  )

  # Posit / CRAN infrastructure packages
  posit_pkgs <- c(
    "plumber2", "mirai", "nanonext", "jsonlite", "DBI", "RPostgres",
    "httr2", "callr", "processx", "rJava", "duckdb", "remotes"
  )

  ohdsi_versions <- lapply(ohdsi_pkgs, function(p) get_ver(p))
  names(ohdsi_versions) <- ohdsi_pkgs

  posit_versions <- lapply(posit_pkgs, function(p) get_ver(p))
  names(posit_versions) <- posit_pkgs

  # Filter out packages that are not installed (NA)
  ohdsi_versions <- Filter(Negate(is.na), ohdsi_versions)
  posit_versions <- Filter(Negate(is.na), posit_versions)

  # FinnGen SP1 runtime probe: report which FinnGen-stack packages load.
  finngen_block <- tryCatch({
    pkgs <- c("ROMOPAPI", "HadesExtras", "CO2AnalysisModules")
    loaded <- vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)
    list(
      packages_loaded = as.list(pkgs[loaded]),
      load_errors     = as.list(pkgs[!loaded])
    )
  }, error = function(e) list(
    packages_loaded = list(),
    load_errors     = list(as.character(e$message))
  ))

  list(
    status = if (overall) "ok" else "degraded",
    service = "darkstar",
    version = "0.3.0",
    r_version = paste(R.version$major, R.version$minor, sep = "."),
    uptime_seconds = uptime_secs,
    checks = checks,
    packages = list(
      ohdsi = ohdsi_versions,
      posit = posit_versions
    ),
    finngen = finngen_block
  )
}
