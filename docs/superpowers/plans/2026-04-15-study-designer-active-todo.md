# Study Designer Active Todo

Date: 2026-04-15
Status: Active working checklist
Related plan: `docs/superpowers/plans/2026-04-15-study-designer-ohdsi-compiler-plan.md`

## End Goal

Make Study Designer an equally valid top-down path to produce the same canonical Parthenon/OHDSI artifacts that experts currently build bottom-up:

1. Reviewed study intent.
2. Verified phenotype/reuse recommendations.
3. Vocabulary-grounded concept sets.
4. ATLAS/Circe-compatible cohort definitions.
5. Study cohort role links and snapshots.
6. Source-aware feasibility and diagnostics.
7. HADES-compatible analysis designs.
8. Locked, reproducible study package with protocol, SAP, provenance, and exportable execution assets.

The Study Designer must not create a parallel "AI-only" artifact universe. It must compile into existing canonical Parthenon assets and keep every generated artifact reviewable, auditable, and reproducible.

## Current State

Completed:

- Study design sessions, versions, and AI event provenance.
- Study intent generation from a research question with lint/review gating.
- Human review/edit/accept flow for structured intent.
- Phenotype/reuse recommendation service.
- Recommendations from StudyAgent, local `phenotype_library`, local cohorts, and local concept sets.
- `study_design_assets` intermediate storage.
- Deterministic asset verification service.
- `verified`, `partial`, `blocked`, and `unverified` verification semantics.
- Acceptance gate: only `verified` assets can be accepted.
- UI panel for phenotype/reuse recommendations.
- UI badges/checks for verification state.
- PostgreSQL feature-test path using disposable local test databases.

Known gaps:

- Recommendation ranking is still basic.
- Accepted recommendations do not yet feed concept/cohort drafting.
- Concept set drafting is not implemented.
- Cohort drafting is not implemented.
- Feasibility/diagnostics are implemented for linked study cohorts and selected CDM sources.
- Analysis plan generation is not implemented.
- Locking/version packaging is not implemented.
- Frontend suite has unrelated design-token test drift around hex colors versus CSS variables.

## Non-Negotiable Guardrails

- Do not let AI-generated concept IDs pass through unless they resolve through vocabulary lookup.
- Do not let unverifiable or blocked recommendations become accepted downstream inputs.
- Do not silently materialize canonical concept sets, cohorts, or analyses.
- Do not create another cohort-definition format.
- Do not bypass existing native editors.
- Do not mark a generated cohort as validated simply because its JSON compiles.
- Do not treat feasibility as global; feasibility is source-specific.
- Do not lock a study unless required cohorts, concept sets, analysis designs, source assumptions, and feasibility evidence are present.
- Do not log PHI or row-level patient data in AI events.
- Do not mutate unrelated bottom-up assets without explicit user action.

## Phase 0: Stabilize The Working Surface

Purpose: make the existing Study Designer work reliable enough to build on.

### Backend

- [ ] Add a reusable script or documented command for disposable PostgreSQL feature tests.
  - [ ] Creates temporary database.
  - [ ] Creates temporary role.
  - [ ] Creates required schemas: `app`, `php`, `omop`, `vocab`, `results`, `gis`, `eunomia`, `eunomia_results`, `webapi`, `inpatient`, `inpatient_ext`.
  - [ ] Runs target Pest file.
  - [ ] Always drops database and role.
  - [ ] Refuses to run against `parthenon` or any protected database.
- [ ] Add `verification_status` constants or enum-like helpers to avoid string drift.
- [ ] Add asset status constants for `needs_review`, `accepted`, `rejected`, `deferred`.
- [ ] Add a backend resource/transformer for Study Design responses so UI does not depend on raw Eloquent shape.
- [ ] Add a test proving accepted assets cannot be re-accepted after canonical materialization.
- [ ] Add a test proving blocked assets can be deferred/rejected but never accepted.
- [ ] Add migration/data check that existing `failed` verification statuses are migrated to `blocked`.

### Frontend

- [ ] Replace free-form verification label logic with a typed helper.
- [ ] Add a tooltip or expanded detail view explaining each verification status:
  - `verified`: eligible for acceptance.
  - `partial`: needs human review or missing supporting evidence.
  - `blocked`: cannot move downstream until corrected or replaced.
  - `unverified`: has not yet been checked.
