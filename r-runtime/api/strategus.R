# ──────────────────────────────────────────────────────────────────
# Strategus — OHDSI Study Orchestration API
#
# POST /execute  — Run a full Strategus analysis specification
# POST /validate — Validate an analysis spec without executing
# GET  /modules  — List available Strategus modules with versions
# ──────────────────────────────────────────────────────────────────

library(Strategus)
library(DatabaseConnector)
source("/app/R/connection.R")
source("/app/R/progress.R")

# ── Module registry ───────────────────────────────────────────────
# Canonical list of Strategus-compatible modules. We resolve their
# installed version at runtime so clients know what's available.
.STRATEGUS_MODULES <- c(
  "CohortGeneratorModule",
  "CohortMethodModule",
  "PatientLevelPredictionModule",
  "SelfControlledCaseSeriesModule",
  "CohortDiagnosticsModule",
  "CharacterizationModule",
  "CohortIncidenceModule",
  "EvidenceSynthesisModule"
)

# Map from module name to the R package that provides it.
# Most modules live in a same-named package; a few differ.
.MODULE_PACKAGE_MAP <- list(
  CohortGeneratorModule            = "CohortGenerator",
  CohortMethodModule               = "CohortMethod",
  PatientLevelPredictionModule     = "PatientLevelPrediction",
  SelfControlledCaseSeriesModule   = "SelfControlledCaseSeries",
  CohortDiagnosticsModule          = "CohortDiagnostics",
  CharacterizationModule           = "Characterization",
  CohortIncidenceModule            = "CohortIncidence",
  EvidenceSynthesisModule          = "EvidenceSynthesis"
)

# ── Internal helpers ──────────────────────────────────────────────

#' Resolve package version for a module, returning "not installed" gracefully.
.module_version <- function(module_name) {
  pkg <- .MODULE_PACKAGE_MAP[[module_name]] %||% module_name
  tryCatch(
    as.character(utils::packageVersion(pkg)),
    error = function(e) "not installed"
  )
}

#' Convert a JSON-parsed list to a Strategus analysisSpecifications object.
#' The caller may send either:
#'   (a) A list already produced by jsonlite / Plumber body parsing, or
#'   (b) A raw JSON string nested inside analysis_spec.
#'
#' Strategus uses ParallelLogger's loadSettingsFromJson family internally.
#' The safest path is to round-trip through JSON.
.parse_analysis_spec <- function(raw_spec) {
  if (is.character(raw_spec)) {
    json_str <- raw_spec
  } else {
    json_str <- jsonlite::toJSON(raw_spec, auto_unbox = TRUE, null = "null")
  }

  # Strategus >= 0.2 exposes loadAnalysisSpecifications(); earlier versions
  # use ParallelLogger::loadSettingsFromJson().
  if (isNamespaceLoaded("Strategus") &&
      existsFunction_safe("Strategus", "loadAnalysisSpecifications")) {
    spec <- Strategus::loadAnalysisSpecifications(
      analysisSpecificationsFileName = textConnection(json_str)
    )
  } else {
    spec <- ParallelLogger::loadSettingsFromJson(
      settingsObject = json_str
    )
  }
  spec
}

#' Safe wrapper around existsMethod / exists that avoids namespace errors.
existsFunction_safe <- function(ns, fn) {
  tryCatch(
    exists(fn, envir = asNamespace(ns), mode = "function"),
    error = function(e) FALSE
  )
}

#' Build a results output directory path for a named study.
.study_output_dir <- function(study_name) {
  base <- Sys.getenv("STRATEGUS_OUTPUT_DIR", "/tmp/strategus_results")
  safe_name <- gsub("[^A-Za-z0-9_-]", "_", study_name)
  ts <- format(Sys.time(), "%Y%m%d_%H%M%S")
  file.path(base, paste0(safe_name, "_", ts))
}

# ─────────────────────────────────────────────────────────────────
# POST /execute
# ─────────────────────────────────────────────────────────────────

