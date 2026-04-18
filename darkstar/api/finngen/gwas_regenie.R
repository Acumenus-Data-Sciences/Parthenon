# darkstar/api/finngen/gwas_regenie.R
#
# Phase 14 (D-01, D-13, D-14, D-22) — regenie GWAS worker closures.
#
# Contract:
#   finngen_gwas_regenie_step1_execute(source_envelope, run_id, export_folder, params)
#     Returns: list(cache_key=chr(64), cache_hit=lgl(1), loco_count=int(1))
#     Side effects: writes progress.json + summary.json to export_folder;
#                   writes LOCO files to
#                   /opt/finngen-artifacts/gwas/step1/{source}/{cache_key}/
#
#   finngen_gwas_regenie_step2_execute(source_envelope, run_id, export_folder, params)
#     Returns: list(run_id=chr(26), rows_written=int(1), cache_key_used=chr(64),
#                   warnings=list())
#     Side effects: COPY ingest into {source}_gwas_results.summary_stats.
#                   Stops on missing step-1 cache artifact (Phase 15 will surface
#                   this as 422; PHP-side GwasRunService also pre-checks, so this
#                   stop() is the second line of defense).
#
# Cache-key parity with PHP (Wave 2 Plan 14-03 fixture):
#   .gwas_cache_key(221L, 1L, "deadbeef", "PANCREAS") MUST equal the hex
#   pinned in 14-03-SUMMARY.md:
#     b58a15fc61e7bca9d2ecc767782c98de90a0c32e1f3855df79214d72190df8c1
#
# HIGHSEC §4.3 — regenie + plink2 binaries live INSIDE this container at
# /opt/regenie/regenie and /opt/regenie/plink2 (Task 1 multi-stage COPY).
# We invoke via processx::run() with an argv vector — no shell interpolation,
# no docker.sock mount, no sibling-container shell-out.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
  library(digest)
  library(DBI)
  library(processx)
  library(DatabaseConnector)
})

# ----- helpers: path conventions ----------------------------------------

.STEP1_ROOT  <- "/opt/finngen-artifacts/gwas/step1"
.STEP2_ROOT  <- "/opt/finngen-artifacts/gwas/step2"
.REGENIE_BIN <- "/opt/regenie/regenie"

# DatabaseConnector::bulkLoadPostgres uses the `psql` CLI via POSTGRES_PATH.
# Docker sets ENV POSTGRES_PATH=/usr/bin in the Darkstar image, but the s6-overlay
# plumber `run` script does not invoke `with-contenv`, so Dockerfile ENVs never
# reach the R worker. Re-assert the value here so `bulkLoad = TRUE` survives
# container restarts until the s6 run script is updated to propagate env.
if (!nzchar(Sys.getenv("POSTGRES_PATH")) && file.exists("/usr/bin/psql")) {
  Sys.setenv(POSTGRES_PATH = "/usr/bin")
}

.gwas_step1_cache_dir <- function(source_key_lower, cache_key) {
  file.path(.STEP1_ROOT, source_key_lower, cache_key)
}

.gwas_step2_run_dir <- function(source_key_lower, gwas_run_id) {
  file.path(.STEP2_ROOT, source_key_lower, gwas_run_id)
}

# ----- cache-key hashing (PHP-parity) -----------------------------------

.gwas_cache_key <- function(cohort_id, covariate_set_id, covariate_set_version_hash, source_key) {
  # Build list with keys in alphabetical order so jsonlite's serializer
  # produces the exact same byte sequence as PHP's json_encode on an
  # associatively-keyed array inserted in alpha order.
  canonical_list <- list(
    cohort_definition_id       = as.integer(cohort_id),
    covariate_set_id           = as.integer(covariate_set_id),
    covariate_set_version_hash = as.character(covariate_set_version_hash),
    source_key                 = tolower(as.character(source_key))
  )
  # Defensive re-sort in case caller passed unordered keys.
  canonical_list <- canonical_list[sort(names(canonical_list))]
  canonical_json <- jsonlite::toJSON(
    canonical_list,
    auto_unbox = TRUE,
    null       = "null"
  )
  digest::digest(as.character(canonical_json), algo = "sha256", serialize = FALSE)
}

# ----- summary writers --------------------------------------------------

.write_step1_summary <- function(export_folder, envelope) {
  writeLines(
    jsonlite::toJSON(
      list(
        analysis_type = "gwas.regenie.step1",
        cache_key     = envelope$cache_key,
        cache_hit     = envelope$cache_hit,
        loco_count    = envelope$loco_count
      ),
      auto_unbox = TRUE, null = "null", force = TRUE
    ),
    file.path(export_folder, "summary.json")
  )
}

