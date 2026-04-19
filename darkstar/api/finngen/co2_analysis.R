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

# ═══════════════════════════════════════════════════════════════════════════
# Phase 18 GENOMICS-09 / GENOMICS-10 / GENOMICS-11 — Risteys-style endpoint
# profile worker.
#
# Inputs (analysis_settings — keys set by EndpointProfileDispatchService in PHP):
#   endpoint_name                   — FinnGen endpoint code (e.g. "E4_DM2")
#   source_key                      — Parthenon source key (e.g. "PANCREAS")
#   expression_hash                 — SHA-256 from EndpointExpressionHasher
#   min_subjects                    — Comorbidity universe filter (default 20L)
#   cohort_definition_id            — numeric (nullable); when present it
#                                      carries the Phase 13.2 100B offset
#                                      already applied in PHP
#   finngen_endpoint_generation_id  — nullable; provenance only
#   condition_concept_ids           — integer list (qualifying conditions)
#   drug_concept_ids                — integer list
#   source_concept_ids              — integer list
#   source_has_death_data           — bool (precondition echo)
#   source_has_drug_data            — bool
#
# Outputs:
#   INSERTs into {source}_co2_results.endpoint_profile_summary /
#   _km_points / _comorbidities / _drug_classes with ON CONFLICT DO UPDATE.
#
# Pitfalls mitigated:
#   Pitfall 1 — cohort_definition_id is numeric (not integer); SQL uses %.0f.
#   Pitfall 2 — comorbidity uses vectorized Matrix::crossprod, not fisher.test.
#   Pitfall 7 — ATC3 aggregates via SELECT DISTINCT (subject_id, atc3_code)
#               before COUNT so multi-parent ATC drugs don't double-count.
#   Pitfall 8 — if death_count == 0, skip survfit entirely and return empty
#               km_points + median=NA.
#   T-18-03  — source_key + every interpolated schema name re-validated
#              against /^[a-z][a-z0-9_]*$/ before any SQL interpolation.
# ═══════════════════════════════════════════════════════════════════════════

suppressPackageStartupMessages({
  library(survival)
  library(Matrix)
})

