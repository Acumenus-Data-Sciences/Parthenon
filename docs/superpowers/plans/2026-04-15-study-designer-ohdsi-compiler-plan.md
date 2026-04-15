# Study Designer OHDSI Compiler Implementation Plan

Date: 2026-04-15
Status: Proposed
Scope: Make Study Designer an AI-assisted, OHDSI-aligned, top-down path that produces the same native Parthenon artifacts as the existing bottom-up concept set, cohort, and analysis workflows.

## Goal

Turn Study Designer from a lightly wired study metadata page into a first-class study design workbench.

The Study Designer should let a researcher start with a clinical research question, then progressively produce, validate, version, execute, and publish the same core artifacts that an OHDSI expert would build bottom-up:

1. Concept sets.
2. OHDSI Circe/ATLAS-compatible cohort definitions.
3. Study cohort roles and snapshots.
4. HADES-compatible analysis specifications.
5. Feasibility, diagnostics, data quality, and phenotype validation outputs.
6. Study protocol, statistical analysis plan, execution package, results, synthesis, and publication artifacts.

The bottom-up workflow remains the canonical expert workflow. The Study Designer becomes an equally valid top-down workflow by compiling into the same canonical objects, not by creating a separate "AI study" universe.

## Product Principle

The Study Designer is a protocol-to-artifacts compiler.

Researchers may begin in natural language, but every accepted design decision must become an inspectable, versioned, reproducible Parthenon/OHDSI artifact. The AI proposes and explains. Deterministic backend services validate and materialize.

Do not allow the Study Designer to silently mutate study assets. Every generated concept set, cohort, analysis, or protocol section must pass through a review state before it becomes canonical.

## OHDSI Alignment

This plan aligns Study Designer with the following OHDSI conventions and product surfaces:

- OMOP CDM and standardized vocabularies: all computable phenotype and analysis assets should reference OMOP domains, concepts, vocabularies, standard concept flags, source-to-standard mappings, observation periods, and CDM source metadata.
- ATLAS/Circe cohort definitions: generated cohorts must round-trip through Parthenon's existing cohort builder, Circe JSON storage, SQL preview, import/export, and validation paths.
- Concept sets: generated concept sets must preserve included concepts, excluded concepts, descendant expansion, mapped concept expansion, domain, vocabulary, concept class, and rationale.
- HADES analyses: generated analyses should map to the existing Parthenon analysis types backed by HADES-compatible design payloads: characterization, CohortMethod estimation, PatientLevelPrediction, incidence rate, pathways/TreatmentPatterns, SCCS, SelfControlledCohort, evidence synthesis, and feature extraction.
- PhenotypeLibrary: phenotype recommendations should preserve source library IDs, version, DOI/release context when available, peer-review/deprecation/error status, metadata, logic description, and import provenance.
- CohortDiagnostics and PheValuator: phenotype development should include diagnostics and validation states rather than treating the first generated cohort as final.
- DataQualityDashboard and Achilles/Ares: feasibility should be source-aware and should surface completeness, conformance, plausibility, population coverage, date coverage, small cell suppression, and data freshness issues before analysis execution.
- Distributed/network study readiness: locked study versions should produce portable study packages, site execution plans, result bundle metadata, and reproducible provenance.

Useful official references:

- OHDSI Book: https://ohdsi.github.io/TheBookOfOhdsi/
- HADES: https://ohdsi.github.io/Hades/
- Common Data Model: https://ohdsi.github.io/CommonDataModel/
- CirceR: https://ohdsi.github.io/CirceR/
- CohortMethod: https://ohdsi.github.io/CohortMethod/
- PatientLevelPrediction: https://ohdsi.github.io/PatientLevelPrediction/
- PhenotypeLibrary: https://ohdsi.github.io/PhenotypeLibrary/
- DataQualityDashboard: https://ohdsi.github.io/DataQualityDashboard/

## Current Parthenon Starting Point

Relevant existing product surfaces:

- Studies: `frontend/src/features/studies/*`
- Current Study Designer: `frontend/src/features/studies/components/StudyDesigner.tsx`
- Study cohorts: `frontend/src/features/studies/components/StudyCohortsTab.tsx`
- Study analyses: `frontend/src/features/studies/components/StudyAnalysesTab.tsx`
- Study API: `frontend/src/features/studies/api/studyApi.ts`
- Study models/controllers: `backend/app/Models/App/Study.php`, `backend/app/Http/Controllers/Api/V1/StudyController.php`
- Study cohorts: `backend/app/Models/App/StudyCohort.php`, `backend/app/Http/Controllers/Api/V1/StudyCohortController.php`
- StudyAgent proxy: `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`
- Cohort definitions and phenotype validation: existing cohort definition APIs plus `PhenotypeValidationController`
- Analysis surfaces: characterization, estimation, prediction, incidence rate, pathways, SCCS, SelfControlledCohort, evidence synthesis
- Publish: native publish/export workflow plus OHDSI package export work from the parity plan

