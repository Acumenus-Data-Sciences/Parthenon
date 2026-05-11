# Parthenon Inline Documentation Plan

> A phased, priority-ordered plan for systematically adding inline documentation across the Parthenon codebase. Designed to be executed by Claude Code agents with human review.

## Current State Assessment

### Documentation Coverage by Area

| Area | Files | Current Coverage | Doc Quality | Priority |
|------|-------|-----------------|-------------|----------|
| Backend Services | 369 | ~40% partial | Mixed — mappings good, orchestration weak | **P0 Critical** |
| Backend Controllers | 102 | 77% have PHPDoc, 65% have OpenAPI attrs | Moderate — method-level inconsistent | P1 High |
| Backend Models | 149 | ~85% class-level PHPDoc | Partial — relationships underdocumented | P1 High |
| Frontend Features | 37 modules, ~500+ files | ~28% JSDoc average | Sparse — API/hook layers worst | P1 High |
| Frontend Stores | 7 | ~15% | Minimal | P2 Medium |
| Frontend Shared Components | 44 | ~20% | Props typed, purpose undocumented | P2 Medium |
| Python AI Service | 33 modules | ~88% docstrings | Strong — best in codebase | P3 Low (polish) |
| R Runtime | 18 files | ~60% | Moderate — APIs good, utils weak | P2 Medium |
| Solr Configsets | 30 XML files | ~0% | None — purely structural | P1 High |
| Database Migrations | 161 | ~75% | Good inline comments | P3 Low (polish) |
| Jobs | 23 | ~85% | Strong | P3 Low (polish) |
| Console Commands | 37 | ~90% | Strong | P3 Low (polish) |

### Key Gaps Identified

1. **No module-level README or service inventory** for cross-service dependencies
2. **Backend Services orchestration undocumented** — FinnGenWorkbenchService (3,485 lines) has no top-level class doc
3. **127 Achilles analysis classes** with no central registry or catalog
4. **Frontend API functions universally lack JSDoc** — no endpoint, param, or error docs
5. **Frontend hooks lack parameter/return documentation** across all features
6. **Solr configsets have zero semantic documentation** — no explanation of analyzer choices or field strategies
7. **Commons controllers (13) entirely lack OpenAPI attributes**
8. **Cross-schema query patterns undocumented** at the service level

---

## Documentation Standards

### PHP (Backend)

All public classes and methods must have PHPDoc blocks. Follow this format:

```php
/**
 * Compiles a cohort definition JSON expression into executable SQL.
 *
 * Translates the Atlas-compatible JSON cohort expression into a CTE-based SQL query
 * targeting the CDM schema. The compiled SQL uses the OHDSI cohort generation pattern:
 * primary criteria → inclusion rules → censoring → era collapse.
 *
 * WHY: Atlas cohort expressions are database-agnostic JSON. This compiler resolves
 * them into PostgreSQL-specific SQL, applying temporal logic (observation period
 * constraints, washout windows) that the JSON format encodes declaratively.
 *
 * SCHEMAS: Reads from cdm.* (clinical tables) and vocab.* (concept lookups).
 * Writes to app.cohort (generated cohort membership).
 *
 * @param  array<string, mixed>  $expression  The Atlas JSON cohort expression
 * @param  int                   $cohortId    Target cohort_definition_id in app.cohort
 * @param  string                $cdmSchema   CDM schema name (default: 'cdm')
 * @return string                Compiled SQL ready for execution
 *
 * @throws \InvalidArgumentException  If expression is missing PrimaryCriteria
 * @throws \RuntimeException          If referenced concepts are not in vocab schema
 *
 * @see CohortDefinitionController::generate()  Caller endpoint
 * @see OhdsiSqlTranslator                      For dialect-specific rendering
 */
```

**Required elements for services:**
- Class-level: purpose, business context (WHY), schemas touched, key dependencies
- Method-level: purpose, parameters with types, return type, exceptions, cross-references
- Inline: explain non-obvious logic, OHDSI-specific patterns, SQL strategy choices

**Required elements for controllers:**
- Class-level: OpenAPI `#[Group()]` attribute, brief description
- Method-level: HTTP verb + path, purpose, response shape, error codes
- All controllers must have Dedoc/Scramble OpenAPI attributes

