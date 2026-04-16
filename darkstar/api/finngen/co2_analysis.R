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
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", na = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

.write_display <- function(export_folder, display_obj) {
  writeLines(
    jsonlite::toJSON(display_obj, auto_unbox = TRUE, null = "null", na = "null", force = TRUE, digits = 8),
    file.path(export_folder, "display.json")
  )
}

# CO2AnalysisModules execute_* functions return a character path to
# analysisResults.duckdb, NOT a list with per-result-type tibbles. Our workers
# originally assumed list-return (res$codeWASCounts, res$total, etc). Use this
# helper to count rows from the duckdb result table given its name.
.count_rows_in_duckdb <- function(res, export_folder, table_name) {
  tryCatch({
    db_path <- if (is.character(res) && length(res) == 1 && file.exists(res)) res
               else file.path(export_folder, "analysisResults.duckdb")
    if (!file.exists(db_path)) return(NA_integer_)
    conn <- duckdb::dbConnect(duckdb::duckdb(), db_path, read_only = TRUE)
    on.exit(tryCatch(duckdb::dbDisconnect(conn, shutdown = TRUE), error = function(e) NULL), add = TRUE)
    tables <- DBI::dbListTables(conn)
    if (!(table_name %in% tables)) return(NA_integer_)
    n <- DBI::dbGetQuery(conn, sprintf('SELECT COUNT(*) AS n FROM "%s"', table_name))$n[1]
    as.integer(n)
  }, error = function(e) NA_integer_)
}

# Extract the list of cohort_ids that a given module will use, from the raw
# (pre-normalized) analysis_settings sent by Parthenon. Handles both snake_case
# (Parthenon API) and camelCase (Shiny-parity) param names.
.extract_cohort_ids_for_module <- function(module_key, settings) {
  if (is.null(settings)) return(integer(0))
  ids <- c()
  if (identical(module_key, "co2.codewas") || identical(module_key, "co2.time_codewas")) {
    case_id <- settings$case_cohort_id %||% settings$cohortIdCases
    ctrl_id <- settings$control_cohort_id %||% settings$cohortIdControls
    ids <- c(ids, case_id, ctrl_id)
  } else {
    ids <- c(ids, settings$cohort_ids %||% settings$cohortIds)
  }
  ids <- as.integer(unlist(ids))
  ids[!is.na(ids) & ids > 0]
}

