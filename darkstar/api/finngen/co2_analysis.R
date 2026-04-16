# darkstar/api/finngen/co2_analysis.R
#
# Async analysis endpoints wrapping CO2AnalysisModules::execute_*.
# Per spec §0.1 handoff: we NEVER library(CO2AnalysisModules) because its
# Shiny deps pollute the runtime — we call functions via CO2AnalysisModules::
# qualified prefix only.
#
# Each function:
#   1. Creates the export folder (artifact sink)
#   2. Wraps everything in run_with_classification so DB/OOM/etc errors are
#      surfaced via result$error$category
#   3. Writes newline-JSON progress via write_progress (rotating buffer)
#   4. Writes a summary.json with per-analysis metadata
#
# Called from Plumber routes (B6) inside a mirai::mirai task. The mirai
# task's return value is what the Plumber /jobs/{id} endpoint surfaces.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

.write_display <- function(export_folder, display_obj) {
  writeLines(
    jsonlite::toJSON(display_obj, auto_unbox = TRUE, null = "null", force = TRUE, digits = 8),
    file.path(export_folder, "display.json")
  )
}

# Translate the snake_case params sent by Parthenon's frontend into the
# camelCase names CO2AnalysisModules::execute_* expects. Mapping is per-module
# since different CO2 functions use different param names (e.g. CodeWAS uses
# cohortIdCases/cohortIdControls, Demographics uses cohortIds).
.normalize_co2_settings <- function(module_key, settings) {
  if (is.null(settings)) settings <- list()

  # Generic snake_case → camelCase translations
  translations <- list(
    case_cohort_id    = "cohortIdCases",
    control_cohort_id = "cohortIdControls",
    cohort_ids        = "cohortIds",
    min_cell_count    = "minCellCount",
    reference_years   = "referenceYears",
    group_by          = "groupBy",
    analysis_ids      = "analysisIds"
  )

  out <- list()
  for (name in names(settings)) {
    camel_name <- translations[[name]] %||% name
    out[[camel_name]] <- settings[[name]]
  }

  # timeCodeWAS: flatten time_windows array-of-objects → temporalStartDays vector
  if (identical(module_key, "co2.time_codewas") && !is.null(settings$time_windows)) {
    tw <- settings$time_windows
    if (is.list(tw) || is.data.frame(tw)) {
      start_days <- vapply(tw, function(w) as.integer(w$start_day %||% w[["start_day"]]), integer(1))
      out$temporalStartDays <- start_days
      out$time_windows <- NULL
    }
  }

  # Universal default — all CO2 modules require minCellCount for privacy gating.
  if (is.null(out$minCellCount)) out$minCellCount <- 5L

  # Module-specific defaults for required CO2AnalysisModules params
  # that aren't surfaced in the Parthenon settings schema yet.
  if (identical(module_key, "co2.demographics")) {
    # CO2 expects a reference date column on person/cohort, not a year keyword.
    if (is.null(out$referenceYears) || length(out$referenceYears) == 0) {
      out$referenceYears <- "cohort_start_date"
    }
    # IMPORTANT: use all 3 dimensions to avoid the upstream groupBy-subset bug
    # (CO2AnalysisModules#199). When groupBy is a strict subset, the function's
    # reshape branch drops the referenceYear column that's later transmute'd.
    # All 3 dimensions = skip the buggy branch entirely.
    if (is.null(out$groupBy) || length(out$groupBy) == 0) {
      out$groupBy <- c("calendarYear", "ageGroup", "gender")
    }
  }
  if (identical(module_key, "co2.codewas") || identical(module_key, "co2.time_codewas")) {
    if (is.null(out$analysisIds) || length(out$analysisIds) == 0) {
      # CO2AnalysisModules allowed analysis IDs (subset of FeatureExtraction's
      # built-in covariate set). Keep minimal — one per domain.
      out$analysisIds <- c(101L, 141L, 201L, 301L, 401L, 501L, 601L, 701L, 801L)
    }
  }

  out
}

