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
  # Bespoke SQL matcher — same strategy that SP3 used (option C2) after we
  # established that HadesExtras' matcher requires a handler-registered
  # cohortDefinitionSet we can't cheaply populate. Greedy with-replacement:
  # each primary case gets up to `match_ratio` comparators, ranked by
  # |birth_year_diff| with a random tie-break. Sex + birth-year predicates
  # are applied as JOIN filters when the matching flags are on.
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    primary_id      <- as.integer(params$primary_cohort_id)
    comparator_ids  <- as.integer(params$comparator_cohort_ids)
    match_ratio     <- as.integer(params$ratio %||% 1L)
    match_sex       <- isTRUE(params$match_sex %||% TRUE)
    match_by        <- isTRUE(params$match_birth_year %||% TRUE)
    max_year_diff   <- as.integer(params$max_year_difference %||% 1L)

    if (!match_sex && !match_by) stop("cohort.match requires at least one of match_sex or match_birth_year")

    write_progress(progress_path, list(step = "build_connection", pct = 5))
    connection <- .finngen_open_connection(source_envelope)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

    cohort_schema <- source_envelope$schemas$cohort
    cdm_schema    <- source_envelope$schemas$cdm
    if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema)) stop(sprintf("cohort.match: unsafe cohort_schema %s", cohort_schema))
    if (!grepl("^[a-z][a-z0-9_]*$", cdm_schema))    stop(sprintf("cohort.match: unsafe cdm_schema %s", cdm_schema))

    write_progress(progress_path, list(step = "capture_pre_match_sizes", pct = 15))
    pre_counts <- .finngen_match_cohort_sizes(source_envelope, c(primary_id, comparator_ids))

    # Allocate a fresh cohort_definition_id for the matched output. We go
    # high (9e6 + primary_id) to avoid collisions with user cohorts; in a
    # future iteration we'd hand these back through Laravel so they become
    # first-class cohort_definitions with names.
    matched_cohort_id <- 9000000L + primary_id

    write_progress(progress_path, list(
      step = "clear_existing_matched", pct = 25,
      message = sprintf("Clearing prior matched rows for cohort_definition_id=%d", matched_cohort_id)
    ))
    DatabaseConnector::executeSql(
      connection,
      sprintf("DELETE FROM %s.cohort WHERE cohort_definition_id = %d",
              cohort_schema, matched_cohort_id)
    )

    # Build match predicates. Comparing year_of_birth directly is the Shiny
    # default (maxYearDifference=1 means within 1 calendar year); gender
    # uses gender_concept_id exact-match.
    sex_pred       <- if (match_sex) "pp.gender_concept_id = cp.gender_concept_id"                 else "1=1"
    birth_pred     <- if (match_by)  sprintf("ABS(pp.year_of_birth - cp.year_of_birth) <= %d", max_year_diff) else "1=1"
    tiebreak_order <- if (match_by)  "ABS(pp.year_of_birth - cp.year_of_birth), RANDOM()"          else "RANDOM()"

    comparator_id_list <- paste(comparator_ids, collapse = ",")

    write_progress(progress_path, list(step = "insert_matched", pct = 55, message = "Running greedy match"))
    insert_sql <- sprintf(
      "WITH primary_subjects AS (
         SELECT DISTINCT c.subject_id, p.year_of_birth, p.gender_concept_id,
                MIN(c.cohort_start_date) AS cohort_start_date,
                MAX(c.cohort_end_date)   AS cohort_end_date
         FROM %1$s.cohort c
         JOIN %2$s.person p ON p.person_id = c.subject_id
         WHERE c.cohort_definition_id = %3$d
         GROUP BY c.subject_id, p.year_of_birth, p.gender_concept_id
       ),
       comparator_pool AS (
         SELECT DISTINCT c.subject_id, p.year_of_birth, p.gender_concept_id,
                MIN(c.cohort_start_date) AS cohort_start_date,
                MAX(c.cohort_end_date)   AS cohort_end_date
         FROM %1$s.cohort c
         JOIN %2$s.person p ON p.person_id = c.subject_id
         WHERE c.cohort_definition_id IN (%4$s)
           AND c.subject_id NOT IN (SELECT subject_id FROM primary_subjects)
         GROUP BY c.subject_id, p.year_of_birth, p.gender_concept_id
       ),
       ranked AS (
         SELECT cp.subject_id, cp.cohort_start_date, cp.cohort_end_date,
                ROW_NUMBER() OVER (
                  PARTITION BY pp.subject_id
                  ORDER BY %5$s
                ) AS rnk
         FROM primary_subjects pp
         JOIN comparator_pool  cp
           ON %6$s AND %7$s
       ),
       matched_controls AS (
         SELECT DISTINCT subject_id, cohort_start_date, cohort_end_date
         FROM ranked WHERE rnk <= %8$d
       )
       INSERT INTO %1$s.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
       SELECT %9$d, subject_id, cohort_start_date, cohort_end_date FROM primary_subjects
       UNION ALL
       SELECT %9$d, subject_id, cohort_start_date, cohort_end_date FROM matched_controls",
      cohort_schema,   cdm_schema,       # %1 %2
      primary_id,      comparator_id_list, # %3 %4
      tiebreak_order,  sex_pred, birth_pred, # %5 %6 %7
      match_ratio,     matched_cohort_id  # %8 %9
    )
    DatabaseConnector::executeSql(connection, insert_sql)

    write_progress(progress_path, list(step = "getCohortCounts", pct = 75))
    count_sql <- sprintf(
      "SELECT %d AS cohort_id, 'Matched from #%d' AS cohort_name,
              COUNT(*) AS cohort_entries, COUNT(DISTINCT subject_id) AS cohort_subjects
       FROM %s.cohort WHERE cohort_definition_id = %d
       GROUP BY 1, 2",
      matched_cohort_id, primary_id, cohort_schema, matched_cohort_id
    )
    counts_df <- DatabaseConnector::querySql(connection, count_sql)
    names(counts_df) <- tolower(names(counts_df))
    counts <- lapply(seq_len(nrow(counts_df)), function(i) {
      list(
        cohortId       = as.integer(counts_df$cohort_id[i]),
        cohortName     = as.character(counts_df$cohort_name[i]),
        cohortEntries  = as.integer(counts_df$cohort_entries[i]),
        cohortSubjects = as.integer(counts_df$cohort_subjects[i])
      )
    })

    # SP4 Polish 5 — waterfall + SMD diagnostics. Failures are non-fatal; the
    # primary match run has already succeeded by this point.
    write_progress(progress_path, list(step = "compute_diagnostics", pct = 88))
    post_ids <- tryCatch({
      as.integer(vapply(counts, function(x) x$cohortId %||% NA_integer_, integer(1)))
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
  # Matched-output rows. Bespoke matcher emits counts as list-of-lists.
  if (is.list(counts) && length(counts) > 0) {
    for (row in counts) {
      waterfall[[length(waterfall) + 1]] <- list(
        step = "matched_output",
        label = sprintf("Matched: %s", row$cohortName %||% "?"),
        count = as.integer(row$cohortSubjects %||% NA_integer_),
        cohort_id = as.integer(row$cohortId %||% NA_integer_),
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

# Genomics #2 — Materialize a FinnGen endpoint definition against a CDM.
# Reads the resolved standard SNOMED + RxNorm concept_ids from PHP, expands
# them through vocab.concept_ancestor (so all descendants count), unions
# qualifying events from condition_occurrence + drug_exposure (and a fallback
# match on source_concept_id for ICD-10/9 source codes that didn't resolve to
# standard), and writes one row per subject to {cohort_schema}.cohort with
# index = MIN(event_date), end = MAX(event_date). Optional sex filter via
# gender_concept_id (8507 male / 8532 female).
#
# Honors the same overwrite gate as cohort.materialize: refuses to write
# if rows already exist for cohort_definition_id unless overwrite_existing
# is true.
finngen_endpoint_generate_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    # Phase 13.2 — FinnGen endpoint generations use an offset-derived key.
    # Matching constant in PHP: App\Models\App\FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET = 100_000_000_000.
    # Using numeric (double) NOT R integer (32-bit) — offset > INT_MAX (2^31).
    # See: .planning/phases/13.2-finish-finngen-cutover/13.2-RESEARCH.md §Pitfall 4
    OMOP_COHORT_ID_OFFSET <- 100000000000

    gen_id_raw <- params$finngen_endpoint_generation_id %||% NA
    gen_id     <- suppressWarnings(as.numeric(gen_id_raw))
    legacy_cid <- suppressWarnings(as.numeric(params$cohort_definition_id))

    cohort_def_id <- if (!is.na(gen_id) && gen_id > 0) {
      gen_id + OMOP_COHORT_ID_OFFSET
    } else if (!is.na(legacy_cid) && legacy_cid > 0) {
      legacy_cid
    } else {
      NA_real_
    }

    condition_ids   <- as.integer(params$condition_concept_ids %||% integer(0))
    drug_ids        <- as.integer(params$drug_concept_ids %||% integer(0))
    source_ids      <- as.integer(params$source_concept_ids %||% integer(0))
    sex_restriction <- params$sex_restriction %||% NULL  # "male" / "female" / NULL
    overwrite       <- isTRUE(params$overwrite_existing)

    if (is.na(cohort_def_id) || cohort_def_id <= 0)
      stop("endpoint.generate: either finngen_endpoint_generation_id or cohort_definition_id required")
    if (length(condition_ids) == 0 && length(drug_ids) == 0 && length(source_ids) == 0)
      stop("endpoint.generate: no resolved concepts — endpoint cannot be materialized (CONTROL_ONLY?)")

    write_progress(progress_path, list(step = "build_connection", pct = 5))
    connection <- .finngen_open_connection(source_envelope)
    on.exit(tryCatch(DatabaseConnector::disconnect(connection), error = function(e) NULL), add = TRUE)

    cohort_schema <- source_envelope$schemas$cohort
    cdm_schema    <- source_envelope$schemas$cdm
    vocab_schema  <- source_envelope$schemas$vocab %||% "vocab"
    if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema)) stop(sprintf("endpoint.generate: unsafe cohort_schema %s", cohort_schema))
    if (!grepl("^[a-z][a-z0-9_]*$", cdm_schema))    stop(sprintf("endpoint.generate: unsafe cdm_schema %s", cdm_schema))
    if (!grepl("^[a-z][a-z0-9_]*$", vocab_schema))  stop(sprintf("endpoint.generate: unsafe vocab_schema %s", vocab_schema))

    write_progress(progress_path, list(step = "check_existing", pct = 12))
    existing_df <- DatabaseConnector::querySql(
      connection,
      sprintf("SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %.0f",
              cohort_schema, cohort_def_id)
    )
    names(existing_df) <- tolower(names(existing_df))
    existing_count <- as.integer(existing_df$c[1])
    if (!is.na(existing_count) && existing_count > 0) {
      if (overwrite) {
        write_progress(progress_path, list(
          step = "clear_existing", pct = 18,
          message = sprintf("Clearing %d prior rows", existing_count)
        ))
        DatabaseConnector::executeSql(
          connection,
          sprintf("DELETE FROM %s.cohort WHERE cohort_definition_id = %.0f",
                  cohort_schema, cohort_def_id)
        )
      } else {
        stop(sprintf("endpoint.generate: cohort_definition_id %.0f already has %d rows in %s.cohort — re-run with overwrite_existing=true",
                     cohort_def_id, existing_count, cohort_schema))
      }
    }

    # Build the qualifying-event CTEs. Each branch only included if the
    # corresponding concept list is non-empty — keeps the SQL minimal for
    # condition-only or drug-only endpoints.
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

    # Source-concept fallback — catches ICD-10/9 codes the resolver matched
    # in vocab but never traversed Maps-to to a standard SNOMED. Useful for
    # endpoints where the Finnish-specific source code is recorded in
    # condition_source_concept_id but no standard_concept maps cleanly.
    if (length(source_ids) > 0) {
      src_list <- paste(source_ids, collapse = ",")
      branches <- c(branches, sprintf(
        "SELECT co.person_id AS subject_id, co.condition_start_date AS event_date
           FROM %s.condition_occurrence co
          WHERE co.condition_source_concept_id IN (%s)",
        cdm_schema, src_list
      ))
    }

    qualifying_cte <- paste(branches, collapse = "\nUNION\n")

    sex_filter <- ""
    if (!is.null(sex_restriction) && nzchar(sex_restriction)) {
      sx <- tolower(sex_restriction)
      sex_concept <- if (sx == "female") 8532L else if (sx == "male") 8507L else NA_integer_
      if (!is.na(sex_concept)) {
        sex_filter <- sprintf("AND p.gender_concept_id = %d", sex_concept)
      }
    }

    write_progress(progress_path, list(step = "insert_subjects", pct = 35, message = "Materializing endpoint"))
    insert_sql <- sprintf(
      "INSERT INTO %s.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
       SELECT %.0f AS cohort_definition_id,
              q.subject_id,
              MIN(q.event_date) AS cohort_start_date,
              MAX(q.event_date) AS cohort_end_date
         FROM (
           %s
         ) q
         JOIN %s.person p ON p.person_id = q.subject_id
        WHERE 1=1 %s
        GROUP BY q.subject_id",
      cohort_schema, cohort_def_id, qualifying_cte, cdm_schema, sex_filter
    )
    DatabaseConnector::executeSql(connection, insert_sql)

    write_progress(progress_path, list(step = "count_subjects", pct = 85))
    cnt_df <- DatabaseConnector::querySql(
      connection,
      sprintf("SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %.0f",
              cohort_schema, cohort_def_id)
    )
    names(cnt_df) <- tolower(names(cnt_df))
    subject_count <- as.integer(cnt_df$c[1])

    .write_summary(export_folder, list(
      analysis_type        = "endpoint.generate",
      cohort_definition_id = cohort_def_id,
      subject_count        = subject_count,
      n_condition_concepts = length(condition_ids),
      n_drug_concepts      = length(drug_ids),
      n_source_concepts    = length(source_ids),
      sex_restriction      = sex_restriction
    ))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      subject_count        = subject_count,
      cohort_definition_id = cohort_def_id
    )
  })
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
    overwrite     <- isTRUE(params$overwrite_existing)

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

    # SP4 Polish #7 — overwrite flow. When the PHP caller passes
    # overwrite_existing=true (only possible when the researcher explicitly
    # re-materializes one of their own cohorts), DELETE existing rows for this
    # cohort_definition_id before re-inserting. Without the flag, keep the
    # original guard so accidental collisions still fail loud.
    write_progress(progress_path, list(step = "check_existing", pct = 15))
    existing_sql <- sprintf(
      "SELECT COUNT(*) AS c FROM %s.cohort WHERE cohort_definition_id = %d",
      cohort_schema, cohort_def_id
    )
    existing <- DatabaseConnector::querySql(connection, existing_sql)
    names(existing) <- tolower(names(existing))
    existing_count <- as.integer(existing$c[1])
    if (existing_count > 0) {
      if (overwrite) {
        write_progress(progress_path, list(
          step = "clear_existing", pct = 20,
          message = sprintf("Clearing %d prior rows for cohort_definition_id=%d", existing_count, cohort_def_id)
        ))
        DatabaseConnector::executeSql(
          connection,
          sprintf("DELETE FROM %s.cohort WHERE cohort_definition_id = %d",
                  cohort_schema, cohort_def_id)
        )
      } else {
        stop(sprintf("cohort.materialize: cohort_definition_id %d already has %d rows in %s.cohort — re-run with overwrite_existing=true",
                     cohort_def_id, existing_count, cohort_schema))
      }
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