# Copy selected cohort rows from the source's canonical cohort table (e.g.
# pancreas_results.cohort, owned by Parthenon's cohort pipeline) into the
# finngen_cohort table that the HadesExtras handler uses. CO2AnalysisModules
# needs the cohort to be writable (it DROPs/CREATEs _distinct temp tables)
# AND to actually contain the subject rows for the requested cohort_ids.
#
# Idempotent: deletes existing rows for the requested cohort_ids first, then
# INSERT SELECTs from the canonical cohort table. Creates finngen_cohort with
# the same schema if it doesn't exist.
.stage_cohorts_for_finngen <- function(handler, source_envelope, cohort_ids) {
  if (is.null(cohort_ids) || length(cohort_ids) == 0) return(invisible(NULL))
  ids <- as.integer(unlist(cohort_ids))
  ids <- ids[!is.na(ids)]
  if (length(ids) == 0) return(invisible(NULL))

  cohort_schema <- source_envelope$schemas$cohort
  conn <- handler$connectionHandler$getConnection()

  # Ensure finngen_cohort exists (same schema as the standard OMOP cohort table).
  ensure_sql <- sprintf(
    "CREATE TABLE IF NOT EXISTS %s.finngen_cohort (
       cohort_definition_id INTEGER NOT NULL,
       subject_id BIGINT NOT NULL,
       cohort_start_date DATE NOT NULL,
       cohort_end_date DATE NOT NULL
     )", cohort_schema
  )
  DatabaseConnector::executeSql(conn, ensure_sql, progressBar = FALSE, reportOverallTime = FALSE)

  id_list <- paste(ids, collapse = ",")

  # Idempotent replace: delete existing rows for these cohort_ids first.
  del_sql <- sprintf(
    "DELETE FROM %s.finngen_cohort WHERE cohort_definition_id IN (%s)",
    cohort_schema, id_list
  )
  DatabaseConnector::executeSql(conn, del_sql, progressBar = FALSE, reportOverallTime = FALSE)

  # Copy from canonical cohort table.
  ins_sql <- sprintf(
    "INSERT INTO %s.finngen_cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
     SELECT cohort_definition_id, subject_id, cohort_start_date, cohort_end_date
     FROM %s.cohort
     WHERE cohort_definition_id IN (%s)",
    cohort_schema, cohort_schema, id_list
  )
  DatabaseConnector::executeSql(conn, ins_sql, progressBar = FALSE, reportOverallTime = FALSE)

  invisible(NULL)
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

  # timeCodeWAS: flatten time_windows array-of-objects → temporalStartDays +
  # temporalEndDays parallel integer vectors (mod_analysisSettings_TimeCodeWAS.R
  # sends both; Parthenon's settings schema uses a single array-of-pairs).
  if (identical(module_key, "co2.time_codewas") && !is.null(settings$time_windows)) {
    tw <- settings$time_windows
    if (is.list(tw) || is.data.frame(tw)) {
      start_days <- vapply(tw, function(w) as.integer(w$start_day %||% w[["start_day"]]), integer(1))
      end_days   <- vapply(tw, function(w) as.integer(w$end_day   %||% w[["end_day"]]),   integer(1))
      out$temporalStartDays <- start_days
      out$temporalEndDays   <- end_days
      out$time_windows <- NULL
    }
  }

  # Universal default — all CO2 modules require minCellCount for privacy gating.
  if (is.null(out$minCellCount)) out$minCellCount <- 5L

  # Module-specific Shiny-parity shapes.
  # Source of truth: CO2AnalysisModules/R/mod_analysisSettings_*_server.R
  # (the reactive analysisSettings list produced by the Shiny UI).

  if (identical(module_key, "co2.demographics")) {
    # Shiny sends all three referenceYears + all three groupBy dimensions.
    # Upstream CO2AnalysisModules#199 shows that strict-subset groupBy triggers
    # a transmute against a dropped referenceYear column; sending a length-1
    # referenceYears also hits a `$ operator on atomic vector` crash internally.
    # Matching Shiny exactly avoids both.
    if (is.null(out$referenceYears) || length(out$referenceYears) < 3) {
      out$referenceYears <- c("cohort_start_date", "cohort_end_date", "birth_datetime")
    }
    if (is.null(out$groupBy) || length(out$groupBy) < 3) {
      out$groupBy <- c("calendarYear", "ageGroup", "gender")
    }
  }

  if (identical(module_key, "co2.codewas") || identical(module_key, "co2.time_codewas")) {
    # Defaults from mod_analysisSettings_CodeWAS.R lines 149-150.
    if (is.null(out$cores)) out$cores <- 1L
    if (is.null(out$chunksSizeNOutcomes)) out$chunksSizeNOutcomes <- 5000L
    # Shiny explicitly sets autoMatchRatio = NULL when not auto-matching;
    # keep the key present so checkmate assertions see it.
    if (!("autoMatchRatio" %in% names(out))) out["autoMatchRatio"] <- list(NULL)
    # covariatesIds: NULL by default (CO2 asserts it's numeric or NULL, not list).
    # Users can opt-in to specific covariate IDs later via settings.
    if (!("covariatesIds" %in% names(out))) out["covariatesIds"] <- list(NULL)
    # analysisIds: minimal valid subset (one per FeatureExtraction domain).
    if (is.null(out$analysisIds) || length(out$analysisIds) == 0) {
      out$analysisIds <- c(101L, 141L, 201L, 301L, 401L, 501L, 601L, 701L, 801L)
    }
    # CodeWAS-only: analysisRegexTibble for regex-based endpoint classification.
    # Shiny hardcodes this 2-row tibble (mod_analysisSettings_CodeWAS.R line ~440).
    if (identical(module_key, "co2.codewas") && is.null(out$analysisRegexTibble)) {
      out$analysisRegexTibble <- tibble::tribble(
        ~analysisId, ~analysisName,    ~analysisRegex,
        999L,        "Endpoints",      "^(?!.*\\[CohortLibrary\\]).*_case$",
        998L,        "CohortLibrary",  ".*\\[CohortLibrary\\]"
      )
    }
  }

  out
}

