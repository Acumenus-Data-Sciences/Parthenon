sqlite <- Sys.which("sqlite3")
if (!nzchar(sqlite)) {
  stop("sqlite3 is required to generate managed Shiny golden result databases.")
}

golden_dir <- "docker/shiny-ohdsi/tests/golden"
dir.create(golden_dir, recursive = TRUE, showWarnings = FALSE)

sql_literal <- function(value) {
  if (is.null(value) || is.na(value)) {
    return("NULL")
  }

  paste0("'", gsub("'", "''", as.character(value), fixed = TRUE), "'")
}

create_database <- function(filename, statements) {
  path <- file.path(golden_dir, filename)
  unlink(path)

  sql <- paste(c(
    "PRAGMA foreign_keys = OFF;",
    "BEGIN;",
    statements,
    "COMMIT;"
  ), collapse = "\n")

  status <- system2(sqlite, args = path, input = sql, stdout = TRUE, stderr = TRUE)
  if (!identical(attr(status, "status"), NULL)) {
    stop(sprintf("sqlite3 failed while generating %s: %s", filename, paste(status, collapse = "\n")))
  }

  normalizePath(path, winslash = "/", mustWork = TRUE)
}

metadata_sql <- function(database_id, description) {
  c(
    "CREATE TABLE database_meta_data (database_id TEXT, database_name TEXT, database_description TEXT, cdm_version TEXT, vocabulary_version TEXT, result_generated_at TEXT);",
    sprintf(
      "INSERT INTO database_meta_data VALUES (%s, %s, %s, '5.4', 'v5.0 2026-01-01', '2026-05-09T18:00:00Z');",
      sql_literal(database_id),
      sql_literal(paste(database_id, "golden fixture")),
      sql_literal(description)
    )
  )
}

invisible(create_database("plp-results.sqlite", c(
  metadata_sql("plp", "PatientLevelPrediction golden result database with performance and diagnostics rows."),
  "CREATE TABLE plp_model_designs (model_design_id INTEGER PRIMARY KEY, model_type TEXT, target_id INTEGER, outcome_id INTEGER, population_size INTEGER);",
  "CREATE TABLE plp_performances (model_design_id INTEGER, auc REAL, calibration_slope REAL, brier_score REAL, observation_count INTEGER);",
  "CREATE TABLE plp_diagnostics (model_design_id INTEGER, diagnostic_name TEXT, diagnostic_value REAL);",
  "CREATE TABLE plp_prediction_distribution (model_design_id INTEGER, risk_bin TEXT, person_count INTEGER);",
  "INSERT INTO plp_model_designs VALUES (1, 'GradientBoosting', 101, 202, 2500);",
  "INSERT INTO plp_performances VALUES (1, 0.742, 0.981, 0.118, 2500);",
  "INSERT INTO plp_diagnostics VALUES (1, 'calibration_intercept', -0.031), (1, 'mean_predicted_risk', 0.184);",
  "INSERT INTO plp_prediction_distribution VALUES (1, '0.00-0.10', 870), (1, '0.10-0.25', 1044), (1, '0.25-1.00', 586);"
)))

invisible(create_database("cohort-method-results.sqlite", c(
  metadata_sql("cohort_method", "CohortMethod golden result database with effect estimate and balance rows."),
  "CREATE TABLE cm_analysis (analysis_id INTEGER PRIMARY KEY, target_id INTEGER, comparator_id INTEGER, outcome_id INTEGER, analysis_name TEXT);",
  "CREATE TABLE cm_result (analysis_id INTEGER, target_subjects INTEGER, comparator_subjects INTEGER, hazard_ratio REAL, ci_95_lb REAL, ci_95_ub REAL, p_value REAL);",
  "CREATE TABLE cm_attrition (analysis_id INTEGER, sequence_number INTEGER, description TEXT, target_count INTEGER, comparator_count INTEGER);",
  "CREATE TABLE cm_covariate_balance (analysis_id INTEGER, covariate_name TEXT, std_diff_before REAL, std_diff_after REAL);",
  "INSERT INTO cm_analysis VALUES (1, 101, 102, 201, 'ACE inhibitor versus CCB');",
  "INSERT INTO cm_result VALUES (1, 1240, 1188, 0.86, 0.74, 0.99, 0.041);",
  "INSERT INTO cm_attrition VALUES (1, 1, 'Initial cohorts', 1800, 1750), (1, 2, 'PS matched', 1240, 1188);",
  "INSERT INTO cm_covariate_balance VALUES (1, 'Age', 0.22, 0.03), (1, 'Diabetes', 0.18, 0.04);"
)))