Current gap:

The existing Study Designer mostly edits study metadata and attaches pre-existing analyses. It does not yet transform a research question into reviewed concept sets, cohorts, feasibility results, analysis designs, protocol snapshots, or executable study packages.

## Target Experience

### Top-Down Study Designer Flow

1. The user creates or opens a Study.
2. The user enters a research question, protocol fragment, grant aim, abstract, or PICO statement.
3. Study Designer extracts a structured study intent.
4. The user reviews the extracted intent and resolves ambiguity.
5. The system proposes candidate phenotype definitions, concept sets, cohorts, and study roles.
6. The system materializes draft concept sets and draft cohort definitions.
7. The user reviews generated assets in native concept set and cohort editors.
8. The system runs linting, cohort diagnostics, source feasibility, and optionally phenotype validation.
9. The system proposes one or more analysis plans.
10. The user accepts or edits analyses in native analysis designers.
11. The Study gets a locked protocol version containing frozen cohort JSON snapshots, analysis design JSON, package versions, source assumptions, and AI/human rationale.
12. The Study can execute locally or across sites, synthesize results, and export protocol/SAP/report/code packages.

### Bottom-Up Compatibility

Users must still be able to:

- Build concept sets manually.
- Build cohorts manually.
- Build analyses manually.
- Attach those assets to a Study.
- Open Study Designer later and ask it to critique, complete, explain, or package the existing assets.

Top-down and bottom-up paths must converge on the same objects.

## Design Contract

### Canonical Assets

The canonical assets remain:

- `concept_sets`
- `concept_set_items`
- `cohort_definitions`
- `cohort_generations`
- `study_cohorts`
- `study_analyses`
- Analysis-specific tables such as estimation, prediction, incidence rate, pathway, SCCS, SelfControlledCohort, evidence synthesis, feature, and characterization analyses.
- `analysis_executions`
- `study_sites`
- `study_executions`
- `study_results`
- `study_synthesis`
- `study_artifacts`

### New Intermediate Assets

Add a reviewed intermediate design layer. This layer should be durable, auditable, and safe to regenerate.

Recommended new tables:

- `study_design_sessions`
- `study_design_versions`
- `study_design_assets`
- `study_design_reviews`
- `study_design_compilation_runs`
- `study_design_ai_events`

These tables should store draft and review state, not replace canonical assets.

### StudyDesignSpec

Create a JSON schema for the compiler input/output. Suggested top-level shape:

```json
{
  "schema_version": "1.0",
  "study": {
    "title": "",
    "short_title": "",
    "research_question": "",
    "scientific_rationale": "",
    "hypothesis": "",
    "primary_objective": "",
    "secondary_objectives": [],
    "study_design": "observational",
    "study_type": "comparative_effectiveness",
    "target_population_summary": "",
    "estimand": {}
  },
  "pico": {
    "population": {},
    "intervention_or_exposure": {},
    "comparator": {},
    "outcomes": [],
    "time": {}
  },
  "cohort_roles": [],
  "concept_set_drafts": [],
  "cohort_definition_drafts": [],
  "analysis_plan": [],
  "feasibility_plan": {},
  "validation_plan": {},
  "publication_plan": {},
  "open_questions": [],
  "provenance": {}
}
```

Core rule: `StudyDesignSpec` is not the source of truth after compilation. It is the reviewed design intent and provenance record that explains how canonical artifacts were produced.

## Recommended Data Model

### study_design_sessions

Purpose: one active design conversation/workbench per study or per major redesign effort.

Fields:

- `id`
- `study_id`
- `created_by`
- `title`
- `status`: `draft`, `reviewing`, `compiling`, `compiled`, `locked`, `archived`
- `active_version_id`
- `source_mode`: `natural_language`, `protocol_upload`, `existing_study`, `mixed`
- `created_at`, `updated_at`

### study_design_versions

Purpose: immutable versioned design specifications.

Fields:

- `id`
- `session_id`
- `version_number`
- `status`: `draft`, `review_ready`, `accepted`, `rejected`, `compiled`, `locked`
- `spec_json`
- `normalized_spec_json`
- `lint_results_json`
- `feasibility_summary_json`
- `ai_model_metadata_json`
- `created_by`
- `created_at`
- `accepted_by`
- `accepted_at`

### study_design_assets

Purpose: map generated draft assets to canonical assets.

Fields:

- `id`
- `session_id`
- `version_id`
- `asset_type`: `concept_set`, `cohort_definition`, `analysis`, `protocol_section`, `artifact`, `feasibility_result`
- `draft_payload_json`
- `canonical_type`
- `canonical_id`
- `role`: `target`, `comparator`, `outcome`, `subgroup`, `exclusion`, `covariate`, `negative_control`, `sensitivity`
- `status`: `draft`, `needs_review`, `accepted`, `materialized`, `superseded`, `rejected`
- `provenance_json`
- `review_notes`
- `created_at`, `updated_at`

