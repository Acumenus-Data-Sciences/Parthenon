# ──────────────────────────────────────────────────────────────────
# Evidence Synthesis — Cross-Database Meta-Analysis
# POST /analysis/evidence-synthesis/run
# ──────────────────────────────────────────────────────────────────

library(EvidenceSynthesis)
source("/app/R/connection.R")
source("/app/R/progress.R")

#* Run meta-analysis across multiple site estimates
#* @post /run
#* @serializer unboxedJSON
function(req, res) {
  spec   <- req$body
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    res$status <- 400L
    return(list(status = "error", message = "No specification provided"))
  }

  if (is.null(spec$estimates) || length(spec$estimates) < 2) {
    res$status <- 400L
    return(list(status = "error", message = "At least 2 site estimates are required for meta-analysis"))
  }

  logger$info("Evidence synthesis started", list(n_sites = length(spec$estimates)))

  safe_execute(res, logger, {
    # Build data frame from site estimates
    # Note: plumber/jsonlite may convert homogeneous arrays-of-objects into
    # a data.frame instead of a list of lists. Handle both cases.
    estimates <- spec$estimates
    if (is.data.frame(estimates)) {
      # Already a data.frame — access columns directly
      site_data <- data.frame(
        logRr   = as.numeric(estimates$logRr %||% estimates$log_rr),
        seLogRr = as.numeric(estimates$seLogRr %||% estimates$se_log_rr %||% estimates$seLogRr),
        site    = as.character(estimates$siteName %||% estimates$site_name %||% paste0("Site ", seq_len(nrow(estimates)))),
        stringsAsFactors = FALSE
      )
    } else {
      # List of lists — iterate elements
      site_data <- data.frame(
        logRr   = sapply(estimates, function(e) as.numeric(e$log_rr %||% e$logRr)),
        seLogRr = sapply(estimates, function(e) as.numeric(e$se_log_rr %||% e$seLogRr)),
        site    = sapply(seq_along(estimates), function(i) {
          estimates[[i]]$site_name %||% estimates[[i]]$siteName %||% paste0("Site ", i)
        }),
        stringsAsFactors = FALSE
      )
    }

    # Remove rows with NA
    valid_rows <- complete.cases(site_data[, c("logRr", "seLogRr")])
    site_data  <- site_data[valid_rows, ]

    if (nrow(site_data) < 2) {
      res$status <- 400L
      return(list(status = "error", message = "Fewer than 2 valid estimates after removing NAs"))
    }

    method <- tolower(spec$method %||% "bayesian")

    if (method == "fixed") {
      logger$info("Computing fixed-effect meta-analysis")
      result <- EvidenceSynthesis::computeFixedEffectMetaAnalysis(site_data)
    } else {
      logger$info("Computing Bayesian random-effects meta-analysis")
      result <- EvidenceSynthesis::computeBayesianMetaAnalysis(
        data             = site_data,
        chainLength      = as.integer(spec$chain_length %||% 1100000),
        burnIn           = as.integer(spec$burn_in      %||% 100000),
        subSampleFrequency = as.integer(spec$sub_sample %||% 100)
      )
    }

    # Extract pooled estimate
    pooled_log_rr <- result$logRr %||% result$mu[1]
    pooled_se     <- result$seLogRr %||% result$muSe[1]
    pooled_hr     <- exp(pooled_log_rr)
    pooled_ci_lo  <- exp(pooled_log_rr - 1.96 * pooled_se)
    pooled_ci_hi  <- exp(pooled_log_rr + 1.96 * pooled_se)
    tau           <- result$tau %||% NA_real_

    # Per-site results for forest plot
    per_site <- lapply(seq_len(nrow(site_data)), function(i) {
      list(
        site_name = site_data$site[i],
        log_rr    = round(site_data$logRr[i], 4),
        se_log_rr = round(site_data$seLogRr[i], 4),
        hr        = round(exp(site_data$logRr[i]), 4),
        ci_lower  = round(exp(site_data$logRr[i] - 1.96 * site_data$seLogRr[i]), 4),
        ci_upper  = round(exp(site_data$logRr[i] + 1.96 * site_data$seLogRr[i]), 4)
      )
    })

    logger$info("Evidence synthesis complete", list(
      pooled_hr = round(pooled_hr, 4),
      tau = round(tau, 4)
    ))

    list(
      status = "completed",
      method = method,
      pooled = list(
        log_rr    = round(pooled_log_rr, 4),
        se_log_rr = round(pooled_se, 4),
        hr        = round(pooled_hr, 4),
        ci_lower  = round(pooled_ci_lo, 4),
        ci_upper  = round(pooled_ci_hi, 4),
        tau       = round(tau, 4)
      ),
      per_site        = per_site,
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