finngen_co2_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  # SP3 bespoke-SQL implementation. Bypasses CO2AnalysisModules::execute_CodeWAS
  # (which depends on HadesExtras handler state we can't cheaply register).
  # Instead we compute per-concept 2x2 counts + Fisher's exact directly against
  # the source's CDM schema. Same display.json shape the frontend already renders.
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_connection", pct = 5))
    cohort_ids <- .extract_cohort_ids_for_module("co2.codewas", analysis_settings)
    case_id <- as.integer(analysis_settings$case_cohort_id %||% analysis_settings$cohortIdCases %||% cohort_ids[1])
    ctrl_id <- as.integer(analysis_settings$control_cohort_id %||% analysis_settings$cohortIdControls %||% cohort_ids[2])
    if (is.na(case_id) || is.na(ctrl_id)) stop("co2.codewas requires case_cohort_id and control_cohort_id")

    min_count    <- as.integer(analysis_settings$min_cell_count %||% analysis_settings$minCellCount %||% 5L)
    cdm_schema   <- source_envelope$schemas$cdm
    vocab_schema <- source_envelope$schemas$vocab
    coh_schema   <- source_envelope$schemas$cohort

    connection_details <- DatabaseConnector::createConnectionDetails(
      dbms     = source_envelope$dbms %||% "postgresql",
      server   = source_envelope$connection$server,
      port     = source_envelope$connection$port,
      user     = source_envelope$connection$user,
      password = source_envelope$connection$password,
      pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
    )
    connection <- DatabaseConnector::connect(connection_details)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

    # Cohort sizes (cases / controls excluding overlap)
    write_progress(progress_path, list(step = "compute_cohort_sizes", pct = 10))
    cohort_sizes_sql <- sprintf(
      "WITH case_subs AS (
         SELECT DISTINCT subject_id FROM %s.cohort WHERE cohort_definition_id = %d
       ),
       ctrl_subs AS (
         SELECT DISTINCT subject_id FROM %s.cohort
         WHERE cohort_definition_id = %d
           AND subject_id NOT IN (SELECT subject_id FROM case_subs)
       )
       SELECT (SELECT COUNT(*) FROM case_subs) AS n_case,
              (SELECT COUNT(*) FROM ctrl_subs) AS n_ctrl",
      coh_schema, case_id, coh_schema, ctrl_id
    )
    sizes <- DatabaseConnector::querySql(connection, cohort_sizes_sql)
    names(sizes) <- tolower(names(sizes))
    n_case_total <- as.integer(sizes$n_case[1])
    n_ctrl_total <- as.integer(sizes$n_ctrl[1])
    if (is.na(n_case_total) || is.na(n_ctrl_total) || n_case_total == 0 || n_ctrl_total == 0) {
      stop(sprintf("co2.codewas: case/control sizes are zero (case=%s, ctrl=%s)", n_case_total, n_ctrl_total))
    }

    # Counts per concept across 4 OMOP domains.
    # Each UNION member returns (domain_id, concept_id, case_n, ctrl_n).
    # concept_id > 0 filters out OMOP "unmapped" sentinel 0.
    domain_specs <- list(
      list(domain = "Condition",   table = "condition_occurrence",   concept_col = "condition_concept_id"),
      list(domain = "Drug",        table = "drug_exposure",          concept_col = "drug_concept_id"),
      list(domain = "Procedure",   table = "procedure_occurrence",   concept_col = "procedure_concept_id"),
      list(domain = "Measurement", table = "measurement",            concept_col = "measurement_concept_id")
    )

    write_progress(progress_path, list(step = "compute_counts", pct = 25))
    build_count_sql <- function(d) {
      sprintf(
        "SELECT '%s' AS domain_id,
                t.%s AS concept_id,
                SUM(CASE WHEN cs.which = 'case' THEN 1 ELSE 0 END) AS case_n,
                SUM(CASE WHEN cs.which = 'ctrl' THEN 1 ELSE 0 END) AS ctrl_n
         FROM (
           SELECT DISTINCT t.person_id, t.%s
           FROM %s.%s t
           WHERE t.%s > 0
         ) t
         JOIN (
           SELECT subject_id, 'case'::text AS which FROM %s.cohort WHERE cohort_definition_id = %d
           UNION
           SELECT subject_id, 'ctrl'::text AS which FROM %s.cohort
             WHERE cohort_definition_id = %d
               AND subject_id NOT IN (SELECT subject_id FROM %s.cohort WHERE cohort_definition_id = %d)
         ) cs ON cs.subject_id = t.person_id
         GROUP BY t.%s",
        d$domain, d$concept_col, d$concept_col,
        cdm_schema, d$table, d$concept_col,
        coh_schema, case_id,
        coh_schema, ctrl_id, coh_schema, case_id,
        d$concept_col
      )
    }
    all_parts <- vapply(domain_specs, build_count_sql, character(1))
    counts_sql <- paste(all_parts, collapse = "\nUNION ALL\n")
    counts_df <- DatabaseConnector::querySql(connection, counts_sql)
    names(counts_df) <- tolower(names(counts_df))

    # Filter to concepts that clear the minimum cell count in EITHER cohort — nothing
    # below the privacy floor is disclosable regardless of significance.
    if (nrow(counts_df) > 0) {
      counts_df$case_n <- as.integer(counts_df$case_n)
      counts_df$ctrl_n <- as.integer(counts_df$ctrl_n)
      counts_df <- counts_df[(counts_df$case_n >= min_count) | (counts_df$ctrl_n >= min_count), , drop = FALSE]
    }

    # Concept names
    write_progress(progress_path, list(step = "fetch_concept_names", pct = 60))
    concept_names <- data.frame(concept_id = integer(0), concept_name = character(0))
    if (nrow(counts_df) > 0) {
      id_list <- paste(unique(counts_df$concept_id), collapse = ",")
      names_sql <- sprintf(
        "SELECT concept_id, concept_name FROM %s.concept WHERE concept_id IN (%s)",
        vocab_schema, id_list
      )
      concept_names <- tryCatch(DatabaseConnector::querySql(connection, names_sql),
                                error = function(e) data.frame(concept_id = integer(0), concept_name = character(0)))
      names(concept_names) <- tolower(names(concept_names))
    }

    # Per-concept 2x2 + Fisher's exact
    write_progress(progress_path, list(step = "fisher_tests", pct = 80))
    n_total <- nrow(counts_df)
    signals <- if (n_total == 0) list() else lapply(seq_len(n_total), function(i) {
      case_yes <- counts_df$case_n[i]
      ctrl_yes <- counts_df$ctrl_n[i]
      case_no  <- n_case_total - case_yes
      ctrl_no  <- n_ctrl_total - ctrl_yes
      # Haldane-Anscombe continuity correction when any cell is 0, for stable OR/SE
      a <- case_yes + 0.5; b <- case_no + 0.5
      c <- ctrl_yes + 0.5; d <- ctrl_no + 0.5
      or_log <- log((a * d) / (b * c))
      se     <- sqrt(1/a + 1/b + 1/c + 1/d)
      p <- tryCatch(
        fisher.test(matrix(c(case_yes, ctrl_yes, case_no, ctrl_no), nrow = 2))$p.value,
        error = function(e) NA_real_
      )
      cid   <- as.integer(counts_df$concept_id[i])
      cname <- concept_names$concept_name[match(cid, concept_names$concept_id)]
      list(
        concept_id   = cid,
        concept_name = if (is.na(cname) || is.null(cname)) paste("Concept", cid) else as.character(cname),
        domain_id    = as.character(counts_df$domain_id[i]),
        p_value      = as.numeric(p),
        beta         = as.numeric(or_log),
        se           = as.numeric(se),
        n_cases      = as.integer(case_yes),
        n_controls   = as.integer(ctrl_yes)
      )
    })

    bonf     <- if (n_total > 0) 0.05 / n_total else 0.05
    sugg     <- min(1e-5, bonf * 10)
    sig_cnt  <- sum(vapply(signals, function(s) !is.na(s$p_value) && s$p_value < bonf, logical(1)))

    # Persist a CSV companion so downstream tooling / jobs expecting the old
    # CO2 shape still get a flat file.
    write_progress(progress_path, list(step = "write_csv", pct = 92))
    if (n_total > 0) {
      codewas_csv <- data.frame(
        conceptId   = vapply(signals, function(s) s$concept_id, integer(1)),
        conceptName = vapply(signals, function(s) s$concept_name, character(1)),
        domainId    = vapply(signals, function(s) s$domain_id, character(1)),
        nCases      = vapply(signals, function(s) s$n_cases, integer(1)),
        nControls   = vapply(signals, function(s) s$n_controls, integer(1)),
        beta        = vapply(signals, function(s) s$beta, numeric(1)),
        se          = vapply(signals, function(s) s$se, numeric(1)),
        pValue      = vapply(signals, function(s) s$p_value, numeric(1))
      )
      write.csv(codewas_csv, file.path(export_folder, "codeWASCounts.csv"), row.names = FALSE)
    }

    display <- list(
      signals    = signals,
      thresholds = list(bonferroni = bonf, suggestive = sugg),
      summary    = list(
        total_codes_tested = n_total,
        significant_count  = as.integer(sig_cnt),
        n_case_subjects    = n_case_total,
        n_control_subjects = n_ctrl_total
      )
    )

    .write_summary(export_folder, list(
      analysis_type  = "co2.codewas",
      rows           = n_total,
      case_cohort    = case_id,
      control_cohort = ctrl_id,
      n_case         = n_case_total,
      n_control      = n_ctrl_total
    ))
    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(rows = n_total, n_significant = as.integer(sig_cnt))
  })
}