.write_step2_summary <- function(export_folder, envelope) {
  writeLines(
    jsonlite::toJSON(
      list(
        analysis_type  = "gwas.regenie.step2",
        run_id         = envelope$run_id,
        rows_written   = envelope$rows_written,
        cache_key_used = envelope$cache_key_used,
        warnings       = envelope$warnings
      ),
      auto_unbox = TRUE, null = "null", force = TRUE
    ),
    file.path(export_folder, "summary.json")
  )
}

# ----- DB connection helper (reuse cohort_ops.R pattern) ----------------

.gwas_open_connection <- function(source_envelope) {
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

# ----- variant index lookup --------------------------------------------

.lookup_pgen_prefix <- function(source_envelope, source_key_lower) {
  conn <- .gwas_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  # Per HIGHSEC §3.2 (CDM read-only), this is a SELECT-only query. The
  # `app.finngen_source_variant_indexes` table is owned by parthenon_migrator
  # with SELECT granted to parthenon_app + parthenon_finngen_rw.
  res <- DatabaseConnector::querySql(
    conn,
    sprintf(
      "SELECT pgen_path, pc_tsv_path, sample_count
         FROM app.finngen_source_variant_indexes
        WHERE source_key = '%s'
        LIMIT 1",
      source_key_lower
    )
  )
  names(res) <- tolower(names(res))
  if (nrow(res) == 0L) {
    stop(sprintf(
      "regenie: no variant index for source_key '%s' — run 'php artisan finngen:prepare-source-variants --source=%s' first",
      source_key_lower, toupper(source_key_lower)
    ))
  }
  list(
    pgen_prefix  = as.character(res$pgen_path[1]),
    pc_tsv_path  = as.character(res$pc_tsv_path[1]),
    sample_count = as.integer(res$sample_count[1])
  )
}

# ----- phenotype TSV assembly ------------------------------------------

# Phenotype TSV per regenie spec: header `FID IID Y1` (whitespace-delimited),
# Y1 ∈ {0,1,NA}. Subjects in `{source}_results.cohort` for `cohort_id` are cases (Y1=1);
# every other person in `{source}.person` is control (Y1=0). FID==IID==`person_<id>`
# to match the .psam written by PrepareSourceVariantsCommand (Pitfall 3).
.assemble_pheno_tsv <- function(source_envelope, cohort_id, source_key_lower, out_dir) {
  conn <- .gwas_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  cohort_schema <- source_envelope$schemas$cohort %||% paste0(source_key_lower, "_results")
  cdm_schema    <- source_envelope$schemas$cdm    %||% source_key_lower
  if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema))
    stop(sprintf("gwas: unsafe cohort_schema %s", cohort_schema))
  if (!grepl("^[a-z][a-z0-9_]*$", cdm_schema))
    stop(sprintf("gwas: unsafe cdm_schema %s", cdm_schema))

  pheno_sql <- sprintf(
    "SELECT 'person_' || p.person_id AS fid,
            'person_' || p.person_id AS iid,
            CASE WHEN c.subject_id IS NOT NULL THEN 1 ELSE 0 END AS y1
       FROM %s.person p
       LEFT JOIN (
         SELECT DISTINCT subject_id
           FROM %s.cohort
          WHERE cohort_definition_id = %d
       ) c ON c.subject_id = p.person_id",
    cdm_schema, cohort_schema, as.integer(cohort_id)
  )
  df <- DatabaseConnector::querySql(conn, pheno_sql)
  names(df) <- toupper(names(df))
  # regenie expects header: FID IID Y1 (whitespace-delimited)
  pheno_path <- file.path(out_dir, "phenotype.tsv")
  write.table(
    df[, c("FID", "IID", "Y1")],
    file = pheno_path,
    sep = "\t", quote = FALSE, row.names = FALSE, col.names = TRUE
  )
  pheno_path
}

# ----- covariate TSV assembly ------------------------------------------