# Compute KM for the endpoint cohort per D-01/D-02/D-03.
#
# Dual-mode cohort resolution (research §Dual-mode):
#   1. If cohort_def_id is a non-NA numeric AND at least one row exists for it
#      in {cohort_schema}.cohort, use it as the subject set.
#   2. Else recompute qualifying events on-the-fly via the
#      condition/drug/source_concept UNION (same pattern as
#      cohort_ops.R::finngen_endpoint_generate_execute).
#
# Returns list(
#   km_points,                 # data.frame(time_days, survival_prob, at_risk, events)
#   death_count,               # integer — # of subjects with death event
#   subject_count,             # integer — # of subjects in cohort
#   median_survival_days,      # numeric — NA if all-censored
#   age_at_death_mean,         # numeric — NA if 0 deaths
#   age_at_death_median,       # numeric — NA if 0 deaths
#   age_at_death_bins,         # list of list(age_bin, count) for 0-4, 5-9, ..., 95+
#   resolution_mode            # "cohort_table" | "on_the_fly"
# )
.compute_km_for_cohort <- function(connection, cohort_schema, cdm_schema, vocab_schema,
                                   cohort_def_id, endpoint_name,
                                   condition_ids, drug_ids, source_ids,
                                   progress_path) {

  # ── Decide resolution mode ──
  use_cohort_table <- FALSE
  if (!is.na(cohort_def_id) && cohort_def_id > 0) {
    cnt_df <- DatabaseConnector::querySql(
      connection,
      sprintf("SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %.0f",
              cohort_schema, cohort_def_id)
    )
    names(cnt_df) <- tolower(names(cnt_df))
    cohort_row_count <- as.integer(cnt_df$c[1])
    if (!is.na(cohort_row_count) && cohort_row_count > 0) {
      use_cohort_table <- TRUE
    }
  }

  if (use_cohort_table) {
    write_progress(progress_path, list(step = "km_fetch_cohort_table", pct = 18,
                                        message = sprintf("Using cohort_definition_id=%.0f", cohort_def_id)))
    subj_sql <- sprintf(
      "SELECT c.subject_id,
              c.cohort_start_date AS index_date,
              d.death_date,
              p.birth_datetime,
              p.year_of_birth,
              op.end_date AS obs_end
         FROM %s.cohort c
         JOIN %s.person p ON p.person_id = c.subject_id
         LEFT JOIN %s.death d ON d.person_id = c.subject_id
         LEFT JOIN (
           SELECT person_id, MAX(observation_period_end_date) AS end_date
             FROM %s.observation_period
            GROUP BY person_id
         ) op ON op.person_id = c.subject_id
        WHERE c.cohort_definition_id = %.0f",
      cohort_schema, cdm_schema, cdm_schema, cdm_schema, cohort_def_id
    )
    resolution_mode <- "cohort_table"
  } else {
    write_progress(progress_path, list(step = "km_compute_on_the_fly", pct = 18,
                                        message = "No generation cohort — recomputing qualifying events"))
    # Build the qualifying-event UNION (same branch logic as cohort_ops.R:460-500).
    branches <- character(0)
    if (length(condition_ids) > 0) {
      cond_list <- paste(condition_ids, collapse = ",")
      branches <- c(branches, sprintf(
        "SELECT co.person_id AS subject_id, co.condition_start_date AS event_date
           FROM %s.condition_occurrence co
          WHERE co.condition_concept_id IN (
            SELECT descendant_concept_id FROM %s.concept_ancestor
             WHERE ancestor_concept_id IN (%s)
          )",
        cdm_schema, vocab_schema, cond_list
      ))
    }
    if (length(drug_ids) > 0) {
      drug_list <- paste(drug_ids, collapse = ",")
      branches <- c(branches, sprintf(
        "SELECT de.person_id AS subject_id, de.drug_exposure_start_date AS event_date
           FROM %s.drug_exposure de
          WHERE de.drug_concept_id IN (
            SELECT descendant_concept_id FROM %s.concept_ancestor
             WHERE ancestor_concept_id IN (%s)
          )",
        cdm_schema, vocab_schema, drug_list
      ))
    }
    if (length(source_ids) > 0) {
      src_list <- paste(source_ids, collapse = ",")
      branches <- c(branches, sprintf(
        "SELECT co.person_id AS subject_id, co.condition_start_date AS event_date
           FROM %s.condition_occurrence co
          WHERE co.condition_source_concept_id IN (%s)",
        cdm_schema, src_list
      ))
    }
    if (length(branches) == 0) {
      return(list(
        km_points = data.frame(time_days = integer(0), survival_prob = numeric(0),
                               at_risk = integer(0), events = integer(0)),
        death_count = 0L, subject_count = 0L,
        median_survival_days = NA_real_,
        age_at_death_mean = NA_real_, age_at_death_median = NA_real_,
        age_at_death_bins = list(),
        resolution_mode = "no_concepts"
      ))
    }
    qualifying_cte <- paste(branches, collapse = "\nUNION\n")
    subj_sql <- sprintf(
      "SELECT q.subject_id,
              MIN(q.event_date) AS index_date,
              d.death_date,
              p.birth_datetime,
              p.year_of_birth,
              op.end_date AS obs_end
         FROM ( %s ) q
         JOIN %s.person p ON p.person_id = q.subject_id
         LEFT JOIN %s.death d ON d.person_id = q.subject_id
         LEFT JOIN (
           SELECT person_id, MAX(observation_period_end_date) AS end_date
             FROM %s.observation_period
            GROUP BY person_id
         ) op ON op.person_id = q.subject_id
        GROUP BY q.subject_id, d.death_date, p.birth_datetime, p.year_of_birth, op.end_date",
      qualifying_cte, cdm_schema, cdm_schema, cdm_schema
    )
    resolution_mode <- "on_the_fly"
  }

  df <- DatabaseConnector::querySql(connection, subj_sql)
  names(df) <- tolower(names(df))
  if (nrow(df) == 0) {
    return(list(
      km_points = data.frame(time_days = integer(0), survival_prob = numeric(0),
                             at_risk = integer(0), events = integer(0)),
      death_count = 0L, subject_count = 0L,
      median_survival_days = NA_real_,
      age_at_death_mean = NA_real_, age_at_death_median = NA_real_,
      age_at_death_bins = list(),
      resolution_mode = resolution_mode
    ))
  }

  subject_count <- as.integer(nrow(df))

  # Time-from-index (days) + event indicator.
  df$index_date_d <- as.Date(df$index_date)
  df$death_date_d <- as.Date(df$death_date)
  df$obs_end_d    <- as.Date(df$obs_end)

  df$has_death <- !is.na(df$death_date_d)
  # End date = death_date when dead, else obs_end. If both missing, drop the row.
  df$end_date <- df$death_date_d
  df$end_date[!df$has_death] <- df$obs_end_d[!df$has_death]

  # Censor at observation_period_end_date; drop rows missing end info or pre-index.
  df <- df[!is.na(df$index_date_d) & !is.na(df$end_date) & df$end_date >= df$index_date_d, ]
  if (nrow(df) == 0) {
    return(list(
      km_points = data.frame(time_days = integer(0), survival_prob = numeric(0),
                             at_risk = integer(0), events = integer(0)),
      death_count = 0L, subject_count = 0L,
      median_survival_days = NA_real_,
      age_at_death_mean = NA_real_, age_at_death_median = NA_real_,
      age_at_death_bins = list(),
      resolution_mode = resolution_mode
    ))
  }

  df$time_days <- as.integer(df$end_date - df$index_date_d)
  df$event     <- as.integer(df$has_death)

  death_count <- as.integer(sum(df$event))

  # Age at death bins (5-year: 0-4, 5-9, ..., 95+) per D-03.
  age_at_death_bins <- list()
  age_mean <- NA_real_
  age_median <- NA_real_
  if (death_count > 0L) {
    d_rows <- df[df$event == 1L, ]
    # Prefer birth_datetime; fall back to year_of_birth as midyear.
    bdt <- as.Date(d_rows$birth_datetime)
    no_bdt <- is.na(bdt)
    if (any(no_bdt) && "year_of_birth" %in% names(d_rows)) {
      yob <- suppressWarnings(as.integer(d_rows$year_of_birth[no_bdt]))
      yob[is.na(yob) | yob <= 0] <- NA_integer_
      bdt[no_bdt] <- as.Date(sprintf("%d-07-01", yob))
    }
    age_years <- as.numeric(d_rows$death_date_d - bdt) / 365.25
    age_years <- age_years[!is.na(age_years) & age_years >= 0 & age_years < 130]
    if (length(age_years) > 0) {
      age_mean   <- as.numeric(mean(age_years))
      age_median <- as.numeric(stats::median(age_years))
      # Bin to 5-year buckets 0-4,5-9,...,95+
      bin_start <- pmin(95L, as.integer(floor(age_years / 5)) * 5L)
      bin_tab <- table(bin_start)
      age_at_death_bins <- lapply(names(bin_tab), function(lo) {
        lo_i <- as.integer(lo)
        label <- if (lo_i >= 95L) "95+" else sprintf("%d-%d", lo_i, lo_i + 4L)
        list(age_bin = label, bin_start = lo_i, count = as.integer(bin_tab[[lo]]))
      })
    }
  }

  # Pitfall 8: all-censored → skip survfit; return empty km_points.
  if (death_count == 0L) {
    return(list(
      km_points = data.frame(time_days = integer(0), survival_prob = numeric(0),
                             at_risk = integer(0), events = integer(0)),
      death_count = 0L,
      subject_count = subject_count,
      median_survival_days = NA_real_,
      age_at_death_mean = NA_real_,
      age_at_death_median = NA_real_,
      age_at_death_bins = list(),
      resolution_mode = resolution_mode
    ))
  }

  write_progress(progress_path, list(step = "km_survfit", pct = 30))
  surv_obj <- survival::Surv(time = df$time_days, event = df$event)
  km <- survival::survfit(surv_obj ~ 1)

  km_points <- data.frame(
    time_days     = as.numeric(km$time),
    survival_prob = as.numeric(km$surv),
    at_risk       = as.integer(km$n.risk),
    events        = as.integer(km$n.event)
  )

  median_days <- tryCatch({
    sm <- summary(km)$table
    # survival::survfit summary $table layout: "records", "n.max", "n.start",
    # "events", "*rmean", "*se(rmean)", "median", "0.95LCL", "0.95UCL".
    if (is.matrix(sm)) as.numeric(sm[, "median"][1]) else as.numeric(sm["median"])
  }, error = function(e) NA_real_)

  list(
    km_points            = km_points,
    death_count          = death_count,
    subject_count        = subject_count,
    median_survival_days = median_days,
    age_at_death_mean    = age_mean,
    age_at_death_median  = age_median,
    age_at_death_bins    = age_at_death_bins,
    resolution_mode      = resolution_mode
  )
}

