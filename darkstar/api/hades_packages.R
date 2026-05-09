# ──────────────────────────────────────────────────────────────────
# HADES package capability inventory
# GET /hades/packages — installed/missing OHDSI package matrix
# ──────────────────────────────────────────────────────────────────

.OHDSI_PACKAGE_REGISTRY <- data.frame(
  package = c(
    "SqlRender",
    "DatabaseConnector",
    "Andromeda",
    "Cyclops",
    "FeatureExtraction",
    "ResultModelManager",
    "EmpiricalCalibration",
    "ParallelLogger",
    "CohortMethod",
    "PatientLevelPrediction",
    "DeepPatientLevelPrediction",
    "EnsemblePatientLevelPrediction",
    "SelfControlledCaseSeries",
    "SelfControlledCohort",
    "EvidenceSynthesis",
    "CohortGenerator",
    "CohortDiagnostics",
    "CohortIncidence",
    "Characterization",
    "Strategus",
    "DataQualityDashboard",
    "Achilles",
    "TreatmentPatterns",
    "PheValuator",
    "KEEPER",
    "CohortExplorer",
    "PhenotypeLibrary",
    "Capr",
    "CirceR",
    "MethodEvaluation",
    "BigKnn",
    "BrokenAdaptiveRidge",
    "IterativeHardThresholding",
    "OhdsiReportGenerator",
    "OhdsiSharing",
    "OhdsiShinyAppBuilder",
    "OhdsiShinyModules",
    "ROhdsiWebApi",
    "Eunomia",
    "ETLSyntheaBuilder"
  ),
  capability = c(
    "OHDSI SQL rendering",
    "Database connectivity",
    "Large local result storage",
    "High-dimensional regression",
    "Covariate extraction",
    "Result model management",
    "Empirical calibration",
    "Logging and parallel execution",
    "Population-level effect estimation",
    "Patient-level prediction",
    "Deep learning patient-level prediction",
    "Ensemble patient-level prediction",
    "Self-controlled case series",
    "Self-controlled cohort analysis",
    "Evidence synthesis and meta-analysis",
    "Cohort generation",
    "Cohort diagnostics",
    "Incidence rate analysis",
    "Baseline characterization",
    "Study orchestration",
    "Data quality checks",
    "Data source characterization",
    "Treatment pathway analysis",
    "Phenotype algorithm evaluation",
    "Phenotype review workflow",
    "Cohort exploration",
    "Phenotype Library R interface",
    "R cohort definition DSL",
    "R Circe cohort expression tooling",
    "Method evaluation workbench",
    "KNN algorithm support",
    "Adaptive ridge algorithm support",
    "Sparse model algorithm support",
    "OHDSI report generation",
    "OHDSI result sharing",
    "Legacy Shiny app builder",
    "Legacy Shiny modules",
    "OHDSI WebAPI R client",
    "Demo CDM data",
    "Synthea-to-OMOP ETL"
  ),
  surface = c(
    "runtime",
    "runtime",
    "runtime",
    "runtime",
    "runtime",
    "runtime",
    "runtime",
    "runtime",
    "first_class",
    "first_class",
    "first_class_partial_ui",
    "package_available_ui_pending",
    "first_class",
    "package_available_ui_pending",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "native_or_package",
    "native_replacement",
    "first_class_partial_ui",
    "package_available_ui_pending",
    "package_available_ui_pending",
    "native_partial_package_available",
    "native_partial_package_available",
    "native_partial_package_available",
    "native_partial_package_available",
    "package_available_ui_pending",
    "advanced_dependency",
    "advanced_dependency",
    "advanced_dependency",
    "native_partial_package_available",
    "native_partial_package_available",
    "managed_shiny_compatibility",
    "managed_shiny_compatibility",
    "runtime",
    "runtime",
    "runtime"
  ),
  priority = c(
    "core",
    "core",
    "core",
    "core",
    "core",
    "core",
    "core",
    "core",
    "first_class",
    "first_class",
    "first_class",
    "high",
    "first_class",
    "high",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "first_class",
    "compatibility",
    "high",
    "high",
    "medium",
    "medium",
    "medium",
    "medium",
    "medium",
    "medium",
    "low",
    "low",
    "low",
    "medium",
    "medium",
    "high",
    "high",
    "runtime",
    "runtime",
    "runtime"
  ),
  stringsAsFactors = FALSE
)
.OHDSI_PACKAGE_REGISTRY$install_package <- .OHDSI_PACKAGE_REGISTRY$package
.OHDSI_PACKAGE_REGISTRY$install_package[.OHDSI_PACKAGE_REGISTRY$package == "KEEPER"] <- "Keeper"
.OHDSI_PACKAGE_REGISTRY$install_source <- "runtime dependency"
.OHDSI_PACKAGE_REGISTRY$pinned_ref <- NA_character_
.OHDSI_PACKAGE_REGISTRY$inclusion_reason <- "Runtime support package required by Parthenon OHDSI workflows."
.OHDSI_PACKAGE_REGISTRY$required_for_parity <- .OHDSI_PACKAGE_REGISTRY$priority %in% c("core", "first_class", "high") |
  .OHDSI_PACKAGE_REGISTRY$surface %in% c("first_class", "first_class_partial_ui", "native_or_package")