# Covariate TSV per regenie spec: header `FID IID <col1> <col2> ...`. We read
# the covariate-set definition (Wave 2 GwasCovariateSet model) and assemble:
#   - age              from person.year_of_birth (current_year - year_of_birth)
#   - sex              from person.gender_concept_id (8507=M=1, 8532=F=2, else NA)
#   - PC1..PCN         from pcs.tsv (subject_id JOIN to person_id-suffix)
.assemble_covar_tsv <- function(source_envelope, cohort_id, covariate_set_id,
                                source_key_lower, out_dir) {
  conn <- .gwas_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  # Read covariate set definition from app.finngen_gwas_covariate_sets.
  cs_df <- DatabaseConnector::querySql(
    conn,
    sprintf(
      "SELECT covariate_columns, pc_tsv_path
         FROM app.finngen_gwas_covariate_sets cs
         LEFT JOIN app.finngen_source_variant_indexes svi
           ON svi.source_key = '%s'
        WHERE cs.id = %d
        LIMIT 1",
      source_key_lower, as.integer(covariate_set_id)
    )
  )
  names(cs_df) <- tolower(names(cs_df))
  if (nrow(cs_df) == 0L) {
    stop(sprintf("gwas: covariate_set_id %d not found", covariate_set_id))
  }
  pc_tsv_path <- as.character(cs_df$pc_tsv_path[1])
  covariate_columns_json <- as.character(cs_df$covariate_columns[1])
  covariate_columns <- jsonlite::fromJSON(covariate_columns_json, simplifyVector = FALSE)

  # Determine which covariates to include based on column_name strings.
  col_names <- vapply(covariate_columns, function(c) as.character(c$column_name), character(1))
  want_age  <- "age" %in% col_names
  want_sex  <- "sex" %in% col_names
  pc_cols   <- col_names[grepl("^PC[0-9]+$", col_names)]

  cdm_schema <- source_envelope$schemas$cdm %||% source_key_lower
  if (!grepl("^[a-z][a-z0-9_]*$", cdm_schema))
    stop(sprintf("gwas: unsafe cdm_schema %s", cdm_schema))

  # Pull person rows.
  person_sql <- sprintf(
    "SELECT person_id, year_of_birth, gender_concept_id
       FROM %s.person",
    cdm_schema
  )
  people <- DatabaseConnector::querySql(conn, person_sql)
  names(people) <- tolower(names(people))

  out <- data.frame(
    FID = paste0("person_", people$person_id),
    IID = paste0("person_", people$person_id),
    stringsAsFactors = FALSE
  )
  if (want_age) {
    out$age <- as.integer(format(Sys.Date(), "%Y")) - as.integer(people$year_of_birth)
  }
  if (want_sex) {
    out$sex <- ifelse(people$gender_concept_id == 8507L, 1L,
                      ifelse(people$gender_concept_id == 8532L, 2L, NA_integer_))
  }

  # JOIN PCs from pcs.tsv (subject_id column → match to person_id).
  if (length(pc_cols) > 0L && nzchar(pc_tsv_path) && file.exists(pc_tsv_path)) {
    pcs <- read.table(pc_tsv_path, header = TRUE, sep = "\t", stringsAsFactors = FALSE)
    # subject_id may be `person_<id>` (per Plan 14-04 D-20 D-19) or raw int. Normalize.
    if (is.character(pcs$subject_id)) {
      pcs$person_id <- as.integer(sub("^person_", "", pcs$subject_id))
    } else {
      pcs$person_id <- as.integer(pcs$subject_id)
    }
    pc_keep <- intersect(pc_cols, colnames(pcs))
    if (length(pc_keep) > 0L) {
      # merge() requires a shared key column. out$FID is "person_<id>" (character);
      # pcs$person_id is integer. Join on a stripped integer key, then drop it so
      # regenie's covariate file keeps its expected FID/IID/<covars> layout.
      out$person_id <- as.integer(sub("^person_", "", out$FID))
      out <- merge(out,
                   pcs[, c("person_id", pc_keep), drop = FALSE],
                   by = "person_id",
                   all.x = TRUE, sort = FALSE)
      out$person_id <- NULL
      # merge() moves the join column first; restore FID/IID as cols 1-2 so regenie
      # can parse the covariate TSV.
      out <- out[, c("FID", "IID", setdiff(colnames(out), c("FID", "IID"))), drop = FALSE]
    }
  } else if (length(pc_cols) > 0L) {
    # Fill PCs with NA so the column shape stays right.
    for (pc in pc_cols) out[[pc]] <- NA_real_
  }

  covar_path <- file.path(out_dir, "covariates.tsv")
  write.table(
    out, file = covar_path,
    sep = "\t", quote = FALSE, row.names = FALSE, col.names = TRUE,
    na = "NA"
  )
  covar_path
}

# ----- regenie step-2 ingest into summary_stats ------------------------

