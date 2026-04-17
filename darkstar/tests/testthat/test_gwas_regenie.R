# darkstar/tests/testthat/test_gwas_regenie.R
#
# Wave 0 skeleton tests for the gwas_regenie.R worker. Implementation
# lands in Wave 4 (Plan 14-05). Each test uses testthat::skip() so the
# file parses + is discoverable but does not fail CI until the worker
# lands.

library(testthat)

test_that(".gwas_cache_key produces 64-char lowercase hex", {
  skip("Wave 0 — implementation lands in Wave 4 Plan 14-05")
  source("/app/api/finngen/gwas_regenie.R")
  key <- .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS")
  expect_match(key, "^[a-f0-9]{64}$")
})

test_that(".gwas_cache_key case-normalizes source_key (PHP parity)", {
  skip("Wave 0 — implementation lands in Wave 4 Plan 14-05")
  source("/app/api/finngen/gwas_regenie.R")
  a <- .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS")
  b <- .gwas_cache_key(221L, 1L, "deadbeef", "pancreas")
  expect_identical(a, b)
})

test_that("finngen_gwas_regenie_step1_execute short-circuits on cache hit", {
  skip("Wave 0 — implementation lands in Wave 4 Plan 14-05")
  source("/app/api/finngen/gwas_regenie.R")
  tmp <- tempfile("cache_")
  dir.create(tmp, recursive = TRUE)
  writeLines("dummy", file.path(tmp, "fit_pred.list"))
  result <- finngen_gwas_regenie_step1_execute(
    source_envelope = list(source_key = "PANCREAS"),
    run_id          = "01HTEST",
    export_folder   = tempfile("run_"),
    params          = list(
      cohort_definition_id       = 221L,
      covariate_set_id           = 1L,
      covariate_set_version_hash = "deadbeef"
    )
  )
  expect_true(result$cache_hit)
  expect_match(result$cache_key, "^[a-f0-9]{64}$")
})

test_that("step-1 envelope shape matches contract", {
  skip("Wave 0 — implementation lands in Wave 4 Plan 14-05")
  # Envelope contract: list(cache_key=chr(64), cache_hit=lgl(1), loco_count=int(1))
  # Downstream step-2 + PHP parsing depend on these exact field names.
  source("/app/api/finngen/gwas_regenie.R")
  expect_true(exists("finngen_gwas_regenie_step1_execute"))
  expect_true(exists("finngen_gwas_regenie_step2_execute"))
  expect_true(exists(".gwas_cache_key"))
})