**Required elements for models:**
- Class-level: which schema/table, purpose in the domain
- Relationship methods: explain cardinality and business meaning
- Scopes: document filter intent and when to use each scope
- Casts/accessors: document transformation logic

### TypeScript (Frontend)

All exported functions, hooks, components, and stores must have JSDoc blocks:

```typescript
/**
 * Fetches paginated cohort definitions from the API with optional search filtering.
 *
 * Wraps GET /api/v1/cohort-definitions with TanStack Query caching.
 * Stale time is set to 30s because cohort lists change infrequently
 * but should reflect recent imports within a reasonable window.
 *
 * @param page - 1-based page number for pagination
 * @param search - Optional search string matched against name and description
 * @returns Paginated response with cohort definition summaries
 *
 * @example
 * const { data, isLoading } = useCohortDefinitions(1, 'diabetes');
 */
```

**Required elements for API modules:**
- Function-level: endpoint path, purpose, param descriptions, return shape
- Error handling: document expected error responses

**Required elements for hooks:**
- Purpose and when to use this hook vs alternatives
- Parameters with descriptions
- Return value shape and key properties
- Side effects (mutations, cache invalidation, WebSocket subscriptions)

**Required elements for components:**
- Component purpose and where it's used in the app
- Props interface: each prop gets a JSDoc description
- Complex state logic: inline comments explaining state machine transitions

**Required elements for stores:**
- Store purpose and what feature it serves
- Each state slice: what it holds and why
- Actions: what they do and when to call them
- Selectors/getters: what derived data they compute

### Python (AI Service)

Already well-documented. Maintain existing standard:
- Module-level docstrings on every file
- Class and function docstrings with Args/Returns/Raises sections
- Inline comments for non-obvious ML/NLP logic

### R Runtime

Follow roxygen2 style for all functions:

```r
#' Execute Achilles characterization analysis
#'
#' Runs a subset of Achilles analyses against the specified CDM source.
#' Results are written to the achilles_results schema. Uses DatabaseConnector
#' for connection management and SqlRender for dialect translation.
#'
#' @param connection_details Named list from DatabaseConnector::createConnectionDetails()
#' @param cdm_database_schema CDM schema name (e.g., "cdm")
#' @param results_database_schema Schema for writing results (e.g., "achilles_results")
#' @param analysis_ids Integer vector of Achilles analysis IDs to run
#' @return Invisible NULL; results written to database
#' @export
```

### Solr Configsets

Add XML comments to every configset explaining:
- Purpose of the configset and what feature it powers
- Field type choices and analyzer pipeline rationale
- Request handler configuration and why specific parameters were chosen
- Relationship to the indexing service that populates it

```xml
<!--
  Vocabulary Configset — Powers the concept search in VocabularyController

  WHY this analyzer chain:
  - StandardTokenizer handles medical terms with hyphens and numbers
  - LowerCaseFilter for case-insensitive search
  - EdgeNGramFilter (minGram=2, maxGram=25) enables prefix/typeahead matching
    which is critical for the concept picker autocomplete in cohort builder

  Indexed by: SolrVocabularyIndexCommand (backend/app/Console/Commands/)
  Used by: VocabularyController::search(), ConceptSetController::conceptSearch()
-->
```

---

## Phased Execution Plan

### Phase 0: Infrastructure & Conventions (Week 1)

**Goal:** Establish documentation tooling and standards before writing any docs.

#### Tasks

- [ ] **0.1** Create `.claude/rules/documentation-standards.md` containing the standards from this plan, so all future Claude Code sessions enforce them
- [ ] **0.2** Add a `docs:check` Makefile target that runs documentation coverage analysis
  - PHP: Parse PHPDoc coverage using `phpDocumentor` or a custom script checking for `/** */` blocks on public methods
  - TypeScript: Use `eslint-plugin-jsdoc` with `require-jsdoc` rule targeting exported functions
  - Python: Use `pydocstyle` or `interrogate` for docstring coverage