finngen_co2_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5, message = "Opening DB connection"))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CodeWAS", pct = 10, message = "Running CodeWAS association scan"))
    res <- CO2AnalysisModules::execute_CodeWAS(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = .normalize_co2_settings("co2.codewas", analysis_settings)
    )

    write_progress(progress_path, list(step = "write_summary", pct = 95))
    rows <- if (!is.null(res$codeWASCounts)) nrow(res$codeWASCounts) else NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.codewas",
      rows          = rows,
      case_cohort   = analysis_settings$cohortIdCases %||% NA_integer_,
      control_cohort = analysis_settings$cohortIdControls %||% NA_integer_,
      covariate_ids = analysis_settings$analysisIds %||% integer()
    ))

    # ── SP3: emit display.json for Manhattan plot + signal table ──
    write_progress(progress_path, list(step = "build_display", pct = 96, message = "Building display.json"))
    display <- tryCatch({
      # Read the CodeWAS CSV output written by CO2AnalysisModules
      csv_path <- file.path(export_folder, "codeWASCounts.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        n_total <- nrow(df)
        # Bonferroni threshold: 0.05 / total codes tested
        bonf <- if (n_total > 0) 0.05 / n_total else 0.05
        sugg <- bonf * 10  # suggestive threshold = 10x Bonferroni

        sig_df <- df[!is.na(df$pValue) & df$pValue < bonf, ]

        signals <- lapply(seq_len(nrow(df)), function(i) {
          list(
            concept_id    = as.integer(df$conceptId[i]),
            concept_name  = as.character(df$conceptName[i]),
            domain_id     = as.character(df$domainId[i]),
            p_value       = df$pValue[i],
            beta          = df$beta[i],
            se            = df$se[i],
            n_cases       = as.integer(df$nCases[i]),
            n_controls    = as.integer(df$nControls[i])
          )
        })

        list(
          signals    = signals,
          thresholds = list(bonferroni = bonf, suggestive = sugg),
          summary    = list(total_codes_tested = n_total, significant_count = nrow(sig_df))
        )
      } else {
        # Fallback: use the res object from execute_CodeWAS
        counts_df <- res$codeWASCounts
        if (!is.null(counts_df) && nrow(counts_df) > 0) {
          n_total <- nrow(counts_df)
          bonf <- 0.05 / n_total
          sugg <- bonf * 10
          sig_count <- sum(!is.na(counts_df$pValue) & counts_df$pValue < bonf, na.rm = TRUE)

          signals <- lapply(seq_len(nrow(counts_df)), function(i) {
            list(
              concept_id    = as.integer(counts_df$conceptId[i]),
              concept_name  = as.character(counts_df$conceptName[i]),
              domain_id     = as.character(counts_df$domainId[i]),
              p_value       = counts_df$pValue[i],
              beta          = counts_df$beta[i],
              se            = counts_df$se[i],
              n_cases       = as.integer(counts_df$nCases[i]),
              n_controls    = as.integer(counts_df$nControls[i])
            )
          })

          list(
            signals    = signals,
            thresholds = list(bonferroni = bonf, suggestive = sugg),
            summary    = list(total_codes_tested = n_total, significant_count = sig_count)
          )
        } else {
          list(signals = list(), thresholds = list(bonferroni = 0.05, suggestive = 0.5), summary = list(total_codes_tested = 0L, significant_count = 0L))
        }
      }
    }, error = function(e) {
      list(signals = list(), thresholds = list(bonferroni = 0.05, suggestive = 0.5), summary = list(total_codes_tested = 0L, significant_count = 0L, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(rows = rows)
  })
}

finngen_co2_time_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_timeCodeWAS", pct = 10, message = "Running temporal CodeWAS"))
    res <- CO2AnalysisModules::execute_timeCodeWAS(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = .normalize_co2_settings("co2.time_codewas", analysis_settings)
    )

    rows <- if (!is.null(res$timeCodeWASCounts)) nrow(res$timeCodeWASCounts) else NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.time_codewas",
      rows          = rows,
      temporal_windows = analysis_settings$temporalStartDays %||% integer()
    ))

    # ── SP3: emit display.json for tabbed Manhattan plots ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      # Read the timeCodeWAS CSV output
      csv_path <- file.path(export_folder, "timeCodeWASCounts.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        # Group by temporal window (startDay, endDay)
        window_keys <- unique(df[, c("startDay", "endDay"), drop = FALSE])
        windows <- lapply(seq_len(nrow(window_keys)), function(w) {
          sd <- window_keys$startDay[w]
          ed <- window_keys$endDay[w]
          wdf <- df[df$startDay == sd & df$endDay == ed, ]
          signals <- lapply(seq_len(nrow(wdf)), function(i) {
            list(
              concept_id   = as.integer(wdf$conceptId[i]),
              concept_name = as.character(wdf$conceptName[i]),
              domain_id    = as.character(wdf$domainId[i]),
              p_value      = wdf$pValue[i],
              beta         = wdf$beta[i],
              se           = wdf$se[i],
              n_cases      = as.integer(wdf$nCases[i]),
              n_controls   = as.integer(wdf$nControls[i])
            )
          })
          list(start_day = as.integer(sd), end_day = as.integer(ed), signals = signals)
        })

        total_sig <- sum(sapply(windows, function(w) {
          n <- length(w$signals)
          if (n == 0) return(0L)
          bonf <- 0.05 / n
          sum(sapply(w$signals, function(s) if (!is.na(s$p_value) && s$p_value < bonf) 1L else 0L))
        }))

        list(
          windows = windows,
          summary = list(window_count = nrow(window_keys), total_significant = total_sig)
        )
      } else {
        list(windows = list(), summary = list(window_count = 0L, total_significant = 0L))
      }
    }, error = function(e) {
      list(windows = list(), summary = list(window_count = 0L, total_significant = 0L, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(rows = rows)
  })
}