- [ ] Add empty/loading/error states for recommendation verification details.
- [ ] Add a user-facing message when Accept is disabled because the asset is not verified.
- [ ] Keep Study Designer copy product-facing. Avoid internal explanations such as "Phase 1" in UI.

### Tests

- [ ] Backend feature tests pass against disposable PostgreSQL.
- [ ] Backend PHPStan passes for production Study Design code.
- [ ] Pint passes for touched PHP files.
- [ ] Frontend TypeScript passes.
- [ ] Targeted frontend ESLint passes for Study Designer files.
- [ ] Add frontend unit tests for disabled Accept behavior if test harness is available.

Exit criteria:

- Current Study Designer features are stable and testable.
- No confusing "failed verification" wording remains in Study Designer contexts.
- We have a repeatable way to run strong backend tests without the remote test database.

## Phase 2.5: Evidence, Provenance, And Recommendation Quality

Purpose: finish the recommendation layer before generating new concept sets.

### Data Model

- [ ] Extend `study_design_assets.verification_json` schema documentation.
- [ ] Add explicit fields in verification result:
  - [ ] `status`
  - [ ] `eligibility`
  - [ ] `checks`
  - [ ] `blocking_reasons`
  - [ ] `warnings`
  - [ ] `source_summary`
  - [ ] `canonical_summary`
  - [ ] `accepted_downstream_actions`
- [ ] Consider adding `materialized_type`, `materialized_id`, and `materialized_at` to `study_design_assets`.
- [ ] Consider adding `review_decision_json` for structured reviewer rationale.

### Recommendation Ranking

- [ ] Add deterministic ranking inputs:
  - [ ] source type weight: local accepted cohort, local concept set, PhenotypeLibrary entry, StudyAgent-only suggestion
  - [ ] verification status
  - [ ] computable expression availability
  - [ ] local reuse count if available
  - [ ] validation evidence if available
  - [ ] deprecated/blocked penalties
  - [ ] matched PICO role
  - [ ] matched query terms
- [ ] Store `rank_score_json` separately from AI-provided `score`.
- [ ] Do not let AI-provided score override deterministic safety checks.
- [ ] Add tests for ranking precedence.

### PhenotypeLibrary Evidence

- [ ] Preserve PhenotypeLibrary cohort ID.
- [ ] Preserve imported local cohort ID when present.
- [ ] Preserve domain, severity, tags, logic description, and expression presence.
- [ ] Add room for DOI/version/release metadata if available in source.
- [ ] Add warning if a phenotype has no computable expression.
- [ ] Add warning if a phenotype is imported but missing linked local cohort.
- [ ] Add warning or blocked status if a phenotype source record is deprecated/error-marked when such fields become available.

### UI

- [ ] Add `EvidenceDrawer` or expandable evidence section for each recommendation.
- [ ] Show:
  - [ ] source
  - [ ] canonical record
  - [ ] verification checks
  - [ ] warnings
  - [ ] reviewer
  - [ ] timestamp
  - [ ] downstream eligibility
- [ ] Add sort/filter controls:
  - [ ] verified only
  - [ ] source type
  - [ ] role
  - [ ] computable only
  - [ ] blocked/partial
- [ ] Make blocked assets visually clear without looking like an application crash.

### Tests

- [ ] Recommendation ranking unit tests.
- [ ] Verification evidence JSON shape tests.
- [ ] UI tests for verification states if harness exists.
- [ ] PostgreSQL feature test: accept verified recommendation.
- [ ] PostgreSQL feature test: block StudyAgent-only recommendation without canonical source.
- [ ] PostgreSQL feature test: partial recommendation cannot be accepted.

Exit criteria:

- Recommendations are not merely listed; they are evidence-backed candidates.
- Accepted recommendations are trusted inputs for concept/cohort drafting.

## Phase 3: Vocabulary-Grounded Concept Set Drafting

Purpose: generate inspectable concept set drafts without hallucinated concepts.

### Backend Services

