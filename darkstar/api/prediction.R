# ──────────────────────────────────────────────────────────────────
# Patient-Level Prediction — PLP Pipeline
# POST /analysis/prediction/run
# ──────────────────────────────────────────────────────────────────

library(PatientLevelPrediction)
library(FeatureExtraction)
library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/covariates.R")
source("/app/R/progress.R")
source("/app/R/results.R")

# DeepPatientLevelPrediction — optional; provides Transformer, ResNet, MLP deep models.
# These models use reticulate + PyTorch under the hood. The container runs PyTorch on
# CPU by default (no GPU). Set CUDA_VISIBLE_DEVICES in the container environment to
# enable GPU acceleration when an NVIDIA device is available.
.deep_plp_available <- requireNamespace("DeepPatientLevelPrediction", quietly = TRUE)
if (.deep_plp_available) {
  library(DeepPatientLevelPrediction)
}

#* Run patient-level prediction via PatientLevelPrediction
#* @post /analysis/prediction/run
#* @serializer unboxedJSON
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # Plumber may deserialize JSON objects with few keys as named atomic
  # vectors instead of lists.  Only convert named vectors that look like
  # sub-objects (multiple elements with character names) — leave scalars
  # and unnamed vectors alone.
  ensure_list <- function(x) {
    if (is.null(x)) return(x)
    if (is.list(x)) return(lapply(x, ensure_list))
    # Only convert named vectors with 2+ elements (they should be objects)
    if (!is.null(names(x)) && length(x) > 1 && is.character(names(x))) {
      return(lapply(as.list(x), ensure_list))
    }
    return(x)
  }
  spec <- ensure_list(spec)

  # ── Validate input ──────────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("source", "cohorts", "model")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  logger$info("Prediction pipeline started", list(
    target  = spec$cohorts$target_cohort_id,
    outcome = spec$cohorts$outcome_cohort_id,
    model   = spec$model$type
  ))

  safe_execute(response, logger, {

    # ── Step 1: Establish database connection ──────────────────
    logger$info("Connecting to CDM database")
    connectionDetails <- create_hades_connection(spec$source)

    cdmSchema     <- spec$source$cdm_schema
    vocabSchema   <- spec$source$vocab_schema   %||% cdmSchema
    resultsSchema <- spec$source$results_schema

    targetId  <- as.integer(spec$cohorts$target_cohort_id)
    outcomeId <- as.integer(spec$cohorts$outcome_cohort_id)

    logger$info(sprintf("CDM=%s, Vocab=%s, Results=%s", cdmSchema, vocabSchema, resultsSchema))

    # ── Step 2: Create database details ────────────────────────
    databaseDetails <- PatientLevelPrediction::createDatabaseDetails(
      connectionDetails    = connectionDetails,
      cdmDatabaseSchema    = cdmSchema,
      cdmDatabaseName      = "parthenon",
      cdmDatabaseId        = "parthenon-cdm",
      cohortDatabaseSchema = resultsSchema,
      cohortTable          = "cohort",
      outcomeDatabaseSchema = resultsSchema,
      outcomeTable         = "cohort",
      targetId             = targetId,
      outcomeIds           = outcomeId
    )

    # ── Step 3: Build covariate settings ──────────────────────
    logger$info("Building covariate settings")
    covariateSettings <- build_covariate_settings(spec$covariate_settings)

    # ── Step 4: Extract PLP data ──────────────────────────────
    logger$info("Extracting PLP data from database")
    restrictSettings <- PatientLevelPrediction::createRestrictPlpDataSettings()
    plpData <- PatientLevelPrediction::getPlpData(
      databaseDetails         = databaseDetails,
      covariateSettings       = covariateSettings,
      restrictPlpDataSettings = restrictSettings
    )
    logger$info("Data extraction complete")

    # ── Step 5: Configure model ───────────────────────────────
    model_type <- tolower(spec$model$type %||% "lasso_logistic_regression")
    hp <- spec$model$hyper_parameters %||% spec$model$hyperParameters %||% list()
    seed_val <- as.integer(hp$seed %||% 42)

    logger$info(sprintf("Configuring model: %s", model_type))

    modelSettings <- switch(model_type,
      "lasso_logistic_regression" = PatientLevelPrediction::setLassoLogisticRegression(
        variance = as.numeric(hp$variance %||% 0.01),
        seed = seed_val
      ),
      "gradient_boosting" = PatientLevelPrediction::setGradientBoostingMachine(
        ntrees    = as.integer(hp$ntrees    %||% c(100, 300)),
        maxDepth  = as.integer(hp$maxDepth  %||% hp$max_depth %||% c(4, 6, 8)),
        learnRate = as.numeric(hp$learnRate %||% hp$learn_rate %||% c(0.05, 0.1)),
        seed = seed_val
      ),
      "random_forest" = PatientLevelPrediction::setRandomForest(
        ntrees   = as.integer(hp$ntrees   %||% c(100, 500)),
        maxDepth = as.integer(hp$maxDepth  %||% hp$max_depth %||% c(4, 8, 17)),
        seed = seed_val
      ),
      "ada_boost" = PatientLevelPrediction::setAdaBoost(
        nEstimators  = as.integer(hp$nEstimators  %||% hp$n_estimators %||% c(50, 100)),
        learningRate = as.numeric(hp$learningRate  %||% hp$learning_rate %||% c(0.5, 1.0)),
        seed = seed_val
      ),
      "decision_tree" = PatientLevelPrediction::setDecisionTree(
        maxDepth = as.integer(hp$maxDepth %||% hp$max_depth %||% c(3, 5, 10)),
        seed = seed_val
      ),
      "naive_bayes" = PatientLevelPrediction::setNaiveBayes(),
      "mlp" = PatientLevelPrediction::setMLP(
        size = as.integer(hp$hiddenLayers %||% hp$hidden_layers %||% c(128)),
        seed = seed_val
      ),
      "lightgbm" = {
        if (requireNamespace("PatientLevelPrediction", quietly = TRUE) &&
            exists("setLightGBM", where = asNamespace("PatientLevelPrediction"))) {
          PatientLevelPrediction::setLightGBM(
            numLeaves    = as.integer(hp$numLeaves    %||% hp$num_leaves    %||% c(31, 63)),
            learningRate = as.numeric(hp$learningRate  %||% hp$learning_rate %||% c(0.05, 0.1)),
            seed = seed_val
          )
        } else {
          logger$warn("LightGBM not available, falling back to Gradient Boosting")
          PatientLevelPrediction::setGradientBoostingMachine(seed = seed_val)
        }
      },
      "cox_model" = {
        if (exists("setCoxModel", where = asNamespace("PatientLevelPrediction"))) {
          PatientLevelPrediction::setCoxModel(seed = seed_val)
        } else {
          logger$warn("CoxModel not available, falling back to LASSO LR")
          PatientLevelPrediction::setLassoLogisticRegression(seed = seed_val)
        }
      },

      # ── Deep learning models (DeepPatientLevelPrediction) ─────────────────────
      # All three use reticulate + PyTorch; CPU-only by default in this container.
      # Pass numeric hyper-parameters via spec$model$hyper_parameters to override
      # the package defaults (numBlocks, dimToken, dimFFN, etc.).

      "transformer" = {
        if (.deep_plp_available) {
          logger$info("Using DeepPatientLevelPrediction Transformer (CPU)")
          DeepPatientLevelPrediction::setDefaultTransformer(
            # setDefaultTransformer() accepts no required args; all defaults are
            # sensible for a first run. Pass seed via estimatorSettings if needed.
          )
        } else {
          logger$warn("DeepPatientLevelPrediction not available, falling back to Gradient Boosting")
          PatientLevelPrediction::setGradientBoostingMachine(seed = seed_val)
        }
      },

      "resnet" = {
        if (.deep_plp_available) {
          logger$info("Using DeepPatientLevelPrediction ResNet (CPU)")
          DeepPatientLevelPrediction::setDefaultResNet(
            # setDefaultResNet() accepts no required args; package defaults used.
          )
        } else {
          logger$warn("DeepPatientLevelPrediction not available, falling back to Gradient Boosting")
          PatientLevelPrediction::setGradientBoostingMachine(seed = seed_val)
        }
      },

      "deep_mlp" = {
        # "deep_mlp" distinguishes the DeepPLP multi-layer perceptron from the
        # legacy PatientLevelPrediction::setMLP() (keyed as "mlp" above).
        if (.deep_plp_available) {
          logger$info("Using DeepPatientLevelPrediction MLP (CPU)")
          DeepPatientLevelPrediction::setMultiLayerPerceptron(
            numLayers  = as.integer(hp$numLayers   %||% hp$num_layers   %||% c(1L, 2L, 3L)),
            sizeHidden = as.integer(hp$sizeHidden  %||% hp$size_hidden  %||% c(128L, 256L)),
            dropout    = as.numeric(hp$dropout     %||% 0.0),
            sizeEmbedding = as.integer(hp$sizeEmbedding %||% hp$size_embedding %||% 256L),
            seed       = seed_val
          )
        } else {
          logger$warn("DeepPatientLevelPrediction not available, falling back to Gradient Boosting")
          PatientLevelPrediction::setGradientBoostingMachine(seed = seed_val)
        }
      },

      {
        logger$warn(sprintf("Unknown model type '%s', defaulting to LASSO LR", model_type))
        PatientLevelPrediction::setLassoLogisticRegression(seed = seed_val)
      }
    )

    # ── Step 6: Configure population settings ─────────────────
    pop_spec <- spec$population_settings %||% spec$populationSettings %||% list()
    tar_spec <- spec$time_at_risk %||% spec$timeAtRisk %||% list()

    populationSettings <- PatientLevelPrediction::createStudyPopulationSettings(
      washoutPeriod                   = as.integer(pop_spec$washout_period %||% pop_spec$washoutPeriod %||% 364),
      firstExposureOnly               = isTRUE(pop_spec$first_exposure_only %||% pop_spec$firstExposureOnly),
      removeSubjectsWithPriorOutcome  = isTRUE(pop_spec$remove_subjects_with_prior_outcome %||% pop_spec$removeSubjectsWithPriorOutcome %||% TRUE),
      priorOutcomeLookback            = 9999,
      riskWindowStart                 = as.integer(tar_spec$start %||% 1),
      riskWindowEnd                   = as.integer(tar_spec$end   %||% 365),
      startAnchor                     = "cohort start",
      endAnchor                       = tar_spec$end_anchor %||% tar_spec$endAnchor %||% "cohort start",
      minTimeAtRisk                   = as.integer(pop_spec$min_time_at_risk %||% pop_spec$minTimeAtRisk %||% 364),
      requireTimeAtRisk               = isTRUE(pop_spec$require_time_at_risk %||% pop_spec$requireTimeAtRisk %||% TRUE),
      includeAllOutcomes              = TRUE
    )

    # ── Step 7: Configure split settings ──────────────────────
    split_spec <- spec$split_settings %||% spec$splitSettings %||% list()
    splitSettings <- PatientLevelPrediction::createDefaultSplitSetting(
      testFraction = as.numeric(split_spec$test_fraction %||% split_spec$testFraction %||% 0.25),
      splitSeed    = as.integer(split_spec$split_seed    %||% split_spec$splitSeed    %||% 42),
      nfold        = as.integer(split_spec$n_fold        %||% split_spec$nFold        %||% 3),
      type         = split_spec$type %||% "stratified"
    )

    # ── Step 8: Configure preprocessing ───────────────────────
    preprocessSettings <- PatientLevelPrediction::createPreprocessSettings(
      minFraction      = 0.001,
      normalize        = TRUE,
      removeRedundancy = TRUE
    )

    # ── Step 9: Run PLP ───────────────────────────────────────
    logger$info("Starting model training and evaluation")
    save_dir <- tempdir()

    plpResult <- PatientLevelPrediction::runPlp(
      plpData            = plpData,
      outcomeId          = outcomeId,
      analysisId         = "parthenon-plp",
      analysisName       = "Parthenon PLP Analysis",
      populationSettings = populationSettings,
      splitSettings      = splitSettings,
      sampleSettings     = PatientLevelPrediction::createSampleSettings(),
      featureEngineeringSettings = PatientLevelPrediction::createFeatureEngineeringSettings(),
      preprocessSettings = preprocessSettings,
      modelSettings      = modelSettings,
      executeSettings    = PatientLevelPrediction::createExecuteSettings(
        runSplitData          = TRUE,
        runSampleData         = FALSE,
        runFeatureEngineering = FALSE,
        runPreprocessData     = TRUE,
        runModelDevelopment   = TRUE,
        runCovariateSummary   = FALSE  # PLP 6.6.0 bug: aggregateCovariateSummaries crashes with 0-coefficient models
      ),
      saveDirectory      = save_dir
    )

    logger$info("Model training complete")

    # ── Step 10: Extract results ──────────────────────────────
    performance <- extract_plp_performance(plpResult)
    roc_data    <- extract_roc_points(plpResult)
    cal_data    <- extract_calibration_points(plpResult)
    predictors  <- extract_top_predictors(plpResult, n = 30)

    # Summary
    prediction_df <- as.data.frame(plpResult$prediction)
    test_pred <- prediction_df[prediction_df$evaluationType %in% c("Test", "test"), ]
    if (nrow(test_pred) == 0) test_pred <- prediction_df

    target_count  <- nrow(test_pred)
    outcome_count <- sum(test_pred$outcomeCount > 0)
    outcome_rate  <- if (target_count > 0) round(outcome_count / target_count, 4) else 0

    # Model details — convert S3 objects to plain lists for JSON serialization
    model_details <- list(
      type       = model_type,
      hyper_parameters_selected = tryCatch({
        ms <- plpResult$model$modelDesign$modelSettings
        # Strip S3 class to avoid jsonlite serialization errors
        if (is.list(ms)) {
          ms <- unclass(ms)
          lapply(ms, function(x) if (is.list(x)) unclass(x) else x)
        } else {
          list()
        }
      }, error = function(e) list()),
      covariate_count = tryCatch(
        as.integer(plpResult$model$trainDetails$covariateCount %||% 0),
        error = function(e) 0L
      ),
      training_time_seconds = logger$elapsed()
    )

    logger$info("Prediction pipeline complete", list(
      elapsed_seconds = logger$elapsed(),
      auc = performance$auc
    ))

    # ── Return result ─────────────────────────────────────────
    list(
      status = "completed",
      summary = list(
        target_count  = as.integer(target_count),
        outcome_count = as.integer(outcome_count),
        outcome_rate  = outcome_rate
      ),
      performance     = performance,
      roc_curve       = roc_data,
      calibration     = cal_data,
      top_predictors  = predictors,
      model_details   = model_details,
      logs            = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