.OHDSI_TARGET_VERSION_CHECKED_AT <- "2026-05-08"
.OHDSI_TARGET_VERSION_SOURCE <- "OHDSI HADES package statuses, upstream DESCRIPTION files, and Parthenon-managed ETL-Synthea tag"
.OHDSI_TARGET_VERSIONS <- c(
  SqlRender = "1.19.5",
  DatabaseConnector = "7.1.0",
  Andromeda = "1.2.0",
  Cyclops = "3.7.0",
  FeatureExtraction = "3.13.0",
  ResultModelManager = "0.6.2",
  EmpiricalCalibration = "3.1.4",
  ParallelLogger = "3.5.1",
  CohortMethod = "6.0.2",
  PatientLevelPrediction = "6.6.0",
  DeepPatientLevelPrediction = "2.3.0",
  EnsemblePatientLevelPrediction = "1.0.3",
  SelfControlledCaseSeries = "6.1.5",
  SelfControlledCohort = "1.6.0",
  EvidenceSynthesis = "1.1.0",
  CohortGenerator = "1.1.0",
  CohortDiagnostics = "3.4.2",
  CohortIncidence = "4.1.1",
  Characterization = "3.0.0",
  Strategus = "1.5.0",
  DataQualityDashboard = "2.8.7",
  Achilles = "1.7.2",
  TreatmentPatterns = "3.1.2",
  PheValuator = "2.2.16",
  KEEPER = "2.1.0",
  CohortExplorer = "0.1.0",
  PhenotypeLibrary = "3.37.0",
  Capr = "2.1.1",
  CirceR = "1.3.3",
  MethodEvaluation = "2.4.0",
  BigKnn = "1.0.2",
  BrokenAdaptiveRidge = "1.0.1",
  IterativeHardThresholding = "1.0.3",
  OhdsiReportGenerator = "2.1.0",
  OhdsiSharing = "0.2.2",
  OhdsiShinyAppBuilder = "1.0.0",
  OhdsiShinyModules = "3.5.0",
  ROhdsiWebApi = "1.3.3",
  Eunomia = "2.1.0",
  ETLSyntheaBuilder = "2.1"
)
.OHDSI_PACKAGE_REGISTRY$target_version <- unname(.OHDSI_TARGET_VERSIONS[.OHDSI_PACKAGE_REGISTRY$package])
.OHDSI_PACKAGE_REGISTRY$target_version_source <- .OHDSI_TARGET_VERSION_SOURCE

.HADES_RELEASE_PROFILE <- list(
  name = "2026Q1",
  source = "OHDSI HADES-wide release renv.lock",
  lock_url = "https://raw.githubusercontent.com/OHDSI/Hades/refs/heads/main/hadesWideReleases/2026Q1/renv.lock",
  mode = "stable_release_profile"
)

.set_package_metadata <- function(packages, install_source, inclusion_reason, pinned_ref = NA_character_) {
  registry <- .OHDSI_PACKAGE_REGISTRY
  idx <- registry$package %in% packages

  if (!any(idx)) {
    stop("Unknown OHDSI package metadata key: ", paste(packages, collapse = ", "))
  }

  registry$install_source[idx] <- install_source
  registry$inclusion_reason[idx] <- inclusion_reason
  registry$pinned_ref[idx] <- pinned_ref
  .OHDSI_PACKAGE_REGISTRY <<- registry
}