- [ ] **0.3** Create `docs/architecture/service-dependency-map.md` with a Mermaid diagram showing how backend services call each other (this is the single most valuable piece of missing documentation)
- [ ] **0.4** Create `backend/app/Services/README.md` — a service inventory listing every service directory, its purpose, schemas it touches, and key entry points
- [ ] **0.5** Create `frontend/src/features/README.md` — a feature module inventory listing every feature, its purpose, route paths, and key components

#### Acceptance Criteria
- CI lint step warns (not fails) on missing docs for new/modified files
- Service inventory README exists and covers all 27 service directories
- Feature module inventory README exists and covers all 37 features

---

### Phase 1: Backend Services — Critical Path (Weeks 2–5)

**Goal:** Document the highest-complexity, most OHDSI-specific backend services that encode irreplaceable domain knowledge.

#### Priority Tier 1 — Orchestration & Core Domain (Week 2–3)

These services have the deepest business logic and cross-service dependencies.

- [ ] **1.1** `Services/Cohort/CohortSqlCompiler.php` — Document CTE generation strategy, temporal logic, Atlas JSON→SQL mapping rationale
- [ ] **1.2** `Services/Cohort/Builders/*.php` (7 files) — Document each builder's role in the CTE chain, what part of the cohort expression it handles
- [ ] **1.3** `Services/SqlRenderer/OhdsiSqlTranslator.php` — Document dialect translation rules, why certain T-SQL patterns exist, the 11 supported dialects
- [ ] **1.4** `Services/StudyAgent/FinnGenWorkbenchService.php` (3,485 lines) — Class-level architecture doc, method groupings, external adapter pattern explanation
- [ ] **1.5** `Services/AI/AbbyAiService.php` (869 lines) — Document regex patterns, LLM fallback logic, confidence thresholds, term-to-domain mapping rationale
- [ ] **1.6** `Services/Analysis/CharacterizationService.php` — Document feature builder registration, domain logic, how analyses map to Achilles results
- [ ] **1.7** `Services/Analysis/CareGapService.php` — Document quality measure evaluation logic, NQF measure patterns

#### Priority Tier 2 — Data Pipeline Services (Week 3–4)

These services handle data transformation with complex mapping logic.

- [ ] **1.8** `Services/Fhir/FhirBulkMapper.php` (855 lines) — Document FHIR→OMOP mapping decisions, concept resolution strategy, vocabulary routing
- [ ] **1.9** `Services/Fhir/FhirResourceMapper.php` — Document code system URI mappings, resource type handling
- [ ] **1.10** `Services/Fhir/FhirNdjsonProcessorService.php` — Document streaming parser, memory management, batch processing strategy
- [ ] **1.11** `Services/Ingestion/*.php` (12 files) — Document CSV profiling pipeline, validation rules, concept mapping workflow
- [ ] **1.12** `Services/Imaging/DicomFileService.php` (549 lines) — Document binary parsing approach, VR handling, tag constants rationale
- [ ] **1.13** `Services/Genomics/*.php` (7 files) — Document VCF parsing, variant annotation, radiogenomics correlation logic

#### Priority Tier 3 — Achilles & DQD Engine (Week 4–5)

These are highly repetitive but need a catalog and pattern documentation.

- [ ] **1.14** Create `Services/Achilles/Analyses/README.md` — Central catalog of all 127 analysis classes mapping analysis ID → name → domain → description
- [ ] **1.15** Document `Services/Achilles/Analyses/` pattern — pick 5 representative analyses (one per major domain: Person, Visit, Condition, Drug, Measurement) and add thorough PHPDoc as templates for the rest
- [ ] **1.16** `Services/Achilles/AchillesResultReaderService.php` (819 lines) — Document multi-source querying, dynamic connection management, result aggregation
- [ ] **1.17** `Services/Achilles/AchillesHeelService.php` + `Heel/Rules/*.php` (17 rules) — Document rule severity levels, SQL template patterns, DQ violation categories
- [ ] **1.18** `Services/Dqd/*.php` (6 files) — Document completeness/conformance/plausibility check categories, threshold logic

#### Priority Tier 4 — Remaining Services (Week 5)