invisible(create_database("sccs-results.sqlite", c(
  metadata_sql("sccs", "SelfControlledCaseSeries golden result database with interval and estimate rows."),
  "CREATE TABLE sccs_analysis (analysis_id INTEGER PRIMARY KEY, exposure_id INTEGER, outcome_id INTEGER, analysis_name TEXT);",
  "CREATE TABLE sccs_result (analysis_id INTEGER, cases INTEGER, era_count INTEGER, relative_incidence REAL, ci_95_lb REAL, ci_95_ub REAL);",
  "CREATE TABLE sccs_interval_result (analysis_id INTEGER, interval_name TEXT, person_days INTEGER, outcomes INTEGER);",
  "INSERT INTO sccs_analysis VALUES (1, 301, 401, 'NSAID exposure and acute kidney injury');",
  "INSERT INTO sccs_result VALUES (1, 412, 786, 1.31, 1.08, 1.58);",
  "INSERT INTO sccs_interval_result VALUES (1, 'pre_exposure', 45000, 71), (1, 'risk_window', 12000, 39);"
)))

invisible(create_database("evidence-synthesis-results.sqlite", c(
  metadata_sql("evidence_synthesis", "EvidenceSynthesis golden result database with site-level and pooled estimates."),
  "CREATE TABLE es_analysis (analysis_id INTEGER PRIMARY KEY, synthesis_type TEXT, outcome_id INTEGER, analysis_name TEXT);",
  "CREATE TABLE es_cm_result (analysis_id INTEGER, database_id TEXT, log_rr REAL, se_log_rr REAL);",
  "CREATE TABLE es_pooled_result (analysis_id INTEGER, model TEXT, estimate REAL, ci_95_lb REAL, ci_95_ub REAL, i2 REAL);",
  "INSERT INTO es_analysis VALUES (1, 'random_effects', 201, 'Network treatment effect synthesis');",
  "INSERT INTO es_cm_result VALUES (1, 'EUNOMIA', -0.150, 0.072), (1, 'SYNPUF', -0.083, 0.091);",
  "INSERT INTO es_pooled_result VALUES (1, 'random_effects', 0.889, 0.781, 1.012, 0.18);"
)))

invisible(create_database("cohort-diagnostics-results.sqlite", c(
  metadata_sql("cohort_diagnostics", "CohortDiagnostics golden result database with counts and orphan concept rows."),
  "CREATE TABLE cd_cohort (cohort_id INTEGER PRIMARY KEY, cohort_name TEXT, target_cohort INTEGER);",
  "CREATE TABLE cd_cohort_count (cohort_id INTEGER, database_id TEXT, cohort_entries INTEGER, cohort_subjects INTEGER);",
  "CREATE TABLE cd_concept_count (cohort_id INTEGER, concept_id INTEGER, concept_name TEXT, record_count INTEGER);",
  "CREATE TABLE cd_orphan_concept (cohort_id INTEGER, concept_id INTEGER, concept_name TEXT, record_count INTEGER);",
  "INSERT INTO cd_cohort VALUES (101, 'T2DM cohort', 1), (102, 'Comparator cohort', 0);",
  "INSERT INTO cd_cohort_count VALUES (101, 'EUNOMIA', 2240, 2188), (102, 'EUNOMIA', 1820, 1791);",
  "INSERT INTO cd_concept_count VALUES (101, 201826, 'Type 2 diabetes mellitus', 2050);",
  "INSERT INTO cd_orphan_concept VALUES (101, 999001, 'Local mapped diagnosis', 12);"
)))

