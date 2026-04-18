# darkstar/tests/testthat/test_gwas_regenie.R
#
# Phase 14 Plan 14-05 (D-01, D-13, D-14, D-22) — testthat suite for the
# regenie GWAS worker. Wave 0 skeletons un-skipped + 1 new PHP/R cache-key
# parity fixture (T-14-12 mitigation).

library(testthat)

test_that(".gwas_cache_key produces 64-char lowercase hex", {
  source("/app/api/finngen/gwas_regenie.R")
  key <- .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS")
  expect_match(key, "^[a-f0-9]{64}$")
})

test_that(".gwas_cache_key case-normalizes source_key (PHP parity)", {
  source("/app/api/finngen/gwas_regenie.R")
  a <- .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS")
  b <- .gwas_cache_key(221L, 1L, "deadbeef", "pancreas")
  expect_identical(a, b)
})

test_that("finngen_gwas_regenie_step1_execute short-circuits on cache hit", {
  source("/app/api/finngen/gwas_regenie.R")

  # Pre-populate the cache directory at the canonical layout for the same
  # input so the worker takes the cache_hit branch without ever invoking
  # regenie or hitting the database.
  cache_key <- .gwas_cache_key(221L, 1L, "deadbeef", "pancreas")
  cache_dir <- .gwas_step1_cache_dir("pancreas", cache_key)
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(cache_dir, recursive = TRUE), add = TRUE)
  writeLines("dummy", file.path(cache_dir, "fit_pred.list"))
  # Two synthetic LOCO files to verify loco_count counting.
  writeLines("dummy_chr1", file.path(cache_dir, "fit_1.loco"))
  writeLines("dummy_chr2", file.path(cache_dir, "fit_2.loco"))

  export_folder <- tempfile("run_")
  on.exit(unlink(export_folder, recursive = TRUE), add = TRUE)

  envelope <- finngen_gwas_regenie_step1_execute(
    source_envelope = list(source_key = "PANCREAS"),
    run_id          = "01HTEST",
    export_folder   = export_folder,
    params          = list(
      cohort_definition_id       = 221L,
      covariate_set_id           = 1L,
      covariate_set_version_hash = "deadbeef"
    )
  )
  # run_with_classification wraps the envelope as {ok=TRUE, result=...}
  result <- if (isTRUE(envelope$ok)) envelope$result else envelope
  expect_true(result$cache_hit)
  expect_match(result$cache_key, "^[a-f0-9]{64}$")
  expect_identical(as.integer(result$loco_count), 2L)
  expect_identical(result$cache_key, cache_key)
})

test_that("step-1 / step-2 / cache-key worker symbols are exported", {
  # Envelope contract: list(cache_key=chr(64), cache_hit=lgl(1), loco_count=int(1))
  # for step-1; list(run_id, rows_written, cache_key_used, warnings) for step-2.
  # Downstream PHP parsing depends on these exact field names.
  source("/app/api/finngen/gwas_regenie.R")
  expect_true(exists("finngen_gwas_regenie_step1_execute"))
  expect_true(exists("finngen_gwas_regenie_step2_execute"))
  expect_true(exists(".gwas_cache_key"))
  expect_true(exists(".ingest_regenie_to_summary_stats"))
  expect_true(exists(".gwas_step1_cache_dir"))
})

test_that("gwas_cache_key matches PHP fixture hex (Wave 2 Plan 14-03 parity)", {
  # FIXTURE PINNED IN .planning/phases/14-regenie-gwas-infrastructure/14-03-SUMMARY.md
  # Input:  (cohort_id=221, covariate_set_id=1, covariate_set_version_hash='deadbeef',
  #          source_key='PANCREAS')
  # Canonical JSON:
  #   {"cohort_definition_id":221,"covariate_set_id":1,
  #    "covariate_set_version_hash":"deadbeef","source_key":"pancreas"}
  # SHA-256: b58a15fc61e7bca9d2ecc767782c98de90a0c32e1f3855df79214d72190df8c1
  source("/app/api/finngen/gwas_regenie.R")
  expected <- "b58a15fc61e7bca9d2ecc767782c98de90a0c32e1f3855df79214d72190df8c1"
  actual   <- .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS")
  expect_identical(actual, expected)
})
