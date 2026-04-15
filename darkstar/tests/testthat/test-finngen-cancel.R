# darkstar/tests/testthat/test-finngen-cancel.R
#
# Validates cancellation semantics for FinnGen async jobs against Darkstar's
# existing callr::r_bg-based async subsystem.
#
# NOTE: Spec §5.6 prescribes a 60s force-recycle ceiling for mirai-backed
# tasks. Darkstar's SP1 async uses callr::r_bg instead (matches the existing
# jobs.R pattern — mirai is reserved for Plumber @async handlers which we
# don't use for FinnGen). callr's bg$kill() is SIGKILL, immediate — no
# cooperative-interrupt ceiling applies. These tests validate that immediate
# behavior.

source("/app/R/async_jobs.R")

testthat::test_that("submit + cancel transitions a running callr job within 10s", {
  # Worker that just sleeps so we can cancel it while alive
  worker <- function(spec) {
    Sys.sleep(spec$seconds)
    list(ok = TRUE, slept = spec$seconds)
  }

  job_id <- submit_job("finngen.test.sleeper", list(seconds = 120), worker)
  testthat::expect_match(job_id, "^finngen\\.test\\.sleeper_")

  # Give the bg process a moment to actually start
  Sys.sleep(1)
  status_before <- get_job_status(job_id)
  testthat::expect_equal(status_before$status, "running")

  start <- Sys.time()
  cancel_result <- cancel_job(job_id)
  elapsed <- as.numeric(Sys.time() - start, units = "secs")

  testthat::expect_equal(cancel_result$status, "cancelled")
  testthat::expect_lte(elapsed, 10)
})

testthat::test_that("cancelling an already-cancelled job is idempotent (not_found)", {
  # After first cancel the entry is removed, so a second cancel returns not_found.
  # This matches Darkstar's existing jobs.R behavior — document it as the contract.
  worker <- function(spec) { Sys.sleep(60) }
  job_id <- submit_job("finngen.test.sleeper", list(), worker)
  Sys.sleep(0.5)
  cancel_job(job_id)
  second <- cancel_job(job_id)
  testthat::expect_equal(second$status, "not_found")
})

testthat::test_that("cancelling a completed job (entry still cached) reports cancelled+cleaned", {
  # A short-running job completes before we cancel. cancel_job checks bg$is_alive()
  # and only kills if alive; regardless, it removes the entry and returns "cancelled".
  worker <- function(spec) { list(done = TRUE) }
  job_id <- submit_job("finngen.test.fast", list(), worker)

  # Wait for it to complete
  for (i in 1:20) {
    st <- get_job_status(job_id)
    if (st$status %in% c("completed", "failed", "done")) break
    Sys.sleep(0.2)
  }

  cancel_result <- cancel_job(job_id)
  testthat::expect_equal(cancel_result$status, "cancelled")
})
