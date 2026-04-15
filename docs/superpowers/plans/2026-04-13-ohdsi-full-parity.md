# OHDSI Full Parity TODO

Date: 2026-04-13

## Goal

Bring Parthenon to full practical parity with the OHDSI capabilities surfaced in the `OurJourney` open-source software section, while keeping Parthenon's native React/Laravel/Darkstar architecture as the default product surface.

Parity means four things:

1. Runtime parity: Darkstar can report which OHDSI/HADES packages are installed, missing, and first-class in Parthenon.
2. API parity: Laravel has stable endpoints for capabilities users can run or inspect.
3. UI parity: React exposes supported analysis capabilities in the relevant workflows.
4. Artifact parity: imported/exported studies, reports, definitions, and result bundles can move between Parthenon and OHDSI tools when the package semantics matter.

## Current Coverage

- Achilles/Ares/DQD: Native Parthenon engines and source data explorer APIs exist.
- Cohort definitions and Circe: Cohort builder, SQL preview, Circe compile/render/validate, Atlas migration, and WebAPI registry exist.
- HADES analysis: CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries, EvidenceSynthesis, CohortGenerator, CohortDiagnostics, CohortIncidence, Characterization, DataQualityDashboard, DeepPatientLevelPrediction, and Strategus are installed in Darkstar.
- Strategus: Darkstar exposes 8 Strategus-compatible modules and the frontend has module configuration panels for those modules.
- Phenotype Library: Parthenon syncs/browses/imports OHDSI PhenotypeLibrary entries and Darkstar now installs the R package.
- Publish: Parthenon has a native publish/export flow, and Darkstar now installs OHDSI `OhdsiReportGenerator` and `OhdsiSharing` for artifact compatibility work.

## Runtime Package Gap

Darkstar currently has all 40 checked OHDSI packages installed after the parity runtime rebuild.

Missing packages:

- None.

Newly installed packages in the parity layer:

- `Achilles` 1.7.2
- `BigKnn` 1.0.2 (R package name for BigKNN)
- `BrokenAdaptiveRidge` 1.0.2
- `Capr` 2.1.1
- `CirceR` 1.3.3
- `CohortExplorer` 0.1.0
- `EnsemblePatientLevelPrediction` 1.0.3
- `IterativeHardThresholding` 1.0.3
- `MethodEvaluation` 2.4.0
- `OhdsiReportGenerator` 2.1.0
- `OhdsiSharing` 0.2.2
- `OhdsiShinyAppBuilder` 1.0.0
- `OhdsiShinyModules` 3.5.0
- `PhenotypeLibrary` 3.37.0
- `PheValuator` 2.2.16
- `SelfControlledCohort` 1.6.0
- `TreatmentPatterns` 3.1.2

Newly installed package in the KEEPER compatibility layer:

- `Keeper` 2.0.0, reported as `KEEPER` in the capability matrix to match the OSS section naming.

## Implementation Tracks

### Track 1: Capability Inventory

- [x] Audit Darkstar packages from inside the running container.
- [x] Map existing Parthenon API/UI coverage against the OHDSI package list.
- [x] Add a Darkstar `/hades/packages` endpoint that reports installed/missing packages, versions, product surface, and priority.
- [x] Add a Laravel `/api/v1/hades/packages` proxy endpoint.
- [x] Add an admin/system UI panel that shows the package matrix and links each gap to its backlog item.
- [ ] Add a deploy/smoke check that fails loudly when required first-class packages disappear.

### Track 2: PLP and Prediction Parity

- [x] Confirm Darkstar already supports `transformer`, `resnet`, and `deep_mlp` through `DeepPatientLevelPrediction`.
- [x] Expose those Deep PLP model types in the Prediction designer.
- [x] Update Laravel prediction validation so Deep PLP model specs can be saved.
- [x] Add `EnsemblePatientLevelPrediction` to the runtime image.
- [ ] Add ensemble model settings and result metadata to the Prediction API/UI.
- [x] Install `BigKNN`, `BrokenAdaptiveRidge`, and `IterativeHardThresholding` as advanced-method runtime dependencies.
- [ ] Decide whether `BigKNN`, `BrokenAdaptiveRidge`, and `IterativeHardThresholding` should be exposed as direct user choices.

### Track 3: Treatment Pathway Parity

- [x] Confirm Parthenon has a native pathway API/UI.
- [x] Add `TreatmentPatterns` to Darkstar.
- [x] Add Darkstar endpoint for package-native TreatmentPatterns execution.
- [x] Add Laravel controller/job/result normalization for TreatmentPatterns.
- [x] Extend the Pathway designer with TreatmentPatterns settings: era collapse, combination window, minimum cell count, max pathway length, and package execution controls.
- [x] Extend pathway results with TreatmentPatterns provenance and package-normalized pathway table metadata.
- [x] Add first-class download endpoints for package-native TreatmentPatterns artifact bundles.
- [x] Add richer Sankey/table drilldowns for TreatmentPatterns step-level event cohorts and suppressed small-cell rows.