# Compute top-50 comorbidities via vectorized phi (Pitfall 2).
#
# Builds a sparse dgCMatrix M of (subjects × endpoints) where a 1 indicates
# the subject is a member of that endpoint's generation cohort. Uses
# Matrix::crossprod(M) to get the pairwise co-occurrence matrix in one BLAS
# call. Derives phi + Haldane-Anscombe OR + 95% CI in closed form.
#
# Universe = FinnGen endpoint generations on this source with
#   last_status='succeeded' AND last_subject_count >= min_subjects.
# Cohort IDs follow the Phase 13.2 convention: generation.id + 100B offset.
#
# Returns data.frame(comorbid_endpoint, phi_coef, odds_ratio, or_ci_low,
# or_ci_high, co_count, rank) — rows where comorbid_endpoint != index_endpoint
# AND n_self >= min_subjects. Sorted by |phi| desc, top 50.
.compute_comorbidity_phi <- function(connection, cohort_schema, cdm_schema,
                                     index_endpoint_name, source_key,
                                     min_subjects) {
  OMOP_COHORT_ID_OFFSET <- 100000000000

  # Fetch eligible generations for this source. source_key is stored on the
  # app.finngen_endpoint_generations row as an app.sources key — we filter by
  # it but quote parameterized to avoid injection.
  elig_sql <- sprintf(
    "SELECT geg.id + %.0f AS cohort_definition_id,
            geg.endpoint_name,
            geg.last_subject_count
       FROM finngen.endpoint_generations geg
       JOIN app.sources s ON s.id = geg.source_id
      WHERE UPPER(s.source_key) = UPPER('%s')
        AND geg.last_status = 'succeeded'
        AND geg.last_subject_count >= %d",
    OMOP_COHORT_ID_OFFSET,
    gsub("'", "''", source_key, fixed = TRUE),
    as.integer(min_subjects)
  )

  gens <- tryCatch(DatabaseConnector::querySql(connection, elig_sql),
                   error = function(e) NULL)
  if (is.null(gens)) return(data.frame())
  names(gens) <- tolower(names(gens))
  if (nrow(gens) == 0L) return(data.frame())

  # Always include the index endpoint row (may or may not already be in `gens`).
  idx_sql <- sprintf(
    "SELECT geg.id + %.0f AS cohort_definition_id,
            geg.endpoint_name,
            geg.last_subject_count
       FROM finngen.endpoint_generations geg
       JOIN app.sources s ON s.id = geg.source_id
      WHERE UPPER(s.source_key) = UPPER('%s')
        AND UPPER(geg.endpoint_name) = UPPER('%s')
        AND geg.last_status = 'succeeded'
      ORDER BY geg.id DESC
      LIMIT 1",
    OMOP_COHORT_ID_OFFSET,
    gsub("'", "''", source_key, fixed = TRUE),
    gsub("'", "''", index_endpoint_name, fixed = TRUE)
  )
  idx_row <- tryCatch(DatabaseConnector::querySql(connection, idx_sql),
                      error = function(e) NULL)
  if (is.null(idx_row) || nrow(idx_row) == 0L) {
    # Without an index-endpoint generation, we can't compute phi (no subject set).
    return(data.frame())
  }
  names(idx_row) <- tolower(names(idx_row))

  # De-dup: index_row may already be present.
  all_gens <- rbind(
    idx_row[, c("cohort_definition_id", "endpoint_name", "last_subject_count")],
    gens[, c("cohort_definition_id", "endpoint_name", "last_subject_count")]
  )
  all_gens <- all_gens[!duplicated(all_gens$cohort_definition_id), ]

  index_cid <- all_gens$cohort_definition_id[1]

  # Fetch (subject_id, cohort_definition_id) for all eligible cohorts.
  ids_str <- paste(sprintf("%.0f", all_gens$cohort_definition_id), collapse = ",")
  mem_sql <- sprintf(
    "SELECT DISTINCT subject_id, cohort_definition_id
       FROM %s.cohort
      WHERE cohort_definition_id IN (%s)",
    cohort_schema, ids_str
  )
  mdf <- tryCatch(DatabaseConnector::querySql(connection, mem_sql),
                  error = function(e) NULL)
  if (is.null(mdf) || nrow(mdf) == 0L) return(data.frame())
  names(mdf) <- tolower(names(mdf))
  mdf$cohort_definition_id <- as.numeric(mdf$cohort_definition_id)

  # Build sparse subject × endpoint matrix. Keep the index endpoint as col 1.
  subjects <- sort(unique(mdf$subject_id))
  endpoints_cid <- c(index_cid, all_gens$cohort_definition_id[all_gens$cohort_definition_id != index_cid])
  endpoints_name <- c(all_gens$endpoint_name[all_gens$cohort_definition_id == index_cid][1],
                      all_gens$endpoint_name[all_gens$cohort_definition_id != index_cid])

  subj_idx <- match(mdf$subject_id, subjects)
  ep_idx   <- match(mdf$cohort_definition_id, endpoints_cid)
  keep <- !is.na(subj_idx) & !is.na(ep_idx)
  if (!any(keep)) return(data.frame())

  M <- Matrix::sparseMatrix(
    i = subj_idx[keep],
    j = ep_idx[keep],
    x = 1,
    dims = c(length(subjects), length(endpoints_cid))
  )

  N <- nrow(M)
  n <- Matrix::colSums(M)
  n_i <- as.numeric(n[1])
  if (n_i <= 0) return(data.frame())

  # crossprod returns a symmetric sparse matrix. We only need row 1 (index).
  co_row <- as.numeric((Matrix::crossprod(M[, 1, drop = FALSE], M))[1, ])
  n_j    <- as.numeric(n)

  # Closed-form phi for 2×2 contingency.
  denom <- suppressWarnings(sqrt(n_i * n_j * (N - n_i) * (N - n_j)))
  phi <- ifelse(is.na(denom) | denom <= 0, 0,
                (N * co_row - n_i * n_j) / denom)

  # Haldane-Anscombe continuity correction for OR + 95% CI.
  a <- co_row + 0.5
  b <- (n_i - co_row) + 0.5
  c <- (n_j - co_row) + 0.5
  d <- (N - n_i - n_j + co_row) + 0.5
  or <- (a * d) / (b * c)
  log_or <- log(or)
  se_log_or <- sqrt(1 / a + 1 / b + 1 / c + 1 / d)
  or_ci_low  <- exp(log_or - 1.96 * se_log_or)
  or_ci_high <- exp(log_or + 1.96 * se_log_or)

  out <- data.frame(
    endpoint_cid      = endpoints_cid,
    comorbid_endpoint = as.character(endpoints_name),
    phi_coef          = as.numeric(phi),
    odds_ratio        = as.numeric(or),
    or_ci_low         = as.numeric(or_ci_low),
    or_ci_high        = as.numeric(or_ci_high),
    co_count          = as.integer(co_row),
    n_self            = as.integer(n_j),
    stringsAsFactors  = FALSE
  )

  # Drop index row + universe-filter on n_self + sort + top-50.
  out <- out[out$endpoint_cid != index_cid & out$n_self >= min_subjects, ]
  if (nrow(out) == 0L) return(data.frame())
  out <- out[order(-abs(out$phi_coef)), ]
  out <- head(out, 50L)
  out$rank <- seq_len(nrow(out))
  out[, c("comorbid_endpoint", "phi_coef", "odds_ratio",
          "or_ci_low", "or_ci_high", "co_count", "rank")]
}

