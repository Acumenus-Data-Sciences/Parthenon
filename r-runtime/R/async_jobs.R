# ──────────────────────────────────────────────────────────────────
# Async job registry — manages callr::r_bg background R processes
# for long-running HADES analyses.
#
# Jobs are stored in an in-memory environment keyed by job_id.
# Each entry is a list with: bg_process, submitted_at, type, spec.
# ──────────────────────────────────────────────────────────────────

library(callr)

# In-memory job store (lives as long as the R process)
.job_store <- new.env(parent = emptyenv())

#' Generate a unique job ID (microsecond precision + 5-digit random suffix)
.new_job_id <- function(prefix = "job") {
  paste0(prefix, "_", format(Sys.time(), "%Y%m%d%H%M%OS6"), "_", sample(10000:99999, 1))
}

#' Submit a background job
#'
#' @param type Character: "estimation", "prediction", "sccs", etc.
#' @param spec The full request spec (list)
#' @param func A function(spec) that runs the analysis and returns a result list
#' @return job_id (character)
submit_job <- function(type, spec, func) {
  job_id <- .new_job_id(type)

  bg <- callr::r_bg(
    func = func,
    args = list(spec = spec),
    package = FALSE,
    supervise = TRUE,
    cleanup = TRUE
  )

  .job_store[[job_id]] <- list(
    bg           = bg,
    type         = type,
    submitted_at = Sys.time(),
    spec_summary = list(
      type = type,
      source = spec$source$server %||% "unknown"
    )
  )

  cat(sprintf("[ASYNC] Job %s submitted (type=%s)\n", job_id, type))
  job_id
}

#' Get job status and result
#'
#' @param job_id Character
#' @return List with status, and result/error if complete
get_job_status <- function(job_id) {
  entry <- .job_store[[job_id]]
  if (is.null(entry)) {
    return(list(status = "not_found", job_id = job_id))
  }

  bg <- entry$bg

  if (bg$is_alive()) {
    return(list(
      status       = "running",
      job_id       = job_id,
      type         = entry$type,
      elapsed_seconds = round(as.numeric(difftime(Sys.time(), entry$submitted_at, units = "secs")), 1)
    ))
  }

  # Process finished — extract result or error.
  # Cache the result so subsequent polls can retrieve it (TTL-based cleanup below).
  if (is.null(entry$cached_result)) {
    cached <- tryCatch({
      result <- bg$get_result()
      list(
        status  = "completed",
        job_id  = job_id,
        type    = entry$type,
        elapsed_seconds = round(as.numeric(difftime(Sys.time(), entry$submitted_at, units = "secs")), 1),
        result  = result
      )
    }, error = function(e) {
      list(
        status  = "failed",
        job_id  = job_id,
        type    = entry$type,
        elapsed_seconds = round(as.numeric(difftime(Sys.time(), entry$submitted_at, units = "secs")), 1),
        error   = conditionMessage(e)
      )
    })
    # Store cached result with completion timestamp for TTL cleanup
    entry$cached_result <- cached
    entry$completed_at  <- Sys.time()
    .job_store[[job_id]] <- entry
  }

  entry$cached_result
}

#' Cancel a running job
#'
#' @param job_id Character
#' @return List with status
cancel_job <- function(job_id) {
  entry <- .job_store[[job_id]]
  if (is.null(entry)) {
    return(list(status = "not_found", job_id = job_id))
  }

  bg <- entry$bg
  if (bg$is_alive()) {
    bg$kill()
    cat(sprintf("[ASYNC] Job %s cancelled\n", job_id))
  }
  .job_store[[job_id]] <- NULL
  list(status = "cancelled", job_id = job_id)
}

#' Clean up completed/failed jobs older than TTL (default 5 minutes).
#' Called periodically (e.g., from a Plumber filter or health check).
cleanup_expired_jobs <- function(ttl_seconds = 300) {
  ids <- ls(.job_store)
  now <- Sys.time()
  for (id in ids) {
    entry <- .job_store[[id]]
    if (!is.null(entry$completed_at)) {
      age <- as.numeric(difftime(now, entry$completed_at, units = "secs"))
      if (age > ttl_seconds) {
        .job_store[[id]] <- NULL
        cat(sprintf("[ASYNC] Cleaned up expired job %s (age=%.0fs)\n", id, age))
      }
    }
  }
}

#' List all active jobs
#'
#' @return List of job status summaries
list_jobs <- function() {
  ids <- ls(.job_store)
  if (length(ids) == 0) return(list())

  lapply(ids, function(id) {
    entry <- .job_store[[id]]
    list(
      job_id       = id,
      type         = entry$type,
      is_alive     = entry$bg$is_alive(),
      elapsed_seconds = round(as.numeric(difftime(Sys.time(), entry$submitted_at, units = "secs")), 1)
    )
  })
}
