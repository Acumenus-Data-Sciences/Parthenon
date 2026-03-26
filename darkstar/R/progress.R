# ──────────────────────────────────────────────────────────────────
# Structured progress / logging utilities for HADES pipelines
# Wraps ParallelLogger and produces JSON-safe structured output
# ──────────────────────────────────────────────────────────────────

library(ParallelLogger)
source("/app/R/connection.R")  # for %||%

#' Create a structured logger that collects messages for the final response.
#'
#' Returns a list of functions:
#'   $info(msg, ...)   — record an info-level message
#'   $warn(msg, ...)   — record a warning-level message
#'   $error(msg, ...)  — record an error-level message
#'   $entries()        — return all collected log entries as a list
#'   $elapsed()        — seconds since logger creation
create_analysis_logger <- function() {
  entries <- list()
  start_time <- Sys.time()

  add_entry <- function(level, message, context = NULL) {
    entry <- list(
      level     = level,
      message   = message,
      timestamp = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3Z"),
      elapsed_s = round(as.numeric(difftime(Sys.time(), start_time, units = "secs")), 1)
    )
    if (!is.null(context)) entry$context <- context
    entries[[length(entries) + 1]] <<- entry

    # Also emit to console for Docker logs
    cat(sprintf("[%s] %s: %s\n", entry$timestamp, toupper(level), message))
  }

  list(
    info  = function(msg, context = NULL) add_entry("info",    msg, context),
    warn  = function(msg, context = NULL) add_entry("warning", msg, context),
    error = function(msg, context = NULL) add_entry("error",   msg, context),
    entries = function() entries,
    elapsed = function() round(as.numeric(difftime(Sys.time(), start_time, units = "secs")), 1)
  )
}

#' Safely execute a block, catching errors and returning a structured
#' error response suitable for the Plumber endpoint.
#'
#' @param res  The Plumber response object
#' @param logger  A logger from create_analysis_logger()
#' @param expr  An expression to evaluate (use bquote/substitute or just wrap in {})
#' @return The result of expr, or sets res$status and returns error list
safe_execute <- function(response, logger, expr) {
  tryCatch(
    expr,
    error = function(e) {
      logger$error(conditionMessage(e))
      response$status <- 500L
      list(
        status  = "error",
        message = conditionMessage(e),
        logs    = logger$entries(),
        elapsed_seconds = logger$elapsed()
      )
    }
  )
}
