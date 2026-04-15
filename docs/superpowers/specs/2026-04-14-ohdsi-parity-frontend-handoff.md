# OHDSI Parity+ Frontend and API Handoff

Date: 2026-04-14
Primary plan: `docs/superpowers/plans/2026-04-13-ohdsi-full-parity.md`

## Goal

Complete the remaining OHDSI Parity+ product work by exposing installed OHDSI/HADES capabilities through Parthenon's existing native workflows.

This is not a request to create a new top-level "OHDSI" frontend area. The strongest product fit is capability-local integration:

- TreatmentPatterns belongs in Pathways.
- EnsemblePatientLevelPrediction and advanced PLP models belong in Prediction.
- SelfControlledCohort belongs near SCCS as a sibling workflow if method semantics diverge.
- PheValuator, KEEPER, and CohortExplorer-style review belong in Cohort Definitions, Phenotype Library, and patient review surfaces.
- CAPR/CirceR belongs in Cohort Definitions as artifact import/export.
- OhdsiReportGenerator and OhdsiSharing belong in Publish.
- Runtime package inventory belongs in Admin System Health.
- Shiny compatibility, if needed, should be an artifact viewer launched from results, not the primary workflow.

The dedicated implementation agent should preserve Parthenon's native React/Laravel/Darkstar architecture and avoid making users think in package names unless the package name is necessary for export compatibility.

## Current Verified State

Runtime parity exists:

- Darkstar has all checked OHDSI packages installed.
- `GET http://localhost:8787/hades/packages` returned `status=complete`, `total=40`, `installed_count=40`, `missing_count=0` during the prior parity pass.
- Laravel proxies the package inventory at `/api/v1/hades/packages`.
- Admin System Health already includes an OHDSI/HADES package matrix.
- Deep PLP model choices are already exposed in Prediction for `transformer`, `resnet`, and `deep_mlp`.
- The frontend was deployed with `./deploy.sh --frontend` after prior changes.

Relevant files from the prior pass:

- Darkstar capability inventory: `darkstar/api/hades_packages.R`
- Darkstar route mount: `darkstar/plumber_api.R`
- Laravel capability proxy: `backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php`
- Laravel routes: `backend/routes/api.php`
- Admin UI inventory: `frontend/src/features/administration/pages/SystemHealthPage.tsx`
- Admin API hook/types: `frontend/src/features/administration/hooks/useAiProviders.ts`
- Backend tests: `backend/tests/Feature/Api/V1/HadesCapabilityTest.php`
- Runtime image: `docker/r/Dockerfile`

## Repository Rules

Use these rules throughout the work:

- Do not use `npm run build` as the shipped frontend deploy path. This repo's frontend deployment path is `./deploy.sh --frontend`.
- Use existing feature modules instead of adding a broad `/ohdsi` area.
- Use existing TanStack Query and `apiClient` patterns.
- Use existing analysis execution patterns with `AnalysisExecution`, Laravel jobs, and Darkstar Plumber endpoints.
- Use existing route permission groups in `backend/routes/api.php`: `analyses.view`, `analyses.create`, `analyses.run`, and relevant cohort/publish permissions.
- Do not revert unrelated worktree changes.
- Add tests at the API boundary and type/lint gates for frontend edits.

## Product Placement

### Pathways

Primary location:

- `frontend/src/features/pathways/components/PathwayDesigner.tsx`
- `frontend/src/features/pathways/pages/PathwayDetailPage.tsx`
- `frontend/src/features/pathways/components/SankeyDiagram.tsx`
- `frontend/src/features/pathways/components/PathwayTable.tsx`
- `frontend/src/features/pathways/api/pathwayApi.ts`
- `frontend/src/features/pathways/hooks/usePathways.ts`
- `frontend/src/features/pathways/types/pathway.ts`

Backend/Darkstar:

- `backend/app/Http/Controllers/Api/V1/PathwayController.php`
- `backend/app/Jobs/Analysis/RunPathwayJob.php`
- `backend/app/Models/App/PathwayAnalysis.php`
- `backend/routes/api.php`
- Add or extend a Darkstar endpoint under `darkstar/api/`, likely a new TreatmentPatterns endpoint rather than overloading unrelated native logic.

