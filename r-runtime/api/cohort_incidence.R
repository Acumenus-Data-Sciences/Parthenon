# ──────────────────────────────────────────────────────────────────
# CohortIncidence — OHDSI Incidence Rate Analysis
# POST /analysis/cohort-incidence/calculate
# ──────────────────────────────────────────────────────────────────

source("/app/R/connection.R")
source("/app/R/progress.R")

#* Calculate cohort incidence rates using the OHDSI CohortIncidence package
#* @post /analysis/cohort-incidence/calculate
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # ── Validate required fields ────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("connection", "targets", "outcomes", "time_at_risk",
                     "cdm_database_schema", "cohort_database_schema")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = paste("Missing required fields:", paste(missing, collapse = ", "))
    ))
  }

  if (!is.list(spec$targets) || length(spec$targets) == 0) {
    response$status <- 400L
    return(list(status = "error", message = "targets must be a non-empty array of {cohort_id, cohort_name}"))
  }

  if (!is.list(spec$outcomes) || length(spec$outcomes) == 0) {
    response$status <- 400L
    return(list(status = "error", message = "outcomes must be a non-empty array of {cohort_id, cohort_name}"))
  }

  if (!is.list(spec$time_at_risk) || length(spec$time_at_risk) == 0) {
    response$status <- 400L
    return(list(status = "error", message = "time_at_risk must be a non-empty array of TAR definitions"))
  }

  logger$info("CohortIncidence pipeline started", list(
    n_targets  = length(spec$targets),
    n_outcomes = length(spec$outcomes),
    n_tars     = length(spec$time_at_risk)
  ))

  safe_execute(response, logger, {
    library(CohortIncidence)

    # ── Parameters ──────────────────────────────────────────────
    cdmDatabaseSchema    <- spec$cdm_database_schema
    cohortDatabaseSchema <- spec$cohort_database_schema
    cohortTable          <- spec$cohort_table %||% "cohort"
    min_cell             <- as.integer(spec$min_cell_count %||% 5L)
    strata_spec          <- spec$strata %||% list()

    logger$info(sprintf(
      "CDM=%s, CohortDB=%s, Table=%s, MinCell=%d",
      cdmDatabaseSchema, cohortDatabaseSchema, cohortTable, min_cell
    ))

    # ── Step 1: Establish database connection ──────────────────
    logger$info("Connecting to CDM database")
    connectionDetails <- create_hades_connection(spec$connection)

    # ── Step 2: Build target cohort references ─────────────────
    logger$info(sprintf("Building %d target cohort references", length(spec$targets)))
    targetRefs <- lapply(spec$targets, function(t) {
      CohortIncidence::createCohortRef(
        id   = as.integer(t$cohort_id),
        name = as.character(t$cohort_name %||% paste("Target", t$cohort_id))
      )
    })

    # ── Step 3: Build outcome definitions ─────────────────────
    logger$info(sprintf("Building %d outcome definitions", length(spec$outcomes)))
    outcomeDefs <- lapply(spec$outcomes, function(o) {
      clean_window <- as.integer(o$clean_window %||% 0L)
      CohortIncidence::createOutcomeDef(
        id          = as.integer(o$cohort_id),
        name        = as.character(o$cohort_name %||% paste("Outcome", o$cohort_id)),
        cohortId    = as.integer(o$cohort_id),
        cleanWindow = clean_window
      )
    })

    # ── Step 4: Build time-at-risk definitions ─────────────────
    logger$info(sprintf("Building %d time-at-risk definitions", length(spec$time_at_risk)))
    tarDefs <- lapply(seq_along(spec$time_at_risk), function(i) {
      tar <- spec$time_at_risk[[i]]

      start_offset <- as.integer(tar$start_offset %||% 0L)
      start_anchor <- as.character(tar$start_anchor %||% "era_start")
      end_offset   <- as.integer(tar$end_offset   %||% 0L)
      end_anchor   <- as.character(tar$end_anchor  %||% "era_end")

      # CohortIncidence accepts "era_start"/"era_end" anchors
      CohortIncidence::createTimeAtRiskDef(
        id          = as.integer(i),
        startWith   = start_anchor,
        startOffset = start_offset,
        endWith     = end_anchor,
        endOffset   = end_offset
      )
    })

    # ── Step 5: Build strata settings (optional) ───────────────
    strataSettings <- NULL
    strata_requested <- isTRUE(strata_spec$by_age) ||
                        isTRUE(strata_spec$by_gender) ||
                        isTRUE(strata_spec$by_year)

    if (strata_requested) {
      logger$info("Building strata settings")

      age_breaks <- strata_spec$age_breaks
      if (is.null(age_breaks) || length(age_breaks) == 0) {
        age_breaks <- c(0L, 18L, 35L, 50L, 65L)
      } else {
        age_breaks <- as.integer(age_breaks)
      }

      strataSettings <- CohortIncidence::createStrataSettings(
        byAge    = isTRUE(strata_spec$by_age),
        byGender = isTRUE(strata_spec$by_gender),
        byYear   = isTRUE(strata_spec$by_year),
        ageBreaks = age_breaks
      )
    }

    # ── Step 6: Build analyses (target × outcome × TAR) ────────
    logger$info("Building incidence analyses")
    analyses <- list()
    analysis_id <- 1L

    for (target in spec$targets) {
      for (outcome in spec$outcomes) {
        for (tar_idx in seq_along(tarDefs)) {
          analyses[[length(analyses) + 1]] <- CohortIncidence::createIncidenceAnalysis(
            targets  = as.integer(target$cohort_id),
            outcomes = as.integer(outcome$cohort_id),
            tars     = as.integer(tar_idx)
          )
          analysis_id <- analysis_id + 1L
        }
      }
    }

    n_analyses <- length(analyses)
    logger$info(sprintf(
      "Created %d analysis combinations (%d targets × %d outcomes × %d TARs)",
      n_analyses,
      length(spec$targets),
      length(spec$outcomes),
      length(spec$time_at_risk)
    ))

    # ── Step 7: Assemble incidence design ──────────────────────
    logger$info("Assembling incidence design")

    design_args <- list(
      targets       = targetRefs,
      outcomes      = outcomeDefs,
      tars          = tarDefs,
      analysisList  = analyses
    )
    if (!is.null(strataSettings)) {
      design_args$strataSettings <- strataSettings
    }

    irDesign <- do.call(CohortIncidence::createIncidenceDesign, design_args)

    # ── Step 8: Build execution options ────────────────────────
    buildOptions <- CohortIncidence::buildOptions(
      cohortTable          = cohortTable,
      cdmDatabaseSchema    = cdmDatabaseSchema,
      sourceName           = spec$source_name %||% "CDM",
      resultsDatabaseSchema = cohortDatabaseSchema
    )

    # ── Step 9: Execute analysis ────────────────────────────────
    logger$info("Executing incidence analysis via CohortIncidence::executeAnalysis()")

    executeResults <- CohortIncidence::executeAnalysis(
      connectionDetails    = connectionDetails,
      incidenceDesign      = irDesign,
      buildOptions         = buildOptions
    )

    logger$info("Execution complete — processing results")

    # ── Step 10: Process raw results ───────────────────────────
    # executeAnalysis returns a data.frame (or tibble) with columns:
    #   TARGET_COHORT_DEFINITION_ID, OUTCOME_COHORT_DEFINITION_ID,
    #   TAR_ID, SUBGROUP_ID (optional, strata),
    #   PERSONS_AT_RISK, PERSON_TIME, OUTCOMES,
    #   INCIDENCE_PROPORTION_P1000, INCIDENCE_RATE_P1000PY
    results_df <- as.data.frame(executeResults)

    # Normalise column names to lowercase for consistent access
    names(results_df) <- tolower(names(results_df))

    # Build lookup maps for names
    target_name_map  <- stats::setNames(
      vapply(spec$targets,  function(t) as.character(t$cohort_name  %||% paste("Target",  t$cohort_id)), character(1)),
      vapply(spec$targets,  function(t) as.character(t$cohort_id),  character(1))
    )
    outcome_name_map <- stats::setNames(
      vapply(spec$outcomes, function(o) as.character(o$cohort_name %||% paste("Outcome", o$cohort_id)), character(1)),
      vapply(spec$outcomes, function(o) as.character(o$cohort_id), character(1))
    )

    # Build a TAR label map (1-indexed positional)
    tar_label_map <- stats::setNames(
      vapply(seq_along(spec$time_at_risk), function(i) {
        tar <- spec$time_at_risk[[i]]
        sprintf("%s%+d to %s%+d",
          tar$start_anchor %||% "era_start", as.integer(tar$start_offset %||% 0L),
          tar$end_anchor   %||% "era_end",   as.integer(tar$end_offset   %||% 0L))
      }, character(1)),
      as.character(seq_along(spec$time_at_risk))
    )

    # Confidence interval helper (exact Poisson for rates, Wilson for proportions)
    .poisson_ci <- function(events, time, conf = 0.95) {
      alpha <- 1 - conf
      if (is.na(events) || is.na(time) || time <= 0) {
        return(list(lower = NA_real_, upper = NA_real_))
      }
      n <- as.numeric(events)
      t <- as.numeric(time)
      lower <- qgamma(alpha / 2,     shape = n,     rate = 1) / t * 1000
      upper <- qgamma(1 - alpha / 2, shape = n + 1, rate = 1) / t * 1000
      list(lower = round(lower, 4), upper = round(upper, 4))
    }

    .wilson_ci <- function(k, n, conf = 0.95) {
      if (is.na(k) || is.na(n) || n == 0) {
        return(list(lower = NA_real_, upper = NA_real_))
      }
      z <- qnorm(1 - (1 - conf) / 2)
      p <- k / n
      denom <- 1 + z^2 / n
      centre <- (p + z^2 / (2 * n)) / denom
      spread <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / denom
      list(
        lower = round(max(0, (centre - spread) * 1000), 4),
        upper = round(min(1000, (centre + spread) * 1000), 4)
      )
    }

    # Helper: suppress a numeric count that falls below min_cell_count
    .suppress <- function(x) {
      x <- as.integer(x)
      if (!is.na(x) && x > 0L && x < min_cell) paste0("<", min_cell) else x
    }

    # ── Build structured incidence_rates list ──────────────────
    incidence_rates <- vector("list", nrow(results_df))

    for (row_i in seq_len(nrow(results_df))) {
      r <- results_df[row_i, ]

      target_id  <- as.character(r$target_cohort_definition_id)
      outcome_id <- as.character(r$outcome_cohort_definition_id)
      tar_id     <- as.character(r$tar_id)

      persons_at_risk  <- as.integer(r$persons_at_risk  %||% NA)
      person_time      <- as.numeric(r$person_time      %||% NA)  # person-days typically
      outcomes_count   <- as.integer(r$outcomes         %||% NA)

      # Convert person-days → person-years if column appears to be in days
      # CohortIncidence stores PERSON_TIME as person-days
      person_years <- if (!is.na(person_time)) round(person_time / 365.25, 4) else NA_real_

      # Raw rates already computed by CohortIncidence (per 1000 PY and per 1000 persons)
      ir_raw  <- as.numeric(r$incidence_rate_p1000py       %||% NA)
      ip_raw  <- as.numeric(r$incidence_proportion_p1000   %||% NA)

      # Confidence intervals
      rate_ci  <- .poisson_ci(outcomes_count, person_years)
      prop_ci  <- .wilson_ci(outcomes_count, persons_at_risk)

      # Privacy suppression
      suppressed_outcomes <- .suppress(outcomes_count)

      # Strata info (present only when strata were requested)
      subgroup_id   <- if ("subgroup_id"   %in% names(r)) as.integer(r$subgroup_id)   else NA_integer_
      subgroup_name <- if ("subgroup_name" %in% names(r)) as.character(r$subgroup_name) else NA_character_

      incidence_rates[[row_i]] <- list(
        target_cohort_id    = as.integer(target_id),
        target_cohort_name  = target_name_map[[target_id]]  %||% paste("Target",  target_id),
        outcome_cohort_id   = as.integer(outcome_id),
        outcome_cohort_name = outcome_name_map[[outcome_id]] %||% paste("Outcome", outcome_id),
        tar_id              = as.integer(tar_id),
        tar_label           = tar_label_map[[tar_id]] %||% paste("TAR", tar_id),
        subgroup_id         = subgroup_id,
        subgroup_name       = subgroup_name,
        persons_at_risk     = as.integer(persons_at_risk),
        person_years        = person_years,
        outcomes            = suppressed_outcomes,
        incidence_rate_p1000py     = round(ir_raw %||% NA_real_, 4),
        incidence_proportion_p1000 = round(ip_raw %||% NA_real_, 4),
        rate_ci_95 = list(
          lower = rate_ci$lower,
          upper = rate_ci$upper
        ),
        proportion_ci_95 = list(
          lower = prop_ci$lower,
          upper = prop_ci$upper
        )
      )
    }

    # ── Aggregate summary ──────────────────────────────────────
    # Roll up across all strata rows — sum person_time, outcomes; re-compute IR
    compute_summary <- function(df_subset) {
      total_persons   <- as.integer(sum(df_subset$persons_at_risk, na.rm = TRUE))
      # Use only the primary (non-stratified, subgroup_id == 0 or NA) rows for
      # person totals to avoid double-counting strata slices
      total_py        <- round(sum(df_subset$person_time / 365.25, na.rm = TRUE), 4)
      total_outcomes  <- as.integer(sum(df_subset$outcomes, na.rm = TRUE))
      ir_overall      <- if (total_py > 0) round(total_outcomes / total_py * 1000, 4) else NA_real_
      list(
        persons_at_risk   = total_persons,
        total_person_years = total_py,
        total_outcomes    = .suppress(total_outcomes),
        incidence_rate_p1000py = ir_overall
      )
    }

    # Base rows only (subgroup_id == 0 or missing, meaning no strata split)
    if ("subgroup_id" %in% names(results_df)) {
      base_rows <- results_df[is.na(results_df$subgroup_id) | results_df$subgroup_id == 0L, ]
    } else {
      base_rows <- results_df
    }

    overall_summary <- if (nrow(base_rows) > 0) compute_summary(base_rows) else compute_summary(results_df)

    logger$info(sprintf(
      "CohortIncidence complete: %d result rows, overall IR=%.2f per 1000 PY",
      nrow(results_df),
      overall_summary$incidence_rate_p1000py %||% 0
    ))

    # ── Return ─────────────────────────────────────────────────
    list(
      status  = "completed",
      summary = list(
        n_targets         = length(spec$targets),
        n_outcomes        = length(spec$outcomes),
        n_tars            = length(spec$time_at_risk),
        n_result_rows     = as.integer(nrow(results_df)),
        strata_applied    = strata_requested,
        min_cell_count    = min_cell,
        persons_at_risk   = overall_summary$persons_at_risk,
        total_person_years = overall_summary$total_person_years,
        total_outcomes    = overall_summary$total_outcomes,
        overall_incidence_rate_p1000py = overall_summary$incidence_rate_p1000py
      ),
      incidence_rates = incidence_rates,
      design = list(
        targets  = lapply(spec$targets,  function(t) list(
          cohort_id   = as.integer(t$cohort_id),
          cohort_name = as.character(t$cohort_name %||% paste("Target",  t$cohort_id))
        )),
        outcomes = lapply(spec$outcomes, function(o) list(
          cohort_id    = as.integer(o$cohort_id),
          cohort_name  = as.character(o$cohort_name %||% paste("Outcome", o$cohort_id)),
          clean_window = as.integer(o$clean_window %||% 0L)
        )),
        time_at_risk = lapply(seq_along(spec$time_at_risk), function(i) {
          tar <- spec$time_at_risk[[i]]
          list(
            tar_id       = as.integer(i),
            start_offset = as.integer(tar$start_offset %||% 0L),
            start_anchor = as.character(tar$start_anchor %||% "era_start"),
            end_offset   = as.integer(tar$end_offset   %||% 0L),
            end_anchor   = as.character(tar$end_anchor  %||% "era_end"),
            label        = tar_label_map[[as.character(i)]]
          )
        }),
        strata = if (strata_requested) list(
          by_age    = isTRUE(strata_spec$by_age),
          by_gender = isTRUE(strata_spec$by_gender),
          by_year   = isTRUE(strata_spec$by_year),
          age_breaks = if (isTRUE(strata_spec$by_age)) as.integer(strata_spec$age_breaks %||% c(0,18,35,50,65)) else NULL
        ) else NULL
      ),
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}

#* Health check for the CohortIncidence router
#* @get /analysis/cohort-incidence/health
#* @serializer unboxedJSON
function() {
  list(
    status  = "ok",
    service = "cohort-incidence",
    endpoints = c("POST /analysis/cohort-incidence/calculate")
  )
}
