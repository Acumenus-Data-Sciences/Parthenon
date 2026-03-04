# ──────────────────────────────────────────────────────────────────
# FeatureExtraction covariate settings builder
# Maps the JSON covariate config from the frontend/backend into
# a FeatureExtraction::createCovariateSettings() call.
# ──────────────────────────────────────────────────────────────────

library(FeatureExtraction)
source("/app/R/connection.R")  # for %||%

#' Build FeatureExtraction covariate settings from a spec list.
#'
#' When the incoming spec is NULL or empty, returns sensible defaults
#' (demographics + common condition/drug/procedure/measurement flags).
#'
#' @param spec  A list mirroring the frontend CovariateSettings type
#' @param exclude_concept_ids  Optional vector of concept IDs to exclude
#'                             (e.g. treatment drugs from PS model)
#' @return A CovariateSettings object
build_covariate_settings <- function(spec, exclude_concept_ids = c()) {
  if (is.null(spec) || length(spec) == 0) {
    return(FeatureExtraction::createDefaultCovariateSettings(
      excludedCovariateConceptIds = exclude_concept_ids,
      addDescendantsToExclude = TRUE
    ))
  }

  # Helper: extract a boolean flag from a nested list, default FALSE
  flag <- function(section, key, default = FALSE) {
    val <- spec[[section]][[key]]
    if (is.null(val)) default else as.logical(val)
  }

  args <- list()

  # ── Demographics ──────────────────────────────────────────────
  demo <- spec$demographics
  if (!is.null(demo)) {
    args$useDemographicsGender               <- demo$gender               %||% FALSE
    args$useDemographicsAge                  <- demo$age                  %||% FALSE
    args$useDemographicsAgeGroup             <- demo$ageGroup             %||% FALSE
    args$useDemographicsRace                 <- demo$race                 %||% FALSE
    args$useDemographicsEthnicity            <- demo$ethnicity            %||% FALSE
    args$useDemographicsIndexYear            <- demo$indexYear            %||% FALSE
    args$useDemographicsIndexMonth           <- demo$indexMonth           %||% FALSE
    args$useDemographicsPriorObservationTime <- demo$priorObservationTime %||% FALSE
    args$useDemographicsPostObservationTime  <- demo$postObservationTime  %||% FALSE
  } else {
    # Legacy simple boolean mode: if spec has a top-level "demographics" boolean
    if (isTRUE(spec[["demographics"]])) {
      args$useDemographicsGender   <- TRUE
      args$useDemographicsAge      <- TRUE
      args$useDemographicsAgeGroup <- TRUE
      args$useDemographicsRace     <- TRUE
      args$useDemographicsEthnicity <- TRUE
    }
  }

  # ── Conditions ────────────────────────────────────────────────
  cond <- spec$conditions
  if (is.list(cond)) {
    args$useConditionOccurrenceAnyTimePrior <- cond$anyTimePrior %||% FALSE
    args$useConditionOccurrenceLongTerm     <- cond$longTerm     %||% FALSE
    args$useConditionOccurrenceMediumTerm   <- cond$mediumTerm   %||% FALSE
    args$useConditionOccurrenceShortTerm    <- cond$shortTerm    %||% FALSE
    args$useConditionEraAnyTimePrior        <- cond$eraAnyTimePrior  %||% FALSE
    args$useConditionEraLongTerm            <- cond$eraLongTerm      %||% FALSE
    args$useConditionEraOverlapping         <- cond$eraOverlapping   %||% FALSE
    args$useConditionGroupEraAnyTimePrior   <- cond$groupEraAnyTimePrior %||% FALSE
    args$useConditionGroupEraLongTerm       <- cond$groupEraLongTerm     %||% FALSE
    args$useConditionGroupEraOverlapping    <- cond$groupEraOverlapping  %||% FALSE
  } else if (isTRUE(spec[["conditions"]])) {
    args$useConditionOccurrenceAnyTimePrior <- TRUE
    args$useConditionOccurrenceLongTerm     <- TRUE
    args$useConditionEraAnyTimePrior        <- TRUE
    args$useConditionGroupEraAnyTimePrior   <- TRUE
  }

  # ── Drugs ─────────────────────────────────────────────────────
  drug <- spec$drugs
  if (is.list(drug)) {
    args$useDrugExposureAnyTimePrior     <- drug$anyTimePrior        %||% FALSE
    args$useDrugExposureLongTerm         <- drug$longTerm            %||% FALSE
    args$useDrugExposureMediumTerm       <- drug$mediumTerm          %||% FALSE
    args$useDrugExposureShortTerm        <- drug$shortTerm           %||% FALSE
    args$useDrugEraAnyTimePrior          <- drug$eraAnyTimePrior     %||% FALSE
    args$useDrugEraLongTerm              <- drug$eraLongTerm         %||% FALSE
    args$useDrugEraOverlapping           <- drug$eraOverlapping      %||% FALSE
    args$useDrugGroupEraAnyTimePrior     <- drug$groupEraAnyTimePrior %||% FALSE
    args$useDrugGroupEraLongTerm         <- drug$groupEraLongTerm    %||% FALSE
    args$useDrugGroupEraOverlapping      <- drug$groupEraOverlapping %||% FALSE
  } else if (isTRUE(spec[["drugs"]])) {
    args$useDrugExposureAnyTimePrior <- TRUE
    args$useDrugExposureLongTerm     <- TRUE
    args$useDrugEraAnyTimePrior      <- TRUE
    args$useDrugGroupEraAnyTimePrior <- TRUE
  }

  # ── Procedures ────────────────────────────────────────────────
  proc <- spec$procedures
  if (is.list(proc)) {
    args$useProcedureOccurrenceAnyTimePrior <- proc$anyTimePrior %||% FALSE
    args$useProcedureOccurrenceLongTerm     <- proc$longTerm     %||% FALSE
    args$useProcedureOccurrenceMediumTerm   <- proc$mediumTerm   %||% FALSE
    args$useProcedureOccurrenceShortTerm    <- proc$shortTerm    %||% FALSE
  } else if (isTRUE(spec[["procedures"]])) {
    args$useProcedureOccurrenceAnyTimePrior <- TRUE
    args$useProcedureOccurrenceLongTerm     <- TRUE
  }

  # ── Measurements ──────────────────────────────────────────────
  meas <- spec$measurements
  if (is.list(meas)) {
    args$useMeasurementAnyTimePrior           <- meas$anyTimePrior          %||% FALSE
    args$useMeasurementLongTerm               <- meas$longTerm              %||% FALSE
    args$useMeasurementMediumTerm             <- meas$mediumTerm            %||% FALSE
    args$useMeasurementShortTerm              <- meas$shortTerm             %||% FALSE
    args$useMeasurementValueAnyTimePrior      <- meas$valueAnyTimePrior     %||% FALSE
    args$useMeasurementRangeGroupAnyTimePrior <- meas$rangeGroupAnyTimePrior %||% FALSE
  } else if (isTRUE(spec[["measurements"]])) {
    args$useMeasurementAnyTimePrior      <- TRUE
    args$useMeasurementLongTerm          <- TRUE
    args$useMeasurementValueAnyTimePrior <- TRUE
  }

  # ── Observations ──────────────────────────────────────────────
  obs <- spec$observations
  if (is.list(obs)) {
    args$useObservationAnyTimePrior <- obs$anyTimePrior %||% FALSE
    args$useObservationLongTerm     <- obs$longTerm     %||% FALSE
    args$useObservationMediumTerm   <- obs$mediumTerm   %||% FALSE
    args$useObservationShortTerm    <- obs$shortTerm    %||% FALSE
  } else if (isTRUE(spec[["observations"]])) {
    args$useObservationAnyTimePrior <- TRUE
    args$useObservationLongTerm     <- TRUE
  }

  # ── Devices ───────────────────────────────────────────────────
  dev <- spec$devices
  if (is.list(dev)) {
    args$useDeviceExposureAnyTimePrior <- dev$anyTimePrior %||% FALSE
    args$useDeviceExposureLongTerm     <- dev$longTerm     %||% FALSE
    args$useDeviceExposureMediumTerm   <- dev$mediumTerm   %||% FALSE
    args$useDeviceExposureShortTerm    <- dev$shortTerm    %||% FALSE
  }

  # ── Comorbidity indices ───────────────────────────────────────
  idx <- spec$indices
  if (is.list(idx)) {
    args$useCharlsonIndex <- idx$charlson   %||% FALSE
    args$useDcsi          <- idx$dcsi       %||% FALSE
    args$useChads2        <- idx$chads2     %||% FALSE
    args$useChads2Vasc    <- idx$chads2Vasc %||% FALSE
    args$useHfrs          <- idx$hfrs       %||% FALSE
  }

  # ── Count covariates ──────────────────────────────────────────
  cnt <- spec$counts
  if (is.list(cnt)) {
    args$useDistinctConditionCountLongTerm   <- cnt$conditions   %||% FALSE
    args$useDistinctIngredientCountLongTerm  <- cnt$ingredients  %||% FALSE
    args$useDistinctProcedureCountLongTerm   <- cnt$procedures   %||% FALSE
    args$useDistinctMeasurementCountLongTerm <- cnt$measurements %||% FALSE
    args$useDistinctObservationCountLongTerm <- cnt$observations %||% FALSE
    args$useVisitCountLongTerm               <- cnt$visits       %||% FALSE
    args$useVisitConceptCountLongTerm        <- cnt$visitConcepts %||% FALSE
  }

  # ── Time windows ──────────────────────────────────────────────
  tw <- spec$timeWindows
  if (is.list(tw)) {
    args$longTermStartDays   <- tw$longTermStart   %||% -365L
    args$mediumTermStartDays <- tw$mediumTermStart  %||% -180L
    args$shortTermStartDays  <- tw$shortTermStart   %||% -30L
    args$endDays             <- tw$end              %||% 0L
  }

  # ── Concept filters ──────────────────────────────────────────
  all_exclude <- c(
    as.integer(exclude_concept_ids),
    as.integer(spec$excludedConceptIds %||% c())
  )
  if (length(all_exclude) > 0) {
    args$excludedCovariateConceptIds <- unique(all_exclude)
    args$addDescendantsToExclude     <- spec$excludeDescendants %||% TRUE
  }

  include_ids <- spec$includedConceptIds
  if (!is.null(include_ids) && length(include_ids) > 0) {
    args$includedCovariateConceptIds <- as.integer(include_ids)
    args$addDescendantsToInclude     <- spec$includeDescendants %||% FALSE
  }

  do.call(FeatureExtraction::createCovariateSettings, args)
}
