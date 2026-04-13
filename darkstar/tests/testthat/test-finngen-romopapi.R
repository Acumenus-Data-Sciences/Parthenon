# darkstar/tests/testthat/test-finngen-romopapi.R
#
# Integration tests for romopapi.R — require a live Postgres with Eunomia
# seeded, FINNGEN_PG_RO_PASSWORD env var set, and HadesExtras/ROMOPAPI
# installed in the image (post-B1).

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi.R")

eunomia_source <- function() {
  list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "postgres/parthenon", port = 5432,
      user = "parthenon_finngen_ro",
      password = Sys.getenv("FINNGEN_PG_RO_PASSWORD", "")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )
}

# Type 2 diabetes mellitus — broadly present in OMOP demos
SAMPLE_CONCEPT <- 201826L

testthat::test_that("finngen_romopapi_code_counts returns shape-valid payload", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_romopapi_code_counts(eunomia_source(), SAMPLE_CONCEPT)
  testthat::expect_named(out, c("concept", "stratified_counts", "node_count", "descendant_count"))
})

testthat::test_that("finngen_romopapi_relationships returns named list with relationships key", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_romopapi_relationships(eunomia_source(), SAMPLE_CONCEPT)
  testthat::expect_named(out, "relationships")
  testthat::expect_true(is.data.frame(out$relationships) || is.list(out$relationships))
})

testthat::test_that("finngen_romopapi_ancestors returns nodes+edges+mermaid", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RO_PASSWORD") == "", "RO password not set")
  out <- finngen_romopapi_ancestors(eunomia_source(), SAMPLE_CONCEPT, direction = "both", max_depth = 3)
  testthat::expect_named(out, c("nodes", "edges", "mermaid"))
  testthat::expect_true(is.character(out$mermaid))
  testthat::expect_match(out$mermaid, "^graph TD")
})
