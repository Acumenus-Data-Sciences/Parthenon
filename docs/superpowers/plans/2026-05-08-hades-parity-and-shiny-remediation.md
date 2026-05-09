# HADES Parity and Managed OHDSI Shiny Remediation

Date: 2026-05-08

## Goal

Bring Parthenon to full HADES parity and above by tracking both package presence
and package freshness, routing Study Designer plans to the correct package-native
Darkstar endpoints, and replacing blanket Shiny suppression with a managed OHDSI
Shiny compatibility layer.

## Implemented in this pass

- Updated and verified Darkstar Docker pins for HADES packages that were stale
  or had to be canonicalized against upstream package metadata:
  - `CohortMethod` 6.0.2
  - `SelfControlledCaseSeries` 6.1.5
  - `Achilles` 1.7.2, after confirming `1.8` is not a valid upstream package
    version
  - `Keeper` 2.1.0
- Added target/latest version metadata to the HADES inventory contract.
- Added `version_status`, freshness counts, required-outdated counts, and HADES
  2026Q1 release-profile metadata.
- Added Laravel-side normalization so older Darkstar payloads still report
  freshness and managed Shiny policy correctly.
- Reclassified `OhdsiShinyAppBuilder` and `OhdsiShinyModules` as high-priority
  managed compatibility packages.
- Added an initial managed OHDSI Shiny app registry:
  - PatientLevelPrediction Results
  - CohortMethod, SCCS, and Evidence Synthesis Results
  - Cohort Diagnostics Explorer
  - Characterization and Incidence Results
  - PheValuator Results
  - OHDSI Report Viewer
- Updated System Health types and UI to show package freshness and managed Shiny
  compatibility.
- Corrected Study Designer analysis-plan endpoint metadata to use real Darkstar
  `/analysis/...` routes.
- Added Study Designer verifier warnings when a required HADES package is
  installed but behind the current target version.
- Updated deploy smoke parsing so stale required packages can warn by default or
  fail when `DEPLOY_HADES_REQUIRE_CURRENT=1`.
- Rebuilt and redeployed the Darkstar image; live `/hades/packages` reports
  `parity_status=ready`, `freshness_status=current`, `installed_count=40`,
  `outdated_count=0`, and `required_outdated_count=0`.
- Deployed the frontend with `./deploy.sh --frontend` and passed smoke checks
  for `/`, `/login`, and `/jobs`.

## Remaining implementation todo

- Add a scheduled upstream HADES version refresh job that opens a PR when target
  versions drift.
- Add a lockfile-mode check against the HADES-wide `2026Q1` `renv.lock`, distinct
  from latest-version mode.
- Add package-native TreatmentPatterns execution to saved pathway workflows,
  retaining the native PHP pathway engine as fallback and comparison.
- Expand package-native execution/imports for DataQualityDashboard, Achilles,
  Capr/CirceR, OhdsiReportGenerator, OhdsiSharing, CohortExplorer, Keeper,
  MethodEvaluation, EnsemblePatientLevelPrediction, and full PheValuator output.
- Expand Strategus module discovery and add a JSON/manual configuration fallback
  for modules without first-class React panels.
- Add Shiny runtime infrastructure:
  - ShinyProxy compose service for open-source deployments.
  - Posit Connect adapter settings for licensed deployments.
  - Apache/WebSocket proxy route for `/shiny/*`.
  - Short-lived Parthenon launch records with source/study/artifact permission
    checks.
  - Per-session working directories and result-bundle mounts.
- Add frontend launch surfaces from study artifacts, PLP/PLE/SCCS/Evidence
  Synthesis results, Cohort Diagnostics, Characterization, and PheValuator pages.
- Add golden Eunomia smoke tests for package-native endpoints and managed Shiny
  launch manifests.
- Add Playwright coverage for System Health freshness, managed Shiny viewer
  discovery, launch denial, and successful embedded launch.
- After frontend launch surfaces ship, deploy with `./deploy.sh --frontend` and
  smoke `/`, `/login`, `/jobs`, System Health, `/api/v1/hades/packages`, and at
  least one managed OHDSI Shiny viewer.
