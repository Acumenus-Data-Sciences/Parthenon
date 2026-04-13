# darkstar/api/finngen/hades_extras.R
#
# Sync read endpoints wrapping HadesExtras helpers on top of a
# HadesExtras::CohortTableHandler. Each function is callable standalone
# (for testthat) and wired into Plumber via darkstar/api/finngen/routes.R
# (Task B6).

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(HadesExtras)
})

# --- 1. Cohort counts ---------------------------------------------------

finngen_hades_counts <- function(source_envelope, cohort_ids) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  ids <- as.integer(cohort_ids)
  counts <- HadesExtras::getCohortCounts(handler, cohortIds = ids)
  list(counts = counts)
}

# --- 2. Cohort overlap (upset-plot matrix) ------------------------------

finngen_hades_overlap <- function(source_envelope, cohort_ids) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  ids <- as.integer(cohort_ids)
  overlap <- HadesExtras::getCohortsOverlap(handler, cohortIds = ids)

  list(
    matrix = overlap$matrix %||% overlap,
    labels = overlap$labels %||% ids
  )
}

# --- 3. Cohort demographics ---------------------------------------------

finngen_hades_demographics <- function(source_envelope, cohort_id) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  demo <- HadesExtras::getCohortDemographics(handler, cohortId = as.integer(cohort_id))

  gender_counts <- demo$gender_counts %||% demo$genderCounts %||% list()
  total <- demo$total %||%
    (if (length(gender_counts) > 0) sum(unlist(gender_counts, use.names = FALSE), na.rm = TRUE) else NA_integer_)

  list(
    age_histogram = demo$age_histogram %||% demo$ageHistogram,
    gender_counts = gender_counts,
    total         = total
  )
}
