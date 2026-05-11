# Study Design Compiler Abby + MedGemma Harness TODO

> **For agentic workers:** Implement this task-by-task with narrow commits. Abby is the product-facing assistant and workflow harness. MedGemma 27B on local Ollama is Abby's local control plane. Claude is the scoped research-grade evaluator for protocol compiler work when the Study Design Compiler cloud-evaluation flag is enabled. Keep canonical writes deterministic, validated, auditable, and user-reviewed.

**Goal:** Turn the Study Design Compiler into a guided, Abby-assisted protocol-to-artifacts workflow: protocol or question in, reviewed OHDSI-aligned intent and draft assets out, deterministic validators at every gate, canonical Parthenon/OHDSI assets after human acceptance, and a lockable package with provenance.

**Core rule:** Ordinary Abby chat runs locally on Ollama with MedGemma 27B by default. Protocol upload may use Claude through an explicit Abby-scoped Study Design Compiler evaluation path. Model calls may extract, critique, rank, and propose. Parthenon validates. Abby explains and guides. The user approves. Materializers write canonical records.

**Primary surfaces:**

- `frontend/src/features/studies/components/StudyDesignWorkbench.tsx`
- `frontend/src/features/studies/api/studyApi.ts`
- `frontend/src/features/studies/hooks/useStudies.ts`
- `frontend/src/features/studies/types/study.ts`
- `backend/app/Http/Controllers/Api/V1/StudyDesignController.php`
- `backend/app/Services/StudyDesign/*`
- `backend/tests/Feature/Api/V1/StudyDesignTest.php`
- `frontend/src/features/studies/components/__tests__/*`

---

## Phase 0: Guardrails and Vocabulary

- [x] Rename protocol-import user-facing and test-facing stale "Claude" labels to Abby/provider-neutral labels.
- [x] Preserve provider provenance in audit records as `provider=anthropic`, `model=<configured model>`.
- [x] Replace source labels like `protocol_upload_claude` with Abby/provider-neutral labels for new records while preserving backward-compatible readers.
- [x] Confirm remote-provider governance: administrators can decide whether Study Design Compiler may send protocol-derived text to a remote provider.
- [x] Keep Abby local by default with `ABBY_OLLAMA_MODEL=puyangwang/medgemma-27b-it:q4_0` and `ABBY_CLOUD_ROUTING_ENABLED=false`.
- [x] Keep protocol evaluation explicit with `ABBY_PROTOCOL_CLOUD_EVALUATION_ENABLED=true` for Claude-backed Study Design Compiler imports.
- [x] Confirm raw protocol storage policy: raw uploaded protocol text is not persisted unless an explicit admin setting permits it.
- [x] Keep bottom-up authoring canonical: Study Design Compiler must compile into the same Concept Set, Cohort Definition, Study Cohort, Study Analysis, and Study Artifact models.

## Phase 1: Deterministic Abby Guidance Layer

- [x] Create a durable implementation TODO for Abby + local MedGemma Study Design Compiler work.
- [x] Add a frontend guidance model that derives compiler stage, blockers, warnings, metrics, and next best action from the loaded version/assets/readiness.
- [x] Add a persistent guidance rail/stepper to the workbench.
- [x] Show users where they are, what Abby found, why a stage is blocked, and the safest next action.
- [x] Convert existing disabled-button conditions into visible explanations.
- [x] Add focused tests for guidance derivation.
- [x] Add a frontend journey test for upload/import staying in-place and showing compiler guidance.

## Phase 2: Abby Orchestration Backend