finngen_co2_time_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  # SP3 bespoke-SQL implementation. Bypasses CO2AnalysisModules::execute_timeCodeWAS
  # (same handler-state limitation as CodeWAS). For each user-specified window
  # [start_day, end_day] we compute per-concept 2x2 + Fisher's exact against
  # events whose date falls in [cohort_start_date + start_day, cohort_start_date + end_day].
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_connection", pct = 5))
    cohort_ids <- .extract_cohort_ids_for_module("co2.time_codewas", analysis_settings)
    case_id <- as.integer(analysis_settings$case_cohort_id %||% analysis_settings$cohortIdCases %||% cohort_ids[1])
    ctrl_id <- as.integer(analysis_settings$control_cohort_id %||% analysis_settings$cohortIdControls %||% cohort_ids[2])
    if (is.na(case_id) || is.na(ctrl_id)) stop("co2.time_codewas requires case_cohort_id and control_cohort_id")

    # Accept either the frontend shape time_windows=[[s,e],...] or CO2's parallel
    # temporalStartDays/temporalEndDays vectors.
    tw <- analysis_settings$time_windows %||% analysis_settings$timeWindows
    if (is.null(tw) || length(tw) == 0) {
      starts <- analysis_settings$temporalStartDays %||% integer()
      ends   <- analysis_settings$temporalEndDays   %||% integer()
      if (length(starts) != length(ends) || length(starts) == 0) {
        stop("co2.time_codewas requires time_windows or matching temporalStartDays/temporalEndDays")
      }
      tw <- mapply(function(s, e) list(as.integer(s), as.integer(e)), starts, ends, SIMPLIFY = FALSE)
    }
    # jsonlite auto-simplifies [[s,e],...] to an N×2 matrix when homogeneous.
    # Normalize back to a list of 2-element vectors so downstream indexing works.
    if (is.matrix(tw)) {
      tw <- lapply(seq_len(nrow(tw)), function(i) as.integer(tw[i, ]))
    }

    min_count    <- as.integer(analysis_settings$min_cell_count %||% analysis_settings$minCellCount %||% 5L)
    cdm_schema   <- source_envelope$schemas$cdm
    vocab_schema <- source_envelope$schemas$vocab
    coh_schema   <- source_envelope$schemas$cohort

    connection_details <- DatabaseConnector::createConnectionDetails(
      dbms     = source_envelope$dbms %||% "postgresql",
      server   = source_envelope$connection$server,
      port     = source_envelope$connection$port,
      user     = source_envelope$connection$user,
      password = source_envelope$connection$password,
      pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
    )
    connection <- DatabaseConnector::connect(connection_details)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

    # Cohort sizes are time-window-independent; compute once.
    sizes_sql <- sprintf(
      "WITH case_subs AS (
         SELECT DISTINCT subject_id FROM %s.cohort WHERE cohort_definition_id = %d
       ),
       ctrl_subs AS (
         SELECT DISTINCT subject_id FROM %s.cohort
         WHERE cohort_definition_id = %d
           AND subject_id NOT IN (SELECT subject_id FROM case_subs)
       )
       SELECT (SELECT COUNT(*) FROM case_subs) AS n_case,
              (SELECT COUNT(*) FROM ctrl_subs) AS n_ctrl",
      coh_schema, case_id, coh_schema, ctrl_id
    )
    sizes <- DatabaseConnector::querySql(connection, sizes_sql)
    names(sizes) <- tolower(names(sizes))
    n_case_total <- as.integer(sizes$n_case[1])
    n_ctrl_total <- as.integer(sizes$n_ctrl[1])
    if (n_case_total == 0 || n_ctrl_total == 0) {
      stop(sprintf("co2.time_codewas: case/control sizes are zero (case=%s, ctrl=%s)", n_case_total, n_ctrl_total))
    }

    # Domain event-date mapping
    domain_specs <- list(
      list(domain = "Condition",   table = "condition_occurrence",   concept_col = "condition_concept_id",   date_col = "condition_start_date"),
      list(domain = "Drug",        table = "drug_exposure",          concept_col = "drug_concept_id",        date_col = "drug_exposure_start_date"),
      list(domain = "Procedure",   table = "procedure_occurrence",   concept_col = "procedure_concept_id",   date_col = "procedure_date"),
      list(domain = "Measurement", table = "measurement",            concept_col = "measurement_concept_id", date_col = "measurement_date")
    )

    window_count <- length(tw)
    windows_out <- vector("list", window_count)
    total_sig   <- 0L

    for (w_idx in seq_along(tw)) {
      pair <- tw[[w_idx]]
      # Accept [s,e] arrays (atomic vectors) or named lists {start_day,end_day}
      if (is.list(pair)) {
        sd <- as.integer(pair$start_day %||% pair[[1]])
        ed <- as.integer(pair$end_day   %||% pair[[2]])
      } else {
        sd <- as.integer(pair[[1]])
        ed <- as.integer(pair[[2]])
      }
      if (is.na(sd) || is.na(ed)) stop(sprintf("co2.time_codewas: invalid window at index %d", w_idx))

      write_progress(progress_path, list(
        step = sprintf("window_%d_counts", w_idx),
        pct = as.integer(10 + 80 * (w_idx - 1) / window_count),
        message = sprintf("Window [%d, %d]", sd, ed)
      ))

      build_count_sql <- function(d) {
        sprintf(
          "SELECT '%s' AS domain_id,
                  t.%s AS concept_id,
                  SUM(CASE WHEN cs.which = 'case' THEN 1 ELSE 0 END) AS case_n,
                  SUM(CASE WHEN cs.which = 'ctrl' THEN 1 ELSE 0 END) AS ctrl_n
           FROM (
             SELECT DISTINCT t.person_id, t.%s, s.which
             FROM %s.%s t
             JOIN (
               SELECT subject_id, cohort_start_date, 'case'::text AS which FROM %s.cohort WHERE cohort_definition_id = %d
               UNION
               SELECT subject_id, cohort_start_date, 'ctrl'::text AS which FROM %s.cohort
                 WHERE cohort_definition_id = %d
                   AND subject_id NOT IN (SELECT subject_id FROM %s.cohort WHERE cohort_definition_id = %d)
             ) s ON s.subject_id = t.person_id
             WHERE t.%s > 0
               AND (t.%s::date - s.cohort_start_date::date) BETWEEN %d AND %d
           ) t
           JOIN (
             SELECT subject_id, 'case'::text AS which FROM %s.cohort WHERE cohort_definition_id = %d
             UNION
             SELECT subject_id, 'ctrl'::text AS which FROM %s.cohort
               WHERE cohort_definition_id = %d
                 AND subject_id NOT IN (SELECT subject_id FROM %s.cohort WHERE cohort_definition_id = %d)
           ) cs ON cs.subject_id = t.person_id AND cs.which = t.which
           GROUP BY t.%s",
          d$domain, d$concept_col, d$concept_col,
          cdm_schema, d$table,
          coh_schema, case_id,
          coh_schema, ctrl_id, coh_schema, case_id,
          d$concept_col, d$date_col, sd, ed,
          coh_schema, case_id,
          coh_schema, ctrl_id, coh_schema, case_id,
          d$concept_col
        )
      }
      parts <- vapply(domain_specs, build_count_sql, character(1))
      counts_sql <- paste(parts, collapse = "\nUNION ALL\n")
      counts_df <- DatabaseConnector::querySql(connection, counts_sql)
      names(counts_df) <- tolower(names(counts_df))
      if (nrow(counts_df) > 0) {
        counts_df$case_n <- as.integer(counts_df$case_n)
        counts_df$ctrl_n <- as.integer(counts_df$ctrl_n)
        counts_df <- counts_df[(counts_df$case_n >= min_count) | (counts_df$ctrl_n >= min_count), , drop = FALSE]
      }

      concept_names <- data.frame(concept_id = integer(0), concept_name = character(0))
      if (nrow(counts_df) > 0) {
        id_list <- paste(unique(counts_df$concept_id), collapse = ",")
        names_sql <- sprintf(
          "SELECT concept_id, concept_name FROM %s.concept WHERE concept_id IN (%s)",
          vocab_schema, id_list
        )
        concept_names <- tryCatch(DatabaseConnector::querySql(connection, names_sql),
                                  error = function(e) data.frame(concept_id = integer(0), concept_name = character(0)))
        names(concept_names) <- tolower(names(concept_names))
      }

      n_w <- nrow(counts_df)
      signals <- if (n_w == 0) list() else lapply(seq_len(n_w), function(i) {
        case_yes <- counts_df$case_n[i]
        ctrl_yes <- counts_df$ctrl_n[i]
        case_no  <- n_case_total - case_yes
        ctrl_no  <- n_ctrl_total - ctrl_yes
        a <- case_yes + 0.5; b <- case_no + 0.5
        c <- ctrl_yes + 0.5; d <- ctrl_no + 0.5
        or_log <- log((a * d) / (b * c))
        se     <- sqrt(1/a + 1/b + 1/c + 1/d)
        p <- tryCatch(
          fisher.test(matrix(c(case_yes, ctrl_yes, case_no, ctrl_no), nrow = 2))$p.value,
          error = function(e) NA_real_
        )
        cid   <- as.integer(counts_df$concept_id[i])
        cname <- concept_names$concept_name[match(cid, concept_names$concept_id)]
        list(
          concept_id   = cid,
          concept_name = if (is.na(cname) || is.null(cname)) paste("Concept", cid) else as.character(cname),
          domain_id    = as.character(counts_df$domain_id[i]),
          p_value      = as.numeric(p),
          beta         = as.numeric(or_log),
          se           = as.numeric(se),
          n_cases      = as.integer(case_yes),
          n_controls   = as.integer(ctrl_yes)
        )
      })

      # Per-window Bonferroni
      if (n_w > 0) {
        bonf_w <- 0.05 / n_w
        sig_w <- sum(vapply(signals, function(s) !is.na(s$p_value) && s$p_value < bonf_w, logical(1)))
        total_sig <- total_sig + as.integer(sig_w)
      }

      windows_out[[w_idx]] <- list(
        start_day = sd,
        end_day   = ed,
        signals   = signals
      )
    }

    display <- list(
      windows = windows_out,
      summary = list(
        window_count      = as.integer(window_count),
        total_significant = as.integer(total_sig),
        n_case_subjects   = n_case_total,
        n_control_subjects = n_ctrl_total
      )
    )

    .write_summary(export_folder, list(
      analysis_type  = "co2.time_codewas",
      windows        = length(windows_out),
      case_cohort    = case_id,
      control_cohort = ctrl_id,
      total_significant = as.integer(total_sig)
    ))
    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(windows = length(windows_out), total_significant = as.integer(total_sig))
  })
}