### study_design_reviews

Purpose: human review decisions.

Fields:

- `id`
- `session_id`
- `version_id`
- `asset_id`
- `reviewer_id`
- `decision`: `accept`, `revise`, `reject`, `defer`
- `comments`
- `changes_requested_json`
- `created_at`

### study_design_compilation_runs

Purpose: deterministic compiler execution audit.

Fields:

- `id`
- `session_id`
- `version_id`
- `status`: `queued`, `running`, `completed`, `failed`
- `compiler_version`
- `input_hash`
- `output_hash`
- `created_asset_counts_json`
- `warnings_json`
- `errors_json`
- `started_at`, `completed_at`

### study_design_ai_events

Purpose: AI provenance and traceability without leaking secrets or prompt-internal material unnecessarily.

Fields:

- `id`
- `session_id`
- `version_id`
- `event_type`: `intent_extract`, `concept_suggest`, `cohort_draft`, `analysis_plan`, `critique`, `revision`
- `provider`
- `model`
- `prompt_template_version`
- `input_summary_json`
- `output_json`
- `safety_flags_json`
- `latency_ms`
- `created_by`
- `created_at`

## Compiler Architecture

### Layer 1: Intent Parser

Input:

- Natural language research question.
- Optional protocol text.
- Optional selected study type.
- Optional selected data source(s).

Output:

- PICO structure.
- Study design classification.
- Candidate estimand.
- Ambiguity list.
- Suggested missing details.

Acceptance:

- The parser must produce machine-validated JSON.
- Ambiguous items must be explicit, not guessed into final artifacts.
- The UI should ask the user to resolve high-impact ambiguity before cohort materialization.

### Layer 2: Phenotype and Concept Planner

Input:

- Reviewed PICO.
- Source metadata.
- PhenotypeLibrary index.
- Vocabulary search APIs.
- Existing Parthenon concept sets and cohorts.

Output:

- Candidate phenotype library entries.
- Candidate reusable local cohorts.
- Draft concept sets.
- Inclusion/exclusion rationale.
- Expansion flags.
- Domain/vocabulary warnings.
- Deprecation/error warnings for phenotype library entries.

Acceptance:

- Every draft concept set includes concept IDs, concept names, domain, vocabulary, concept class, standard concept flag, include descendants, include mapped, excluded flag, and rationale.
- Every external phenotype recommendation preserves source ID and version/provenance.
- The planner must prefer reusable accepted assets when they match the intent.

### Layer 3: Cohort Generator

Input:

- Reviewed concept plans.
- Study role map.
- Washout/index/time-at-risk assumptions.
- Existing cohort expression templates.

Output:

- Circe/ATLAS-compatible cohort definition JSON.
- Human-readable cohort logic.
- Role-specific labels.
- Concept set links.
- Expected limitations and warnings.

Acceptance:

- Generated cohorts must validate through the existing cohort validation stack.
- Generated cohorts must open in the native cohort definition editor.
- Generated cohorts must support SQL preview through the existing Circe path.
- Generated cohorts should not be directly linked to a Study as final until accepted.

### Layer 4: Feasibility and Diagnostics

Input:

- Draft or accepted cohorts.
- Selected source(s).
- Data quality metadata.

Output:

- Person counts.
- Event counts.
- Attrition summary.
- Overlap matrix.
- Incidence estimates where applicable.
- Small-cell suppression warnings.
- Observation period/date coverage.
- Vocabulary/domain coverage.
- DQD/Achilles/Ares context.

Acceptance:

- Feasibility must be source-aware.
- Counts used for design decisions must be stored with source ID, CDM version, vocabulary version, run time, and query/package provenance.
- Study Designer should display "insufficient evidence to proceed" states, not only happy-path recommendations.

### Layer 5: Analysis Planner

Input:

- Reviewed study intent.
- Accepted cohorts.
- Feasibility results.
- Selected study type.

Output:

- Analysis plan options.
- Primary analysis recommendation.
- Sensitivity analysis recommendations.
- Negative control recommendations where appropriate.
- Covariate strategy.
- Time-at-risk strategy.
- Stratification/subgroup strategy.
- Diagnostics and acceptance criteria.

Analysis mapping:

- Descriptive characterization: baseline summary, covariates, data source comparison.
- Incidence rate: outcome frequency, event rates by subgroup/time window.
- CohortMethod estimation: target/comparator/outcome comparative effect estimation, propensity score matching/stratification/weighting, negative controls.
- PatientLevelPrediction: target/outcome risk prediction, train/test split, calibration, discrimination, validation.
- Pathways/TreatmentPatterns: treatment sequence and clinical progression paths.
- SCCS or SelfControlledCohort: self-controlled safety questions and acute exposure-outcome designs.
- Evidence synthesis: multi-site pooled or meta-analytic results.
- Feature extraction: reusable covariate generation and feature review.

