# ──────────────────────────────────────────────────────────────────
# PheValuator — phenotype validation metrics
# POST /analysis/phenotype-validation/run
# ──────────────────────────────────────────────────────────────────

.phevaluator_available <- requireNamespace("PheValuator", quietly = TRUE)
source("/app/R/progress.R")

.ensure_list <- function(x) {
  if (is.null(x)) return(x)
  if (is.data.frame(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) {
      .ensure_list(as.list(x[i, , drop = FALSE]))
    })
    if (nrow(x) == 1) return(rows[[1]])
    return(rows)
  }
  if (is.list(x)) return(lapply(x, .ensure_list))
  x
}

.count_value <- function(counts, snake_name, camel_name) {
  value <- counts[[snake_name]] %||% counts[[camel_name]]
  if (is.null(value) || length(value) == 0) {
    stop("counts.", snake_name, " is required")
  }

  numeric_value <- suppressWarnings(as.numeric(value[[1]]))
  if (is.na(numeric_value) || !is.finite(numeric_value) || numeric_value < 0) {
    stop("counts.", snake_name, " must be a non-negative integer")
  }

  as.integer(numeric_value)
}

.number_or_null <- function(value, digits = 6L) {
  if (is.null(value) || length(value) == 0) return(NULL)
  numeric_value <- suppressWarnings(as.numeric(value[[1]]))
  if (is.na(numeric_value) || !is.finite(numeric_value)) return(NULL)
  round(numeric_value, digits)
}

.metric <- function(row, estimate, lower = NULL, upper = NULL) {
  metric <- list(estimate = .number_or_null(row[[estimate]]))
  if (!is.null(lower)) metric$ci_lower <- .number_or_null(row[[lower]])
  if (!is.null(upper)) metric$ci_upper <- .number_or_null(row[[upper]])
  metric
}

#* Run PheValuator performance metric computation
#* @post /analysis/phenotype-validation/run
#* @serializer unboxedJSON
function(body, response) {
  if (!isTRUE(.phevaluator_available)) {
    response$status <- 501L
    return(list(
      status = "error",
      message = "PheValuator R package is not installed in this Darkstar image. Install HADES PheValuator and restart the container to enable this endpoint."
    ))
  }

  spec <- .ensure_list(body)
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  mode <- spec$mode %||% "counts"
  if (!identical(as.character(mode), "counts")) {
    response$status <- 400L
    return(list(status = "error", message = "Only counts mode is currently supported"))
  }

  if (is.null(spec$counts) || !is.list(spec$counts)) {
    response$status <- 400L
    return(list(status = "error", message = "counts is required"))
  }

  safe_execute(response, logger, {
    logger$info("PheValuator count metrics started")

    input_counts <- list(
      true_positives = .count_value(spec$counts, "true_positives", "truePositives"),
      false_negatives = .count_value(spec$counts, "false_negatives", "falseNegatives"),
      false_positives = .count_value(spec$counts, "false_positives", "falsePositives"),
      true_negatives = .count_value(spec$counts, "true_negatives", "trueNegatives")
    )

    counts_df <- data.frame(
      truePositives = input_counts$true_positives,
      falseNegatives = input_counts$false_negatives,
      falsePositives = input_counts$false_positives,
      trueNegatives = input_counts$true_negatives
    )

    metrics_df <- PheValuator::computePerformanceMetricsFromCounts(counts_df)
    row <- as.list(metrics_df[1, , drop = FALSE])

    logger$info("PheValuator count metrics completed", input_counts)

    list(
      status = "completed",
      engine = "phevaluator",
      package = "PheValuator",
      package_version = as.character(utils::packageVersion("PheValuator")),
      mode = "counts",
      cohort = spec$cohort %||% NULL,
      counts = input_counts,
      metrics = list(
        sensitivity = .metric(row, "sens", "sensCi95Lb", "sensCi95Ub"),
        positive_predictive_value = .metric(row, "ppv", "ppvCi95Lb", "ppvCi95Ub"),
        specificity = .metric(row, "spec", "specCi95Lb", "specCi95Ub"),
        negative_predictive_value = .metric(row, "npv", "npvCi95Lb", "npvCi95Ub"),
        estimated_prevalence = .metric(row, "estimatedPrevalence"),
        f1_score = .metric(row, "f1Score")
      ),
      logs = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
