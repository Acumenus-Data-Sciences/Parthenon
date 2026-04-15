# darkstar/tests/testthat/test-finngen-hades.R
#
# Integration tests for hades_extras.R against Eunomia demo cohorts.

source("/app/api/finngen/common.R")
source("/app/api/finngen/hades_extras.R")

eunomia_source <- function() {
  list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "host.docker.internal/parthenon", port = 5432,
      user = "parthenon_finngen_ro",
      password = Sys.getenv("FINNGEN_PG_RO_PASSWORD", "")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )
}

testthat::test_that("finngen_hades_counts returns a counts frame", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_hades_counts(eunomia_source(), c(1L, 2L))
  testthat::expect_named(out, "counts")
  testthat::expect_true(is.data.frame(out$counts) || is.list(out$counts))
})

testthat::test_that("finngen_hades_overlap returns matrix+labels", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_hades_overlap(eunomia_source(), c(1L, 2L))
  testthat::expect_named(out, c("matrix", "labels"))
})

testthat::test_that("finngen_hades_demographics returns demographics payload", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_hades_demographics(eunomia_source(), 1L)
  testthat::expect_named(out, c("age_histogram", "gender_counts", "total"))
})
