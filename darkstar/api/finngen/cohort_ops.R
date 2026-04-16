# darkstar/api/finngen/cohort_ops.R
#
# Async cohort-materialization endpoints. Used by SP4 Cohort Workbench
# (not by SP1 UI, but the endpoints must exist for Part B API shape stability).
#
# Each writes to the bound results schema via parthenon_finngen_rw role.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
  library(HadesExtras)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

finngen_cohort_generate_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(step = "generateCohortSet", pct = 30, message = "Materializing cohorts"))
    handler$generateCohortSet(cohortDefinitionSet = params$cohort_definition_set)

    write_progress(progress_path, list(step = "getCohortCounts", pct = 90))
    counts <- handler$getCohortCounts()

    .write_summary(export_folder, list(
      analysis_type = "cohort.generate",
      counts        = counts
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(counts = counts)
  })
}

finngen_cohort_match_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    primary_id      <- as.integer(params$primary_cohort_id)
    comparator_ids  <- as.integer(params$comparator_cohort_ids)
    match_ratio     <- params$ratio %||% 1L

    # SP4 Polish 5 — capture pre-match cohort sizes for the attrition
    # waterfall BEFORE running the matcher.
    write_progress(progress_path, list(step = "capture_pre_match_sizes", pct = 15))
    pre_counts <- .finngen_match_cohort_sizes(source_envelope, c(primary_id, comparator_ids))

    write_progress(progress_path, list(step = "build_matching_operator", pct = 30))
    matched <- HadesExtras::CohortGenerator_MatchingSubsetOperator(
      targetCohortId      = primary_id,
      comparatorCohortIds = comparator_ids,
      ratio               = match_ratio,
      matchSex            = params$match_sex %||% TRUE,
      matchBirthYear      = params$match_birth_year %||% TRUE,
      maxYearDifference   = params$max_year_difference %||% 1L
    )

    write_progress(progress_path, list(step = "generateCohortSet", pct = 60, message = "Materializing matched cohort"))
    handler$generateCohortSet(cohortDefinitionSet = list(matched))

    write_progress(progress_path, list(step = "getCohortCounts", pct = 75))
    counts <- handler$getCohortCounts()

    # SP4 Polish 5 — waterfall + SMD diagnostics. Failures are non-fatal; the
    # primary match run has already succeeded by this point.
    write_progress(progress_path, list(step = "compute_diagnostics", pct = 88))
    post_ids <- tryCatch({
      ids <- counts$cohortId
      if (!is.null(ids)) as.integer(ids[!is.na(ids)]) else integer(0)
    }, error = function(e) integer(0))

    waterfall <- tryCatch(
      .finngen_match_waterfall(primary_id, comparator_ids, pre_counts, counts, match_ratio),
      error = function(e) list()
    )

    smd_rows <- tryCatch(
      .finngen_match_smd(source_envelope, primary_id, comparator_ids, post_ids),
      error = function(e) list()
    )

    .write_summary(export_folder, list(
      analysis_type       = "cohort.match",
      primary_cohort_id   = primary_id,
      comparator_cohort_ids = comparator_ids,
      ratio               = match_ratio,
      counts              = counts,
      waterfall           = waterfall,
      smd                 = smd_rows
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(counts = counts, waterfall = waterfall, smd = smd_rows)
  })
}

# SP4 Polish 5 — helpers for the cohort.match diagnostics ----------------

# Pre-match cohort sizes by cohort_definition_id, returned as a named
# vector keyed by id. Uses a fresh DatabaseConnector connection so it
# doesn't fight with HadesExtras' own handler for the matcher run.
.finngen_match_cohort_sizes <- function(source_envelope, cohort_ids) {
  if (length(cohort_ids) == 0) return(integer(0))
  conn <- .finngen_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)
  sch <- source_envelope$schemas$cohort
  id_list <- paste(unique(cohort_ids), collapse = ",")
  res <- DatabaseConnector::querySql(
    conn,
    sprintf(
      "SELECT cohort_definition_id AS id, COUNT(DISTINCT subject_id) AS n
       FROM %s.cohort WHERE cohort_definition_id IN (%s)
       GROUP BY cohort_definition_id",
      sch, id_list
    )
  )
  names(res) <- tolower(names(res))
  setNames(as.integer(res$n), as.integer(res$id))
}

