# darkstar/tests/testthat/test-finngen-co2-display-json.R
#
# Shape tests for display.json emitted by CO2 analysis workers.
# Requires: live Postgres, FINNGEN_PG_RW_PASSWORD env var.
# Gated behind nightly slow-lane CI job.

source("/app/api/finngen/common.R")
source("/app/api/finngen/co2_analysis.R")

.build_test_source <- function() {
  list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server   = "host.docker.internal/parthenon",
      port     = 5432,
      user     = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(
      cdm     = "eunomia",
      vocab   = "vocab",
      results = "eunomia_results",
      cohort  = "eunomia_results"
    )
  )
}

.make_export_folder <- function(prefix) {
  run_id <- paste0(prefix, "-", substr(digest::digest(Sys.time()), 1, 12))
  path <- file.path("/opt/finngen-artifacts/runs", run_id)
  list(run_id = run_id, path = path)
}

testthat::test_that("CodeWAS display.json has signals + thresholds + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-codewas-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_codewas_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIdCases = 1L, cohortIdControls = 2L)
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("signals" %in% names(display))
  testthat::expect_true("thresholds" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("timeCodeWAS display.json has windows + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-tcodewas-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_time_codewas_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(
      cohortIdCases = 1L, cohortIdControls = 2L,
      temporalStartDays = c(-365L, 0L), temporalEndDays = c(-1L, 30L)
    )
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("windows" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("Overlaps display.json has sets + intersections + matrix + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-overlaps-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_overlaps_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIds = c(1L, 2L))
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("sets" %in% names(display))
  testthat::expect_true("intersections" %in% names(display))
  testthat::expect_true("matrix" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("Demographics display.json has cohorts key with expected shape", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-demographics-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_demographics_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIds = c(1L))
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("cohorts" %in% names(display))
  if (length(display$cohorts) > 0) {
    cohort <- display$cohorts[[1]]
    testthat::expect_true("cohort_id" %in% names(cohort))
    testthat::expect_true("age_histogram" %in% names(cohort))
    testthat::expect_true("gender_counts" %in% names(cohort))
    testthat::expect_true("summary" %in% names(cohort))
  }
})