# Reads {out_prefix}_*.regenie files (one per chromosome), maps columns to
# the 13-col summary_stats contract (D-09), and bulk-inserts via DBI.
# COPY FROM STDIN under-the-hood through RPostgres' executeMany pattern.
# Returns list(rows_written=int(1)).
.ingest_regenie_to_summary_stats <- function(source_envelope, source_key_lower,
                                              out_prefix, cohort_id, gwas_run_id) {
  conn <- .gwas_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  results_schema <- paste0(source_key_lower, "_gwas_results")
  if (!grepl("^[a-z][a-z0-9_]*$", results_schema))
    stop(sprintf("gwas: unsafe results_schema %s", results_schema))

  # Collect every per-chromosome regenie output. Pattern depends on regenie
  # version + flags; --out=foo emits foo_Y1.regenie (no chrom split when
  # --pgen is single-shard) or foo_<pheno>_chr<N>.regenie when split.
  candidates <- Sys.glob(c(
    paste0(out_prefix, "_*.regenie"),
    paste0(out_prefix, ".regenie")
  ))
  if (length(candidates) == 0L) {
    stop(sprintf("regenie step-2 produced no .regenie files at prefix %s", out_prefix))
  }

  total_rows <- 0L
  for (f in candidates) {
    df <- read.table(f, header = TRUE, comment.char = "", stringsAsFactors = FALSE)
    if (nrow(df) == 0L) next

    # regenie v4 output columns: CHROM GENPOS ID ALLELE0 ALLELE1 A1FREQ N TEST BETA SE CHISQ LOG10P EXTRA
    # Map to summary_stats:
    #   chrom              ← CHROM (truncated to 4 chars)
    #   pos                ← GENPOS
    #   ref                ← ALLELE0
    #   alt                ← ALLELE1
    #   snp_id             ← ID
    #   af                 ← A1FREQ
    #   beta               ← BETA
    #   se                 ← SE
    #   p_value            ← 10^(-LOG10P)
    #   case_n             ← NA (not directly in regenie output; populated by Phase 15)
    #   control_n          ← NA
    #   cohort_definition_id ← cohort_id (constant)
    #   gwas_run_id        ← gwas_run_id (constant)
    rows <- data.frame(
      chrom                = substr(as.character(df$CHROM), 1, 4),
      pos                  = bit64::as.integer64(df$GENPOS),
      ref                  = as.character(df$ALLELE0),
      alt                  = as.character(df$ALLELE1),
      snp_id               = as.character(df$ID),
      af                   = as.numeric(df$A1FREQ),
      beta                 = as.numeric(df$BETA),
      se                   = as.numeric(df$SE),
      p_value              = 10^(-as.numeric(df$LOG10P)),
      case_n               = NA_integer_,
      control_n            = NA_integer_,
      cohort_definition_id = as.integer(cohort_id),
      gwas_run_id          = as.character(gwas_run_id),
      stringsAsFactors     = FALSE,
      check.names          = FALSE
    )

    # DatabaseConnector::insertTable issues parameterized batch inserts and
    # under-the-hood uses COPY FROM STDIN for PostgreSQL when bulkLoad=TRUE.
    DatabaseConnector::insertTable(
      connection      = conn,
      databaseSchema  = results_schema,
      tableName       = "summary_stats",
      data            = rows,
      dropTableIfExists = FALSE,
      createTable     = FALSE,
      bulkLoad        = TRUE
    )
    total_rows <- total_rows + as.integer(nrow(rows))
  }
  list(rows_written = total_rows)
}

# ----- Pitfall 5: sample-count divergence check ------------------------