Acceptance:

- Analysis designs must be saved through existing analysis APIs where possible.
- Each analysis must link back to study cohorts by role.
- Analysis payloads must remain backward compatible with existing Parthenon execution jobs.
- Package-specific options should be advanced/provenance settings, not primary user language.

### Layer 6: Materializer

Input:

- Accepted `StudyDesignSpec`.
- Accepted draft assets.

Output:

- Canonical concept sets.
- Canonical cohort definitions.
- `study_cohorts` records with role-specific snapshots.
- Canonical analyses.
- `study_analyses` records.
- Protocol/SAP draft artifacts.
- Compilation run record.

Acceptance:

- Materialization is idempotent by version hash.
- Re-running compilation for the same accepted version must not duplicate canonical assets.
- If an asset already exists, the compiler should link or create a new version according to explicit policy.
- The compiler must never overwrite user-edited canonical assets without a versioned replacement workflow.

### Layer 7: Lock and Package

Input:

- Accepted canonical assets.
- Source feasibility results.
- Protocol metadata.

Output:

- Locked study version.
- Frozen cohort JSON snapshots.
- Frozen analysis design JSON snapshots.
- Runtime package inventory.
- Source assumptions.
- Exportable protocol, SAP, and execution package metadata.

Acceptance:

- Locked versions are immutable except for explicit supersession.
- Network/distributed execution packages should be reproducible from the locked version.
- Published reports should cite the locked design version.

## API Plan

Add a `StudyDesignController` or split controllers under `Api/V1/StudyDesign`.

Suggested routes:

```text
GET    /api/v1/studies/{study}/design-sessions
POST   /api/v1/studies/{study}/design-sessions
GET    /api/v1/studies/{study}/design-sessions/{session}
PATCH  /api/v1/studies/{study}/design-sessions/{session}

POST   /api/v1/studies/{study}/design-sessions/{session}/intent
POST   /api/v1/studies/{study}/design-sessions/{session}/phenotypes/recommend
POST   /api/v1/studies/{study}/design-sessions/{session}/concept-sets/draft
POST   /api/v1/studies/{study}/design-sessions/{session}/cohorts/draft
POST   /api/v1/studies/{study}/design-sessions/{session}/cohorts/lint
POST   /api/v1/studies/{study}/design-sessions/{session}/feasibility
POST   /api/v1/studies/{study}/design-sessions/{session}/analyses/plan

GET    /api/v1/studies/{study}/design-sessions/{session}/versions
POST   /api/v1/studies/{study}/design-sessions/{session}/versions
GET    /api/v1/studies/{study}/design-sessions/{session}/versions/{version}
POST   /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/review
POST   /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/compile
POST   /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/lock

GET    /api/v1/studies/{study}/design-sessions/{session}/assets
POST   /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/review
POST   /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/materialize
```

Route permissions:

- View: `studies.view`
- Draft: `studies.update` or `studies.design`
- Materialize: `cohorts.create`, `analyses.create`, and `studies.update`
- Execute feasibility: `cohorts.run` or `analyses.run`
- Lock: `studies.lock` or PI/statistician role
- Publish/export: existing publish permissions

## Backend Services

### StudyDesignSpecValidator

Responsibilities:

- Validate schema version.
- Enforce required PICO fields by study type.
- Validate role references.
- Validate concept set draft shape.
- Validate cohort draft shape before Circe validation.
- Validate analysis plan shape.

### StudyIntentService

Responsibilities:

- Call StudyAgent or the configured AI provider.
- Normalize AI output into `StudyDesignSpec`.
- Detect and preserve ambiguities.
- Create `study_design_ai_events`.

### StudyPhenotypeRecommendationService

Responsibilities:

- Combine StudyAgent phenotype recommendation, local PhenotypeLibrary entries, and local cohort/concept set reuse.
- Filter deprecated/error phenotype entries.
- Rank by relevance, computability, validation evidence, source compatibility, and local reuse.

### StudyConceptSetDraftService

Responsibilities:

- Generate draft concept sets.
- Search vocabulary.
- Enforce standard concept preference.
- Include evidence/rationale for included and excluded concepts.
- Detect mixed-domain concept sets and unsafe broad descendants.

### StudyCohortDraftService

Responsibilities:

- Generate ATLAS/Circe-compatible cohort JSON.
- Attach concept sets.
- Generate human-readable logic.
- Run cohort lint.
- Run Circe validation/SQL preview.

### StudyFeasibilityService

Responsibilities:

- Generate and execute feasibility jobs.
- Use cohort generation, Achilles/Ares summaries, DQD results, overlap queries, and temporal coverage checks.
- Store source-aware feasibility outputs.

### StudyAnalysisPlannerService

Responsibilities:

- Recommend analysis types and settings.
- Produce design JSON compatible with existing analysis controllers/jobs.
- Add sensitivity and diagnostic plan.
- Avoid recommending methods that are not supported by the selected source or runtime package inventory.

### StudyDesignCompiler

Responsibilities:

- Convert an accepted `StudyDesignSpec` into canonical assets.
- Be deterministic and idempotent.
- Maintain draft-to-canonical mappings.
- Create `study_cohorts` and `study_analyses` links.
- Snapshot cohort JSON and concept set IDs into `study_cohorts`.
- Record compilation warnings and errors.

### StudyVersionLockService

Responsibilities:

- Freeze design version.
- Snapshot canonical assets.
- Store package inventory and source assumptions.
- Generate protocol/SAP draft artifacts.
- Prepare export metadata.

## Frontend Plan

### Placement

Keep Study Designer inside the Studies feature module:

- Do not create a broad new top-level OHDSI area.
- Keep `/study-designer` only as a launch/discovery route if already present.
- The primary workbench should live on the study detail page as a first-class tab or sub-route.

Recommended routes:

```text
/studies/:slug/design
/studies/:slug/design/:sessionId
/studies/:slug/design/:sessionId/version/:versionId
```

### Main Workbench Layout

Use a staged workspace:

1. Intent
2. Phenotypes
3. Concept Sets
4. Cohorts
5. Feasibility
6. Analysis Plan
7. Protocol
8. Compile
9. Lock

Each stage should show:

- Current status.
- AI suggestions.
- Human review state.
- Canonical asset links.
- Blocking issues.
- Revision history.

### Components

Suggested components:

- `StudyDesignWorkbench.tsx`
- `StudyIntentStep.tsx`
- `PicoReviewPanel.tsx`
- `PhenotypeRecommendationPanel.tsx`
- `ConceptSetDraftPanel.tsx`
- `CohortDraftPanel.tsx`
- `CohortLogicPreview.tsx`
- `FeasibilityDashboard.tsx`
- `AnalysisPlanBuilder.tsx`
- `ProtocolDraftPanel.tsx`
- `CompilationReviewPanel.tsx`
- `StudyDesignVersionTimeline.tsx`
- `StudyDesignAssetLinkCard.tsx`
- `StudyDesignWarningsPanel.tsx`

### UX Rules

- AI output is never final by default.
- Show "Draft", "Needs review", "Accepted", "Materialized", "Locked", and "Superseded" states clearly.
- Provide direct links from generated assets into native editors.
- If a user edits a generated cohort in the native cohort builder, Study Designer should mark the generated draft as diverged and ask whether to update the design version.
- Use clinical language for users and package/provenance language in details.
- Prefer "Target population", "Comparator", "Outcome", "Time at risk", and "Covariates" over package-first terms.
- Do not hide OHDSI compatibility metadata. Put it in expandable provenance/details panels.

## AI Guardrails

### Required Behavior

- Structured JSON output with schema validation.
- Explicit uncertainty.
- Explicit assumptions.
- Traceable recommendations.
- Human approval before materialization.
- No hidden mutation of canonical assets.
- No execution of analysis until assets are accepted.

### AI Must Not

- Invent concept IDs without vocabulary verification.
- Silently ignore phenotype deprecation/error status.
- Choose a study method without explaining why other plausible methods were not selected.
- Treat feasibility counts as universal across sources.
- Mark a generated cohort as validated simply because it compiles.
- Generate publishable claims without linking to executed results.

### Prompt/Model Provenance

Store:

- Provider and model.
- Prompt template version.
- Retrieval sources.
- Input summary.
- Output schema version.
- Validation errors.
- Human review decisions.

Avoid storing PHI or sensitive source rows in AI event logs.

## Study Method Decision Framework

Add a deterministic method-selection layer after AI extraction. Suggested rules:

- Use characterization when the question is descriptive or when a study needs baseline context.
- Use incidence rate when the question asks how often an event occurs in a defined population/time window.
- Use CohortMethod when comparing effect of target vs comparator exposures on outcome risk.
- Use PLP when predicting individual future outcome risk.
- Use pathways/TreatmentPatterns when the question concerns treatment sequences or clinical progression states.
- Use SCCS or SelfControlledCohort when the design is self-controlled and exposure/outcome timing supports it.
- Use evidence synthesis when results span multiple sources/sites or multiple comparable analyses.
- Use phenotype validation when a generated or imported outcome/target phenotype is central to study validity.

The AI may recommend, but the deterministic selector should enforce obvious constraints and required fields.

## Validation and Quality Gates

### Intent Gates