- [x] Create `StudyDesignAbbyOrchestrator`.
- [x] Create a local Ollama/MedGemma client for Study Design Compiler tasks.
- [x] Keep the protocol Claude evaluator behind an explicit Abby-scoped Study Design Compiler cloud provider flag.
- [x] Create `StudyDesignContextBuilder`.
- [x] Create `StudyDesignGuidanceService`.
- [x] Create `StudyDesignToolRunner`.
- [x] Create `StudyDesignStructuredOutputSchemas`.
- [x] Make the protocol cloud evaluator resolve configured `AiProviderSetting` first, then fallback env config.
- [x] Record protocol import Abby/model calls in `StudyDesignAiEvent` with provider, model, prompt/schema version, input summary, output payload, and safety flags.
- [x] Add graceful degradation when the scoped remote evaluator is disabled or misconfigured before draft persistence.
- [x] Add graceful degradation when the scoped remote evaluator times out or returns invalid structured output.

## Phase 3: Local MedGemma Harness and Optional Cloud Harness

- [x] Use local Ollama/MedGemma through a single backend client, not scattered `Http::post` calls.
- [x] If cloud routing is later enabled, use Claude Messages API through a separate optional backend client.
- [x] Add request builders for structured JSON outputs.
- [x] Add schema validation for each model output before any draft asset is persisted.
- [x] Add output handling for refusal, max-token truncation, malformed payload, timeout, and provider 4xx/5xx responses.
- [x] Add optional prompt caching for large, repeated context blocks such as protocol extracts, OHDSI conventions, and schema instructions.
- [x] Avoid provider-specific language in user-facing UI; show provider/model only in audit/admin surfaces.

## Phase 4: Tool Surface for Abby and Model Proposals

Tool calls should read, validate, and propose. They should not write canonical records directly.

- [x] Add `study_design_get_context`.
- [x] Add `vocabulary_search_concepts`.
- [x] Add `vocabulary_validate_concepts`.
- [x] Add `phenotype_search_library`.
- [x] Add `local_concept_set_search`.
- [x] Add `local_cohort_search`.
- [x] Add `cohort_expression_validate`.
- [x] Add `hades_package_status`.
- [x] Add `data_source_profile`.
- [x] Add `study_design_readiness_check`.
- [x] Add `draft_asset_patch`.
- [x] Add tests proving tool responses are high-signal and do not leak unrelated PHI/source rows.

## Phase 5: Structured Output Schemas

- [x] `ProtocolExtractionSchema`: required intent/PICO fields plus structured arrays and plan object shape.
- [x] Extend `ProtocolExtractionSchema` with evidence spans, confidence, uncertainty, and design assumptions.
- [x] `CompilerGuidanceSchema`: current stage, next action, blockers, warnings, completed stages, action targets.
- [x] `PhenotypeRecommendationSchema`: ranked reusable phenotypes/cohorts/concept sets with rationale and provenance.
- [x] `ConceptSetDraftSchema`: title, role, domain, search terms, candidate concepts, inclusion flags, rationale, evidence.
- [x] `CohortDraftSchema`: title, role, concept sets, entry event, observation window, inclusion rules, exit/censoring, Circe expression.
- [x] `AnalysisPlanDraftSchema`: analysis family, HADES package, design parameters, feasibility assumptions, required cohorts.
- [x] `AssetRepairSuggestionSchema`: patch proposal, user-visible explanation, risks, verifier expectations.
- [x] `PackageManifestReviewSchema`: lock readiness, manifest preview, unresolved risks, provenance summary.

## Phase 6: Protocol Import Upgrade

- [x] Route protocol upload through `StudyDesignAbbyOrchestrator`.
- [x] Keep upload in-place for standalone Study Designer and embedded study workbench.
- [x] Preserve current file extraction support: `.doc`, `.docx`, `.pdf`, `.md`, `.markdown`.
- [x] Return both `version` and Abby extraction summary to the frontend.
- [x] Show evidence spans and confidence in the Intent Review panel.
- [x] Add structured validation before creating draft assets.
- [x] Add initial protocol gates so under-specified protocol uploads fail before draft persistence with field-level reasons.
- [x] Show initial-gate failure details back to the user in the Study Design workbench error banner.
- [x] Keep no-OMOP-ID-invention guard: Abby can propose terms; Parthenon vocabulary search/validation supplies concept IDs.

