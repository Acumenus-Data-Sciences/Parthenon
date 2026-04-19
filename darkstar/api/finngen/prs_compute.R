# darkstar/api/finngen/prs_compute.R
#
# Phase 17 GENOMICS-07 — finngen.prs.compute worker.
#
# Contract:
#   finngen_prs_compute_execute(source_envelope, run_id, export_folder, params)
#     params = list(
#       score_id                       = chr        (required; PGS\d+ format)
#       cohort_definition_id           = num|NULL   (user cohort; numeric NOT integer)
#       finngen_endpoint_generation_id = int|NULL   (preferred for FinnGen-offset keys)
#       source_key                     = chr        (fallback when source_envelope lacks it)
#       overwrite_existing             = bool       (ignored for now; PRS is append-only per D-09)
#     )
#     Returns: list(rows_written = int, score_id = chr, cohort_definition_id = num)
#     Side effects:
#       writes progress.json + summary.json to export_folder
#       inserts rows into {source_key}_gwas_results.prs_subject_scores
#
# HIGHSEC §10: plink2 invoked via processx argv vector — no shell interpolation.
# plink2 binary lives at /opt/regenie/plink2 per docker/r/Dockerfile L394 (Phase 14).
# See 17-RESEARCH.md §Pitfall 2.
#
# 100B offset: numeric (double), NOT integer. Mirrors:
#   - App\Models\App\FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET (PHP)
#   - darkstar/api/finngen/cohort_ops.R::finngen_endpoint_generate_execute (R)
# 32-bit integers overflow silently at 2^31 (~2.1B); 100B > INT_MAX.

source("/app/api/finngen/common.R")
source("/app/api/finngen/cohort_ops.R")  # reuse .finngen_open_connection

suppressPackageStartupMessages({
  library(jsonlite)
  library(DBI)
  library(processx)
  library(DatabaseConnector)
})

.PLINK2_BIN <- "/opt/regenie/plink2"

# Helper — pull the PGEN prefix for this source from app.finngen_source_variant_indexes.
# T-17-S-SQLi-1 mitigation: source_key_lower regex-validated + single-quote escaped.
.prs_lookup_pgen <- function(conn, source_key_lower) {
  if (!grepl("^[a-z][a-z0-9_]*$", source_key_lower)) {
    stop(sprintf("prs.compute: unsafe source_key '%s'", source_key_lower))
  }
  sql <- sprintf(
    "SELECT pgen_path FROM app.finngen_source_variant_indexes WHERE lower(source_key) = '%s' LIMIT 1",
    gsub("'", "''", source_key_lower)
  )
  df <- DatabaseConnector::querySql(conn, sql)
  names(df) <- tolower(names(df))
  if (nrow(df) == 0) {
    stop(sprintf(
      "prs.compute: no variant_index for source '%s' \u2014 run `php artisan parthenon:finngen:prepare-source-variants --source-key=%s` first (Phase 14 prerequisite)",
      source_key_lower, toupper(source_key_lower)
    ))
  }
  as.character(df$pgen_path[1])
}