Recommendation:

- Keep the route `/analyses/pathways/:id`.
- Add an explicit engine or result metadata field such as `engine: "native" | "treatment_patterns"` in design and/or execution result payloads.
- Default new advanced package-native settings to TreatmentPatterns-compatible values without disrupting older saved designs.
- Avoid a separate `/analyses/treatment-patterns` route unless stakeholders explicitly want package-branded workflows.

### Prediction

Primary location:

- `frontend/src/features/prediction/components/PredictionDesigner.tsx`
- `frontend/src/features/prediction/pages/PredictionDetailPage.tsx`
- `frontend/src/features/prediction/components/PredictionResults.tsx`
- `frontend/src/features/prediction/api/predictionApi.ts`
- `frontend/src/features/prediction/hooks/usePredictions.ts`
- `frontend/src/features/prediction/types/prediction.ts`

Backend/Darkstar:

- `backend/app/Http/Controllers/Api/V1/PredictionController.php`
- `backend/app/Jobs/Analysis/RunPredictionJob.php`
- `backend/app/Support/PredictionResultNormalizer.php`
- `backend/routes/api.php`
- `darkstar/api/prediction.R`

Recommendation:

- Extend the existing model configuration surface for ensemble PLP.
- Treat `BigKNN`, `BrokenAdaptiveRidge`, and `IterativeHardThresholding` as advanced options only if Darkstar can build valid PatientLevelPrediction settings for them and result interpretation is clear.
- Prefer a grouped UI model selector:
  - Standard models: current PLP models.
  - Deep models: Transformer, ResNet, Deep MLP.
  - Ensemble models: EnsemblePatientLevelPrediction configuration.
  - Advanced methods: BigKNN, BrokenAdaptiveRidge, IterativeHardThresholding if enabled.

### SCCS and SelfControlledCohort

Primary existing location:

- `frontend/src/features/sccs/components/SccsDesigner.tsx`
- `frontend/src/features/sccs/pages/SccsDetailPage.tsx`
- `frontend/src/features/sccs/components/SccsResults.tsx`
- `frontend/src/features/sccs/api/sccsApi.ts`
- `frontend/src/features/sccs/hooks/useSccs.ts`
- `frontend/src/features/sccs/types/sccs.ts`

Backend/Darkstar:

- `backend/app/Http/Controllers/Api/V1/SccsController.php`
- `backend/app/Jobs/Analysis/RunSccsJob.php`
- `backend/app/Support/SccsResultNormalizer.php`
- `backend/routes/api.php`
- `darkstar/api/sccs.R`

Recommendation:

- Do not hide SelfControlledCohort behind SCCS unless the method semantics are close enough for the same designer and result vocabulary.
- Preferred default if semantics diverge: create a sibling feature `frontend/src/features/self-controlled-cohort` and sibling route `/analyses/self-controlled-cohorts/:id`.
- Add sidebar/help/study integration only after the route is first-class and tested.
- Reuse SCCS components only where the language and result shapes remain correct.

### Cohort Definitions, Phenotype Library, and Patient Review

Primary location:

- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- `frontend/src/features/cohort-definitions/components/CohortDiagnosticsPanel.tsx`
- `frontend/src/features/cohort-definitions/api/cohortApi.ts`
- `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`
- `frontend/src/features/phenotype-library/pages/PhenotypeLibraryPage.tsx`
- `frontend/src/features/phenotype-library/api.ts`
- `frontend/src/features/profiles/*` for patient-level review if needed.

Backend/Darkstar:

- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- `backend/app/Http/Controllers/Api/V1/CohortDiagnosticsController.php`
- Consider a new controller such as `PhenotypeValidationController`.
- Add a Darkstar endpoint for `PheValuator`.
- Add storage for validation jobs/results if existing execution tables do not fit cohort-level validation outputs cleanly.

Recommendation:

- Add a "Validation" tab or panel to cohort detail, near diagnostics and generation history.
- Add entry points from Phenotype Library imported phenotypes to run/view validation.
- Keep patient-level review native unless KEEPER or CohortExplorer outputs are explicitly required.
- Do not put PheValuator in Admin. It is a cohort quality/review workflow, not an operational health concern.

### CAPR and CirceR

Primary location:

- `frontend/src/features/cohort-definitions/components/ImportCohortModal.tsx`
- `frontend/src/features/cohort-definitions/components/CreateFromBundleModal.tsx`
- `frontend/src/features/cohort-definitions/components/CirceSqlPanel.tsx`
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- `frontend/src/features/cohort-definitions/api/cohortApi.ts`

Backend/Darkstar:

- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- Existing export/import methods in `CohortDefinitionController` should be extended if possible.
- Add Darkstar endpoints for package-native CAPR/CirceR conversion only where the Laravel/Circe service cannot already provide equivalent output.

Recommendation:

- Keep the React cohort builder as the primary editor.
- Add artifact import/export actions:
  - Export ATLAS/Circe JSON.
  - Export SQL.
  - Export CAPR R DSL if package-native output is needed.
  - Import CAPR/CirceR artifacts only after validating they can be round-tripped into the builder's expression model.
- Do not add CAPR as a separate nav destination.

### Publish

Primary location:

- `frontend/src/features/publish/pages/PublishPage.tsx`
- `frontend/src/features/publish/api/publishApi.ts`
- `frontend/src/features/publish/hooks/useDocumentExport.ts`
- `frontend/src/features/publish/components/ExportControls.tsx`
- `frontend/src/features/publish/components/ExportPanel.tsx`
- `frontend/src/features/publish/components/DocumentConfigurator.tsx`
- `frontend/src/features/publish/types/publish.ts`
- Existing template `frontend/src/features/publish/templates/generic-ohdsi.ts`

Backend/Darkstar:

- Search current publish controller/service structure before editing. Route usage exists through `/publish/narrative` and `/publish/export`.
- Add report bundle import/export endpoints only where native export does not already cover the output.
- Add Darkstar endpoints for OhdsiReportGenerator/OhdsiSharing when package-native artifacts are required.

Recommendation:

- Extend Publish export choices with explicit OHDSI report/export choices.
- Preserve the current native document generator as the default.
- Add OHDSI package-native export only as an advanced compatibility format.
- Include result bundle provenance in exported metadata: package name, package version, Darkstar endpoint, source id, execution id, timestamp.

### Admin System Health

Primary location:

- `frontend/src/features/administration/pages/SystemHealthPage.tsx`
- `frontend/src/features/administration/hooks/useAiProviders.ts`
- `backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php`
- `darkstar/api/hades_packages.R`

Recommendation:

- Keep runtime capability inventory here only.
- Add deploy/smoke failure signals for missing required packages.
- Add package install source and reason metadata to the capability endpoint if it is not already present for every package.
- Do not add workflow launchers here except links to product surfaces if they exist.

### Study and Investigation Integration

Secondary integration after first-class features are done:

- `frontend/src/features/studies/components/StudyAnalysesTab.tsx`
- `frontend/src/features/studies/types/study.ts`
- `frontend/src/features/investigation/components/clinical/*`
- `frontend/src/features/investigation/clinicalRegistry.ts`

Recommendation:

- Do not start here.
- Once each workflow has stable API/UI, add it to study composition and investigation clinical analysis launchers.
- This prevents study/investigation from becoming a dumping ground for half-implemented analysis types.

## Implementation Tracks

### Track 0: Baseline and Guardrails

Tasks:

- Run `git status --short` and identify unrelated worktree changes before editing.
- Read `docs/superpowers/plans/2026-04-13-ohdsi-full-parity.md`.
- Verify package inventory still works:
  - `curl -s http://localhost:8787/hades/packages | jq '{status,total,installed:.installed_count,missing:.missing_count}'`
  - `cd backend && php artisan test tests/Feature/Api/V1/HadesCapabilityTest.php`
- Confirm route prefixes through `frontend/src/lib/api-client.ts` before adding client calls.

Acceptance:

- Existing package inventory still reports complete or the agent documents exactly which package disappeared and why.
- No implementation starts by creating a new top-level OHDSI nav area.

### Track 1: TreatmentPatterns in Pathways

Outcome:

Users can configure and execute package-native TreatmentPatterns from the existing Pathway Analysis workflow and inspect/export package-native results.

Frontend tasks:

- Extend `PathwayDesign` in `frontend/src/features/pathways/types/pathway.ts` with a backward-compatible settings object. Suggested shape:

```ts
export type PathwayEngine = "native" | "treatment_patterns";

export interface TreatmentPatternsSettings {
  eraCollapseWindowDays: number;
  combinationWindowDays: number;
  minCellCount: number;
  maxPathLength: number;
  eventOrdering: "start_date" | "first_observed" | "era_start";
  includeNoEventPath?: boolean;
  exportPackageArtifacts?: boolean;
}
```

- Add controls in `PathwayDesigner.tsx`:
  - Engine selector or advanced toggle.
  - Era collapse window.
  - Combination window.
  - Minimum cell count.
  - Max pathway length.
  - Event ordering.
  - Optional package artifact export.
- Keep defaults equivalent to current behavior where possible.
- Extend `PathwayDetailPage.tsx` to show:
  - Engine used.
  - Package and package version if the execution used TreatmentPatterns.
  - Artifact download links when returned by the backend.
  - Drilldown table by path step, cohort/event label, subject count, percent, and suppressed/small-cell status.
- Extend `PathwayTable.tsx` and/or add a dedicated component for package-native pathway rows if the result shape differs materially.

Backend tasks:

- Add backend validation in `PathwayController` for the new design fields.
- Decide whether the existing `PathwayAnalysis` table can store the design and all result metadata in JSON, or whether a dedicated artifact table is needed.
- Update `RunPathwayJob` to pass engine-specific settings to Darkstar.
- Add/extend result normalization so the frontend receives a stable shape even if TreatmentPatterns output changes.

Darkstar tasks:

- Add a new Plumber endpoint for TreatmentPatterns package-native execution.
- Inputs should include source connection details, target cohort id, event cohort ids, cohort schema/table, min cell count, combination window, era collapse window, max path length, and event ordering.
- Output should include:
  - `engine: "treatment_patterns"`
  - package name and version.
  - summary counts.
  - normalized pathway rows.
  - optional artifact paths or identifiers.
  - suppression flags for small cells.

Tests:

- Backend feature test for create/update validation with TreatmentPatterns settings.
- Backend feature or job test that verifies the execution request payload includes TreatmentPatterns settings.
- Frontend typecheck and targeted lint.
- If adding chart behavior, add a small component test if the repo already uses one for feature components.

Acceptance:

- Existing saved Pathway analyses still render.
- New TreatmentPatterns settings can be saved.
- Executing a TreatmentPatterns-backed pathway queues successfully.
- Result UI displays engine/package provenance and normalized pathway rows.

### Track 2: Ensemble PLP and Advanced Prediction

Outcome:

Prediction supports ensemble PLP configuration and result metadata while preserving existing PLP and Deep PLP workflows.

Frontend tasks:

- Extend `PredictionModelType` in `frontend/src/features/prediction/types/prediction.ts`:
  - Add `ensemble`.
  - Add `bigknn`, `broken_adaptive_ridge`, `iterative_hard_thresholding` only if they will be directly selectable.
- Extend `PredictionDesign.model` to support:
  - base learners for ensemble.
  - ensemble strategy/voting or package-supported ensemble configuration.
  - optional per-base-learner hyperparameters.
- Update `PredictionDesigner.tsx`:
  - Group model options by standard, deep, ensemble, and advanced.
  - Render ensemble settings only when `model.type === "ensemble"`.
  - Render advanced method settings only when supported by Darkstar.
  - Add explanatory copy as labels only; do not add promotional text.
- Update `PredictionResults.tsx` and `PredictionDetailPage.tsx`:
  - Display model family, base learner list, package versions, and ensemble performance metadata.
  - Keep existing charts working for normal PLP results.

Backend tasks:

- Update `PredictionController` validation for ensemble and advanced model settings.
- Update `RunPredictionJob` to send ensemble settings to Darkstar.
- Update `PredictionResultNormalizer` to surface:
  - model family.
  - package version.
  - base learners.
  - per-learner performance if returned.
  - selected ensemble method.
- Keep old result JSON compatible.

Darkstar tasks:

- Extend `darkstar/api/prediction.R` to construct valid EnsemblePatientLevelPrediction settings.
- Add direct advanced model settings only if the package APIs are present and stable in the installed versions.
- Return explicit fallback warnings if an advanced model request cannot be honored. Do not silently run a different model unless the response marks it.