- Research question present.
- Population, exposure/comparator, outcome, and time frame identified or explicitly marked missing.
- Study type selected.
- Primary objective accepted.

### Concept Gates

- Concepts verified against vocabulary table/API.
- Standard concept preference checked.
- Source concepts mapped when needed.
- Descendant and mapped expansion flags reviewed.
- Broad concept warnings surfaced.
- Excluded concepts explained.

### Cohort Gates

- Circe JSON schema valid.
- SQL renders for selected dialect/source.
- Required observation window explicit.
- Index date explicit.
- End strategy explicit.
- Inclusion/exclusion rules explicit.
- Attrition can be generated.
- Small-cell and empty cohort states handled.

### Feasibility Gates

- Counts generated for selected source(s).
- Observation period coverage checked.
- Outcome count threshold checked.
- Target/comparator overlap checked.
- Missing domain/vocabulary coverage checked.
- DQD/Achilles source warnings surfaced.

### Analysis Gates

- Required cohort roles linked.
- Time-at-risk valid.
- Covariate settings valid.
- Diagnostics planned.
- Runtime package support available.
- Result interpretation plan present.

### Lock Gates

- All primary assets accepted.
- All primary cohorts materialized.
- At least one feasibility run completed or explicitly waived.
- Primary analysis materialized.
- Protocol summary generated.
- Package/source/version provenance captured.

## Implementation Phases

### Phase 0: Architecture and Schema Foundation

Outcome:

Study Designer has durable sessions, versions, draft assets, reviews, compilation runs, and AI event provenance.

Tasks:

- [ ] Create migrations for `study_design_sessions`.
- [ ] Create migrations for `study_design_versions`.
- [ ] Create migrations for `study_design_assets`.
- [ ] Create migrations for `study_design_reviews`.
- [ ] Create migrations for `study_design_compilation_runs`.
- [ ] Create migrations for `study_design_ai_events`.
- [ ] Add Eloquent models and relationships.
- [ ] Add policies/permissions for design, materialize, and lock actions.
- [ ] Add backend feature tests for session/version CRUD.
- [ ] Add a minimal Study Design tab that lists sessions and versions.

Acceptance:

- A study can have design sessions and versioned specs.
- Versions are immutable after acceptance/lock.
- AI events and compilation runs can be stored without creating canonical assets.

### Phase 1: StudyDesignSpec and Intent Review

Outcome:

Users can convert a research question into a reviewed structured study intent.

Tasks:

- [ ] Define `StudyDesignSpec` JSON schema.
- [ ] Add `StudyDesignSpecValidator`.
- [ ] Add `StudyIntentService`.
- [ ] Integrate existing `/study-agent/intent/split` into session/version creation.
- [ ] Build `StudyIntentStep` and `PicoReviewPanel`.
- [ ] Store ambiguities and open questions.
- [ ] Allow users to edit/accept the structured intent.
- [ ] Add backend tests for valid/invalid specs.
- [ ] Add frontend tests for review state transitions.

Acceptance:

- AI can draft structured intent.
- User can correct it before downstream work.
- Accepted intent becomes versioned design input.

### Phase 2: Phenotype Recommendation and Reuse

Outcome:

Study Designer recommends existing PhenotypeLibrary entries, local cohorts, local concept sets, and reusable assets before generating new ones.

Tasks:

- [x] Add `StudyPhenotypeRecommendationService`.
- [x] Merge results from StudyAgent, local `phenotype_library`, local cohorts, and local concept sets.
- [x] Persist deterministic verification state for each recommendation asset.
- [x] Block acceptance of assets that cannot be verified against local source records and OMOP vocabulary concepts when concept IDs are present.
- [ ] Rank recommendations using relevance, validation evidence, local reuse, status, and computability.
- [ ] Surface deprecated/error status warnings.
- [x] Add `PhenotypeRecommendationPanel`.
- [x] Let users accept, reject, or defer each recommendation.
- [ ] Link accepted phenotypes to draft assets.
- [ ] Add tests for deprecation/error filtering and provenance preservation.
- [x] Add tests for positive verification and blocked acceptance of unverified assets.

Acceptance:

- Recommendations are traceable.
- Existing high-quality assets are preferred over unnecessary regeneration.
- AI suggestions cannot be accepted unless they resolve to deterministic local/source evidence.
- Accepted recommendations feed concept/cohort drafting.

### Phase 3: Concept Set Drafting

Outcome:

Study Designer can propose concept sets with vocabulary-verified concepts and human review states.

Tasks:

- [ ] Add `StudyConceptSetDraftService`.
- [ ] Connect to vocabulary/concept search APIs.
- [ ] Generate concept set draft payloads.
- [ ] Add concept-level provenance and rationale.
- [ ] Add warnings for non-standard concepts, mapped expansion, descendant expansion, and mixed domains.
- [ ] Add `ConceptSetDraftPanel`.
- [ ] Add "materialize concept set" action for accepted drafts.
- [ ] Link created concept sets to `study_design_assets`.
- [ ] Add tests for concept set draft validation and materialization.