.check_sample_divergence <- function(source_envelope, source_key_lower, cohort_id) {
  warnings <- list()
  conn <- .gwas_open_connection(source_envelope)
  on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

  cohort_schema <- source_envelope$schemas$cohort %||% paste0(source_key_lower, "_results")
  if (!grepl("^[a-z][a-z0-9_]*$", cohort_schema)) {
    return(warnings)
  }

  cohort_n <- tryCatch({
    df <- DatabaseConnector::querySql(
      conn,
      sprintf(
        "SELECT COUNT(DISTINCT subject_id) AS n
           FROM %s.cohort
          WHERE cohort_definition_id = %d",
        cohort_schema, as.integer(cohort_id)
      )
    )
    names(df) <- tolower(names(df))
    as.integer(df$n[1])
  }, error = function(e) NA_integer_)

  index_n <- tryCatch({
    df <- DatabaseConnector::querySql(
      conn,
      sprintf(
        "SELECT sample_count AS n
           FROM app.finngen_source_variant_indexes
          WHERE source_key = '%s'
          LIMIT 1",
        source_key_lower
      )
    )
    names(df) <- tolower(names(df))
    as.integer(df$n[1])
  }, error = function(e) NA_integer_)

  if (!is.na(cohort_n) && !is.na(index_n) && index_n > 0L) {
    delta_pct <- abs(cohort_n - index_n) / index_n
    if (delta_pct >= 0.05) {
      warnings[[length(warnings) + 1L]] <- sprintf(
        "sample-count divergence: cohort has %d distinct subjects but variant index has %d samples (%.1f%% drift) — possible PHENO/PGEN mismatch (Pitfall 5)",
        cohort_n, index_n, delta_pct * 100
      )
    }
  }
  warnings
}

# ----- step-1 worker -----------------------------------------------------

finngen_gwas_regenie_step1_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    cohort_id      <- as.integer(params$cohort_definition_id)
    covar_set_id   <- as.integer(params$covariate_set_id)
    covar_version  <- as.character(params$covariate_set_version_hash)
    source_key     <- tolower(as.character(source_envelope$source_key %||% params$source_key))

    if (is.na(cohort_id) || cohort_id <= 0L)
      stop("gwas.regenie.step1: cohort_definition_id required (positive integer)")
    if (is.na(covar_set_id) || covar_set_id <= 0L)
      stop("gwas.regenie.step1: covariate_set_id required (positive integer)")
    if (!nzchar(covar_version))
      stop("gwas.regenie.step1: covariate_set_version_hash required (non-empty string)")
    if (!nzchar(source_key))
      stop("gwas.regenie.step1: source_key required (non-empty string)")
    if (!grepl("^[a-z][a-z0-9_]*$", source_key))
      stop(sprintf("gwas.regenie.step1: unsafe source_key %s (T-14-22)", source_key))

    cache_key <- .gwas_cache_key(cohort_id, covar_set_id, covar_version, source_key)
    cache_dir <- .gwas_step1_cache_dir(source_key, cache_key)
    dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)

    fit_pred <- file.path(cache_dir, "fit_pred.list")
    if (file.exists(fit_pred)) {
      loco_n <- length(Sys.glob(file.path(cache_dir, "*.loco")))
      write_progress(progress_path, list(step = "cache_hit", pct = 100,
                                          message = "Step-1 artifact exists; reusing"))
      envelope <- list(cache_key = cache_key, cache_hit = TRUE, loco_count = loco_n)
      .write_step1_summary(export_folder, envelope)
      return(envelope)
    }

    write_progress(progress_path, list(step = "assemble_pheno_covar", pct = 5,
                                        message = "Reading cohort + covariates"))
    pheno_path <- .assemble_pheno_tsv(source_envelope, cohort_id, source_key, cache_dir)
    covar_path <- .assemble_covar_tsv(source_envelope, cohort_id, covar_set_id, source_key, cache_dir)

    write_progress(progress_path, list(step = "lookup_pgen", pct = 12,
                                        message = "Resolving variant index"))
    pgen_info  <- .lookup_pgen_prefix(source_envelope, source_key)

    write_progress(progress_path, list(step = "regenie_step1", pct = 20,
                                        message = "Fitting null model — 30-90 min expected"))

    threads <- suppressWarnings(as.integer(Sys.getenv("REGENIE_CPU_LIMIT", "4")))
    if (is.na(threads) || threads < 1L) threads <- 4L

    res <- processx::run(
      command = .REGENIE_BIN,
      args = c(
        "--step", "1",
        "--pgen", pgen_info$pgen_prefix,
        "--phenoFile", pheno_path,
        "--covarFile", covar_path,
        "--bsize", "1000",
        "--bt",
        "--lowmem",
        "--lowmem-prefix", file.path(cache_dir, paste0("tmp_lowmem_", run_id)),
        "--threads", as.character(threads),
        "--out", file.path(cache_dir, "fit")
      ),
      echo_cmd         = FALSE,
      stderr_to_stdout = TRUE,
      error_on_status  = FALSE,
      timeout          = 3 * 60 * 60  # 3h
    )
    if (res$status != 0L) {
      tail_lines <- utils::tail(strsplit(res$stdout %||% "", "\n")[[1]], 40)
      stop(sprintf("regenie step-1 failed (exit %d): %s", res$status,
                   paste(tail_lines, collapse = "\n")))
    }
    if (!file.exists(fit_pred)) {
      stop("regenie step-1 completed but fit_pred.list was not produced")
    }

    loco_count <- length(Sys.glob(file.path(cache_dir, "*.loco")))
    envelope <- list(cache_key = cache_key, cache_hit = FALSE, loco_count = loco_count)
    .write_step1_summary(export_folder, envelope)
    write_progress(progress_path, list(step = "done", pct = 100))
    envelope
  })
}