## Phase 7: Intent Review Assistance

- [x] Add Abby review summary above the intent form.
- [x] Identify missing PICO fields.
- [x] Identify weak comparator/outcome/time-at-risk text.
- [x] Suggest safer OHDSI-aligned wording.
- [x] Let users apply suggested field patches individually.
- [x] Keep Save Review and Accept Intent as explicit user actions.
- [x] Add tests for blocked accept state and patch application.

## Phase 8: Bottom-Up Compatibility Assistance

- [x] Convert imported current-study critique output into actionable tasks.
- [x] Group tasks by cohorts, concept sets, analyses, feasibility, and package readiness.
- [x] Add "resolve this" action targets where a direct next step exists.
- [x] Show imported assets with provenance, native links, and compatibility status.
- [x] Ensure critique never modifies existing canonical records.

## Phase 9: Phenotype Recommendation Assistance

- [x] Route recommendations through `StudyPhenotypeRecommendationService`.
- [x] Merge Abby recommendations with StudyAgent, Phenotype Library, local cohorts, and local concept sets.
- [x] Rank by match, computability, verification status, provenance quality, and reuse value.
- [x] Show why Abby recommends each item.
- [x] Show which downstream actions become available after acceptance.
- [x] Add accept/defer/reject notes.
- [x] Add tests for deterministic rank ordering and acceptability gates.

## Phase 10: Concept Set Draft Assistance

- [x] Route default concept drafting through `StudyConceptSetDraftService`.
- [x] Add Abby-assisted concept search terms from protocol evidence.
- [x] Add structured editor fields: title, role, domain, clinical rationale, search terms, source references, concepts.
- [x] Add batch verify for all concept drafts.
- [x] Add repair suggestions for missing, deprecated, non-standard, or domain-mismatched concepts.
- [x] Add "apply Abby patch" action that updates only the draft payload.
- [x] Require deterministic verifier pass before acceptance.
- [x] Require acceptance before materialization.
- [x] Add tests for deprecated OMOP concepts blocking readiness.

## Phase 11: Cohort Draft Assistance

- [x] Replace skeletal inline cohort materialization with `StudyCohortDraftService` + `StudyCohortMaterializer`.
- [x] Generate meaningful Circe-compatible cohort expressions from accepted/materialized concept sets.
- [x] Add role-aware templates for target, comparator, outcome, exclusion, subgroup, and event cohorts.
- [x] Add editor/review surface for entry event, observation window, inclusion rules, exit criteria, censoring, collapse settings, and role link.
- [x] Add Abby repair suggestions for empty criteria lists, missing concept sets, missing observation windows, and invalid role links.
- [x] Verify expression shape before materialization.
- [x] Link materialized cohorts to the study through `StudyCohortRoleLinker`.
- [x] Add tests that materialized cohort expressions are non-empty and native editor compatible.

## Phase 12: Cohort Readiness and Linking

- [x] Expand readiness response with action targets for each blocker.
- [x] Show required roles, present roles, materialized count, linked count, and missing roles in one visible checklist.
- [x] Add one-click link action where role can be inferred safely.
- [x] Add explicit role selector when the role is ambiguous.
- [x] Add tests for readiness blockers becoming direct UI actions.

## Phase 13: Feasibility Assistance

- [x] Improve source selection with select-all, clear, default source, and source readiness presets.
- [x] Explain source blockers and warnings in Abby guidance language.
- [x] Preserve small-cell threshold in the feasibility asset payload.
- [x] Add feasibility rerun history comparison.
- [x] Add action targets from feasibility blockers back to cohort linking or concept/cohort repair.
- [x] Add tests for blocked feasibility until required cohorts are linked.

## Phase 14: Analysis Plan Assistance