# Build a sparse attrition list suitable for the waterfall visualization.
# pre_counts is named by cohort id; counts is the HadesExtras tibble keyed
# by the new post-match cohort ids.
.finngen_match_waterfall <- function(primary_id, comparator_ids, pre_counts, counts, ratio) {
  waterfall <- list()
  waterfall[[length(waterfall) + 1]] <- list(
    step = "primary_input",
    label = sprintf("Primary cohort #%d", primary_id),
    count = as.integer(pre_counts[as.character(primary_id)] %||% NA_integer_),
    cohort_id = primary_id
  )
  for (cid in comparator_ids) {
    waterfall[[length(waterfall) + 1]] <- list(
      step = "comparator_input",
      label = sprintf("Comparator cohort #%d", cid),
      count = as.integer(pre_counts[as.character(cid)] %||% NA_integer_),
      cohort_id = as.integer(cid)
    )
  }
  # Matched-output rows from the HadesExtras counts tibble (one row per
  # emitted matched cohort — typically one per comparator plus the primary).
  if (!is.null(counts) && nrow(counts) > 0) {
    for (i in seq_len(nrow(counts))) {
      waterfall[[length(waterfall) + 1]] <- list(
        step = "matched_output",
        label = sprintf("Matched: %s", counts$cohortName[i] %||% counts$cohort_name[i] %||% "?"),
        count = as.integer(counts$cohortSubjects[i] %||% counts$cohort_subjects[i] %||% NA_integer_),
        cohort_id = as.integer(counts$cohortId[i] %||% counts$cohort_id[i] %||% NA_integer_),
        ratio = as.integer(ratio)
      )
    }
  }
  waterfall
}