# Compute top-10 ATC3 drug classes in the 90-day pre-index window per D-14.
# Uses DISTINCT (subject_id, atc3_code) before aggregation (Pitfall 7) so
# multi-parent ATC memberships don't double-count subjects in one class.
# Denominator excludes subjects with zero drug_exposure rows in the window
# (D-14 "absence of recording ≠ absence of treatment").
#
# Returns data.frame(atc3_code, atc3_name, subjects_on_drug, subjects_total,
# pct_on_drug, rank). LIMIT 10.
.compute_drug_classes_atc3 <- function(connection, cohort_schema, cdm_schema,
                                       vocab_schema, cohort_def_id) {
  if (is.na(cohort_def_id) || cohort_def_id <= 0) return(data.frame())

  # Guard: if cohort_def_id has no rows, nothing to aggregate.
  cnt_df <- DatabaseConnector::querySql(
    connection,
    sprintf("SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %.0f",
            cohort_schema, cohort_def_id)
  )
  names(cnt_df) <- tolower(names(cnt_df))
  if (as.integer(cnt_df$c[1]) == 0L) return(data.frame())

  sql <- sprintf(
    "WITH index_events AS (
       SELECT c.subject_id, c.cohort_start_date AS index_date
         FROM %s.cohort c
        WHERE c.cohort_definition_id = %.0f
     ),
     window_drugs AS (
       SELECT DISTINCT ie.subject_id, de.drug_concept_id
         FROM index_events ie
         JOIN %s.drug_exposure de
           ON de.person_id = ie.subject_id
          AND de.drug_exposure_start_date
              BETWEEN ie.index_date - INTERVAL '90 days'
                  AND ie.index_date - INTERVAL '1 day'
     ),
     subjects_with_any_drug AS (
       SELECT DISTINCT subject_id FROM window_drugs
     ),
     atc3_per_subject AS (
       SELECT DISTINCT wd.subject_id, c.concept_code AS atc3_code,
                       c.concept_name AS atc3_name
         FROM window_drugs wd
         JOIN %s.concept_ancestor ca
           ON ca.descendant_concept_id = wd.drug_concept_id
         JOIN %s.concept c
           ON c.concept_id = ca.ancestor_concept_id
        WHERE c.vocabulary_id = 'ATC'
          AND c.concept_class_id = 'ATC 3rd'
     )
     SELECT a.atc3_code,
            a.atc3_name,
            COUNT(DISTINCT a.subject_id) AS subjects_on_drug,
            (SELECT COUNT(*) FROM subjects_with_any_drug) AS subjects_total,
            (COUNT(DISTINCT a.subject_id) * 100.0)
              / NULLIF((SELECT COUNT(*) FROM subjects_with_any_drug), 0) AS pct_on_drug,
            ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT a.subject_id) DESC) AS rank
       FROM atc3_per_subject a
      GROUP BY a.atc3_code, a.atc3_name
      ORDER BY subjects_on_drug DESC
      LIMIT 10",
    cohort_schema, cohort_def_id, cdm_schema, vocab_schema, vocab_schema
  )

  df <- tryCatch(DatabaseConnector::querySql(connection, sql),
                 error = function(e) NULL)
  if (is.null(df) || nrow(df) == 0L) return(data.frame())
  names(df) <- tolower(names(df))
  data.frame(
    atc3_code        = as.character(df$atc3_code),
    atc3_name        = as.character(df$atc3_name),
    subjects_on_drug = as.integer(df$subjects_on_drug),
    subjects_total   = as.integer(df$subjects_total),
    pct_on_drug      = as.numeric(df$pct_on_drug),
    rank             = as.integer(df$rank),
    stringsAsFactors = FALSE
  )
}

