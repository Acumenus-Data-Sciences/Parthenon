# darkstar/tests/testthat/test-finngen-common.R
#
# Unit tests for common.R — pure-R logic only, no DB required for 6 of the 7.

source("/app/api/finngen/common.R")

testthat::test_that("run_with_classification returns ok=TRUE on success", {
  result <- run_with_classification(NULL, function() 42)
  testthat::expect_true(result$ok)
  testthat::expect_equal(result$result, 42)
})

testthat::test_that("run_with_classification classifies DatabaseConnectorError", {
  result <- run_with_classification(NULL, function() {
    e <- structure(
      class = c("DatabaseConnectorError", "error", "condition"),
      list(message = "could not connect to server", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_false(result$ok)
  testthat::expect_equal(result$error$category, "DB_CONNECTION_FAILED")
  testthat::expect_match(result$error$message, "could not connect")
})

testthat::test_that("run_with_classification classifies SqlRenderError as schema mismatch", {
  result <- run_with_classification(NULL, function() {
    e <- structure(
      class = c("SqlRenderError", "error", "condition"),
      list(message = "relation synpuf.cohort does not exist", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_equal(result$error$category, "DB_SCHEMA_MISMATCH")
})

testthat::test_that("run_with_classification catches OutOfMemoryError condition class", {
  result <- run_with_classification(NULL, function() {
    e <- structure(
      class = c("OutOfMemoryError", "error", "condition"),
      list(message = "Java heap space", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_equal(result$error$category, "OUT_OF_MEMORY")
})

testthat::test_that("classify_simple_error detects Java heap string", {
  out <- run_with_classification(NULL, function() stop("java.lang.OutOfMemoryError: Java heap space"))
  testthat::expect_equal(out$error$category, "OUT_OF_MEMORY")
})

testthat::test_that("classify_simple_error detects disk-full", {
  out <- run_with_classification(NULL, function() stop("write failed: No space left on device"))
  testthat::expect_equal(out$error$category, "DISK_FULL")
})

testthat::test_that("run_with_classification falls through to ANALYSIS_EXCEPTION", {
  out <- run_with_classification(NULL, function() stop("generic boom"))
  testthat::expect_equal(out$error$category, "ANALYSIS_EXCEPTION")
  testthat::expect_match(out$error$message, "generic boom")
})

testthat::test_that("write_progress rotates at 500 lines", {
  path <- tempfile(fileext = ".json")
  on.exit(file.remove(path), add = TRUE)
  for (i in 1:520) {
    write_progress(path, list(step = "x", pct = i, message = sprintf("iter %d", i)))
  }
  lines <- readLines(path)
  testthat::expect_lte(length(lines), 500)
  last <- jsonlite::fromJSON(lines[length(lines)])
  testthat::expect_equal(last$pct, 520)
})