# Compute SMD for age-at-index + % female across primary vs each
# comparator, pre- and post-match.
.finngen_match_smd <- function(source_envelope, primary_id, comparator_ids, post_ids) {
  conn <- .finngen_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  cohort_schema <- source_envelope$schemas$cohort
  cdm_schema    <- source_envelope$schemas$cdm
  ids <- unique(c(primary_id, comparator_ids, post_ids))
  ids <- ids[!is.na(ids)]
  if (length(ids) == 0) return(list())

  id_list <- paste(ids, collapse = ",")
  # gender_concept_id 8532 = FEMALE in OMOP SNOMED.
  stats_sql <- sprintf(
    "SELECT c.cohort_definition_id AS id,
            AVG(EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth)::numeric AS mean_age,
            STDDEV(EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth)::numeric AS sd_age,
            AVG(CASE WHEN p.gender_concept_id = 8532 THEN 1.0 ELSE 0.0 END)::numeric AS pct_female,
            COUNT(DISTINCT c.subject_id)::integer AS n
     FROM %s.cohort c JOIN %s.person p ON p.person_id = c.subject_id
     WHERE c.cohort_definition_id IN (%s)
     GROUP BY c.cohort_definition_id",
    cohort_schema, cdm_schema, id_list
  )
  df <- DatabaseConnector::querySql(conn, stats_sql)
  names(df) <- tolower(names(df))

  stats_by_id <- setNames(
    lapply(seq_len(nrow(df)), function(i) list(
      id         = as.integer(df$id[i]),
      mean_age   = as.numeric(df$mean_age[i]),
      sd_age     = as.numeric(df$sd_age[i]),
      pct_female = as.numeric(df$pct_female[i]),
      n          = as.integer(df$n[i])
    )),
    as.character(df$id)
  )
  primary_pre <- stats_by_id[[as.character(primary_id)]]
  if (is.null(primary_pre)) return(list())

  rows <- list()
  for (cid in comparator_ids) {
    pre <- stats_by_id[[as.character(cid)]]
    if (is.null(pre)) next
    # Find the matched post-id for this comparator (best-effort — HadesExtras
    # emits a single matched cohort id per comparator; if we can't tell which
    # is which, we just emit pre-only SMDs).
    post <- NULL
    for (pid in post_ids) {
      cand <- stats_by_id[[as.character(pid)]]
      if (!is.null(cand) && !is.na(cand$n) && cand$n > 0 && pid != primary_id && !(pid %in% comparator_ids)) {
        post <- cand
        # Consume this post id so subsequent comparators don't re-claim it.
        post_ids <- setdiff(post_ids, pid)
        break
      }
    }

    rows[[length(rows) + 1]] <- list(
      covariate = "age_years",
      comparator_id = as.integer(cid),
      mean_primary = primary_pre$mean_age,
      mean_comparator_pre = pre$mean_age,
      mean_comparator_post = if (!is.null(post)) post$mean_age else NA_real_,
      smd_pre  = .finngen_smd_continuous(primary_pre$mean_age, primary_pre$sd_age,
                                         pre$mean_age, pre$sd_age),
      smd_post = if (!is.null(post)) .finngen_smd_continuous(
        primary_pre$mean_age, primary_pre$sd_age, post$mean_age, post$sd_age) else NA_real_,
      n_primary = primary_pre$n,
      n_comparator_pre = pre$n,
      n_comparator_post = if (!is.null(post)) post$n else NA_integer_
    )
    rows[[length(rows) + 1]] <- list(
      covariate = "pct_female",
      comparator_id = as.integer(cid),
      mean_primary = primary_pre$pct_female,
      mean_comparator_pre = pre$pct_female,
      mean_comparator_post = if (!is.null(post)) post$pct_female else NA_real_,
      smd_pre  = .finngen_smd_proportion(primary_pre$pct_female, pre$pct_female),
      smd_post = if (!is.null(post)) .finngen_smd_proportion(
        primary_pre$pct_female, post$pct_female) else NA_real_,
      n_primary = primary_pre$n,
      n_comparator_pre = pre$n,
      n_comparator_post = if (!is.null(post)) post$n else NA_integer_
    )
  }
  rows
}

.finngen_open_connection <- function(source_envelope) {
  conn_details <- DatabaseConnector::createConnectionDetails(
    dbms     = source_envelope$dbms %||% "postgresql",
    server   = source_envelope$connection$server,
    port     = source_envelope$connection$port,
    user     = source_envelope$connection$user,
    password = source_envelope$connection$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  )
  DatabaseConnector::connect(conn_details)
}

# Standardized mean difference for continuous covariates.
.finngen_smd_continuous <- function(m1, s1, m2, s2) {
  if (any(is.na(c(m1, s1, m2, s2)))) return(NA_real_)
  pooled <- sqrt((s1^2 + s2^2) / 2)
  if (is.na(pooled) || pooled == 0) return(NA_real_)
  as.numeric((m1 - m2) / pooled)
}

# SMD for proportions: (p1 - p2) / sqrt((p1*(1-p1) + p2*(1-p2))/2).
.finngen_smd_proportion <- function(p1, p2) {
  if (any(is.na(c(p1, p2)))) return(NA_real_)
  pooled <- sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / 2)
  if (is.na(pooled) || pooled == 0) return(NA_real_)
  as.numeric((p1 - p2) / pooled)
}

