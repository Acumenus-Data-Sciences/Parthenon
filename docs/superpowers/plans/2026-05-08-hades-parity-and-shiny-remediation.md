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
- Added a managed Shiny launch broker for study artifacts:
  - shared registry service for vetted OHDSI Shiny apps
  - artifact compatibility checks based on metadata, result type, and safe
    artifact-type fallbacks
  - short-lived signed launch envelopes for ShinyProxy/managed runtimes
  - no support for legacy `shiny_app_url` artifacts or user-supplied app paths
  - runtime-configuration reporting when `SHINY_PROXY_BASE_URL` is not set
- Added the first frontend launch surface in Study Artifacts: eligible OHDSI
  result artifacts now expose an embedded managed Shiny viewer panel or the
  runtime setup gap.
- Added the managed Shiny runtime foundation:
  - ShinyProxy 3.2.4 compose service with Docker internal networking
  - configurable `SHINY_PROXY_DOCKER_GID` so the non-root ShinyProxy process can
    access `/var/run/docker.sock` without running the service as root
  - `/shiny/*` nginx WebSocket proxy route
  - public Apache `/shiny/` HTTP and WebSocket reverse proxy on
    `parthenon.acumenus.net`
  - `parthenon-shiny-ohdsi` app image scaffold backed by the HADES/Darkstar R
    runtime
  - shared `parthenon_shiny_workspaces` volume for per-launch context and
    materialized artifacts
  - public signed-token context resolver for Shiny app containers at
    `/api/v1/shiny/launch-context`
  - ShinyProxy app specs aligned to the vetted Parthenon managed app registry
  - live browser smoke verified public ShinyProxy launch behavior: direct
    `plp-results` access blocks without a Parthenon launch token, and a real
    `ohdsi-report` launch token renders the study artifact context plus installed
    OHDSI Shiny packages

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
- Expand Shiny runtime infrastructure:
  - Posit Connect adapter settings for licensed deployments.
  - Optional persisted launch audit records for source/study/artifact permission
    checks; the initial broker currently issues signed stateless launch tokens.
  - Result-bundle specific loaders inside the managed Shiny app image for PLP,
    PLE/SCCS/Evidence Synthesis, CohortDiagnostics, Characterization,
    PheValuator, and OHDSI report bundles.
- Add frontend launch surfaces from PLP/PLE/SCCS/Evidence Synthesis results,
  Cohort Diagnostics, Characterization, and PheValuator pages.
- Add golden Eunomia smoke tests for package-native endpoints and managed Shiny
  launch manifests.
- Add Playwright coverage for System Health freshness, managed Shiny viewer
  discovery, launch denial, and successful embedded launch.
- After frontend launch surfaces ship, deploy with `./deploy.sh --frontend` and
  smoke `/`, `/login`, `/jobs`, System Health, `/api/v1/hades/packages`, and at
  least one managed OHDSI Shiny viewer.