invisible(create_database("characterization-results.sqlite", c(
  metadata_sql("characterization", "Characterization golden result database with time-to-event and covariate summaries."),
  "CREATE TABLE c_time_to_event_targets (target_id INTEGER PRIMARY KEY, target_name TEXT);",
  "CREATE TABLE c_time_to_event (target_id INTEGER, outcome_id INTEGER, days_at_risk INTEGER, events INTEGER, event_rate REAL);",
  "CREATE TABLE c_covariate_ref (covariate_id INTEGER PRIMARY KEY, covariate_name TEXT, analysis_id INTEGER);",
  "CREATE TABLE c_covariate_value (covariate_id INTEGER, cohort_id INTEGER, mean_value REAL, person_count INTEGER);",
  "INSERT INTO c_time_to_event_targets VALUES (101, 'T2DM patients');",
  "INSERT INTO c_time_to_event VALUES (101, 201, 365, 84, 0.038);",
  "INSERT INTO c_covariate_ref VALUES (1, 'Age in years', 1), (2, 'Female sex', 1);",
  "INSERT INTO c_covariate_value VALUES (1, 101, 64.2, 2188), (2, 101, 0.51, 2188);"
)))

invisible(create_database("cohort-incidence-results.sqlite", c(
  metadata_sql("cohort_incidence", "CohortIncidence golden result database with stratified incidence rates."),
  "CREATE TABLE ci_incidence_rate (target_id INTEGER, outcome_id INTEGER, strata_name TEXT, person_count INTEGER, person_years REAL, cases INTEGER, incidence_rate REAL);",
  "CREATE TABLE ci_attrition (target_id INTEGER, sequence_number INTEGER, description TEXT, person_count INTEGER);",
  "INSERT INTO ci_incidence_rate VALUES (101, 201, 'overall', 2188, 1876.4, 84, 44.77), (101, 201, 'age_65_plus', 1002, 842.5, 51, 60.53);",
  "INSERT INTO ci_attrition VALUES (101, 1, 'Initial target cohort', 2240), (101, 2, 'With observation time', 2188);"
)))

invisible(create_database("phevaluator-results.sqlite", c(
  metadata_sql("phevaluator", "PheValuator golden result database with algorithm performance and diagnostics."),
  "CREATE TABLE pv_algorithm_performance_results (algorithm_id INTEGER, algorithm_name TEXT, sensitivity REAL, specificity REAL, ppv REAL, npv REAL);",
  "CREATE TABLE pv_diagnostics (algorithm_id INTEGER, diagnostic_name TEXT, diagnostic_value REAL);",
  "CREATE TABLE pv_model_performance (model_id INTEGER, auc REAL, calibration_slope REAL);",
  "CREATE TABLE pv_model_input_parameters (model_id INTEGER, parameter_name TEXT, parameter_value TEXT);",
  "INSERT INTO pv_algorithm_performance_results VALUES (1, 'Case definition A', 0.84, 0.91, 0.67, 0.96);",
  "INSERT INTO pv_diagnostics VALUES (1, 'positive_controls', 24), (1, 'negative_controls', 31);",
  "INSERT INTO pv_model_performance VALUES (1, 0.88, 0.97);",
  "INSERT INTO pv_model_input_parameters VALUES (1, 'outcomeId', '201');"
)))

invisible(create_database("ohdsi-report-results.sqlite", c(
  metadata_sql("ohdsi_report", "OHDSI report golden result database using a PLP-compatible result schema."),
  "CREATE TABLE plp_model_designs (model_design_id INTEGER PRIMARY KEY, model_type TEXT, target_id INTEGER, outcome_id INTEGER, population_size INTEGER);",
  "CREATE TABLE plp_performances (model_design_id INTEGER, auc REAL, calibration_slope REAL, brier_score REAL, observation_count INTEGER);",
  "CREATE TABLE report_section (section_id TEXT PRIMARY KEY, title TEXT, source_table TEXT);",
  "INSERT INTO plp_model_designs VALUES (1, 'LassoLogisticRegression', 701, 801, 1430);",
  "INSERT INTO plp_performances VALUES (1, 0.721, 1.041, 0.126, 1430);",
  "INSERT INTO report_section VALUES ('plp-performance', 'Patient-level prediction performance', 'plp_performances');"
)))

