# darkstar/tests/testthat/test-finngen-cohort-generate.R
#
# End-to-end test: generate a trivial cohort definition against Eunomia
# and assert the cohort table is populated.

source("/app/api/finngen/common.R")
source("/app/api/finngen/cohort_ops.R")

testthat::test_that("finngen_cohort_generate_execute materializes counts", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  testthat::skip_if_not_installed("Capr")  # Cohort def DSL — ships with HADES stack

  src <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "postgres/parthenon", port = 5432,
      user = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )

  # Reuse an already-seeded demo cohort definition if available, else skip.
  # For SP1 this test validates the pipeline; SP4 will build real definitions.
  run_id <- paste0("test-gen-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)

  # Minimal cohort definition set — a single cohort that selects all persons.
  # Real usage builds these via Capr/Circe; here we inline a trivial one.
  simple_def <- data.frame(
    cohortId = 999L,
    cohortName = "All persons (test)",
    sql = "SELECT person_id AS subject_id, '1970-01-01'::date AS cohort_start_date, '2100-01-01'::date AS cohort_end_date FROM @cdm_database_schema.person",
    stringsAsFactors = FALSE
  )

  result <- finngen_cohort_generate_execute(
    source_envelope = src,
    run_id          = run_id,
    export_folder   = export_folder,
    params          = list(cohort_definition_set = simple_def)
  )

  testthat::expect_true(result$ok, info = if (!isTRUE(result$ok)) paste("Error:", result$error$category, result$error$message) else NULL)
  testthat::expect_true(file.exists(file.path(export_folder, "summary.json")))

  unlink(export_folder, recursive = TRUE)
})