- [ ] Add `StudyConceptSetDraftService`.
- [ ] Add `StudyConceptSetDraftVerifier`.
- [ ] Add `StudyConceptSetMaterializer`.
- [ ] Add request class for concept draft generation.
- [ ] Add request class for concept draft review/materialization.
- [ ] Reuse existing vocabulary search APIs and `App\Models\Vocabulary\Concept`.
- [ ] Reuse existing `ConceptSet` and `ConceptSetItem` models.

### Draft Inputs

- [ ] Accepted phenotype/reuse recommendations.
- [ ] Accepted study intent.
- [ ] Existing local concept sets.
- [ ] Existing local cohort expressions where concept sets can be reused.
- [ ] User-selected PICO role:
  - [ ] population
  - [ ] exposure/intervention
  - [ ] comparator
  - [ ] outcome
  - [ ] exclusion
  - [ ] subgroup

### Draft Payload Shape

Each draft concept set asset should include:

- [ ] title
- [ ] PICO role
- [ ] domain
- [ ] clinical rationale
- [ ] search terms used
- [ ] included concepts
- [ ] excluded concepts
- [ ] include descendants flag
- [ ] include mapped flag
- [ ] concept-level rationale
- [ ] source concept set references, if reused
- [ ] vocabulary metadata for each concept:
  - [ ] concept ID
  - [ ] concept name
  - [ ] domain ID
  - [ ] vocabulary ID
  - [ ] concept class ID
  - [ ] standard concept flag
  - [ ] concept code
  - [ ] invalid reason

### Verification Rules

- [ ] Block missing concept IDs.
- [ ] Block invalid concepts unless explicitly excluded and documented.
- [ ] Warn on non-standard concepts.
- [ ] Warn on mixed domains.
- [ ] Warn on broad ancestor concepts with descendants enabled.
- [ ] Warn on mapped expansion when vocabulary source mappings are incomplete.
- [ ] Block duplicate concepts with contradictory include/exclude flags.
- [ ] Require at least one included concept unless the draft is a pure exclusion set.
- [ ] Require domain consistency with PICO role unless explicitly justified.

### API

- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/concept-sets/draft`
- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/concept-sets/verify`
- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/concept-sets/materialize`

### UI

- [ ] Add `ConceptSetDraftPanel`.
- [ ] Show candidate concepts in a table.
- [ ] Show standard/non-standard/invalid flags.
- [ ] Show include descendants/include mapped/excluded flags.
- [ ] Allow user to remove concepts before acceptance.
- [ ] Allow user to search/add vocabulary concepts manually.
- [ ] Allow user to accept, defer, reject, or materialize.
- [ ] Link materialized concept set to native concept set detail/editor.

### Tests

- [ ] Unit test: validates good concept draft.
- [ ] Unit test: blocks missing concepts.
- [ ] Unit test: blocks invalid concepts.
- [ ] Unit test: warns on non-standard concepts.
- [ ] Unit test: warns on mixed domains.
- [ ] PostgreSQL feature test: materializes accepted draft into `concept_sets`.
- [ ] PostgreSQL feature test: creates correct `concept_set_items`.
- [ ] Regression test: materialized concept set opens through native concept set endpoint.

Exit criteria:

- Study Designer can create concept set drafts.
- Drafts cannot use hallucinated concepts.
- Materialized concept sets are normal Parthenon concept sets.

## Phase 4: Cohort Drafting And Linting

Purpose: generate reviewed ATLAS/Circe-compatible cohort drafts from accepted concept sets.

### Backend Services

- [ ] Add `StudyCohortDraftService`.
- [ ] Add `StudyCohortDraftVerifier`.
- [ ] Add `StudyCohortMaterializer`.
- [ ] Add `StudyCohortRoleLinker`.
- [ ] Reuse existing cohort import/validation/SQL preview logic where possible.
- [ ] Integrate StudyAgent cohort lint only as advisory; deterministic checks remain authoritative.

### Draft Inputs

- [ ] Accepted intent.
- [ ] Accepted/materialized concept sets.
- [ ] Accepted phenotype/reuse recommendations.
- [ ] Role mapping:
  - [ ] target
  - [ ] comparator
  - [ ] outcome
  - [ ] exclusion
  - [ ] subgroup

### Cohort Draft Requirements

- [ ] ATLAS/Circe-compatible JSON.
- [ ] Human-readable logic description.
- [ ] Entry event criteria.
- [ ] Index date definition.
- [ ] Observation period requirements.
- [ ] Inclusion rules.
- [ ] Exit criteria.
- [ ] Concept set references.
- [ ] Role metadata.
- [ ] Provenance from concept set drafts/recommendations.

### Verification Rules

- [ ] Block cohort drafts with no entry event.
- [ ] Block missing target/outcome role when required by study type.
- [ ] Warn on missing washout/observation period.
- [ ] Warn on broad criteria likely to produce nonspecific cohorts.
- [ ] Warn when outcome definition overlaps target definition unexpectedly.
- [ ] Verify referenced concept sets exist and are accepted/materialized.
- [ ] Verify cohort JSON can be stored and reopened by native cohort editor.

### API

- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/cohorts/draft`
- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/cohorts/lint`
- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/cohorts/materialize`
- [ ] `POST /api/v1/studies/{study}/design-sessions/{session}/assets/{asset}/cohorts/link-to-study`