Tests:

- Backend validation tests for `ensemble`.
- Unit/feature test for result normalizer with ensemble metadata.
- Frontend typecheck and targeted lint.

Acceptance:

- Existing prediction designs still save and execute.
- Ensemble designs save, execute, and show provenance in results.
- Unsupported advanced model selection is either hidden or rejected with a clear validation error.

### Track 3: SelfControlledCohort Near SCCS

Outcome:

SelfControlledCohort is exposed as a first-class workflow only if its semantics justify a sibling to SCCS.

Decision point:

- First inspect SelfControlledCohort input/output semantics and compare to the existing SCCS designer.
- If the fields are mostly identical and result interpretation is identical, add a method mode to SCCS.
- If there are material differences, create a sibling feature. This is the expected default.

Sibling feature path if needed:

- `frontend/src/features/self-controlled-cohort/api/selfControlledCohortApi.ts`
- `frontend/src/features/self-controlled-cohort/hooks/useSelfControlledCohorts.ts`
- `frontend/src/features/self-controlled-cohort/types/selfControlledCohort.ts`
- `frontend/src/features/self-controlled-cohort/components/SelfControlledCohortDesigner.tsx`
- `frontend/src/features/self-controlled-cohort/components/SelfControlledCohortResults.tsx`
- `frontend/src/features/self-controlled-cohort/pages/SelfControlledCohortDetailPage.tsx`

Routing/nav:

- Add route in `frontend/src/app/router.tsx`: `/analyses/self-controlled-cohorts/:id`
- Add nav/help key near SCCS only when the route is usable.
- Add backend routes beside SCCS in `backend/routes/api.php` using the same permission groups.

Backend tasks:

- Add model/controller/job/result normalizer if sibling route is used.
- Reuse `AnalysisExecution` conventions.
- Add `JobController` and `StudyController` mappings if the new analysis type should appear in jobs and studies.

Darkstar tasks:

- Add a SelfControlledCohort Plumber endpoint.
- Return normalized estimates, confidence intervals, population counts, time windows, and package provenance.

Tests:

- Backend CRUD/execution route tests.
- Result normalizer tests.
- Frontend typecheck and targeted lint.

Acceptance:

- SelfControlledCohort is not conflated with SCCS unless that is technically defensible.
- Execution history and result display match existing analysis conventions.

### Track 4: PheValuator and Phenotype Review

Outcome:

Cohort definitions and imported phenotype library entries can run phenotype validation and show validation results.

Frontend tasks:

- Add a validation panel/tab to `CohortDefinitionDetailPage.tsx`, likely near diagnostics.
- Reuse or extend `CohortDiagnosticsPanel.tsx` where it helps, but do not blur diagnostics and validation if result semantics differ.
- Add API functions in `cohortApi.ts`:
  - start validation for a cohort definition.
  - list validation runs.
  - fetch validation result.
- Add links/actions from `PhenotypeLibraryPage.tsx` for imported phenotypes:
  - "View cohort definition" if imported.
  - "Run validation" if there is a backing cohort definition.
- If patient review is needed, use existing `features/profiles` surfaces and link patients from validation/review outputs.

Backend tasks:

- Add a controller such as `PhenotypeValidationController` or extend `CohortDefinitionController` with clear route names:
  - `POST /cohort-definitions/{cohortDefinition}/phevaluator`
  - `GET /cohort-definitions/{cohortDefinition}/phevaluator`
  - `GET /cohort-definitions/{cohortDefinition}/phevaluator/{run}`
- Add storage for validation run metadata and result JSON if current execution storage cannot represent this cleanly.
- Include source id, cohort definition id, package version, status, timestamps, and artifact references.

Darkstar tasks:

- Add PheValuator endpoint.
- Normalize output to stable metrics and artifact refs.
- Return package version and warnings.

Acceptance:

- A cohort detail page can launch validation and show results.
- Phenotype Library imported phenotypes have a path into validation.
- Patient-level review, if included, uses native profiles rather than launching separate package UI by default.

### Track 5: CAPR/CirceR Artifact Import/Export

Outcome:

Cohort authors can import/export OHDSI-compatible cohort artifacts without leaving Cohort Definitions.

Frontend tasks:

- Extend `ImportCohortModal.tsx` and/or `CreateFromBundleModal.tsx` for artifact types.
- Add export actions in `CohortDefinitionDetailPage.tsx`.
- Show validation status for imported artifacts:
  - parsed successfully.
  - converted to builder expression.
  - SQL preview generated.
  - warnings/lossy conversion notes.

Backend tasks:

- Extend `CohortDefinitionController::import` and `export` if appropriate.
- Add explicit route methods if import/export semantics become too broad:
  - `POST /cohort-definitions/import/capr`
  - `GET /cohort-definitions/{cohortDefinition}/export/capr`
  - `GET /cohort-definitions/{cohortDefinition}/export/circer`
- Validate uploaded/imported artifacts strictly.
- Persist original artifact when needed for round-trip provenance.

Darkstar tasks:

- Add CAPR/CirceR conversion endpoint only where existing Laravel/Circe cannot produce the same output.

Acceptance:

- Existing import/export still works.
- CAPR/CirceR artifacts can be imported/exported or, if full round-trip is not technically safe, the UI explains the unsupported conversion path in product language.

### Track 6: OHDSI Report and Sharing in Publish

Outcome:

Publish supports OHDSI package-compatible report/share artifacts while keeping native document export as the default.

Frontend tasks:

- Extend `ExportFormat` or add an export option model in `publish.ts` for OHDSI package-native outputs.
- Update `ExportControls.tsx` and `ExportPanel.tsx` with:
  - native document formats.
  - figure/table exports.
  - OHDSI report bundle export.
  - OHDSI sharing package export.
- Keep current document generator flow intact.
- Add progress/status handling if the OHDSI export is asynchronous.

Backend tasks:

- Add publish routes for OHDSI package export if existing `/publish/export` cannot represent the request cleanly:
  - `POST /publish/ohdsi-report`
  - `POST /publish/ohdsi-sharing`
  - `GET /publish/exports/{id}`
- Reuse existing study/analysis selection payloads where possible.
- Include provenance metadata in artifact bundles.

Darkstar tasks:

- Add OhdsiReportGenerator/OhdsiSharing endpoint(s).
- Validate that artifact bundle paths are not path-traversable.
- Return stable artifact ids, not arbitrary host file paths.

Acceptance:

- Native export remains the default path.
- OHDSI package-native export can be requested for selected study/analysis artifacts.
- Exported bundles include provenance.

### Track 7: Optional Shiny Artifact Viewer

Outcome:

If Shiny compatibility is required, it is treated as an isolated artifact viewer, not the main Parthenon workflow.

Decision point:

- If users only need parity claims, document Shiny packages as runtime compatibility dependencies replaced by native React surfaces.
- If users need to open package-generated Shiny artifacts, build a managed viewer with explicit isolation.

Implementation if required:

- Add backend artifact session endpoint that issues time-limited viewer URLs.
- Add frontend launch button on the relevant result page, not global nav.
- Consider sandboxed iframe only with strict origin and content controls.
- Do not allow arbitrary Shiny app paths from user input.

Acceptance:

- Either there is clear documentation that native React replaces Shiny UI, or there is a secure, isolated artifact viewer.

### Track 8: Runtime Inventory Hardening

Outcome:

Capability inventory remains accurate and fails loudly when required runtime packages disappear.

Tasks:

- Extend `darkstar/api/hades_packages.R` to include install source and reason metadata for every package if missing.
- Add a smoke check script or test that validates all required first-class packages are present.
- Wire the smoke check into the existing deployment/test path that is most appropriate for Darkstar.
- Keep Admin System Health read-only for inventory and status.

Acceptance:

- A missing first-class package causes a clear smoke/test failure.
- Admin inventory shows package version, first-class status, product surface, source, and reason.

## API Contract Guidance

Prefer extending existing resource contracts instead of adding package-branded endpoints to the frontend.

Suggested frontend API posture:

- Pathways still call `/pathways`, `/pathways/{id}`, `/pathways/{id}/execute`, and `/pathways/{id}/executions`.
- Prediction still calls `/predictions`, `/predictions/{id}`, `/predictions/{id}/execute`, and `/predictions/{id}/executions`.
- SCC/SelfControlledCohort may add a sibling resource only if the method warrants it.
- Cohort validation should hang off cohort definitions, not `/admin` or `/hades`.
- Publish OHDSI exports may need distinct endpoints if package export is asynchronous or returns an artifact bundle instead of a document blob.

Suggested backend/Darkstar posture:

- Laravel owns auth, validation, permissions, job/execution lifecycle, and frontend-facing result normalization.
- Darkstar owns OHDSI/HADES package execution and returns package-native metadata.
- Frontend should not call Darkstar directly.
- Frontend should receive stable normalized JSON and artifact ids.

## Data and Result Shape Principles

Every package-native execution result should include:

- `engine`, such as `native`, `treatment_patterns`, `ensemble_plp`, `phevaluator`, or `ohdsi_report_generator`.
- `package`, such as `TreatmentPatterns`.
- `package_version`.
- `source_id`.
- `analysis_id` or `cohort_definition_id`.
- `execution_id` or validation/export run id.
- `status`.
- `warnings`.
- `artifacts`, using controlled ids or URLs from Laravel, not raw Darkstar file paths.
- Normalized result sections used by the UI.
- `raw_summary` only if needed for debugging and safe to expose.

Small-cell and privacy behavior:

- Respect existing min-cell defaults.
- Keep small-cell suppression flags in result rows.
- Do not expose unsuppressed package outputs directly unless an existing backend policy says it is safe.

## UI Rules for This Work

- Use existing feature layout and component patterns.
- Avoid a new top-level "OHDSI" nav item.
- Avoid package jargon in primary labels when a user-facing analysis name exists.
- Include package names in provenance, advanced settings, or export compatibility labels.
- Keep cards/buttons radius at 8px or less if adding new components.
- Keep controls layout-stable; dynamic results should not shift designer form layout unpredictably.
- Do not add purple-heavy, beige, dark blue/slate, or brown/orange dominant themes in new bespoke UI. The safest path is to use existing theme tokens.

## Verification Commands

Run a targeted subset for each completed track and the full set before handoff:

```bash
git status --short
curl -s http://localhost:8787/hades/packages | jq '{status,total,installed:.installed_count,missing:.missing_count}'
cd backend && php artisan test tests/Feature/Api/V1/HadesCapabilityTest.php
cd backend && php artisan test
cd frontend && npx tsc -p tsconfig.app.json --noEmit --pretty false
cd frontend && npx eslint <touched frontend files>
git diff --check
```

Deploy frontend after implementation with:

```bash
./deploy.sh --frontend
```

Do not substitute `npm run build` for deployment.

Smoke the app after deploy:

```bash
curl -I http://localhost/
curl -I http://localhost/login
curl -I http://localhost/jobs
```

Add feature-specific browser smoke checks if the implementation changes visible workflow pages.

## Suggested Work Order

1. Baseline runtime/package inventory and read the parity plan.
2. Implement TreatmentPatterns in Pathways.
3. Implement Ensemble PLP in Prediction.
4. Decide and implement SelfControlledCohort as SCCS mode or sibling route.
5. Implement PheValuator validation in Cohort Definitions and Phenotype Library.
6. Implement CAPR/CirceR cohort artifact import/export.
7. Implement OHDSI report/sharing export in Publish.
8. Decide and document or implement Shiny artifact viewer.
9. Add study/investigation integration for newly first-class workflows.
10. Add runtime smoke check hardening and package source/reason metadata.

## Definition of Done

Parity+ is complete when:

- Users can run or export each first-class OHDSI capability from the native Parthenon surface where they already work.
- Package-native workflows expose provenance and artifacts without leaking raw Darkstar paths.
- Existing Pathway, Prediction, SCCS, Cohort Definition, Phenotype Library, Publish, and Admin pages still work.
- The frontend route map and sidebar remain organized around user workflows, not package names.
- Backend feature tests cover new validation/routes/result normalization.
- Frontend typecheck and targeted lint pass.
- `./deploy.sh --frontend` completes and basic smoke checks pass.
- `docs/superpowers/plans/2026-04-13-ohdsi-full-parity.md` is updated with completed tasks and any deliberate non-goals.