# SP4 Phase B.3 — sync preview-counts. Receives a precompiled subject_id SQL
# fragment from PHP (CohortOperationCompiler::compileSql), opens a connection
# against the source, and returns COUNT(DISTINCT subject_id). PHP validates
# the operation tree and whitelists the schema name before compiling, so the
# SQL fragment is trusted at this layer.
finngen_cohort_preview_count <- function(source_envelope, sql) {
  if (!is.character(sql) || length(sql) != 1 || nchar(sql) == 0) {
    stop("preview_count requires a non-empty SQL fragment")
  }
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

  wrapped <- sprintf("SELECT COUNT(DISTINCT subject_id) AS total FROM (%s) result_set", sql)
  res <- DatabaseConnector::querySql(connection, wrapped)
  names(res) <- tolower(names(res))
  total <- as.integer(res$total[1])
  list(total = total)
}

# SP4 Polish 2 — materialize an operation tree as a new cohort row. Laravel
# creates the cohort_definitions row first, compiles the tree to subject-id
# SQL, and hands us the {cohort_definition_id, subject_sql, cohort_schema,
# referenced_cohort_ids} payload. We INSERT INTO cohort with subject_ids from
# the compiled SQL, joining back to cohort to pick up cohort_start_date /
# cohort_end_date (min/max across referenced cohort memberships). Returns
# {subject_count, cohort_definition_id} for the workbench UI.
finngen_cohort_materialize_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    cohort_def_id <- as.integer(params$cohort_definition_id)
    subject_sql   <- as.character(params$subject_sql)
    cohort_schema <- as.character(params$cohort_schema)
    referenced    <- as.integer(params$referenced_cohort_ids)

    if (is.na(cohort_def_id) || cohort_def_id <= 0) stop("cohort.materialize requires a positive cohort_definition_id")
    if (is.na(subject_sql) || !nzchar(subject_sql)) stop("cohort.materialize requires subject_sql")
    if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema)) stop(sprintf("cohort.materialize: unsafe cohort_schema %s", cohort_schema))
    if (length(referenced) == 0) stop("cohort.materialize requires referenced_cohort_ids")

    write_progress(progress_path, list(step = "build_connection", pct = 5))
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

    # Guard: refuse to re-materialize if this cohort_definition already has rows.
    write_progress(progress_path, list(step = "check_existing", pct = 15))
    existing_sql <- sprintf(
      "SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %d",
      cohort_schema, cohort_def_id
    )
    existing <- DatabaseConnector::querySql(connection, existing_sql)
    names(existing) <- tolower(names(existing))
    if (as.integer(existing$c[1]) > 0) {
      stop(sprintf("cohort.materialize: cohort_definition_id %d already has rows in %s.cohort — delete them first", cohort_def_id, cohort_schema))
    }

    write_progress(progress_path, list(step = "insert_cohort", pct = 30, message = "Writing subject rows"))
    id_list <- paste(referenced, collapse = ",")
    insert_sql <- sprintf(
      "INSERT INTO %s.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
       SELECT %d AS cohort_definition_id,
              r.subject_id,
              MIN(c.cohort_start_date) AS cohort_start_date,
              MAX(c.cohort_end_date)   AS cohort_end_date
       FROM (%s) r
       JOIN %s.cohort c
         ON c.subject_id = r.subject_id
        AND c.cohort_definition_id IN (%s)
       GROUP BY r.subject_id",
      cohort_schema, cohort_def_id, subject_sql, cohort_schema, id_list
    )
    DatabaseConnector::executeSql(connection, insert_sql)

    write_progress(progress_path, list(step = "count_subjects", pct = 80))
    count_sql <- sprintf(
      "SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %d",
      cohort_schema, cohort_def_id
    )
    cnt <- DatabaseConnector::querySql(connection, count_sql)
    names(cnt) <- tolower(names(cnt))
    subject_count <- as.integer(cnt$c[1])

    .write_summary(export_folder, list(
      analysis_type        = "cohort.materialize",
      cohort_definition_id = cohort_def_id,
      subject_count        = subject_count,
      referenced_cohort_ids = referenced
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      subject_count = subject_count,
      cohort_definition_id = cohort_def_id
    )
  })
}