# Persist all 4 result tables. DELETE existing rows for the composite
# (endpoint_name, source_key, expression_hash) key first so stale rows don't
# survive when the new payload is smaller than the cached one. Summary row
# uses ON CONFLICT DO UPDATE as a safety net.
.persist_profile_results <- function(connection, results_schema,
                                     endpoint_name, source_key, expression_hash,
                                     run_id, subject_count, death_count,
                                     median_survival_days,
                                     age_at_death_mean, age_at_death_median,
                                     age_at_death_bins,
                                     universe_size, min_subjects,
                                     source_has_death_data, source_has_drug_data,
                                     km_points, comorb_df, drug_df) {

  # Escape helpers — these values already passed regex validation upstream,
  # but we still single-quote-escape to be safe.
  sq <- function(x) gsub("'", "''", as.character(x), fixed = TRUE)
  ep_esc   <- sq(endpoint_name)
  sk_esc   <- sq(source_key)
  hash_esc <- sq(expression_hash)
  run_esc  <- sq(run_id)

  nullable_num <- function(x) {
    if (is.null(x) || length(x) == 0 || is.na(x) || !is.finite(x)) "NULL" else sprintf("%.6f", as.numeric(x))
  }

  # ── Clear existing rows for this (endpoint, source, hash) key ──
  for (t in c("endpoint_profile_km_points", "endpoint_profile_drug_classes")) {
    DatabaseConnector::executeSql(
      connection,
      sprintf(
        "DELETE FROM %s.%s WHERE endpoint_name = '%s' AND source_key = '%s' AND expression_hash = '%s'",
        results_schema, t, ep_esc, sk_esc, hash_esc
      ),
      progressBar = FALSE, reportOverallTime = FALSE
    )
  }
  DatabaseConnector::executeSql(
    connection,
    sprintf(
      "DELETE FROM %s.endpoint_profile_comorbidities WHERE index_endpoint = '%s' AND source_key = '%s' AND expression_hash = '%s'",
      results_schema, ep_esc, sk_esc, hash_esc
    ),
    progressBar = FALSE, reportOverallTime = FALSE
  )

  # ── 1. Summary row (ON CONFLICT DO UPDATE) ──
  age_bins_json <- jsonlite::toJSON(age_at_death_bins, auto_unbox = TRUE,
                                    null = "null", force = TRUE)
  # Postgres JSON literal — escape single quotes.
  age_bins_esc <- gsub("'", "''", as.character(age_bins_json), fixed = TRUE)

  summary_sql <- sprintf(
    "INSERT INTO %s.endpoint_profile_summary (
        endpoint_name, source_key, expression_hash,
        subject_count, death_count, median_survival_days,
        age_at_death_mean, age_at_death_median, age_at_death_bins,
        universe_size, min_subjects,
        source_has_death_data, source_has_drug_data,
        run_id, computed_at
      ) VALUES (
        '%s', '%s', '%s',
        %d, %d, %s,
        %s, %s, '%s'::jsonb,
        %d, %d,
        %s, %s,
        '%s', CURRENT_TIMESTAMP
      )
      ON CONFLICT (endpoint_name, source_key, expression_hash)
      DO UPDATE SET
        subject_count = EXCLUDED.subject_count,
        death_count = EXCLUDED.death_count,
        median_survival_days = EXCLUDED.median_survival_days,
        age_at_death_mean = EXCLUDED.age_at_death_mean,
        age_at_death_median = EXCLUDED.age_at_death_median,
        age_at_death_bins = EXCLUDED.age_at_death_bins,
        universe_size = EXCLUDED.universe_size,
        min_subjects = EXCLUDED.min_subjects,
        source_has_death_data = EXCLUDED.source_has_death_data,
        source_has_drug_data = EXCLUDED.source_has_drug_data,
        run_id = EXCLUDED.run_id,
        computed_at = CURRENT_TIMESTAMP",
    results_schema,
    ep_esc, sk_esc, hash_esc,
    as.integer(subject_count), as.integer(death_count),
    nullable_num(median_survival_days),
    nullable_num(age_at_death_mean), nullable_num(age_at_death_median), age_bins_esc,
    as.integer(universe_size), as.integer(min_subjects),
    if (isTRUE(source_has_death_data)) "TRUE" else "FALSE",
    if (isTRUE(source_has_drug_data))  "TRUE" else "FALSE",
    run_esc
  )
  DatabaseConnector::executeSql(connection, summary_sql,
                                progressBar = FALSE, reportOverallTime = FALSE)

  # ── 2. KM points (batch INSERT) ──
  if (nrow(km_points) > 0) {
    # Dedup by time_days keeping the first row, since (endpoint_name,
    # source_key, expression_hash, time_days) is the composite PK.
    km_points <- km_points[!duplicated(km_points$time_days), ]
    # Build VALUES in chunks of 500 to stay under query-size limits.
    chunks <- split(seq_len(nrow(km_points)),
                    ceiling(seq_len(nrow(km_points)) / 500L))
    for (ch in chunks) {
      vals <- paste(sprintf("('%s', '%s', '%s', %.6f, %.8f, %d, %d)",
                            ep_esc, sk_esc, hash_esc,
                            as.numeric(km_points$time_days[ch]),
                            as.numeric(km_points$survival_prob[ch]),
                            as.integer(km_points$at_risk[ch]),
                            as.integer(km_points$events[ch])),
                    collapse = ",\n")
      DatabaseConnector::executeSql(
        connection,
        sprintf(
          "INSERT INTO %s.endpoint_profile_km_points (
             endpoint_name, source_key, expression_hash,
             time_days, survival_prob, at_risk, events
           ) VALUES %s
           ON CONFLICT (endpoint_name, source_key, expression_hash, time_days)
           DO UPDATE SET
             survival_prob = EXCLUDED.survival_prob,
             at_risk = EXCLUDED.at_risk,
             events = EXCLUDED.events",
          results_schema, vals
        ),
        progressBar = FALSE, reportOverallTime = FALSE
      )
    }
  }

  # ── 3. Comorbidities (batch INSERT) ──
  if (nrow(comorb_df) > 0) {
    fnum <- function(x) {
      x <- as.numeric(x)
      x[is.na(x) | !is.finite(x)] <- 0
      x
    }
    rows <- paste(sprintf(
      "('%s', '%s', '%s', '%s', %.6f, %.6f, %.6f, %.6f, %d, %d)",
      ep_esc, sk_esc, hash_esc,
      vapply(comorb_df$comorbid_endpoint, sq, character(1)),
      fnum(comorb_df$phi_coef),
      fnum(comorb_df$odds_ratio),
      fnum(comorb_df$or_ci_low),
      fnum(comorb_df$or_ci_high),
      as.integer(comorb_df$co_count),
      as.integer(comorb_df$rank)
    ), collapse = ",\n")
    DatabaseConnector::executeSql(
      connection,
      sprintf(
        "INSERT INTO %s.endpoint_profile_comorbidities (
           index_endpoint, source_key, expression_hash, comorbid_endpoint,
           phi_coef, odds_ratio, or_ci_low, or_ci_high, co_count, rank
         ) VALUES %s
         ON CONFLICT (index_endpoint, source_key, expression_hash, comorbid_endpoint)
         DO UPDATE SET
           phi_coef   = EXCLUDED.phi_coef,
           odds_ratio = EXCLUDED.odds_ratio,
           or_ci_low  = EXCLUDED.or_ci_low,
           or_ci_high = EXCLUDED.or_ci_high,
           co_count   = EXCLUDED.co_count,
           rank       = EXCLUDED.rank",
        results_schema, rows
      ),
      progressBar = FALSE, reportOverallTime = FALSE
    )
  }

  # ── 4. Drug classes (batch INSERT) ──
  if (nrow(drug_df) > 0) {
    rows <- paste(sprintf(
      "('%s', '%s', '%s', '%s', %s, %d, %d, %.6f, %d)",
      ep_esc, sk_esc, hash_esc,
      vapply(as.character(drug_df$atc3_code), sq, character(1)),
      ifelse(is.na(drug_df$atc3_name), "NULL",
             sprintf("'%s'", vapply(as.character(drug_df$atc3_name), sq, character(1)))),
      as.integer(drug_df$subjects_on_drug),
      as.integer(drug_df$subjects_total),
      as.numeric(drug_df$pct_on_drug),
      as.integer(drug_df$rank)
    ), collapse = ",\n")
    DatabaseConnector::executeSql(
      connection,
      sprintf(
        "INSERT INTO %s.endpoint_profile_drug_classes (
           endpoint_name, source_key, expression_hash, atc3_code,
           atc3_name, subjects_on_drug, subjects_total, pct_on_drug, rank
         ) VALUES %s
         ON CONFLICT (endpoint_name, source_key, expression_hash, atc3_code)
         DO UPDATE SET
           atc3_name        = EXCLUDED.atc3_name,
           subjects_on_drug = EXCLUDED.subjects_on_drug,
           subjects_total   = EXCLUDED.subjects_total,
           pct_on_drug      = EXCLUDED.pct_on_drug,
           rank             = EXCLUDED.rank",
        results_schema, rows
      ),
      progressBar = FALSE, reportOverallTime = FALSE
    )
  }

  invisible(NULL)
}