- [x] Add analysis-family selector before drafting.
- [x] Let Abby recommend analysis families from protocol intent and feasibility.
- [x] Explain HADES package status and missing package remediation.
- [x] Add parameter review for each analysis plan.
- [x] Add reject/repair loop; current panel only supports accept/defer.
- [x] Require verifier pass before acceptance.
- [x] Materialize through `StudyAnalysisPlanMaterializer`.
- [x] Add tests for missing HADES package warnings and materialization gates.

## Phase 15: Package Lock Assistance

- [x] Expand lock readiness into grouped checklist: intent, recommendations, concept sets, cohorts, feasibility, analyses, package artifact.
- [x] Show all blockers and warnings, not only the first.
- [x] Add Abby final package review before lock.
- [x] Preview package contents before locking.
- [x] Confirm package artifact URL and download behavior.
- [x] Add tests for package lock blockers and manifest provenance.

## Phase 16: Frontend Type and UX Hardening

- [x] Remove `@ts-nocheck` from `StudyDesignWorkbench.tsx`.
- [x] Split workbench panels into typed components.
- [x] Normalize `StudyDesignReadiness` frontend type to match backend payload.
- [x] Add stable stage/action TypeScript types.
- [x] Keep UI dense, work-focused, and non-marketing.
- [x] Use icons for actions and compact status chips.
- [x] Ensure mobile layout does not overlap or hide action buttons.
- [x] Add focused accessibility checks for buttons, file upload, and guidance rail.

## Phase 17: Backend Service Consolidation

- [x] Inject `StudyPhenotypeRecommendationService` into `StudyDesignController`.
- [x] Inject `StudyConceptSetDraftService` into `StudyDesignController`.
- [x] Inject `StudyCohortDraftService` into `StudyDesignController`.
- [x] Inject `StudyCohortMaterializer` into `StudyDesignController`.
- [x] Inject `StudyCohortRoleLinker` into `StudyDesignController`.
- [x] Inject `StudyDesignLockService` into `StudyDesignController`.
- [x] Remove inline fallback draft/materialization logic once service paths are tested.
- [x] Keep legacy response shapes stable for frontend compatibility.

## Phase 18: Testing and Verification

- [x] Backend focused tests: protocol import, structured output validation, provider fallback, disabled remote AI, provider failure handling, concept verifier, cohort materializer, feasibility gate, analysis verifier, lock readiness.
- [x] Frontend focused tests: guidance model, workbench guidance rail, protocol upload, intent review patching, bottom-up compatibility tasks, protocol initial-gate errors, concept repair, cohort repair, feasibility gate, analysis-plan gate.
- [x] Run targeted Vitest for Study Design frontend tests.
- [x] Run targeted Pest tests for Study Design backend tests.
- [x] Run frontend lint on changed Study Design files.
- [x] When shipping frontend changes, run `./deploy.sh --frontend`.
- [x] Smoke-check `/`, `/login`, and `/jobs` after frontend deploy.

## Phase 19: Finishing Pass to 100%

- [x] Add protocol evidence spans, confidence, uncertainty, and design assumptions to the protocol extraction schema, persisted intent, normalized spec, AI event output, and Intent Review UI.
- [x] Add named structured output schemas for phenotype recommendations, concept set drafts, cohort drafts, analysis plans, repair suggestions, and package manifest review.
- [x] Keep named schemas available through the Abby orchestrator so future Claude/MedGemma calls can request one explicit output contract per compiler stage.
- [x] Remove remaining inline fallback draft/materialization logic now that concept set, cohort, analysis, lock, and guidance service paths are covered.
- [x] Broaden frontend focused tests across every Study Design Compiler panel: guidance, upload/progress, intent review, compatibility, recommendations, concept sets, cohorts, feasibility, analysis plans, package lock, and API guidance.
- [x] Add optional prompt caching support for repeated Claude protocol/OHDSI/schema context blocks behind an explicit environment flag.
- [x] Re-run backend Study Design focused tests, frontend Study Design Vitest suites, frontend lint/type checks, and deploy/smoke the shipped frontend.

---

## Execution Notes