### UI

- [ ] Add `CohortDraftPanel`.
- [ ] Add human-readable logic preview.
- [ ] Add JSON/technical preview for advanced users.
- [ ] Show role mapping.
- [ ] Show lint checks and warnings.
- [ ] Link materialized cohort to native cohort definition editor.
- [ ] Link study cohort role assignment after materialization.

### Tests

- [ ] Unit test: generated cohort draft shape.
- [ ] Unit test: missing entry event is blocked.
- [ ] Unit test: missing concept set reference is blocked.
- [ ] PostgreSQL feature test: materializes cohort definition.
- [ ] PostgreSQL feature test: links materialized cohort to `study_cohorts`.
- [ ] Regression test: materialized cohort opens via native cohort endpoint.

Exit criteria:

- Generated cohorts are real `cohort_definitions`.
- Study cohort role snapshots are populated.
- Native cohort editor remains the canonical editing surface.

## Phase 5: Source-Aware Feasibility And Diagnostics

Purpose: prevent locking or analyzing designs that are empty, underpowered, or source-incompatible.

### Backend Services

- [x] Add `StudyFeasibilityService`.
- [x] Add feasibility run storage if existing tables are insufficient.
  - Implemented as source-scoped `study_design_assets` evidence plus `study_design_versions.feasibility_summary_json`; no new table needed for the first Phase 5 slice.
- [x] Add source-scoped feasibility result assets.
- [x] Integrate with cohort generation/counting where available.
- [x] Pull DQD/Achilles/Ares warnings where available.
  - DQD and Achilles metadata are included; Ares-specific rollups remain a later enrichment because they derive from DQD/Achilles/source history services.

### Feasibility Metrics

- [x] Target cohort count by source.
- [x] Comparator cohort count by source.
- [x] Outcome cohort count by source.
- [x] Target/comparator/outcome overlap.
- [x] Attrition by inclusion rule.
  - Uses cohort generation inclusion-rule stats when present; otherwise stores a generation-level fallback step so the feasibility evidence shape remains stable.
- [x] Observation period availability.
- [x] Date coverage.
- [x] Data freshness.
- [x] Domain availability.
- [x] Small-cell suppression.
- [x] Missing concept/domain warnings.

### UI

- [x] Add `FeasibilityDashboard`.
- [x] Show source selection.
- [x] Show cohort counts.
- [x] Show overlap matrix.
- [x] Show attrition.
- [x] Show source warnings.
- [x] Show lock blockers.

### Tests

- [x] Unit/feature test feasibility result shape.
- [x] Feature test source-scoped feasibility run.
- [x] Test small-cell suppression.
- [x] Test empty required cohort blocks lock/analysis readiness.
- [x] Test DQD warning inclusion.

Exit criteria:

- Feasibility is stored as study design evidence.
- Study lock is blocked for empty or unsupported required cohorts.

## Phase 6: Analysis Plan Generation

Purpose: generate HADES-compatible native Parthenon analysis designs only after cohorts and feasibility exist.

### Analysis Type Mapping

- [x] Descriptive/epidemiologic question -> characterization.
- [x] Target/comparator/outcome causal question -> CohortMethod estimation.
- [x] Prediction question -> PatientLevelPrediction.
- [x] Incidence/prevalence question -> incidence rate.
- [x] Treatment sequence question -> pathways/TreatmentPatterns.
- [x] Acute exposure/self-controlled question -> SCCS or SelfControlledCohort.
- [x] Multi-site effect synthesis -> evidence synthesis.