### Track 4: Self-Controlled Methods

- [x] Confirm SCCS exists.
- [x] Add `SelfControlledCohort` to Darkstar.
- [x] Add API and UI as a sibling to SCCS, not as a hidden SCCS mode, unless the method semantics prove identical enough to share a designer.
- [x] Add result normalization, execution history, and tests.

### Track 5: Phenotype Validation and Review

- [x] Confirm CohortDiagnostics exists.
- [x] Confirm Parthenon has patient profile and cohort patient list surfaces.
- [x] Add `PheValuator` to Darkstar.
- [x] Add PheValuator job/API, phenotype validation result storage, and a phenotype validation dashboard.
- [x] Add Parthenon-native phenotype adjudication review sessions, patient context, reviewer notes, audit events, and metric computation from labels.
- [x] Add Phase 5B hardening: reproducible seeded sampling, balanced-demographics sampling metadata, review lifecycle states, locked-session guardrails, and evidence export.
- [x] Add Phase 5C review quality: multi-reviewer records, conflict detection/resolution, agreement summary, pairwise agreement, and kappa reporting.
- [x] Add Phase 5D promotion governance: validated-tier promotion records, approval notes, evidence snapshots, PheValuator-result requirements, and validated-tier guardrails.
- [x] Add `KEEPER` if we want package-native phenotype review workflow.
- [x] Add `CohortExplorer` if we want package-native cohort exploration artifacts or Shiny-compatible outputs.
- [x] Decide whether patient profile review should remain Parthenon-native or expose KEEPER/CohortExplorer package outputs.

### Track 6: Cohort Authoring Package Parity

- [x] Confirm Parthenon has Circe compile/render/validate through the current Circe service.
- [x] Add `Capr` if users need R DSL import/export or programmatic cohort authoring.
- [x] Add `CirceR` if users need R package-native Circe workflows.
- [x] Add API for CAPR/CirceR artifact import/export, while keeping the current React cohort builder as the primary editor.
- [x] Persist import/export audit records in `cohort_authoring_artifacts`.
- [x] Expose R package, CirceR script, Capr handoff script, Circe JSON, and ATLAS JSON import/export in the cohort builder Circe panel.

### Track 7: Reporting and Sharing

- [x] Confirm Parthenon has native publish/export.
- [x] Add `OhdsiReportGenerator` if OHDSI report artifact compatibility is required.
- [x] Add `OhdsiSharing` if OHDSI result-sharing/distributed package workflows are required.
- [x] Add report bundle import/export APIs for OHDSI package outputs.
- [x] Persist import/export audit records in `publication_report_bundles`.
- [x] Extend Publish UI with OHDSI report generator/export choices.
- [x] Add Publish import flow for OHDSI report bundles, OHDSI sharing bundles, and ReportGenerator R handoff scripts.

### Track 8: Native vs Legacy Shiny

- [x] Install `OhdsiShinyAppBuilder` and `OhdsiShinyModules` for optional legacy Shiny artifact compatibility.
- [x] Decide whether `OhdsiShinyAppBuilder` and `OhdsiShinyModules` should be exposed as managed hosted surfaces: no hosted Shiny surfaces.
- [x] Do not add a managed Shiny artifact hosting path; Parthenon must supersede Shiny workflows with native React/Laravel/Darkstar surfaces.
- [x] Document them as intentionally replaced by Parthenon's native React surfaces in `docs/superpowers/specs/2026-04-15-ohdsi-shiny-supersession-policy.md`.
- [x] Encode the no-hosting Shiny policy in Darkstar and Laravel HADES capability metadata.
- [x] Remove legacy Shiny URL artifacts from study artifact API/UI exposure.

### Track 9: Runtime Build Strategy

- [x] Split package installs in `docker/r/Dockerfile` into stable cacheable layers.
- [x] Add a pinned OHDSI parity package install layer for missing runtime packages.
- [x] Add package install verification for the new OHDSI parity package layer.
- [x] Prefer pinned GitHub tags or known-good R-universe versions.
- [x] Rebuild Darkstar after each package cluster, not after all missing packages at once, by splitting parity installs into independent Docker cache checkpoints.
- [x] Record package version, install source, and reason for inclusion in the capability endpoint.
- [x] Add deploy smoke check that fails when required first-class HADES packages disappear.

## Priority Order

1. Capability inventory endpoint and Laravel proxy.
2. Expose already-supported Deep PLP models in UI/API.
3. TreatmentPatterns package-native execution.
4. SelfControlledCohort.
5. PheValuator plus phenotype validation UI.
6. Ensemble model API/UI using `EnsemblePatientLevelPrediction`.
7. Report/sharing package parity.
8. CAPR/CirceR import/export. Completed in Track 6; remaining package parity should focus on Track 7 reporting/sharing and Track 9 runtime hardening.
9. Runtime build hardening and deploy smoke checks. Shiny hosting is intentionally not a product path.