- This plan begins with deterministic guidance because it immediately helps users and does not require new remote-AI plumbing.
- Optional cloud integration should enter behind Abby orchestration and structured schemas, not directly inside controllers or React components.
- Every generated artifact must carry provenance and remain reviewable before materialization.
- User-facing language should say Abby. Provider names belong in audit/admin/provenance contexts.
- 2026-04-27: Added deterministic Intent Review assistance in `studyDesignIntentAssistance.ts` plus an Abby Review panel in the workbench. It surfaces missing/weak intent fields, conservative OHDSI-aligned wording, protocol-source metadata, open questions, risk notes, and user-applied draft field patches before Save Review/Accept Intent. Verified with targeted Vitest, focused ESLint, `./deploy.sh --frontend`, deploy smoke checks for `/`, `/login`, `/jobs`, and a live 200 for `/studies/hypertension-study-v3-2?tab=design`.
- 2026-04-27: Added bottom-up compatibility assistance in `studyDesignCompatibilityAssistance.ts` and expanded the Current Assets panel into grouped Abby compatibility tasks with native links and review-only policy messaging. Added protocol initial-gate enforcement: under-specified uploads fail before version/assets/events are persisted and return field-level issues to the frontend. Verified with targeted Vitest, focused ESLint, PHP syntax checks, Pint, `StudyDesignTest.php`, `./deploy.sh --php`, `./deploy.sh --frontend`, deploy smoke checks for `/`, `/login`, `/jobs`, shipped-bundle string checks, and a live 200 for `/studies/hypertension-study-v3-2?tab=design`.
- 2026-04-27: Completed Phase 9 recommendation assistance by routing `/phenotypes/recommend` through `StudyPhenotypeRecommendationService`, expanding term extraction for both manual intent and protocol imports, recording Abby deterministic reuse-ranker events, and letting users add review notes when accepting, deferring, or rejecting recommendations. Verified with focused ESLint, targeted Vitest, Pint, `StudyDesignTest.php`, `./deploy.sh --php`, and `./deploy.sh --frontend`. The first PHP deploy surfaced a docs rebuild OOM during the Korean locale build; increased the docs-build container memory envelope and reran deploy successfully, with `/`, `/login`, `/jobs`, API smoke checks, HADES package parity, shipped-bundle string checks, docs locale entrypoint checks, and a live 200 for `/studies/hypertension-study-v3-2?tab=design`.
- 2026-04-27: Completed Phase 10 concept set draft assistance by routing draft creation through `StudyConceptSetDraftService`, seeding Abby search terms from protocol evidence, adding batch verification, returning repair suggestions for missing/deprecated/non-standard/domain-mismatched OMOP concepts, adding an Apply Abby patch flow that mutates only the draft payload, and enforcing verified-then-accepted gates before materialization. Verified with focused ESLint, targeted Vitest, PHP syntax checks, Pint, `StudyDesignTest.php`, `./deploy.sh --php`, and `./deploy.sh --frontend`. The first PHP deploy exposed a stale Docusaurus generated-cache failure in the fallback docs rebuild path; added cache clearing to the guard and reran deploy successfully, then confirmed shipped Study Design bundle strings, the batch verify route, and a live 200 for `/studies/hypertension-study-v3-2?tab=design`.
- 2026-04-27: Completed Phase 11 cohort draft assistance by routing cohort drafting, materialization, and study-role linking through `StudyCohortDraftService`, `StudyCohortMaterializer`, and `StudyCohortRoleLinker`; generating Circe-compatible first-event cohort expressions from materialized concept sets; verifying expression shape, observation windows, limits, collapse settings, and linkable roles; and adding Abby cohort repair patches for incomplete drafts. Verified with PHP syntax checks, Pint, focused ESLint, targeted Vitest, and `StudyDesignTest.php` (20 tests, 215 assertions). A pre-existing GIS seed migration blocked the test database before assertions; added a narrow table-existence guard so unrelated GIS state no longer masks Study Design test results.
- 2026-04-27: Completed Phase 13 feasibility assistance by blocking feasibility until required study cohorts pass readiness, adding source presets and explicit selected-source controls, preserving small-cell thresholds in generated feasibility payloads, surfacing previous-run comparisons, and attaching action targets from source blockers back to cohort/source repair workflows. Verified with `StudyDesignTest.php`, targeted Study Design Vitest suites, focused ESLint, Pint, and whitespace checks.
- 2026-04-27: Completed Phase 14 analysis plan assistance by adding pre-draft family selection, deterministic Abby family recommendations from intent/cohort/feasibility evidence, HADES package remediation guidance, parameter-review rows, reject/re-draft and re-verify loops, and a materializer enum-cast fix so verified accepted plans can become native analyses. Verified with `StudyDesignTest.php`, targeted Study Design Vitest suites, focused ESLint, Pint, and whitespace checks.
- 2026-04-27: Completed Phase 15 package lock assistance by expanding lock readiness into a grouped checklist, returning structured blockers/warnings alongside legacy blocking reasons, adding Abby final package review, adding manifest preview contents and artifact metadata, and rendering all blockers/warnings plus download links in the workbench. Verified with `StudyDesignTest.php`, targeted Study Design Vitest suites, focused ESLint, Pint, and whitespace checks.
- 2026-04-27: Started Phase 16 frontend hardening by removing `@ts-nocheck` from `StudyDesignWorkbench.tsx`, typing the lock checklist and manifest preview payloads, normalizing loose Study Design asset payload reads, and fixing the existing-design import selection to use the returned version id. Verified with `npx tsc -b --pretty false --noEmit`, focused Study Design Vitest suites, focused ESLint, and whitespace checks.
- 2026-04-27: Continued Phase 16 by extracting the package lock UI into `StudyDesignLockPanel.tsx` with local typed helpers for checklist, manifest metrics, and issue rows. Re-verified with TypeScript, focused ESLint, focused Study Design Vitest suites, and whitespace checks.
- 2026-04-27: Added shared compiler stage/action types for Study Design guidance and readiness actions, attached typed next-action metadata to the guidance rail, hardened the main workbench and lock panel headers for small screens, and added focused accessibility assertions for the protocol upload control and Abby guidance region. Verified with TypeScript, focused ESLint, focused Study Design Vitest suites, and whitespace checks.
- 2026-04-27: Completed the Phase 16 status-chip pass by replacing plain guidance and package-checklist status text with compact icon-bearing chips while keeping the dense workbench layout. Re-verified with TypeScript, focused ESLint, focused Study Design Vitest suites, and whitespace checks.
- 2026-04-27: Started Phase 17 backend consolidation by routing concept-set materialization through `StudyConceptSetMaterializer` while preserving the legacy endpoint response and acceptance/verification gate messages. Fixed enum-cast comparisons inside the service. Verified with syntax checks, Pint, focused concept-set tests, and the full `StudyDesignTest.php` suite.
- 2026-04-27: Continued Phase 17 by reconciling `StudyDesignLockService` with the current Abby final review and manifest-preview payload, delegating controller lock readiness/package creation to the service, and preserving the existing frontend response contract. Added a pre-lock readiness contract assertion for `checklist`, `abby_final_review`, `manifest_preview`, and `provenance_summary.package_manifest_sha256`. Verified with syntax checks, Pint, and focused lock-path `StudyDesignTest.php` filters.
- 2026-04-27: Closed the visible-gate helper pass by adding compact action-gate hints and disabled-button titles for intent generation, recommendation, concept-set draft, cohort draft, feasibility, analysis-plan, compatibility critique, intent accept/save, and package-lock actions. Verified with TypeScript, focused ESLint, focused Study Design Vitest suites, and whitespace checks.
- 2026-04-27: Added `StudyDesignContextBuilder` and an Abby orchestrator accessor for `study-design-context.v1` payloads. The context captures canonical study/session/version state, bounded Study Designer assets, native cohorts/analyses/artifacts, cohort and package readiness, action targets, and provenance summaries while filtering raw protocol text/source row samples. Added focused backend coverage proving the context compiles canonical OHDSI assets and avoids raw protocol text leakage.
- 2026-04-27: Added `StudyDesignToolRunner` with read-only Abby tools for `study_design_get_context`, `study_design_readiness_check`, `vocabulary_search_concepts`, `vocabulary_validate_concepts`, and `hades_package_status`, plus an Abby orchestrator pass-through. The runner resolves study/session/version state safely, bounds vocabulary/HADES outputs, and keeps mutation-capable tools out of this phase. Added focused backend coverage for every tool and for raw protocol text filtering.
- 2026-04-27: Added `StudyDesignGuidanceService` and a read-only guidance endpoint for `study-design-guidance.v1` payloads. The service turns sanitized compiler context and readiness outputs into initial-gate status, section-by-section blockers, warnings, counts, and prioritized Abby next actions for intent, concept sets, cohorts, feasibility, analysis plans, review, and package lock.
- 2026-04-27: Added `StudyDesignOllamaClient` for local Abby harness tasks on Ollama/MedGemma. The orchestrator now exposes `runLocalHarness()` for structured JSON harness output while keeping Claude scoped to protocol deep evaluation. The client resolves configured Ollama provider settings or `ABBY_OLLAMA_URL`, uses `ABBY_OLLAMA_MODEL`, strips raw protocol text/source rows from harness payloads, and records safety metadata that canonical writes and deep protocol evaluation are not allowed in the local harness path.
- 2026-04-27: Wired the frontend Study Design workbench to consume the backend `study-design-guidance.v1` endpoint through typed API/query hooks. The existing local guidance derivation remains as a fallback, while backend sections/actions now canonicalize the rail, blockers, warnings, and next best action when available. Study Design mutations now invalidate backend guidance alongside assets, readiness, and versions.
- 2026-04-27: Expanded the Abby read-only tool surface with `phenotype_search_library`, `local_concept_set_search`, `local_cohort_search`, `cohort_expression_validate`, and `data_source_profile`. The new tools return bounded summaries, validation issues, and provenance-ready reuse candidates without exposing connection strings, source row samples, raw protocol text, or write-capable mutation paths. Verified with PHP syntax checks, Pint, focused tool coverage, and the full `StudyDesignTest.php` suite.
- 2026-04-27: Added structured schema gates for local MedGemma harness output and protocol-derived draft asset inputs. Local harness responses now require summary/actions/warnings shape and reject canonical-write or draft-payload output; protocol imports reject model-provided OMOP concept IDs before draft persistence so vocabulary validation remains deterministic. Added `draft_asset_patch` as a proposal-only Abby tool that previews and validates supported draft payload patches without mutating assets or canonical records. Verified with focused tests and the full `StudyDesignTest.php` suite.
- 2026-04-27: Added the finishing schema/evidence pass: protocol extraction now carries evidence spans, field confidence, uncertainty, and design assumptions into persisted intent/spec/event output; the Intent Review panel renders evidence and confidence; Abby exposes named structured schemas for protocol extraction, guidance, phenotype recommendation, concept-set draft, cohort draft, analysis-plan draft, repair suggestion, and package-manifest review; session protocol imports now return version plus extraction metadata to the frontend; optional prompt caching is controlled by `ABBY_PROTOCOL_PROMPT_CACHING_ENABLED` and `ABBY_PROTOCOL_PROMPT_CACHE_TTL`; remote protocol Messages API transport lives in `StudyDesignClaudeClient`; user-facing Study Design UI/error language stays Abby/provider-neutral; and empty cohort fallback drafts were removed in favor of a 422 prerequisite error. Verified with focused backend/frontend tests, TypeScript, ESLint, Pint, `./deploy.sh --frontend`, `./deploy.sh --php`, deploy smoke checks, and a live 200 for `/studies/hypertension-study-v3-2?tab=design`.