finngen_co2_overlaps_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CohortOverlaps", pct = 10))
    res <- CO2AnalysisModules::execute_CohortOverlaps(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = .normalize_co2_settings("co2.overlaps", analysis_settings)
    )

    .write_summary(export_folder, list(
      analysis_type = "co2.overlaps",
      cohort_ids    = analysis_settings$cohortIds %||% integer()
    ))

    # ── SP3: emit display.json for UpSet plot ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      # CO2AnalysisModules writes overlapResults.csv and/or returns overlap data in res
      csv_path <- file.path(export_folder, "overlapResults.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        # Build sets array
        cohort_ids <- unique(c(df$cohortId1, df$cohortId2))
        sets <- lapply(cohort_ids, function(cid) {
          size <- max(df$size1[df$cohortId1 == cid], df$size2[df$cohortId2 == cid], na.rm = TRUE)
          name <- if ("cohortName1" %in% names(df)) {
            row1 <- df[df$cohortId1 == cid, ]
            if (nrow(row1) > 0) row1$cohortName1[1] else paste("Cohort", cid)
          } else paste("Cohort", cid)
          list(cohort_id = as.integer(cid), cohort_name = as.character(name), size = as.integer(size))
        })

        # Build intersections (pairwise from data)
        intersections <- lapply(seq_len(nrow(df)), function(i) {
          list(
            members = c(as.integer(df$cohortId1[i]), as.integer(df$cohortId2[i])),
            size    = as.integer(df$overlapSize[i]),
            degree  = 2L
          )
        })

        # Build matrix
        n <- length(cohort_ids)
        mat <- matrix(0L, nrow = n, ncol = n)
        for (i in seq_len(nrow(df))) {
          r <- match(df$cohortId1[i], cohort_ids)
          c <- match(df$cohortId2[i], cohort_ids)
          mat[r, c] <- as.integer(df$overlapSize[i])
          mat[c, r] <- as.integer(df$overlapSize[i])
        }
        for (s in seq_along(sets)) mat[s, s] <- as.integer(sets[[s]]$size)

        max_pct <- if (length(intersections) > 0) {
          max(sapply(intersections, function(ix) {
            min_set <- min(sapply(ix$members, function(m) {
              si <- sets[[match(m, cohort_ids)]]$size
              if (is.null(si) || si == 0) Inf else si
            }))
            if (is.infinite(min_set)) 0 else round(ix$size / min_set * 100, 1)
          }))
        } else 0

        list(
          sets          = sets,
          intersections = intersections,
          matrix        = apply(mat, 1, as.list),
          summary       = list(max_overlap_pct = max_pct)
        )
      } else {
        list(sets = list(), intersections = list(), matrix = list(), summary = list(max_overlap_pct = 0))
      }
    }, error = function(e) {
      list(sets = list(), intersections = list(), matrix = list(), summary = list(max_overlap_pct = 0, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    res
  })
}

finngen_co2_demographics_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "execute_CohortDemographics", pct = 10))
    res <- CO2AnalysisModules::execute_CohortDemographics(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = .normalize_co2_settings("co2.demographics", analysis_settings)
    )

    total <- res$total %||% NA_integer_
    .write_summary(export_folder, list(
      analysis_type = "co2.demographics",
      total         = total,
      cohort_ids    = analysis_settings$cohortIds %||% integer()
    ))

    # ── SP3: emit display.json for age pyramid + summary ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      csv_path <- file.path(export_folder, "demographicsResults.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        cohort_ids <- unique(df$cohortId)
        cohorts <- lapply(cohort_ids, function(cid) {
          cdf <- df[df$cohortId == cid, ]
          cohort_name <- if ("cohortName" %in% names(cdf)) cdf$cohortName[1] else paste("Cohort", cid)
          n <- as.integer(sum(cdf$count, na.rm = TRUE))

          # Age histogram by decile
          decile_data <- aggregate(cbind(maleCount = cdf$maleCount, femaleCount = cdf$femaleCount),
                                   by = list(decile = cdf$ageDecile), FUN = sum, na.rm = TRUE)
          age_histogram <- lapply(seq_len(nrow(decile_data)), function(i) {
            list(
              decile = as.integer(decile_data$decile[i]),
              male   = as.integer(decile_data$maleCount[i]),
              female = as.integer(decile_data$femaleCount[i])
            )
          })

          total_male    <- as.integer(sum(cdf$maleCount, na.rm = TRUE))
          total_female  <- as.integer(sum(cdf$femaleCount, na.rm = TRUE))
          total_unknown <- as.integer(n - total_male - total_female)
          if (total_unknown < 0) total_unknown <- 0L

          mean_age   <- if ("meanAge" %in% names(cdf)) round(mean(cdf$meanAge, na.rm = TRUE), 1) else NA_real_
          median_age <- if ("medianAge" %in% names(cdf)) round(median(cdf$medianAge, na.rm = TRUE), 0) else NA_real_

          list(
            cohort_id     = as.integer(cid),
            cohort_name   = as.character(cohort_name),
            n             = n,
            age_histogram = age_histogram,
            gender_counts = list(male = total_male, female = total_female, unknown = total_unknown),
            summary       = list(mean_age = mean_age, median_age = median_age)
          )
        })
        list(cohorts = cohorts)
      } else {
        list(cohorts = list())
      }
    }, error = function(e) {
      list(cohorts = list(), error = conditionMessage(e))
    })

    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(total = total)
  })
}
