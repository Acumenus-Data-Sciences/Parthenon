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
    "native_replacement_no_hosting",
    "native_replacement_no_hosting",
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
    "superseded",
    "superseded",
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
  "Parity package layer for sharing bundles, cohort exploration artifacts, method evaluation, advanced KNN support, and Shiny module compatibility."
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

.package_status_rows <- function() {
  installed <- installed.packages()[, "Version"]

  lapply(seq_len(nrow(.OHDSI_PACKAGE_REGISTRY)), function(i) {
    pkg <- .OHDSI_PACKAGE_REGISTRY$package[[i]]
    install_pkg <- .OHDSI_PACKAGE_REGISTRY$install_package[[i]]
    is_installed <- install_pkg %in% names(installed)
    is_shiny <- pkg %in% c("OhdsiShinyAppBuilder", "OhdsiShinyModules")

    list(
      package = pkg,
      install_package = install_pkg,
      installed = is_installed,
      version = if (is_installed) unname(installed[[install_pkg]]) else NA_character_,
      capability = .OHDSI_PACKAGE_REGISTRY$capability[[i]],
      surface = .OHDSI_PACKAGE_REGISTRY$surface[[i]],
      priority = .OHDSI_PACKAGE_REGISTRY$priority[[i]],
      install_source = .OHDSI_PACKAGE_REGISTRY$install_source[[i]],
      pinned_ref = .OHDSI_PACKAGE_REGISTRY$pinned_ref[[i]],
      inclusion_reason = .OHDSI_PACKAGE_REGISTRY$inclusion_reason[[i]],
      required_for_parity = isTRUE(.OHDSI_PACKAGE_REGISTRY$required_for_parity[[i]]),
      hosted_surface = FALSE,
      exposure_policy = if (is_shiny) "not_exposed" else "runtime_or_native",
      decision = if (is_shiny) "superseded_by_native_parthenon" else NA_character_,
      replacement_surface = if (is_shiny) {
        "Parthenon native React result, diagnostics, publishing, and study package workflows"
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

  list(
    status = if (length(missing) == 0) "complete" else "partial",
    parity_status = if (length(required_missing) == 0) "ready" else "degraded",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    total = length(rows),
    installed_count = length(installed),
    missing_count = length(missing),
    required_count = sum(required_flags),
    required_missing_count = length(required_missing),
    required_missing = as.list(required_missing),
    shiny_policy = list(
      expose_hosted_surfaces = FALSE,
      allow_iframe_embedding = FALSE,
      allow_user_supplied_app_paths = FALSE,
      decision = "superseded_by_native_parthenon",
      replacement_surface = "Parthenon native React result, diagnostics, publishing, and study package workflows"
    ),
    installed = as.list(installed),
    missing = as.list(missing),
    packages = rows
  )
}