#* Run a Strategus study package against a CDM database
#*
#* Accepts a Strategus analysisSpecifications JSON and full database
#* connection settings.  Executes the study, zips results, and returns
#* a summary of every module that ran.
#*
#* @post /strategus/execute
#* @serializer unboxedJSON
#* @param body Parsed request body
#* @param response Plumber response
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  # ── Input validation ──────────────────────────────────────────
  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No request body provided"))
  }

  required_keys <- c("connection", "cdm_database_schema", "cohort_database_schema",
                     "cohort_table", "results_database_schema",
                     "analysis_spec", "study_name")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = paste("Missing required fields:", paste(missing, collapse = ", "))
    ))
  }

  study_name <- as.character(spec$study_name)

  logger$info("Strategus execute started", list(study = study_name))

  safe_execute(response, logger, {

    # ── Step 1: Parse the analysis specification ──────────────
    logger$info("Parsing analysisSpecifications")
    analysisSpecifications <- tryCatch(
      .parse_analysis_spec(spec$analysis_spec),
      error = function(e) stop("Failed to parse analysis_spec: ", e$message)
    )
    logger$info(sprintf(
      "Parsed %d module specification(s)",
      length(analysisSpecifications$moduleSpecifications %||% list())
    ))

    # ── Step 2: Build connectionDetails ───────────────────────
    logger$info("Building HADES connectionDetails")
    connectionDetails <- create_hades_connection(spec$connection)

    # ── Step 3: Schema/table settings ─────────────────────────
    cdmDatabaseSchema     <- spec$cdm_database_schema
    cohortDatabaseSchema  <- spec$cohort_database_schema
    cohortTable           <- spec$cohort_table
    resultsDatabaseSchema <- spec$results_database_schema
    workDatabaseSchema    <- spec$work_database_schema %||% resultsDatabaseSchema

    # ── Step 4: Build execution settings ──────────────────────
    logger$info(sprintf(
      "CDM=%s, cohort=%s.%s, results=%s, work=%s",
      cdmDatabaseSchema, cohortDatabaseSchema, cohortTable,
      resultsDatabaseSchema, workDatabaseSchema
    ))

    cdmExecutionSettings <- Strategus::createCdmExecutionSettings(
      connectionDetailsReference = "main",
      workDatabaseSchema         = workDatabaseSchema,
      cdmDatabaseSchema          = cdmDatabaseSchema,
      cohortTableNames           = CohortGenerator::getCohortTableNames(cohortTable),
      workFolder                 = file.path(tempdir(), "strategus_cdm_work"),
      resultsFolder              = file.path(tempdir(), "strategus_cdm_results"),
      minCellCount               = as.integer(spec$min_cell_count %||% 5L)
    )

    resultsExecutionSettings <- Strategus::createResultsExecutionSettings(
      connectionDetailsReference = "main",
      resultsDatabaseSchema      = resultsDatabaseSchema,
      workFolder                 = file.path(tempdir(), "strategus_results_work")
    )

    # ── Step 5: Create results data model (idempotent) ────────
    logger$info("Ensuring results data model exists")
    resultsDsn <- tryCatch({
      con <- DatabaseConnector::connect(connectionDetails)
      on.exit(safe_disconnect(con), add = TRUE)
      Strategus::createResultDataModel(
        analysisSpecifications   = analysisSpecifications,
        resultsConnectionDetails = connectionDetails,
        resultsDatabaseSchema    = resultsDatabaseSchema
      )
      logger$info("Results data model ready")
      TRUE
    }, error = function(e) {
      logger$warn(paste("createResultDataModel warning:", e$message))
      FALSE
    })

    # ── Step 6: Execute the study ──────────────────────────────
    outputDir <- .study_output_dir(study_name)
    dir.create(outputDir, recursive = TRUE, showWarnings = FALSE)

    logger$info(sprintf("Executing study, output dir: %s", outputDir))

    Strategus::execute(
      analysisSpecifications = analysisSpecifications,
      executionSettings      = cdmExecutionSettings,
      executionScriptFolder  = file.path(outputDir, "scripts"),
      keyringName            = NULL,
      storePassword          = FALSE
    )

    logger$info("CDM execution complete; running results execution settings")

    Strategus::execute(
      analysisSpecifications = analysisSpecifications,
      executionSettings      = resultsExecutionSettings,
      executionScriptFolder  = file.path(outputDir, "scripts_results"),
      keyringName            = NULL,
      storePassword          = FALSE
    )

    # ── Step 7: Zip results ────────────────────────────────────
    logger$info("Zipping results")
    zip_path <- paste0(outputDir, ".zip")
    zip_result <- tryCatch({
      Strategus::zipResults(
        resultsFolder = outputDir,
        zipFile       = zip_path
      )
      logger$info(sprintf("Results zipped to %s", zip_path))
      zip_path
    }, error = function(e) {
      logger$warn(paste("zipResults failed:", e$message))
      NA_character_
    })

    # ── Step 8: Build module summary ──────────────────────────
    module_specs <- analysisSpecifications$moduleSpecifications %||% list()
    modules_run <- lapply(module_specs, function(m) {
      list(
        module  = m$module %||% "unknown",
        version = m$version %||% "unknown"
      )
    })

    # Count result files
    result_files <- if (dir.exists(outputDir)) {
      length(list.files(outputDir, recursive = TRUE))
    } else {
      0L
    }

    logger$info(sprintf(
      "Strategus execute complete: %d modules, %d result files",
      length(modules_run), result_files
    ))

    list(
      status        = "completed",
      study_name    = study_name,
      output_dir    = outputDir,
      zip_file      = if (!is.na(zip_result)) zip_result else NULL,
      modules_run   = modules_run,
      result_files  = as.integer(result_files),
      logs          = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}

# ─────────────────────────────────────────────────────────────────
# POST /validate
# ─────────────────────────────────────────────────────────────────

#* Validate a Strategus analysis specification without executing
#*
#* Checks that shared resources exist, that each module specification
#* is well-formed, and that required fields are present.
#* Returns a list of issues (empty = all checks passed).
#*
#* @post /strategus/validate
#* @serializer unboxedJSON
#* @param body Parsed request body
#* @param response Plumber response
function(body, response) {
  spec   <- body
  logger <- create_analysis_logger()

  if (is.null(spec) || is.null(spec$analysis_spec)) {
    response$status <- 400L
    return(list(
      status  = "error",
      message = "Required: analysis_spec — the Strategus analysisSpecifications JSON"
    ))
  }

  logger$info("Validating analysisSpecifications")

  safe_execute(response, logger, {
    issues   <- list()
    warnings <- list()

    # ── Step 1: Parse ──────────────────────────────────────────
    analysisSpecifications <- tryCatch(
      .parse_analysis_spec(spec$analysis_spec),
      error = function(e) {
        issues[[length(issues) + 1]] <<- list(
          severity = "error",
          field    = "analysis_spec",
          message  = paste("JSON parse / deserialization failed:", e$message)
        )
        NULL
      }
    )

    if (is.null(analysisSpecifications)) {
      return(list(
        status     = "failed",
        validation = "failed",
        issues     = issues,
        warnings   = warnings,
        logs       = logger$entries(),
        elapsed_seconds = logger$elapsed()
      ))
    }

    # ── Step 2: Check sharedResources ─────────────────────────
    shared <- analysisSpecifications$sharedResources %||% list()
    if (length(shared) == 0) {
      warnings[[length(warnings) + 1]] <- list(
        severity = "warning",
        field    = "sharedResources",
        message  = "No shared resources defined. Cohort definitions are typically shared resources."
      )
    } else {
      logger$info(sprintf("Found %d shared resource(s)", length(shared)))

      for (i in seq_along(shared)) {
        sr <- shared[[i]]
        if (is.null(sr$attr_class) && is.null(sr[["class"]])) {
          warnings[[length(warnings) + 1]] <- list(
            severity = "warning",
            field    = sprintf("sharedResources[%d]", i),
            message  = "Shared resource has no class attribute — may not deserialize correctly"
          )
        }
      }
    }

    # ── Step 3: Check moduleSpecifications ────────────────────
    module_specs <- analysisSpecifications$moduleSpecifications %||% list()
    if (length(module_specs) == 0) {
      issues[[length(issues) + 1]] <- list(
        severity = "error",
        field    = "moduleSpecifications",
        message  = "No module specifications found. At least one module is required."
      )
    } else {
      logger$info(sprintf("Found %d module specification(s)", length(module_specs)))

      known_modules <- .STRATEGUS_MODULES

      for (i in seq_along(module_specs)) {
        m <- module_specs[[i]]
        mod_name <- m$module %||% sprintf("<unnamed module %d>", i)

        # Check module name is known
        if (!mod_name %in% known_modules) {
          warnings[[length(warnings) + 1]] <- list(
            severity = "warning",
            field    = sprintf("moduleSpecifications[%d].module", i),
            message  = sprintf("Unrecognised module name '%s'. Known modules: %s",
                               mod_name, paste(known_modules, collapse = ", "))
          )
        }

        # Check version field
        if (is.null(m$version) || !nzchar(m$version %||% "")) {
          warnings[[length(warnings) + 1]] <- list(
            severity = "warning",
            field    = sprintf("moduleSpecifications[%d].version", i),
            message  = sprintf("Module '%s' has no version specified", mod_name)
          )
        }

        # Check settings sub-object exists
        if (is.null(m$settings)) {
          issues[[length(issues) + 1]] <- list(
            severity = "error",
            field    = sprintf("moduleSpecifications[%d].settings", i),
            message  = sprintf("Module '%s' is missing its settings block", mod_name)
          )
        }

        # CohortGeneratorModule: validate cohortDefinitionSet or sharedResources ref
        if (mod_name == "CohortGeneratorModule") {
          settings <- m$settings %||% list()
          has_cohort_defs <- !is.null(settings$cohortDefinitionSet) ||
                             !is.null(settings$cohortDefinitionSetRef)
          if (!has_cohort_defs && length(shared) == 0) {
            issues[[length(issues) + 1]] <- list(
              severity = "error",
              field    = sprintf("moduleSpecifications[%d] (CohortGeneratorModule)", i),
              message  = "CohortGeneratorModule requires cohort definitions via settings$cohortDefinitionSet or sharedResources"
            )
          }
        }
      }
    }

    # ── Step 4: Cross-check module dependencies ───────────────
    mod_names <- sapply(module_specs, function(m) m$module %||% "")

    # EvidenceSynthesisModule needs at least one upstream effect estimate module
    if ("EvidenceSynthesisModule" %in% mod_names) {
      upstream <- intersect(mod_names, c("CohortMethodModule", "SelfControlledCaseSeriesModule"))
      if (length(upstream) == 0) {
        warnings[[length(warnings) + 1]] <- list(
          severity = "warning",
          field    = "moduleSpecifications",
          message  = paste(
            "EvidenceSynthesisModule is present but no upstream effect estimate module",
            "(CohortMethodModule or SelfControlledCaseSeriesModule) was found.",
            "Ensure upstream results are pre-populated in the results schema."
          )
        )
      }
    }

    # CharacterizationModule / CohortDiagnosticsModule typically need CohortGeneratorModule
    needs_cohorts <- intersect(
      mod_names,
      c("CharacterizationModule", "CohortDiagnosticsModule", "CohortIncidenceModule",
        "PatientLevelPredictionModule", "CohortMethodModule", "SelfControlledCaseSeriesModule")
    )
    if (length(needs_cohorts) > 0 && !"CohortGeneratorModule" %in% mod_names) {
      warnings[[length(warnings) + 1]] <- list(
        severity = "warning",
        field    = "moduleSpecifications",
        message  = paste(
          "Module(s)", paste(needs_cohorts, collapse = ", "),
          "typically require CohortGeneratorModule to pre-generate cohort tables,",
          "but CohortGeneratorModule is not in the spec. Ensure cohorts are pre-built."
        )
      )
    }

    # ── Step 5: Summarise ──────────────────────────────────────
    n_errors   <- sum(sapply(issues,   function(i) i$severity == "error"))
    n_warnings <- sum(sapply(warnings, function(w) w$severity == "warning"))
    passed     <- n_errors == 0

    logger$info(sprintf(
      "Validation complete: %d error(s), %d warning(s)",
      n_errors, n_warnings
    ))

    list(
      status     = if (passed) "completed" else "failed",
      validation = if (passed) "passed" else "failed",
      summary = list(
        modules_found    = length(module_specs),
        shared_resources = length(shared),
        errors           = as.integer(n_errors),
        warnings         = as.integer(n_warnings)
      ),
      issues   = issues,
      warnings = warnings,
      logs     = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}

# ─────────────────────────────────────────────────────────────────
# GET /modules
# ─────────────────────────────────────────────────────────────────

#* List available Strategus modules with their installed versions
#*
#* Returns each known module alongside the version of the backing HADES
#* package that is currently installed in this R environment.
#*
#* @get /strategus/modules
#* @serializer unboxedJSON
function() {
  strategus_version <- tryCatch(
    as.character(utils::packageVersion("Strategus")),
    error = function(e) "not installed"
  )

  modules <- lapply(.STRATEGUS_MODULES, function(mod_name) {
    pkg         <- .MODULE_PACKAGE_MAP[[mod_name]] %||% mod_name
    installed_v <- .module_version(mod_name)
    available   <- installed_v != "not installed"

    # Derive a human-readable label
    label <- gsub("Module$", "", mod_name)
    label <- gsub("([A-Z])", " \\1", label)
    label <- trimws(label)

    list(
      module    = mod_name,
      label     = label,
      package   = pkg,
      version   = installed_v,
      available = available
    )
  })

  list(
    strategus_version = strategus_version,
    modules           = modules,
    total             = length(modules),
    available         = sum(sapply(modules, function(m) isTRUE(m$available)))
  )
}
