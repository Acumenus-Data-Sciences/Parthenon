# darkstar/tests/testthat/test-finngen-romopapi-report.R
#
# End-to-end test for finngen_romopapi_report_execute against Eunomia vocab.
# Requires: live Postgres, FINNGEN_PG_RW_PASSWORD env var, ROMOPAPI loaded.
# Gated behind the nightly slow-lane CI job (finngen-tests.yml darkstar-integration).

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi_async.R")

testthat::test_that("finngen_romopapi_report_execute generates report.html on Eunomia", {
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

  run_id <- paste0("test-report-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  on.exit(unlink(export_folder, recursive = TRUE), add = TRUE)

  result <- finngen_romopapi_report_execute(
    source_envelope = src,
    run_id          = run_id,
    export_folder   = export_folder,
    params          = list(concept_id = 201826L)
  )

  testthat::expect_true(result$ok, info = if (!isTRUE(result$ok)) paste("Error:", result$error$category, result$error$message))
  testthat::expect_true(file.exists(file.path(export_folder, "report.html")))
  testthat::expect_true(file.exists(file.path(export_folder, "summary.json")))

  summary <- jsonlite::fromJSON(file.path(export_folder, "summary.json"))
  testthat::expect_equal(summary$analysis_type, "romopapi.report")
  testthat::expect_equal(summary$concept_id, 201826)
  testthat::expect_gt(summary$report_bytes, 0)
})
