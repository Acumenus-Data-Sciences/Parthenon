# darkstar/api/finngen/hades_extras.R
#
# Sync read endpoints backed by direct SQL against the cohort schema plus
# HadesExtras::CohortGenerator_getCohortDemograpics for demographics.
#
# Why not handler$getCohortCounts() / handler$getCohortsOverlap()?
#   Those R6 methods read private fields (.cohortDefinitionSet,
#   .cohortsOverlap) which are only populated after handler$insertOrUpdateCohorts()
#   has seeded the cohort definitions. Our endpoints are STATELESS reads —
#   they take cohort_ids and query the already-materialized cohort table.
#   Direct SQL is more honest and decouples us from handler state.
#
# Each function is callable standalone (for testthat) and also wired into
# Plumber via darkstar/api/finngen/routes.R (Task B6).

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(HadesExtras)
  library(DatabaseConnector)
  library(SqlRender)
})

# --- 1. Cohort counts (direct SQL) --------------------------------------

finngen_hades_counts <- function(source_envelope, cohort_ids) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  ids <- as.integer(cohort_ids)
  ids_sql <- if (length(ids) > 0) paste(ids, collapse = ",") else "NULL"

  sql <- SqlRender::render(
    "SELECT cohort_definition_id AS cohort_id,
            COUNT(DISTINCT subject_id) AS subjects,
            COUNT(*) AS entries
     FROM @cohort_schema.cohort
     WHERE cohort_definition_id IN (@ids)
     GROUP BY cohort_definition_id
     ORDER BY cohort_definition_id",
    cohort_schema = source_envelope$schemas$cohort,
    ids           = ids_sql
  )
  conn <- handler$connectionHandler$getConnection()
  rs <- DatabaseConnector::querySql(conn, sql)
  list(counts = rs)
}

# --- 2. Cohort overlap (direct SQL, pairwise long→square) ---------------

finngen_hades_overlap <- function(source_envelope, cohort_ids) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  ids <- as.integer(cohort_ids)
  if (length(ids) < 2) {
    return(list(matrix = matrix(NA_integer_, 0, 0), labels = ids))
  }
  ids_sql <- paste(ids, collapse = ",")

  sql <- SqlRender::render(
    "WITH members AS (
       SELECT DISTINCT cohort_definition_id, subject_id
       FROM @cohort_schema.cohort
       WHERE cohort_definition_id IN (@ids)
     )
     SELECT a.cohort_definition_id AS cohort_i,
            b.cohort_definition_id AS cohort_j,
            COUNT(*) AS shared_subjects
     FROM members a
     JOIN members b ON a.subject_id = b.subject_id
     GROUP BY a.cohort_definition_id, b.cohort_definition_id
     ORDER BY a.cohort_definition_id, b.cohort_definition_id",
    cohort_schema = source_envelope$schemas$cohort,
    ids           = ids_sql
  )
  conn <- handler$connectionHandler$getConnection()
  rs <- DatabaseConnector::querySql(conn, sql)

  mat <- matrix(0L, nrow = length(ids), ncol = length(ids),
                dimnames = list(as.character(ids), as.character(ids)))
  if (nrow(rs) > 0) {
    for (k in seq_len(nrow(rs))) {
      i <- as.character(rs$COHORT_I[k])
      j <- as.character(rs$COHORT_J[k])
      if (i %in% rownames(mat) && j %in% colnames(mat)) {
        mat[i, j] <- as.integer(rs$SHARED_SUBJECTS[k])
      }
    }
  }

  list(matrix = mat, labels = ids)
}

# --- 3. Cohort demographics (HadesExtras CohortGenerator_getCohortDemograpics)

finngen_hades_demographics <- function(source_envelope, cohort_id) {
  # Note the upstream typo: CohortGenerator_getCohortDemograpics (missing 'h').
  # Preserved verbatim because HadesExtras exports it that way.
  cid <- as.integer(cohort_id)

  conn_config <- .build_connection_config(source_envelope)
  connectionDetails <- do.call(DatabaseConnector::createConnectionDetails, conn_config)

  demo <- HadesExtras::CohortGenerator_getCohortDemograpics(
    connectionDetails        = connectionDetails,
    cdmDatabaseSchema        = source_envelope$schemas$cdm,
    vocabularyDatabaseSchema = source_envelope$schemas$vocab,
    cohortDatabaseSchema     = source_envelope$schemas$cohort,
    cohortTable              = "cohort",
    cohortIds                = cid,
    toGet                    = c("histogramBirthYear", "sexCounts"),
    databaseId               = source_envelope$source_key %||% "unknown"
  )

  gender_counts <- demo$sexCounts %||% demo$sex_counts %||% list()
  age_histogram <- demo$histogramBirthYear %||% demo$histogram_birth_year

  total <- if (!is.null(gender_counts) && NROW(gender_counts) > 0) {
    if (is.data.frame(gender_counts) && "cohortSubjects" %in% names(gender_counts)) {
      sum(gender_counts$cohortSubjects, na.rm = TRUE)
    } else {
      sum(unlist(gender_counts, use.names = FALSE), na.rm = TRUE)
    }
  } else {
    NA_integer_
  }

  list(
    age_histogram = age_histogram,
    gender_counts = gender_counts,
    total         = total
  )
}