finngen_endpoint_profile_execute <- function(source_envelope, run_id, export_folder,
                                             analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "validate_params", pct = 2))

    # ── Parse params (Pitfall 1: cohort_definition_id as numeric, NOT integer) ──
    endpoint_name   <- as.character(analysis_settings$endpoint_name)
    source_key      <- as.character(analysis_settings$source_key)
    expression_hash <- as.character(analysis_settings$expression_hash)
    min_subjects    <- as.integer(analysis_settings$min_subjects %||% 20L)
    condition_ids   <- as.integer(analysis_settings$condition_concept_ids %||% integer(0))
    drug_ids        <- as.integer(analysis_settings$drug_concept_ids     %||% integer(0))
    source_ids      <- as.integer(analysis_settings$source_concept_ids   %||% integer(0))
    # NOTE: numeric, NOT integer — 100B + generation.id exceeds R int32 INT_MAX.
    cohort_def_id   <- suppressWarnings(as.numeric(analysis_settings$cohort_definition_id))

    source_has_death <- isTRUE(as.logical(analysis_settings$source_has_death_data %||% TRUE))
    source_has_drug  <- isTRUE(as.logical(analysis_settings$source_has_drug_data  %||% TRUE))

    if (!nzchar(endpoint_name)) stop("endpoint_profile: endpoint_name is required")
    if (!nzchar(source_key))    stop("endpoint_profile: source_key is required")
    if (!nzchar(expression_hash)) stop("endpoint_profile: expression_hash is required")

    # ── T-18-03: regex allow-list on source_key BEFORE any interpolation ──
    source_key_lc <- tolower(source_key)
    if (!grepl("^[a-z][a-z0-9_]*$", source_key_lc)) {
      stop(sprintf("endpoint_profile: unsafe source_key: %s", source_key))
    }

    cdm_schema    <- source_envelope$schemas$cdm
    vocab_schema  <- source_envelope$schemas$vocab %||% "vocab"
    cohort_schema <- source_envelope$schemas$cohort
    results_schema <- paste0(source_key_lc, "_co2_results")

    for (pair in list(c("cdm_schema", cdm_schema),
                      c("vocab_schema", vocab_schema),
                      c("cohort_schema", cohort_schema),
                      c("results_schema", results_schema))) {
      if (!grepl("^[a-z][a-z0-9_]*$", pair[2])) {
        stop(sprintf("endpoint_profile: unsafe %s: %s", pair[1], pair[2]))
      }
    }

    connection <- .finngen_open_connection(source_envelope)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection),
                     error = function(e) NULL), add = TRUE)

    # ── 1. KM survival + age-at-death bins (D-01/D-02/D-03, Pitfall 8) ──
    write_progress(progress_path, list(step = "km_start", pct = 10))
    km <- .compute_km_for_cohort(
      connection, cohort_schema, cdm_schema, vocab_schema,
      cohort_def_id, endpoint_name,
      condition_ids, drug_ids, source_ids,
      progress_path
    )

    # ── 2. Comorbidity phi (vectorized — Pitfall 2) ──
    write_progress(progress_path, list(step = "comorbidity_start", pct = 45))
    comorb_df <- .compute_comorbidity_phi(
      connection, cohort_schema, cdm_schema,
      endpoint_name, source_key, min_subjects
    )
    universe_size <- as.integer(nrow(comorb_df))

    # ── 3. Drug classes ATC3 (D-14 90-day pre-index, Pitfall 7) ──
    write_progress(progress_path, list(step = "drug_classes_start", pct = 70))
    drug_df <- if (source_has_drug) {
      .compute_drug_classes_atc3(
        connection, cohort_schema, cdm_schema, vocab_schema, cohort_def_id
      )
    } else {
      data.frame()
    }

    # ── 4. Persist results ──
    write_progress(progress_path, list(step = "persist_results", pct = 85))
    .persist_profile_results(
      connection, results_schema,
      endpoint_name, source_key, expression_hash, run_id,
      km$subject_count, km$death_count, km$median_survival_days,
      km$age_at_death_mean, km$age_at_death_median, km$age_at_death_bins,
      universe_size, min_subjects,
      source_has_death, source_has_drug,
      km$km_points, comorb_df, drug_df
    )

    .write_summary(export_folder, list(
      analysis_type        = "co2.endpoint_profile",
      endpoint_name        = endpoint_name,
      source_key           = source_key,
      expression_hash      = expression_hash,
      subject_count        = as.integer(km$subject_count),
      death_count          = as.integer(km$death_count),
      median_survival_days = km$median_survival_days,
      age_at_death_mean    = km$age_at_death_mean,
      age_at_death_median  = km$age_at_death_median,
      universe_size        = universe_size,
      n_km_points          = as.integer(nrow(km$km_points)),
      n_comorbidities      = as.integer(nrow(comorb_df)),
      n_drug_classes       = as.integer(nrow(drug_df)),
      resolution_mode      = km$resolution_mode
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      subject_count   = as.integer(km$subject_count),
      death_count     = as.integer(km$death_count),
      n_km_points     = as.integer(nrow(km$km_points)),
      n_comorbidities = as.integer(nrow(comorb_df)),
      n_drug_classes  = as.integer(nrow(drug_df)),
      resolution_mode = km$resolution_mode
    )
  })
}