.set_package_metadata(
  c("SqlRender", "DatabaseConnector", "Andromeda", "ParallelLogger"),
  "OHDSI r-universe pinned with remotes::install_version",
  "Core HADES rendering, connectivity, storage, and logging foundation."
)
.set_package_metadata(
  c("Cyclops", "FeatureExtraction", "ResultModelManager", "EmpiricalCalibration"),
  "OHDSI r-universe pinned with remotes::install_version",
  "Core high-dimensional modeling, covariate extraction, result storage, and calibration."
)
.set_package_metadata(
  c("CohortMethod", "PatientLevelPrediction", "SelfControlledCaseSeries", "EvidenceSynthesis", "CohortGenerator"),
  "Pinned OHDSI GitHub release tags",
  "First-class population estimation, prediction, SCCS, synthesis, and cohort-generation methods."
)
.set_package_metadata(
  c("CohortDiagnostics", "DeepPatientLevelPrediction", "CohortIncidence", "Strategus"),
  "Pinned OHDSI GitHub release tags",
  "First-class diagnostics, deep prediction, incidence, and study-orchestration runtime support."
)
.set_package_metadata(
  c("DataQualityDashboard", "Characterization"),
  "OHDSI r-universe pinned with remotes::install_version",
  "Native Parthenon surfaces use these packages for data quality and baseline characterization compatibility."
)
.set_package_metadata(
  c("TreatmentPatterns", "Achilles", "CirceR", "OhdsiReportGenerator", "BrokenAdaptiveRidge", "IterativeHardThresholding", "OhdsiShinyAppBuilder"),
  "OHDSI r-universe pinned with remotes::install_version",
  "Parity package layer for package-native workflows, reporting, authoring, advanced model dependencies, and Shiny artifact compatibility."
)
.set_package_metadata(
  c("SelfControlledCohort", "PheValuator", "EnsemblePatientLevelPrediction", "Capr", "PhenotypeLibrary"),
  "Pinned OHDSI GitHub release tags",
  "Parity package layer for self-controlled cohort analysis, phenotype validation, ensemble PLP, and authoring interoperability."
)
.set_package_metadata(
  c("OhdsiSharing", "CohortExplorer", "MethodEvaluation", "BigKnn", "OhdsiShinyModules"),
  "Pinned OHDSI GitHub release tags",
  "Parity package layer for sharing bundles, cohort exploration artifacts, method evaluation, advanced KNN support, and managed Shiny module compatibility."
)
.set_package_metadata(
  "KEEPER",
  "Pinned OHDSI GitHub release tag",
  "Phenotype review workflow compatibility; Parthenon keeps native review as the product surface."
)
.set_package_metadata(
  "ETLSyntheaBuilder",
  "Pinned OHDSI GitHub release tag",
  "Synthea-to-OMOP ETL runtime support."
)

.version_status <- function(installed_version, target_version, installed) {
  if (!isTRUE(installed)) {
    return("missing")
  }

  if (is.na(target_version) || !nzchar(target_version)) {
    return("unknown")
  }

  cmp <- tryCatch(
    utils::compareVersion(as.character(installed_version), as.character(target_version)),
    error = function(e) NA_integer_
  )

  if (is.na(cmp)) {
    return("unknown")
  }
  if (cmp < 0) {
    return("behind")
  }
  if (cmp > 0) {
    return("ahead")
  }
  "current"
}