Acceptance:

- Draft concept sets can be inspected and accepted before creation.
- Materialized concept sets are normal Parthenon concept sets.
- Generated concept sets retain provenance.

### Phase 4: Cohort Drafting and Linting

Outcome:

Study Designer generates validated cohort drafts that open in the native Cohort Definition editor.

Tasks:

- [ ] Add `StudyCohortDraftService`.
- [ ] Generate ATLAS/Circe-compatible cohort JSON from accepted concept plans.
- [ ] Reuse existing cohort import/validation/SQL preview logic.
- [ ] Add cohort linting from StudyAgent and local deterministic checks.
- [ ] Add `CohortDraftPanel` and `CohortLogicPreview`.
- [ ] Allow materialization into `cohort_definitions`.
- [ ] Link materialized cohorts into `study_cohorts` with role, label, JSON snapshot, and concept set IDs.
- [ ] Add tests for generated cohort JSON shape, lint results, materialization, and study linking.

Acceptance:

- Generated cohorts are real cohort definitions.
- Cohorts can be edited in native builder.
- Study cohort role snapshots are populated.

### Phase 5: Source-Aware Feasibility

Outcome:

Users can evaluate whether proposed cohorts and analyses are viable before locking a study.

Tasks:

- [ ] Add `StudyFeasibilityService`.
- [ ] Add feasibility run model/table if existing feasibility tables are not sufficient.
- [ ] Generate counts for target, comparator, outcomes, exclusions, and subgroups.
- [ ] Add overlap matrix and attrition summaries.
- [ ] Add date coverage and observation period checks.
- [ ] Pull DQD/Achilles/Ares source warnings into feasibility summary.
- [ ] Add small-cell suppression handling.
- [ ] Build `FeasibilityDashboard`.
- [ ] Add tests for source-scoped feasibility payloads and failure states.

Acceptance:

- Feasibility is source-specific.
- Users can see when a study design is underpowered, empty, or data-quality limited.
- Feasibility output is stored as design evidence.

### Phase 6: Analysis Plan Generation

Outcome:

Study Designer proposes and materializes native analysis designs.

Tasks:

- [ ] Add `StudyAnalysisPlannerService`.
- [ ] Implement deterministic study method selection constraints.
- [ ] Generate characterization designs.
- [ ] Generate incidence rate designs.
- [ ] Generate CohortMethod estimation designs.
- [ ] Generate PLP designs.
- [ ] Generate pathway/TreatmentPatterns designs.
- [ ] Generate SCCS/SelfControlledCohort designs where appropriate.
- [ ] Generate evidence synthesis plan for multi-site studies.
- [ ] Build `AnalysisPlanBuilder`.
- [ ] Materialize accepted analysis plans through existing analysis APIs/models.
- [ ] Link analyses through `study_analyses`.
- [ ] Add backend tests per analysis family.

Acceptance:

- Analysis plans become normal Parthenon analyses.
- Study analysis links are populated.
- Analysis designs preserve cohort-role provenance.

### Phase 7: Protocol, SAP, and Design Lock

Outcome:

Accepted study designs can be locked into reproducible protocol versions.

Tasks:

- [ ] Add `StudyVersionLockService`.
- [ ] Generate protocol draft sections from accepted design assets.
- [ ] Generate SAP draft sections for primary/sensitivity analyses.
- [ ] Snapshot cohort JSON, concept set IDs, analysis design JSON, source assumptions, package versions, and feasibility evidence.
- [ ] Add lock/unlock-by-supersession lifecycle.
- [ ] Build `ProtocolDraftPanel` and `CompilationReviewPanel`.
- [ ] Create `study_artifacts` records for protocol/SAP drafts.
- [ ] Add tests for immutability and supersession.

Acceptance:

- Locked study versions are immutable.
- Protocol/SAP drafts are generated from actual accepted assets.
- Published/exported study packages cite locked version IDs.

### Phase 8: Execution, Results, and Synthesis Integration

Outcome:

Locked designs can drive local and network execution with traceable results.

Tasks:

- [ ] Ensure locked design assets feed existing study execution flows.
- [ ] Add execution readiness checks.
- [ ] Add site-level package/source compatibility checks.
- [ ] Add result review gates to `StudyResultsTab`.
- [ ] Add synthesis recommendations based on result availability.
- [ ] Connect Publish outputs to locked design versions.
- [ ] Add tests for execution readiness and result provenance.

Acceptance:

- Study Designer is not only design-time. It remains the provenance backbone through execution and publication.

### Phase 9: Advanced AI Assistance

Outcome:

The AI becomes a useful copilot across revision loops without compromising reproducibility.

Tasks:

- [ ] Add "revise this cohort based on lint/feasibility" workflow.
- [ ] Add "explain this study design" workflow.
- [ ] Add "compare versions" workflow.
- [ ] Add "suggest sensitivity analyses" workflow.
- [ ] Add "generate negative controls" workflow where supported.
- [ ] Add "draft response to reviewer/design critique" workflow.
- [ ] Add model/provider observability and quality dashboards.

Acceptance:

- AI assistance improves iteration speed but does not bypass review, validation, or materialization gates.

## Testing Strategy

### Backend

- Model relationship tests for new design tables.
- Policy tests for design, materialize, lock, and publish permissions.
- Schema validation tests for `StudyDesignSpec`.
- Service tests for intent normalization, phenotype recommendation, concept draft validation, cohort draft validation, analysis plan generation, and deterministic compiler idempotency.
- Feature tests for API endpoints.
- Regression tests ensuring generated assets can be opened by existing cohort and analysis endpoints.

### Frontend

- Type tests or `tsc` coverage for Study Design API types.
- Component tests for each review stage.
- Mutation tests for accept/reject/materialize flows.
- Integration tests for session creation through compile-ready state.
- E2E happy path: research question to materialized study cohorts and analyses.
- E2E failure path: ambiguous intent, empty cohort, unsupported analysis, lock blocked.

### Runtime

- Verify StudyAgent health.
- Verify HADES package inventory.
- Verify Circe SQL rendering.
- Verify selected source connection.
- Verify cohort generation and feasibility jobs.

## Deployment and Operations

Frontend deployment:

- Use `./deploy.sh --frontend`.
- Do not use `npm run build` as the deployment path for shipped frontend assets.

Operational requirements:

- Add system health checks for Study Designer dependencies: StudyAgent, vocabulary search, Circe, HADES package inventory, cohort generation, DQD/Achilles/Ares source metadata.
- Add feature flags for advanced AI materialization if needed.
- Add rate limits for AI-heavy endpoints.
- Add job queue monitoring for feasibility and compilation runs.
- Add audit logging for materialization and lock actions.

## Security, Privacy, and Governance

- Never send row-level PHI to AI services for study design.
- Store only summaries, aggregate counts, concept IDs, cohort definitions, and study metadata in AI event logs.
- Redact protocol uploads before AI processing if they may contain sensitive information.
- Apply role-based access to design sessions and materialization.
- Treat locked study versions as regulated research artifacts.
- Preserve who accepted every generated concept set, cohort, and analysis.
- Support institutional review workflows by exporting rationale, assumptions, and provenance.

## Migration from Current Study Designer

Stepwise migration:

1. Keep current `StudyDesigner.tsx` behavior available.
2. Add the new Study Design tab beside existing cohorts/analyses tabs.
3. Use existing study metadata as seed input for the first design session.
4. Let users import current `study_cohorts` and `study_analyses` into a design version for critique.
5. Gradually replace the old metadata-only designer with the new workbench once parity is reached.

No existing study, cohort, or analysis records should be rewritten during migration.

## Non-Goals

- Do not create a separate top-level OHDSI application area.
- Do not create a second cohort definition format.
- Do not create AI-only study artifacts that cannot be opened in native editors.
- Do not skip concept/cohort/analysis review gates.
- Do not make package names the primary user-facing design language.
- Do not treat successful JSON generation as scientific validation.

## Success Metrics

Product:

- A researcher can go from research question to materialized study cohorts and analyses without leaving the Study workflow.
- An OHDSI expert can inspect and edit every generated artifact in native builders.
- A locked study version can reproduce the design package.

Scientific:

- Generated cohorts are Circe-valid and source-feasible.
- Study designs include rationale, assumptions, diagnostics, and limitations.
- Phenotype recommendations preserve source and version provenance.

Engineering:

- Study Designer writes canonical Parthenon assets.
- Compilation is deterministic and idempotent.
- Existing bottom-up workflows continue to work unchanged.
- Tests cover happy paths and blocked/ambiguous paths.

## Suggested Delivery Order

1. Data model and API skeleton.
2. StudyDesignSpec schema and intent review.
3. Phenotype recommendation/reuse.
4. Concept set drafts.
5. Cohort drafts and materialization.
6. Feasibility dashboard.
7. Analysis planner and materialization.
8. Protocol/SAP generation and lock.
9. Execution/package/publish integration.
10. Advanced AI revision loops.

## Immediate Next Task

Implement Phase 0 and Phase 1 as a narrow vertical slice:

1. Add design session/version tables.
2. Add a Study Design tab.
3. Let a user enter a research question.
4. Call the existing StudyAgent intent split endpoint.
5. Store the normalized `StudyDesignSpec`.
6. Let the user edit and accept the intent.

This creates the durable skeleton for everything else while avoiding premature commitment to generated cohort and analysis behavior.