- [ ] **1.19** `Services/Solr/*.php` (9 files) — Document indexing pipeline per configset, field mapping strategy, search vs suggest vs facet patterns
- [ ] **1.20** `Services/GIS/*.php` (10 files) — Document geospatial data import, boundary loading, SVI/RUCC scoring logic
- [ ] **1.21** `Services/Database/DynamicConnectionService.php` — Document multi-tenant connection management, when/why dynamic connections are used
- [ ] **1.22** Remaining services: Commons, QueryLibrary, Publication, Network, PopulationRisk, WebApi (19 files) — Standard PHPDoc pass

#### Acceptance Criteria
- Every service file has a class-level PHPDoc with purpose, schemas, and dependencies
- Every public method has parameter/return/throws documentation
- Inline comments explain OHDSI-specific logic and SQL patterns
- Achilles analysis catalog README exists with all 127 analyses listed

---

### Phase 2: Backend Controllers & Models (Weeks 6–7)

**Goal:** Ensure full OpenAPI coverage and model relationship documentation.

#### Controllers (Week 6)

- [ ] **2.1** Add `#[Group()]` OpenAPI attributes to all 23 controllers currently missing them (primarily Commons and GIS controllers)
- [ ] **2.2** Add method-level PHPDoc to the 10 largest controllers:
  - SystemHealthController (845 lines)
  - CohortDefinitionController (829 lines)
  - ConceptSetController (635 lines)
  - StudyAgentController (627 lines)
  - TextToSqlController (616 lines)
  - GenomicsController (477 lines)
  - StudyController (465 lines)
  - CareGapController (421 lines)
  - AbbyAiController (414 lines)
  - VocabularyController (413 lines)
- [ ] **2.3** Standardize remaining controllers — ensure every method documents HTTP verb, path, purpose, response shape

#### Models (Week 7)

- [ ] **2.4** CDM Models (27 files) — Add class-level docs explaining OMOP CDM table purpose, key relationships to other CDM tables, and which services/controllers use each model
- [ ] **2.5** Vocabulary Models (12 files) — Document concept hierarchy patterns, relationship types, vocabulary versioning
- [ ] **2.6** App Models — Focus on the 20 most-used models:
  - CohortDefinition, ConceptSet, Study, Source, DataSource
  - User, Role, Permission (auth models — document carefully per auth-system.md rules)
  - AchillesResult, DqdResult, AnalysisExecution
  - Document all relationship methods, scopes, casts, and accessors
- [ ] **2.7** Results Models (10 files) — Document achilles_results schema mapping and query patterns
- [ ] **2.8** Commons Models (13 files) — Document collaboration domain: channels, messages, wiki pages, presence

#### Acceptance Criteria
- 100% of controllers have OpenAPI `#[Group()]` attributes
- All public controller methods have PHPDoc with HTTP verb + path
- All model relationship methods have PHPDoc explaining cardinality and business meaning
- CDM models include OMOP CDM documentation references

---

### Phase 3: Frontend Documentation (Weeks 8–11)

**Goal:** Add JSDoc to all exported API functions, hooks, and complex components.

#### API Layer (Week 8)

Every `api.ts` file across all 37 feature modules must document every exported function.

- [ ] **3.1** High-priority API modules (features with most complex data flows):
  - cohort-definitions/api.ts
  - data-explorer/ (dqdApi.ts, achillesApi.ts)
  - analyses/api.ts
  - commons/services/abbyService.ts
  - administration/ (6 API modules)
  - gis/api.ts
  - vocabulary/api.ts
- [ ] **3.2** Medium-priority API modules (remaining features)
- [ ] **3.3** Shared API client (`lib/api.ts` or equivalent) — document interceptors, error handling, token refresh logic

#### Hooks Layer (Week 9)

- [ ] **3.4** Document all custom hooks in high-complexity features:
  - commons/hooks/ (useAbby, useEcho, useTypingIndicator, usePresence, useNotificationListener)
  - administration/hooks/ (10 hooks)
  - gis/hooks/
  - data-explorer/hooks/
  - cohort-definitions/hooks/
- [ ] **3.5** Document hooks in remaining features

#### Stores (Week 9)