.managed_shiny_apps <- function() {
  list(
    list(
      key = "plp-results",
      label = "PatientLevelPrediction Results",
      package = "OhdsiShinyModules",
      module_family = "Prediction module",
      result_types = as.list(c("PatientLevelPrediction")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "study_result_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultPredictionConfig"
    ),
    list(
      key = "population-estimation-results",
      label = "CohortMethod, SCCS, and Evidence Synthesis Results",
      package = "OhdsiShinyModules",
      module_family = "Estimator module",
      result_types = as.list(c("CohortMethod", "SelfControlledCaseSeries", "EvidenceSynthesis")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "study_result_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultEstimationConfig"
    ),
    list(
      key = "cohort-diagnostics",
      label = "Cohort Diagnostics Explorer",
      package = "OhdsiShinyModules",
      module_family = "Cohort Diagnostic module",
      result_types = as.list(c("CohortDiagnostics")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "cohort_diagnostics_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultCohortDiagnosticsConfig"
    ),
    list(
      key = "characterization",
      label = "Characterization and Incidence Results",
      package = "OhdsiShinyModules",
      module_family = "Characterization module",
      result_types = as.list(c("Characterization", "CohortIncidence")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "analysis_result_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultCharacterizationConfig"
    ),
    list(
      key = "phevaluator",
      label = "PheValuator Results",
      package = "OhdsiShinyModules",
      module_family = "PheValuator module",
      result_types = as.list(c("PheValuator")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "phenotype_validation_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultPhevaluatorConfig"
    ),
    list(
      key = "ohdsi-report",
      label = "OHDSI Report Viewer",
      package = "OhdsiShinyModules",
      module_family = "Report module",
      result_types = as.list(c("OhdsiReportGenerator", "OhdsiSharing")),
      launch_modes = as.list(c("embedded", "full_page")),
      runtime_preference = "shinyproxy",
      status = "registry_ready",
      permission_scope = "study_artifact_read",
      entrypoint = "OhdsiShinyAppBuilder::createDefaultReportConfig"
    )
  )
}

.package_status_rows <- function() {
  installed <- installed.packages()[, "Version"]

  lapply(seq_len(nrow(.OHDSI_PACKAGE_REGISTRY)), function(i) {
    pkg <- .OHDSI_PACKAGE_REGISTRY$package[[i]]
    install_pkg <- .OHDSI_PACKAGE_REGISTRY$install_package[[i]]
    is_installed <- install_pkg %in% names(installed)
    is_shiny <- pkg %in% c("OhdsiShinyAppBuilder", "OhdsiShinyModules")
    installed_version <- if (is_installed) unname(installed[[install_pkg]]) else NA_character_
    target_version <- .OHDSI_PACKAGE_REGISTRY$target_version[[i]]

    list(
      package = pkg,
      install_package = install_pkg,
      installed = is_installed,
      version = installed_version,
      target_version = target_version,
      latest_version = target_version,
      version_status = .version_status(installed_version, target_version, is_installed),
      target_version_checked_at = .OHDSI_TARGET_VERSION_CHECKED_AT,
      target_version_source = .OHDSI_PACKAGE_REGISTRY$target_version_source[[i]],
      capability = .OHDSI_PACKAGE_REGISTRY$capability[[i]],
      surface = .OHDSI_PACKAGE_REGISTRY$surface[[i]],
      priority = .OHDSI_PACKAGE_REGISTRY$priority[[i]],
      install_source = .OHDSI_PACKAGE_REGISTRY$install_source[[i]],
      pinned_ref = .OHDSI_PACKAGE_REGISTRY$pinned_ref[[i]],
      inclusion_reason = .OHDSI_PACKAGE_REGISTRY$inclusion_reason[[i]],
      required_for_parity = isTRUE(.OHDSI_PACKAGE_REGISTRY$required_for_parity[[i]]),
      hosted_surface = is_shiny,
      exposure_policy = if (is_shiny) "managed_compatibility_layer" else "runtime_or_native",
      decision = if (is_shiny) "managed_ohdsi_shiny_compatibility" else NA_character_,
      replacement_surface = if (is_shiny) {
        "Parthenon native React remains primary; managed OHDSI Shiny reference viewers can launch from vetted result artifacts."
      } else {
        NA_character_
      }
    )
  })
}

#* List OHDSI/HADES package capability status for this Darkstar runtime
#*
#* @get /hades/packages
#* @serializer unboxedJSON
function() {
  rows <- .package_status_rows()
  installed_flags <- vapply(rows, function(row) isTRUE(row$installed), logical(1))
  package_names <- vapply(rows, function(row) row$package, character(1))

  missing <- package_names[!installed_flags]
  installed <- package_names[installed_flags]
  required_flags <- vapply(rows, function(row) isTRUE(row$required_for_parity), logical(1))
  required_missing <- package_names[required_flags & !installed_flags]
  version_statuses <- vapply(rows, function(row) row$version_status, character(1))
  outdated <- package_names[version_statuses == "behind"]
  required_outdated <- package_names[required_flags & version_statuses == "behind"]
  current <- package_names[version_statuses == "current"]
  ahead <- package_names[version_statuses == "ahead"]
  freshness_status <- if (length(required_outdated) > 0) "stale" else "current"
  parity_status <- if (length(required_missing) > 0) {
    "degraded"
  } else if (length(required_outdated) > 0) {
    "stale"
  } else {
    "ready"
  }

  list(
    status = if (length(missing) == 0) "complete" else "partial",
    parity_status = parity_status,
    freshness_status = freshness_status,
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    target_version_checked_at = .OHDSI_TARGET_VERSION_CHECKED_AT,
    target_version_source = .OHDSI_TARGET_VERSION_SOURCE,
    release_profile = .HADES_RELEASE_PROFILE,
    total = length(rows),
    installed_count = length(installed),
    missing_count = length(missing),
    current_count = length(current),
    outdated_count = length(outdated),
    required_outdated_count = length(required_outdated),
    ahead_count = length(ahead),
    required_count = sum(required_flags),
    required_missing_count = length(required_missing),
    required_missing = as.list(required_missing),
    outdated = as.list(outdated),
    required_outdated = as.list(required_outdated),
    ahead = as.list(ahead),
    shiny_policy = list(
      expose_hosted_surfaces = TRUE,
      allow_iframe_embedding = TRUE,
      allow_user_supplied_app_paths = FALSE,
      decision = "managed_ohdsi_shiny_compatibility",
      default_runtime = "shinyproxy",
      supported_runtimes = as.list(c("shinyproxy", "posit_connect")),
      allowed_scope = "vetted_ohdsi_modules_only",
      replacement_surface = "Parthenon native React remains primary; managed OHDSI Shiny reference viewers are available for canonical OHDSI result exploration."
    ),
    shiny_apps = .managed_shiny_apps(),
    installed = as.list(installed),
    missing = as.list(missing),
    packages = rows
  )
}
