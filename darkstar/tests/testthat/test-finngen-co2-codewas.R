# darkstar/tests/testthat/test-finngen-co2-codewas.R
#
# End-to-end test: execute CodeWAS on Eunomia demo cohorts and verify
# DuckDB result + summary.json artifacts are written.

source("/app/api/finngen/common.R")
source("/app/api/finngen/co2_analysis.R")

testthat::test_that("execute_CodeWAS runs end-to-end on Eunomia", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")

  src <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "postgres/parthenon", port = 5432,
      user     = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )

  run_id <- paste0("test-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)

  result <- finngen_co2_codewas_execute(
    source_envelope   = src,
    run_id            = run_id,
    export_folder     = export_folder,
    analysis_settings = list(
      cohortIdCases    = 1L,
      cohortIdControls = 2L,
      analysisIds      = c(1L, 10L),
      minCellCount     = 5L
    )
  )

  # On success: result$ok = TRUE, summary.json + progress.json present
  testthat::expect_true(result$ok, info = if (!isTRUE(result$ok)) paste("Error:", result$error$category, result$error$message) else NULL)
  testthat::expect_true(file.exists(file.path(export_folder, "summary.json")))
  testthat::expect_true(file.exists(file.path(export_folder, "progress.json")))

  # Final progress line should show done/100
  lines <- readLines(file.path(export_folder, "progress.json"))
  last <- jsonlite::fromJSON(lines[length(lines)])
  testthat::expect_equal(last$step, "done")
  testthat::expect_equal(last$pct, 100)

  # Cleanup
  unlink(export_folder, recursive = TRUE)
})