finngen_prs_compute_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    # --- 100B offset handling — exact parity with cohort_ops.R:396-408 ---
    # numeric (double), NOT integer: 100B > INT_MAX. See Phase 13.2 Pitfall 4.
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
    if (is.na(cohort_def_id) || cohort_def_id <= 0) {
      stop("prs.compute: either finngen_endpoint_generation_id or cohort_definition_id required")
    }

    score_id   <- as.character(params$score_id)
    source_key <- tolower(as.character(source_envelope$source_key %||% params$source_key))

    # T-17-S-SQLi-2 + T-17-S-SQLi-1 regex guards before any sprintf interpolation.
    if (!grepl("^PGS\\d+$", score_id)) {
      stop(sprintf("prs.compute: unsafe score_id '%s' (must match ^PGS\\d+$)", score_id))
    }
    if (!grepl("^[a-z][a-z0-9_]*$", source_key)) {
      stop(sprintf("prs.compute: unsafe source_key '%s'", source_key))
    }

    # Pitfall 5: schemas$cohort resolves to {source}_results (Phase 14 convention).
    # Never hard-code paste0(source_key, ".cohort").
    cohort_schema <- source_envelope$schemas$cohort %||% paste0(source_key, "_results")
    gwas_results_schema <- paste0(source_key, "_gwas_results")
    if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema)) {
      stop(sprintf("prs.compute: unsafe cohort_schema '%s'", cohort_schema))
    }
    if (!grepl("^[a-z][a-z0-9_]*$", gwas_results_schema)) {
      stop(sprintf("prs.compute: unsafe gwas_results_schema '%s'", gwas_results_schema))
    }

    write_progress(progress_path, list(step = "open_connection", pct = 5))
    conn <- .finngen_open_connection(source_envelope)
    on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

    # --- Weights TSV: id | allele | weight ---
    # Pitfall 8: prefer rsid; fall back to chr:pos:effect_allele if rsid is NULL.
    # PGEN ID convention depends on how PrepareSourceVariantsCommand built it
    # (Phase 14). If PGEN uses rsIDs, this matches; if chr:pos, fallback also matches.
    write_progress(progress_path, list(step = "read_weights", pct = 12))
    weights_df <- DatabaseConnector::querySql(conn, sprintf(
      "SELECT
          COALESCE(rsid, CONCAT(chrom, ':', pos_grch38, ':', effect_allele)) AS id,
          effect_allele                                                      AS allele,
          effect_weight::text                                                AS weight
         FROM vocab.pgs_score_variants
        WHERE score_id = '%s'",
      gsub("'", "''", score_id)
    ))
    names(weights_df) <- tolower(names(weights_df))
    if (nrow(weights_df) == 0) {
      stop(sprintf(
        "prs.compute: no variants found for score_id %s \u2014 run `php artisan parthenon:load-pgs-catalog --score-id=%s` first",
        score_id, score_id
      ))
    }

    weights_path <- file.path(export_folder, "weights.tsv")
    write.table(weights_df, weights_path, sep = "\t", quote = FALSE,
                row.names = FALSE, col.names = TRUE)

    # --- Keep TSV: FID | IID (Phase 14 convention — person_{id}) ---
    # Live evidence (Phase 13.2-05): pancreas_results.cohort has
    # cohort_definition_id=100000000001 with 135 subjects. sprintf %.0f prevents
    # scientific-notation corruption of the numeric id.
    write_progress(progress_path, list(step = "read_subjects", pct = 20))
    subjects <- DatabaseConnector::querySql(conn, sprintf(
      "SELECT DISTINCT CONCAT('person_', subject_id) AS fid,
                       CONCAT('person_', subject_id) AS iid
         FROM %s.cohort
        WHERE cohort_definition_id = %.0f",
      cohort_schema, cohort_def_id
    ))
    names(subjects) <- tolower(names(subjects))
    if (nrow(subjects) == 0) {
      stop(sprintf(
        "prs.compute: cohort %s.cohort has no rows for cohort_definition_id=%.0f",
        cohort_schema, cohort_def_id
      ))
    }
    keep_path <- file.path(export_folder, "keep.tsv")
    write.table(subjects, keep_path, sep = "\t", quote = FALSE,
                row.names = FALSE, col.names = FALSE)

    # --- plink2 --score ---
    # HIGHSEC §10: argv vector, no shell interpolation.
    # cols=+scoresums adds SCORE1_SUM (raw PRS) to the default .sscore columns.
    # header keyword: weights TSV has a column header. list-variants: emit a
    # .sscore.vars companion with the variants actually used (for debugging).
    write_progress(progress_path, list(step = "plink2_score", pct = 40))
    pgen_prefix <- .prs_lookup_pgen(conn, source_key)
    out_prefix  <- file.path(export_folder, "prs")

    res <- processx::run(
      command = .PLINK2_BIN,
      args = c(
        "--pfile", pgen_prefix,
        "--keep", keep_path,
        "--score", weights_path, "1", "2", "3", "header", "list-variants",
        "cols=+scoresums",
        "--out", out_prefix
      ),
      echo_cmd = FALSE, stderr_to_stdout = TRUE, error_on_status = FALSE,
      timeout = 30 * 60
    )
    if (res$status != 0L) {
      tail_lines <- utils::tail(strsplit(res$stdout %||% "", "\n")[[1]], 40)
      stop(sprintf(
        "prs.compute: plink2 --score failed (exit %d): %s",
        res$status, paste(tail_lines, collapse = "\n")
      ))
    }

    # --- Parse .sscore, write to {source}_gwas_results.prs_subject_scores ---
    # Pitfall 4: .sscore header is `#IID ALLELE_CT ... SCORE1_SUM`. R's read.table
    # treats `#` as a comment by default and DROPS THE HEADER. Use comment.char=""
    # + tolower() normalize + strip the leading `#`.
    write_progress(progress_path, list(step = "parse_sscore", pct = 75))
    sscore_path <- paste0(out_prefix, ".sscore")
    if (!file.exists(sscore_path)) {
      stop(sprintf("prs.compute: plink2 did not produce %s", sscore_path))
    }
    sscore <- read.table(sscore_path, header = TRUE, comment.char = "",
                         sep = "\t", check.names = FALSE)
    names(sscore) <- tolower(gsub("^#", "", names(sscore)))

    if (!"score1_sum" %in% names(sscore)) {
      stop(sprintf(
        "prs.compute: .sscore missing SCORE1_SUM column (cols=+scoresums not applied?); got: %s",
        paste(names(sscore), collapse = ",")
      ))
    }

    # Extract subject_id from iid = "person_<id>".
    results <- data.frame(
      score_id             = score_id,
      cohort_definition_id = as.numeric(cohort_def_id),  # numeric preserves 100B offset
      subject_id           = as.integer(sub("^person_", "", as.character(sscore$iid))),
      raw_score            = as.numeric(sscore$score1_sum),
      scored_at            = Sys.time(),
      gwas_run_id          = as.character(run_id),
      stringsAsFactors     = FALSE
    )
    results <- results[!is.na(results$subject_id) & !is.na(results$raw_score), , drop = FALSE]

    write_progress(progress_path, list(step = "insert_rows", pct = 90))
    DatabaseConnector::insertTable(
      connection        = conn,
      databaseSchema    = gwas_results_schema,
      tableName         = "prs_subject_scores",
      data              = results,
      dropTableIfExists = FALSE,
      createTable       = FALSE,
      bulkLoad          = TRUE
    )

    .write_summary(export_folder, list(
      analysis_type        = "finngen.prs.compute",
      score_id             = score_id,
      cohort_definition_id = cohort_def_id,
      subject_count        = nrow(results),
      variant_count        = nrow(weights_df),
      source_key           = source_key
    ))
    write_progress(progress_path, list(step = "done", pct = 100))

    list(
      rows_written         = nrow(results),
      score_id             = score_id,
      cohort_definition_id = cohort_def_id
    )
  })
}