- [ ] **3.6** Document all 7 Zustand stores:
  - authStore.ts — state shape, role/permission helpers, token management
  - sourceStore.ts — active data source selection, multi-source switching logic
  - uiStore.ts — UI state (sidebar, modals, theme)
  - abbyStore.ts — Abby AI conversation state, streaming state
  - ingestionStore.ts — multi-step ingestion wizard state
  - profileStore.ts — patient profile navigation state

#### Components (Weeks 10–11)

- [ ] **3.7** Shared UI components (44 files) — Document purpose, props, usage context for each
- [ ] **3.8** Complex feature components — Focus on components with significant state logic:
  - cohort-definitions/components/ (cohort builder UI)
  - gis/components/ + gis/layers/ (map rendering, choropleth)
  - commons/components/ (real-time collaboration, Abby chat)
  - data-explorer/components/ (multi-tab charting)
  - administration/components/ (OAuth/SAML config forms, PACS browser)
- [ ] **3.9** Layout components — MainLayout, navigation, ChangePasswordModal, SetupWizard (document auth flow integration)

#### Acceptance Criteria
- Every exported API function has JSDoc with endpoint path, params, return type
- Every custom hook has JSDoc with purpose, params, return shape, side effects
- Every Zustand store has JSDoc on state shape, actions, and selectors
- Complex components have inline comments explaining state transitions

---

### Phase 4: Solr, R Runtime, & Infrastructure (Weeks 12–13)

**Goal:** Document the specialized infrastructure layers that are currently least documented.

#### Solr Configsets (Week 12)

- [ ] **4.1** Create `solr/README.md` — Overview of all 10 configsets, what each powers, indexing pipeline
- [ ] **4.2** Add XML comments to each configset's `schema.xml`:
  - Field type rationale (why StandardTokenizer vs WhitespaceTokenizer, etc.)
  - Field definitions — what each field maps to in the OMOP/app schema
  - Copy field strategy — why certain fields are copied
- [ ] **4.3** Add XML comments to each configset's `solrconfig.xml`:
  - Request handler configuration rationale
  - AutoCommit tuning explanation
  - Suggest component configuration
- [ ] **4.4** Document relationship between Solr configsets and their indexing commands (`SolrIndex*Command.php`)

#### R Runtime (Week 12)

- [ ] **4.5** Create `r-runtime/README.md` — Architecture overview, HADES package dependencies, endpoint catalog
- [ ] **4.6** Document utility modules: connection.R, db.R, progress.R, results.R, covariates.R
- [ ] **4.7** Add roxygen2 headers to all undocumented endpoint functions

#### Infrastructure Documentation (Week 13)

- [ ] **4.8** Document `docker-compose.yml` — Add comments explaining each service's role, port mappings, volume mounts, health check rationale
- [ ] **4.9** Document `deploy.sh` — Inline comments explaining each deployment phase
- [ ] **4.10** Create `docs/architecture/schema-map.md` — Document all 5 database schemas, their tables, and cross-schema query patterns
- [ ] **4.11** Create `docs/architecture/data-flow.md` with Mermaid diagrams showing:
  - Cohort generation flow (UI → Controller → Service → Jobs → DB)
  - Data ingestion pipeline (CSV/FHIR → Validation → Mapping → CDM)
  - Achilles/DQD execution flow
  - Search indexing pipeline (DB → Service → Solr)

#### Acceptance Criteria
- Every Solr configset has XML comments explaining field types, analyzers, and handlers
- R runtime has README and all functions have roxygen2 documentation
- Architecture diagrams exist for the 4 major data flows

---

### Phase 5: Polish & Maintenance Integration (Week 14+)

**Goal:** Fill remaining gaps, establish ongoing documentation hygiene.

#### Remaining Gaps

- [ ] **5.1** Python AI service — Add cross-module dependency documentation, document ensemble ranking strategy
- [ ] **5.2** Database migrations — Create `docs/architecture/schema-evolution.md` summarizing major schema changes by phase
- [ ] **5.3** Jobs — Add process flow documentation for complex multi-job workflows (e.g., ingestion pipeline)
- [ ] **5.4** Console commands — Verify all commands have usage examples in their `$description`
- [ ] **5.5** Scripts directory — Document importer scripts (`scripts/importers/`) and GIS loading scripts (`scripts/gis/`)