finngen_co2_overlaps_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  # SP3 bespoke-SQL implementation. Bypasses CO2AnalysisModules::execute_CohortOverlaps
  # (which needs HadesExtras handler state we can't cheaply register). Instead we
  # compute UpSet-style overlaps directly from Parthenon's canonical cohort table
  # (pancreas_results.cohort, similar for other sources). Same display.json shape.
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_connection", pct = 5))
    cohort_ids <- .extract_cohort_ids_for_module("co2.overlaps", analysis_settings)
    if (length(cohort_ids) < 2) stop("co2.overlaps requires at least 2 cohort_ids")

    min_cell <- as.integer(analysis_settings$min_cell_count %||% analysis_settings$minCellCount %||% 5L)
    cohort_schema <- source_envelope$schemas$cohort

    # Open a DatabaseConnector connection using the same envelope the handler would use.
    connection_details <- DatabaseConnector::createConnectionDetails(
      dbms     = source_envelope$dbms %||% "postgresql",
      server   = source_envelope$connection$server,
      port     = source_envelope$connection$port,
      user     = source_envelope$connection$user,
      password = source_envelope$connection$password,
      pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
    )
    connection <- DatabaseConnector::connect(connection_details)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

    id_list <- paste(cohort_ids, collapse = ",")

    # 1. Cohort sizes
    write_progress(progress_path, list(step = "compute_sizes", pct = 20))
    sizes_sql <- sprintf(
      "SELECT cohort_definition_id, COUNT(DISTINCT subject_id) AS size
       FROM %s.cohort
       WHERE cohort_definition_id IN (%s)
       GROUP BY cohort_definition_id",
      cohort_schema, id_list
    )
    sizes_df <- DatabaseConnector::querySql(connection, sizes_sql)
    names(sizes_df) <- tolower(names(sizes_df))

    # 2. Cohort names (from Parthenon's app.cohort_definitions)
    write_progress(progress_path, list(step = "fetch_names", pct = 35))
    names_sql <- sprintf(
      "SELECT id AS cohort_definition_id, name AS cohort_name
       FROM app.cohort_definitions WHERE id IN (%s)",
      id_list
    )
    names_df <- tryCatch(DatabaseConnector::querySql(connection, names_sql),
                         error = function(e) data.frame(cohort_definition_id = integer(0), cohort_name = character(0)))
    names(names_df) <- tolower(names(names_df))

    # 3. Subject × cohort membership → collapse to member-set per subject
    write_progress(progress_path, list(step = "compute_intersections", pct = 60))
    members_sql <- sprintf(
      "SELECT subject_id,
              STRING_AGG(CAST(cohort_definition_id AS VARCHAR), ',' ORDER BY cohort_definition_id) AS member_cohorts
       FROM (
         SELECT DISTINCT subject_id, cohort_definition_id
         FROM %s.cohort
         WHERE cohort_definition_id IN (%s)
       ) distinct_rows
       GROUP BY subject_id",
      cohort_schema, id_list
    )
    members_df <- DatabaseConnector::querySql(connection, members_sql)
    names(members_df) <- tolower(names(members_df))

    # Count subjects per unique membership combination
    if (nrow(members_df) > 0) {
      combo_counts <- as.data.frame(table(members_df$member_cohorts))
      names(combo_counts) <- c("member_cohorts", "n")
      combo_counts$member_cohorts <- as.character(combo_counts$member_cohorts)
    } else {
      combo_counts <- data.frame(member_cohorts = character(0), n = integer(0))
    }

    # Build sets array
    write_progress(progress_path, list(step = "build_display", pct = 80))
    sets <- lapply(cohort_ids, function(cid) {
      sz_row <- sizes_df[sizes_df$cohort_definition_id == cid, ]
      nm_row <- names_df[names_df$cohort_definition_id == cid, ]
      list(
        cohort_id   = as.integer(cid),
        cohort_name = as.character(if (nrow(nm_row) > 0) nm_row$cohort_name[1] else paste("Cohort", cid)),
        size        = as.integer(if (nrow(sz_row) > 0) sz_row$size[1] else 0L)
      )
    })

    # Build intersections (all observed non-empty combinations)
    intersections <- lapply(seq_len(nrow(combo_counts)), function(i) {
      members <- as.integer(strsplit(combo_counts$member_cohorts[i], ",", fixed = TRUE)[[1]])
      size    <- as.integer(combo_counts$n[i])
      # Privacy floor
      if (size < min_cell) return(NULL)
      # Wrap members with I() so jsonlite emits an array even for degree=1 intersections
      list(members = I(members), size = size, degree = length(members))
    })
    intersections <- intersections[!vapply(intersections, is.null, logical(1))]

    # Pairwise matrix for a quick overview
    n <- length(cohort_ids)
    mat <- matrix(0L, nrow = n, ncol = n)
    for (s in seq_along(sets)) mat[s, s] <- as.integer(sets[[s]]$size)
    for (ix in intersections) {
      if (length(ix$members) == 2) {
        r <- match(ix$members[1], cohort_ids)
        c <- match(ix$members[2], cohort_ids)
        if (!is.na(r) && !is.na(c)) {
          mat[r, c] <- as.integer(ix$size)
          mat[c, r] <- as.integer(ix$size)
        }
      }
    }

    # Max overlap pct (relative to smallest member set of each intersection)
    max_pct <- 0
    for (ix in intersections) {
      if (length(ix$members) < 2) next
      min_set <- min(vapply(ix$members, function(m) {
        s <- sets[[match(m, cohort_ids)]]$size
        if (is.null(s) || s == 0) Inf else s
      }, numeric(1)))
      if (!is.infinite(min_set) && min_set > 0) {
        pct <- round(ix$size / min_set * 100, 1)
        if (pct > max_pct) max_pct <- pct
      }
    }

    display <- list(
      sets          = sets,
      intersections = intersections,
      matrix        = apply(mat, 1, as.list),
      summary       = list(max_overlap_pct = max_pct)
    )

    .write_summary(export_folder, list(
      analysis_type = "co2.overlaps",
      cohort_ids    = as.integer(cohort_ids),
      n_intersections = length(intersections)
    ))
    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(n_intersections = length(intersections))
  })
}

