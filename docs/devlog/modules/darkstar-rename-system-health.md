# Darkstar Rename & Package Version Display in System Health

**Date:** 2026-03-26
**Status:** Complete

## Summary

Renamed the R Analytics Runtime service to "Darkstar" across the System Health admin panels and expanded the service detail page to display all installed OHDSI HADES and Posit/CRAN package versions with their version numbers.

## Changes

### Backend (`SystemHealthController.php`)
- Service key changed from `r` to `darkstar` (matches Docker service name)
- Display name changed from "R Analytics Runtime" to "Darkstar"
- Health card message now shows R version and HADES package count (e.g., "R 4.4.2, 20 HADES packages loaded")
- `getRMetrics()` replaced with `getDarkstarMetrics()` — returns structured package version groups plus runtime diagnostics (memory, JVM, JDBC status)
- Log keyword matcher updated for `darkstar` key

### R Health Endpoint (`darkstar/api/health.R`)
- Service identifier changed from `parthenon-r-runtime` to `darkstar`
- Version bumped from `0.2.0` to `0.3.0`
- Now returns `packages.ohdsi` (20 HADES packages) and `packages.posit` (12 infrastructure packages) with installed versions
- Uses `utils::packageVersion()` with error handling for each package

### Frontend (`ServiceDetailPage.tsx`)
- New `DarkstarPackagesPanel` component renders OHDSI and Posit package grids
- Each group shows package count and a 4-column grid of name + version pairs
- Package groups excluded from generic nested metrics renderer to avoid duplication
- Flat metrics (R version, uptime, memory, JVM/JDBC) still display in standard Metrics section

## Package Groups Displayed

**OHDSI HADES (20 packages):**
SqlRender, DatabaseConnector, Andromeda, Cyclops, FeatureExtraction, ResultModelManager, EmpiricalCalibration, ParallelLogger, CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries, EvidenceSynthesis, CohortGenerator, CohortDiagnostics, DeepPatientLevelPrediction, CohortIncidence, Characterization, Strategus, ETLSyntheaBuilder, DataQualityDashboard

**Posit / CRAN (12 packages):**
plumber2, mirai, nanonext, jsonlite, DBI, RPostgres, httr2, callr, processx, rJava, duckdb, remotes
