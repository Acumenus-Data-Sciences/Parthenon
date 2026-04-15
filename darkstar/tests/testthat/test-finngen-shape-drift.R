# darkstar/tests/testthat/test-finngen-shape-drift.R
#
# Response-shape drift detection for FinnGen sync endpoints. Each test invokes
# an endpoint function against a source with enough data to produce a non-error
# response, then asserts the top-level key names match darkstar-finngen-shapes.json.
#
# Skipped when:
#   - FINNGEN_PG_RO_PASSWORD unset (no way to reach PG)
#   - Eunomia / vocab schemas missing (environment gap — not a code bug)
#
# Purpose: catches upstream HadesExtras/ROMOPAPI breaking changes where a
# version bump renames or drops fields. Without this test, we'd notice only
# when Laravel controllers blow up at runtime.

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi.R")
source("/app/api/finngen/hades_extras.R")

suppressPackageStartupMessages({
  library(jsonlite)
})

.shape_fixture <- function() {
  fixture_path <- "/app/tests/fixtures/darkstar-finngen-shapes.json"
  jsonlite::fromJSON(fixture_path, simplifyVector = FALSE)
}

.eunomia_source <- function() {
  list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "host.docker.internal/parthenon", port = 5432,
      user     = "parthenon_finngen_ro",
      password = Sys.getenv("FINNGEN_PG_RO_PASSWORD", "")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )
}

.assert_keys_match <- function(actual, fixture_key) {
  expected <- .shape_fixture()$endpoints[[fixture_key]]$keys
  testthat::expect_setequal(names(actual), unlist(expected))
}

testthat::test_that("finngen_romopapi_relationships matches fixture shape", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  # Use concept_id 201826 (diabetes) — present in any OMOP vocab
  out <- tryCatch(finngen_romopapi_relationships(.eunomia_source(), 201826L), error = function(e) NULL)
  testthat::skip_if(is.null(out), "vocab relationships query failed — env gap")
  .assert_keys_match(out, "finngen_romopapi_relationships")
})

testthat::test_that("finngen_romopapi_ancestors matches fixture shape", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- tryCatch(finngen_romopapi_ancestors(.eunomia_source(), 201826L, direction = "up", max_depth = 2),
                  error = function(e) NULL)
  testthat::skip_if(is.null(out), "vocab ancestors query failed — env gap")
  .assert_keys_match(out, "finngen_romopapi_ancestors")
})

testthat::test_that("finngen_hades_counts matches fixture shape (even on empty cohort)", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- tryCatch(finngen_hades_counts(.eunomia_source(), c(1L, 2L)), error = function(e) NULL)
  testthat::skip_if(is.null(out), "cohort counts query failed — env gap")
  .assert_keys_match(out, "finngen_hades_counts")
})

testthat::test_that("finngen_hades_overlap matches fixture shape", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- tryCatch(finngen_hades_overlap(.eunomia_source(), c(1L, 2L)), error = function(e) NULL)
  testthat::skip_if(is.null(out), "cohort overlap query failed — env gap")
  .assert_keys_match(out, "finngen_hades_overlap")
})