### Backend Services

- [x] Add `StudyAnalysisPlanService`.
  - Uses Darkstar `/hades/packages` as the local HADES capability inventory.
- [x] Add `StudyAnalysisPlanVerifier`.
- [x] Add analysis materializers for supported analysis types.
  - Materializes accepted `analysis_plan` assets into native analysis tables and `study_analyses` links.
- [x] Preserve role links to study cohorts.
- [x] Preserve package/version assumptions.

### Verification Rules

- [x] Block unsupported study type/analysis combinations.
- [x] Block missing target/comparator/outcome roles for estimation.
- [x] Block prediction plans without outcome and target roles.
- [x] Warn if feasibility is underpowered.
- [x] Warn if data source lacks needed domains.
- [x] Require human acceptance before materialization.

### UI

- [x] Add `AnalysisPlanPanel`.
- [x] Show recommended analysis type.
- [x] Show cohort role dependencies.
- [x] Show assumptions.
- [x] Show alternatives.
- [x] Allow materialization into native analysis tables.
- [x] Link materialized analysis to native analysis editor.

### Tests

- [x] Unit/feature test study-type-to-analysis mapping.
- [x] Unit/feature test blockers for missing roles and Darkstar package availability.
- [x] Feature test materializes characterization.
- [x] Feature test materializes estimation or prediction when prerequisites exist.
- [x] Regression test materialized analysis opens via native endpoint.

Exit criteria:

- Study Designer can create native analysis records from reviewed design state.
- Analysis records remain editable in native designers.

## Phase 7: Locking, Versioning, And Study Package

Purpose: freeze a reproducible study design version.

### Backend

- [x] Add `StudyDesignLockService`.
- [x] Add compilation run model/table if needed.
  - Existing `study_design_assets` plus native `study_artifacts` now carry the locked package snapshot; no extra table needed.
- [ ] Snapshot:
  - [x] accepted intent
  - [x] accepted concept sets
  - [x] accepted cohort definitions
  - [x] study cohort role assignments
  - [x] analysis design JSON
  - [x] source assumptions
  - [x] feasibility evidence
  - [x] verification evidence
  - [x] AI event provenance
  - [x] reviewer provenance
  - [x] package/library versions
- [x] Prevent mutation of locked design versions.
- [x] Allow superseding via a new design version.

### UI

- [x] Add `LockStudyDesignPanel`.
- [x] Show lock blockers.
- [x] Show completeness checklist.
- [x] Show downloadable package summary.
- [ ] Show provenance summary.

### Tests

- [ ] Unit test lock readiness checks.
- [x] Feature test lock blocked when concept sets missing.
- [x] Feature test lock blocked when feasibility missing.
- [x] Feature test locked version immutable.
- [x] Feature test superseding locked version creates new version.

Exit criteria:

- A locked Study Designer version is reproducible and auditable.
- The design can be exported/executed without relying on transient AI state.

## Phase 8: Bottom-Up Compatibility And Critique Mode

Purpose: make Study Designer useful for studies built manually.

### Import Existing Assets

- [ ] Import current `study_cohorts` into a design session.
- [ ] Import current `study_analyses` into a design session.
- [ ] Infer PICO roles where possible.
- [ ] Flag unknown roles for user review.
- [ ] Preserve manual provenance.

### Critique Existing Design

- [ ] AI can critique missing PICO pieces.
- [ ] Deterministic services can flag missing concept metadata.
- [ ] Deterministic services can flag missing feasibility evidence.
- [ ] Deterministic services can flag unsupported analysis/cohort combinations.
- [ ] User can accept suggested improvements into a new design version.

### Tests

- [ ] Feature test import from existing study cohorts.
- [ ] Feature test import from existing analyses.
- [ ] Test no existing canonical assets are mutated during import.
- [ ] Test critique creates reviewable assets, not direct mutations.

Exit criteria:

- Bottom-up users can enter Study Designer later without losing control of their manually built assets.

## Cross-Cutting Security And Safety

