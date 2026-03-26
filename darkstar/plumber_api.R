.r_start_time <- Sys.time()

# Set JVM heap before any JDBC/DatabaseConnector usage
# Default 256MB is insufficient for CohortMethod on 1M+ patients
options(java.parameters = c("-Xmx8g", "-Xms2g"))

library(plumber2)

# Create the API from all endpoint files.
# Each file uses @root to define its path prefix.
pa <- api(
  "/app/api/health.R",
  "/app/api/stubs.R",
  "/app/api/estimation.R",
  "/app/api/prediction.R",
  "/app/api/sccs.R",
  "/app/api/evidence_synthesis.R",
  "/app/api/cohort_diagnostics.R",
  "/app/api/cohort_incidence.R",
  "/app/api/characterization.R",
  "/app/api/study_bridge.R",
  "/app/api/strategus.R",
  "/app/api/synthea.R",
  "/app/api/jobs.R",
  host = "0.0.0.0",
  port = 8787L,
  default_async = "mirai"
)

# Handle process exit for graceful shutdown logging.
.Last <- function() {
  cat("[SHUTDOWN] R runtime shutting down\n")
}

# Start server (blocks in non-interactive/Docker mode)
pa |> api_run()