#### CI/CD Integration

- [ ] **5.6** Enable `eslint-plugin-jsdoc` `require-jsdoc` rule for exported functions (warning → error over 2 sprints)
- [ ] **5.7** Add PHPDoc coverage check to CI pipeline (target: 90% of public methods)
- [ ] **5.8** Add `pydocstyle` check for Python AI service
- [ ] **5.9** Add PR template checklist item: "Documentation updated for changed/new public APIs"

#### Documentation-on-Touch Rule

- [ ] **5.10** Update `.claude/rules/documentation-standards.md` to include:
  - Any file modified in a PR must have its documentation brought up to standard
  - Any new file must have full documentation before merging
  - Reviewers check documentation quality as part of code review

#### Acceptance Criteria
- CI pipeline includes documentation coverage checks
- PR template includes documentation checklist
- `.claude/rules/` enforces documentation standards for all future work

---

## Execution Guidelines for Claude Code

### General Approach

When executing this plan, each task should follow this workflow:

1. **Read the file(s)** to understand current code and existing documentation
2. **Identify the "why"** — focus on business logic, OHDSI domain knowledge, schema interactions, and architectural decisions rather than restating what the code does
3. **Write documentation** following the standards in this plan
4. **Verify** — ensure PHPDoc/JSDoc syntax is valid, cross-references point to real classes/methods, and schema names are correct
5. **Do not refactor** — this plan is documentation-only; do not change code behavior

### What to Document (Priority Order)

1. **Business rationale** — Why does this code exist? What OHDSI/clinical research need does it serve?
2. **Schema dependencies** — Which database schemas does this code read from or write to?
3. **Cross-service dependencies** — What other services/controllers/jobs does this code interact with?
4. **Non-obvious logic** — Complex SQL, regex patterns, temporal logic, mapping decisions
5. **Error conditions** — When does this code fail, and what happens?

### What NOT to Document

1. **Obvious code** — Don't add `// increment counter` above `$count++`
2. **Framework boilerplate** — Don't document Laravel/React conventions that any framework developer would know
3. **Auto-generated code** — Don't touch `frontend/src/types/api.generated.ts`
4. **Test files** — Skip test documentation unless tests encode important business rules

### Batch Size

- Process **one service directory or feature module per session** to keep context manageable
- For large files (500+ lines), read the full file first, then document in sections
- Commit after each completed task with conventional commit: `docs(scope): add inline documentation to [module]`

### Protected Files

Per `.claude/rules/auth-system.md`, the following files may be documented but must not have their behavior changed:
- AuthController.php, TempPasswordMail.php, User.php (auth methods)
- LoginPage.tsx, RegisterPage.tsx, ChangePasswordModal.tsx, SetupWizard.tsx
- authStore.ts (auth-related state)

---

## Estimated Effort

| Phase | Scope | Estimated Sessions | Calendar Time |
|-------|-------|--------------------|---------------|
| Phase 0 | Infrastructure & conventions | 3–5 sessions | Week 1 |
| Phase 1 | Backend Services (369 files) | 20–30 sessions | Weeks 2–5 |
| Phase 2 | Controllers & Models (251 files) | 10–15 sessions | Weeks 6–7 |
| Phase 3 | Frontend (500+ files) | 20–25 sessions | Weeks 8–11 |
| Phase 4 | Solr, R, Infrastructure | 8–10 sessions | Weeks 12–13 |
| Phase 5 | Polish & CI integration | 5–8 sessions | Week 14+ |
| **Total** | | **66–93 sessions** | **~14 weeks** |

A "session" is one Claude Code context window focused on a specific task. Multiple sessions can run per day.

---

## Success Metrics

- **PHPDoc coverage:** ≥90% of public methods in Services, Controllers, Models
- **JSDoc coverage:** ≥85% of exported functions in frontend features
- **OpenAPI coverage:** 100% of controllers have `#[Group()]` attributes
- **Architecture docs:** Service dependency map, schema map, and 4 data flow diagrams exist
- **CI enforcement:** Documentation lint checks active in pipeline
- **Ongoing:** Every PR that modifies public APIs includes documentation updates