- [ ] Never send row-level patient data to AI providers.
- [ ] Store AI event summaries, not raw PHI.
- [ ] Log provider/model/prompt-template/version for every AI event.
- [ ] Track user acceptance for every generated artifact.
- [ ] Add RBAC checks for:
  - [ ] creating design sessions
  - [ ] generating AI drafts
  - [ ] accepting assets
  - [ ] materializing assets
  - [ ] locking designs
- [ ] Add rate limits or budget controls for AI generation endpoints.
- [ ] Add prompt-injection resistant handling for protocol text.
- [ ] Add audit events for blocked materialization attempts.

## Cross-Cutting Observability

- [ ] Add system health checks for:
  - [ ] StudyAgent
  - [ ] Anthropic/OpenAI provider configuration if used
  - [ ] vocabulary search
  - [ ] PhenotypeLibrary availability
  - [ ] Circe/cohort generation path
  - [ ] HADES package inventory
  - [ ] DQD/Achilles/Ares metadata
- [ ] Add structured logs for:
  - [ ] intent extraction
  - [ ] recommendation generation
  - [ ] verification blocking
  - [ ] materialization
  - [ ] lock readiness failures
- [ ] Add metrics:
  - [ ] AI latency
  - [ ] verification pass/partial/blocked counts
  - [ ] user acceptance rates
  - [ ] materialization failures
  - [ ] feasibility blockers

## Test Matrix

### Backend Required

- [ ] `php -l` on touched PHP files.
- [ ] Pint on touched PHP files.
- [ ] PHPStan on production Study Design code.
- [ ] PostgreSQL feature tests against disposable database.
- [ ] Route list check for new endpoints.
- [ ] Unit tests for deterministic verifiers.
- [ ] Feature tests for materialization.
- [ ] Regression tests for native editor endpoints.

### Frontend Required

- [ ] TypeScript build.
- [ ] Targeted ESLint.
- [ ] Component tests for:
  - [ ] verification badges
  - [ ] disabled Accept
  - [ ] evidence drawer
  - [ ] concept draft table
  - [ ] cohort draft preview
  - [ ] lock blocker checklist

### End-To-End Required

- [ ] Research question to accepted intent.
- [ ] Accepted intent to verified recommendations.
- [ ] Verified recommendation to concept set draft.
- [ ] Concept set draft to materialized concept set.
- [ ] Materialized concept set to cohort draft.
- [ ] Cohort draft to materialized cohort.
- [ ] Materialized cohorts to feasibility evidence.
- [ ] Feasible cohorts to analysis plan.
- [ ] Analysis plan to materialized native analysis.
- [ ] Complete design to locked study package.

## Definition Of Done For The End Goal

The Study Designer is complete enough when:

- [ ] A researcher can start with a research question and produce reviewed PICO intent.
- [ ] The system recommends reusable OHDSI/local assets with deterministic verification.
- [ ] The system drafts vocabulary-grounded concept sets without hallucinated concept IDs.
- [ ] The system materializes accepted drafts into native Parthenon concept sets.
- [ ] The system drafts ATLAS/Circe-compatible cohorts from accepted concepts.
- [ ] The system materializes accepted cohorts into native Parthenon cohort definitions.
- [ ] The system links cohorts into study roles with snapshots.
- [ ] The system runs source-aware feasibility before analysis planning.
- [ ] The system proposes HADES-compatible native analysis designs.
- [ ] The system materializes accepted analyses into native analysis tables.
- [ ] The system locks reproducible study versions with full provenance.
- [ ] Bottom-up users can import and critique existing study assets.
- [ ] Every generated artifact is reviewable, auditable, and reproducible.

## Recommended Build Order

1. Phase 0: stabilize tests, constants, typed responses, and wording.
2. Phase 2.5: evidence/provenance/ranking hardening.
3. Phase 3: concept set drafting and materialization.
4. Phase 4: cohort drafting and study cohort linking.
5. Phase 5: feasibility and diagnostics.
6. Phase 6: analysis plan generation.
7. Phase 7: lock/reproducible study package.
8. Phase 8: bottom-up import and critique mode.

Do not start Phase 4 until Phase 3 materialization passes native concept set endpoint regression tests.

Do not start Phase 6 until Phase 5 can identify empty/underpowered required cohorts.

Do not implement locking until canonical concept sets, cohorts, study cohort roles, feasibility, and analysis plans are all represented as materialized or accepted assets.