invisible(create_database("ohdsi-sharing-results.sqlite", c(
  metadata_sql("ohdsi_sharing", "OHDSI sharing golden result database using a CohortMethod-compatible result schema plus sharing metadata."),
  "CREATE TABLE cm_analysis (analysis_id INTEGER PRIMARY KEY, target_id INTEGER, comparator_id INTEGER, outcome_id INTEGER, analysis_name TEXT);",
  "CREATE TABLE cm_result (analysis_id INTEGER, target_subjects INTEGER, comparator_subjects INTEGER, hazard_ratio REAL, ci_95_lb REAL, ci_95_ub REAL, p_value REAL);",
  "CREATE TABLE sharing_manifest (bundle_id TEXT PRIMARY KEY, exported_at TEXT, package_name TEXT);",
  "INSERT INTO cm_analysis VALUES (1, 901, 902, 903, 'Shared network estimate');",
  "INSERT INTO cm_result VALUES (1, 880, 861, 0.93, 0.81, 1.07, 0.281);",
  "INSERT INTO sharing_manifest VALUES ('sharing-fixture-001', '2026-05-09T18:00:00Z', 'OhdsiSharing');"
)))

catalog <- list(
  generated_at = "2026-05-09T18:00:00Z",
  databases = list(
    list(loader_key = "plp_result_bundle", app_key = "plp-results", file = "plp-results.sqlite", expected_variant = "PatientLevelPrediction result database", required_nonempty_tables = c("database_meta_data", "plp_model_designs", "plp_performances")),
    list(loader_key = "population_estimation_result_bundle", app_key = "population-estimation-results", file = "cohort-method-results.sqlite", expected_variant = "CohortMethod result database", required_nonempty_tables = c("database_meta_data", "cm_analysis", "cm_result")),
    list(loader_key = "population_estimation_result_bundle", app_key = "population-estimation-results", file = "sccs-results.sqlite", expected_variant = "SelfControlledCaseSeries result database", required_nonempty_tables = c("database_meta_data", "sccs_analysis", "sccs_result")),
    list(loader_key = "population_estimation_result_bundle", app_key = "population-estimation-results", file = "evidence-synthesis-results.sqlite", expected_variant = "EvidenceSynthesis CohortMethod result database", required_nonempty_tables = c("database_meta_data", "es_analysis", "es_cm_result")),
    list(loader_key = "cohort_diagnostics_result_bundle", app_key = "cohort-diagnostics", file = "cohort-diagnostics-results.sqlite", expected_variant = "CohortDiagnostics result database", required_nonempty_tables = c("database_meta_data", "cd_cohort", "cd_cohort_count")),
    list(loader_key = "characterization_result_bundle", app_key = "characterization", file = "characterization-results.sqlite", expected_variant = "Characterization time-to-event result database", required_nonempty_tables = c("database_meta_data", "c_time_to_event_targets", "c_time_to_event")),
    list(loader_key = "characterization_result_bundle", app_key = "characterization", file = "cohort-incidence-results.sqlite", expected_variant = "CohortIncidence result database", required_nonempty_tables = c("database_meta_data", "ci_incidence_rate")),
    list(loader_key = "phevaluator_result_bundle", app_key = "phevaluator", file = "phevaluator-results.sqlite", expected_variant = "PheValuator result database", required_nonempty_tables = c("database_meta_data", "pv_algorithm_performance_results", "pv_diagnostics")),
    list(loader_key = "ohdsi_report_bundle", app_key = "ohdsi-report", file = "ohdsi-report-results.sqlite", expected_variant = "OHDSI report PLP result database", required_nonempty_tables = c("database_meta_data", "plp_model_designs", "plp_performances")),
    list(loader_key = "ohdsi_report_bundle", app_key = "ohdsi-report", file = "ohdsi-sharing-results.sqlite", expected_variant = "OHDSI report CohortMethod result database", required_nonempty_tables = c("database_meta_data", "cm_analysis", "cm_result", "sharing_manifest"))
  )
)

jsonlite::write_json(catalog, file.path(golden_dir, "catalog.json"), pretty = TRUE, auto_unbox = TRUE)
message(sprintf("Generated %d managed Shiny golden result databases in %s.", length(catalog$databases), golden_dir))