finngen_co2_demographics_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "stage_cohorts", pct = 8))
    .stage_cohorts_for_finngen(
      handler, source_envelope,
      .extract_cohort_ids_for_module("co2.demographics", analysis_settings)
    )

    write_progress(progress_path, list(step = "execute_CohortDemographics", pct = 10))
    res <- CO2AnalysisModules::execute_CohortDemographics(
      exportFolder       = export_folder,
      cohortTableHandler = handler,
      analysisSettings   = .normalize_co2_settings("co2.demographics", analysis_settings)
    )

    # execute_CohortDemographics returns a character path to analysisResults.duckdb,
    # not a list. Count rows from the duckdb file for the summary.
    total <- tryCatch({
      db_path <- if (is.character(res) && file.exists(res)) res
                 else file.path(export_folder, "analysisResults.duckdb")
      conn <- duckdb::dbConnect(duckdb::duckdb(), db_path, read_only = TRUE)
      on.exit(tryCatch(duckdb::dbDisconnect(conn, shutdown = TRUE), error = function(e) NULL), add = TRUE)
      n <- DBI::dbGetQuery(conn, "SELECT COUNT(*) AS n FROM demographicsCounts")$n[1]
      as.integer(n)
    }, error = function(e) NA_integer_)

    .write_summary(export_folder, list(
      analysis_type = "co2.demographics",
      total         = total,
      cohort_ids    = analysis_settings$cohortIds %||% integer()
    ))

    # ── SP3: emit display.json for age pyramid + summary ──
    # CO2AnalysisModules writes demographicsCounts to analysisResults.duckdb
    # with schema: databaseId, cohortId, referenceYear, calendarYear, ageGroup,
    # gender, count. We aggregate for the age pyramid + gender totals.
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      db_path <- if (is.character(res) && length(res) == 1 && file.exists(res)) res
                 else file.path(export_folder, "analysisResults.duckdb")
      if (!file.exists(db_path)) {
        list(cohorts = list())
      } else {
        conn <- duckdb::dbConnect(duckdb::duckdb(), db_path, read_only = TRUE)
        on.exit(tryCatch(duckdb::dbDisconnect(conn, shutdown = TRUE), error = function(e) NULL), add = TRUE)
        tables <- DBI::dbListTables(conn)
        if (!("demographicsCounts" %in% tables)) {
          list(cohorts = list())
        } else {
          df <- DBI::dbGetQuery(conn, 'SELECT * FROM demographicsCounts')
          # cohortsInfo table (also in the duckdb) carries cohortName
          cohorts_info <- tryCatch(
            DBI::dbGetQuery(conn, 'SELECT cohortId, cohortName FROM cohortsInfo'),
            error = function(e) data.frame(cohortId = integer(), cohortName = character())
          )
          cohort_ids <- unique(df$cohortId)
          cohorts <- lapply(cohort_ids, function(cid) {
            cdf <- df[df$cohortId == cid, ]
            nm_row <- cohorts_info[cohorts_info$cohortId == cid, ]
            cohort_name <- if (nrow(nm_row) > 0) nm_row$cohortName[1] else paste("Cohort", cid)
            n <- as.integer(sum(cdf$count, na.rm = TRUE))

            # Age histogram by decile (ageGroup like "[30-39]" → decile 3)
            parse_decile <- function(age_group) {
              m <- regmatches(age_group, regexpr("\\d+", age_group))
              if (length(m) == 0 || is.na(m) || m == "") return(NA_integer_)
              as.integer(as.integer(m) / 10)
            }
            cdf$decile <- vapply(cdf$ageGroup, parse_decile, integer(1))

            gender_upper <- toupper(as.character(cdf$gender))
            male_df   <- cdf[gender_upper == "MALE",   c("decile", "count"), drop = FALSE]
            female_df <- cdf[gender_upper == "FEMALE", c("decile", "count"), drop = FALSE]
            male_by   <- aggregate(count ~ decile, male_df,   sum, na.rm = TRUE)
            female_by <- aggregate(count ~ decile, female_df, sum, na.rm = TRUE)
            all_deciles <- sort(unique(c(male_by$decile, female_by$decile)))
            age_histogram <- lapply(all_deciles, function(d) {
              m <- if (any(male_by$decile == d, na.rm = TRUE)) male_by$count[male_by$decile == d][1] else 0L
              f <- if (any(female_by$decile == d, na.rm = TRUE)) female_by$count[female_by$decile == d][1] else 0L
              list(decile = as.integer(d), male = as.integer(m), female = as.integer(f))
            })

            total_male    <- as.integer(sum(cdf$count[gender_upper == "MALE"],   na.rm = TRUE))
            total_female  <- as.integer(sum(cdf$count[gender_upper == "FEMALE"], na.rm = TRUE))
            total_unknown <- max(0L, as.integer(n - total_male - total_female))

            # Mean / median from decile midpoints weighted by count
            decile_totals <- aggregate(count ~ decile, cdf, sum, na.rm = TRUE)
            decile_totals <- decile_totals[!is.na(decile_totals$decile), , drop = FALSE]
            mean_age <- NA_real_
            median_age <- NA_real_
            if (nrow(decile_totals) > 0 && sum(decile_totals$count) > 0) {
              midpoints <- decile_totals$decile * 10 + 5
              counts    <- decile_totals$count
              mean_age <- as.numeric(sum(midpoints * counts) / sum(counts))
              # Weighted median via cumulative counts crossing n/2
              ord <- order(midpoints)
              mp  <- midpoints[ord]; ct <- counts[ord]
              cum <- cumsum(ct)
              target <- sum(ct) / 2
              idx <- which(cum >= target)[1]
              if (!is.na(idx)) median_age <- as.numeric(mp[idx])
            }

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
        }
      }
    }, error = function(e) {
      list(cohorts = list(), error = conditionMessage(e))
    })

    .write_display(export_folder, display)
    write_progress(progress_path, list(step = "done", pct = 100))
    list(total = total)
  })
}