# ----- step-2 worker -----------------------------------------------------

finngen_gwas_regenie_step2_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    cohort_id      <- as.integer(params$cohort_definition_id)
    covar_set_id   <- as.integer(params$covariate_set_id)
    covar_version  <- as.character(params$covariate_set_version_hash)
    source_key     <- tolower(as.character(source_envelope$source_key %||% params$source_key))

    if (is.na(cohort_id) || cohort_id <= 0L)
      stop("gwas.regenie.step2: cohort_definition_id required (positive integer)")
    if (is.na(covar_set_id) || covar_set_id <= 0L)
      stop("gwas.regenie.step2: covariate_set_id required (positive integer)")
    if (!nzchar(covar_version))
      stop("gwas.regenie.step2: covariate_set_version_hash required (non-empty string)")
    if (!nzchar(source_key))
      stop("gwas.regenie.step2: source_key required (non-empty string)")
    if (!grepl("^[a-z][a-z0-9_]*$", source_key))
      stop(sprintf("gwas.regenie.step2: unsafe source_key %s (T-14-22)", source_key))

    cache_key <- .gwas_cache_key(cohort_id, covar_set_id, covar_version, source_key)
    cache_dir <- .gwas_step1_cache_dir(source_key, cache_key)
    fit_pred  <- file.path(cache_dir, "fit_pred.list")

    if (!file.exists(fit_pred)) {
      stop(sprintf(
        "regenie step-1 artifact missing for cache_key %s; run finngen.gwas.regenie.step1 first",
        cache_key
      ))
    }

    pgen_info  <- .lookup_pgen_prefix(source_envelope, source_key)
    pheno_path <- .assemble_pheno_tsv(source_envelope, cohort_id, source_key, export_folder)
    covar_path <- .assemble_covar_tsv(source_envelope, cohort_id, covar_set_id, source_key, export_folder)

    out_prefix <- file.path(export_folder, "assoc")

    threads <- suppressWarnings(as.integer(Sys.getenv("REGENIE_CPU_LIMIT", "4")))
    if (is.na(threads) || threads < 1L) threads <- 4L

    write_progress(progress_path, list(step = "regenie_step2", pct = 10,
                                        message = "Association scan across chromosomes (serial per D-22)"))

    res <- processx::run(
      command = .REGENIE_BIN,
      args = c(
        "--step", "2",
        "--pgen", pgen_info$pgen_prefix,
        "--phenoFile", pheno_path,
        "--covarFile", covar_path,
        "--bsize", "200",
        "--bt",
        "--firth", "--approx", "--pThresh", "0.01",
        "--pred", fit_pred,
        "--threads", as.character(threads),
        "--out", out_prefix
      ),
      echo_cmd         = FALSE,
      stderr_to_stdout = TRUE,
      error_on_status  = FALSE,
      timeout          = 6 * 60 * 60  # 6h hard cap
    )
    if (res$status != 0L) {
      tail_lines <- utils::tail(strsplit(res$stdout %||% "", "\n")[[1]], 40)
      stop(sprintf("regenie step-2 failed (exit %d): %s", res$status,
                   paste(tail_lines, collapse = "\n")))
    }

    write_progress(progress_path, list(step = "copy_summary_stats", pct = 85,
                                        message = "Ingesting summary_stats via COPY"))
    ingest_result <- .ingest_regenie_to_summary_stats(
      source_envelope  = source_envelope,
      source_key_lower = source_key,
      out_prefix       = out_prefix,
      cohort_id        = cohort_id,
      gwas_run_id      = run_id
    )

    # Pitfall 5: sample-count divergence check (advisory; non-fatal).
    warnings <- .check_sample_divergence(source_envelope, source_key, cohort_id)

    envelope <- list(
      run_id         = run_id,
      rows_written   = ingest_result$rows_written,
      cache_key_used = cache_key,
      warnings       = warnings
    )
    .write_step2_summary(export_folder, envelope)
    write_progress(progress_path, list(step = "done", pct = 100))
    envelope
  })
}
