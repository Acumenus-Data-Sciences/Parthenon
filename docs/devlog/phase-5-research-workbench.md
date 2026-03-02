# Phase 5: Research Workbench — Development Log

**Date:** 2026-03-01 → 2026-03-02
**Branch:** `master`
**Status:** Complete — Full research workbench delivered: Cohort SQL Compiler, Concept Sets, Vocabulary Browser, Characterization, Incidence Rates, Pathway Analysis, Patient Profiles, PLE/PLP, Study Orchestrator, Abby AI, Care Gaps, and Notification System.

---

## Overview

Phase 5 delivers the complete research tooling layer replacing OHDSI's Atlas, Circe, FeatureExtraction, CohortMethod, PatientLevelPrediction, CohortDiagnostics, and Strategus with an integrated workbench. The work spans a native PHP cohort SQL compiler, SQL-based analytics, R sidecar integration for estimation/prediction, an AI-assisted cohort builder, and a chronic disease care gaps framework.

Ten feature areas:
1. **Cohort Definitions** — expression editor, SQL compiler, generation pipeline, SQL preview, history table
2. **Concept Sets** — full CRUD with per-item flags (descendants, mapped, excluded) and vocabulary resolution
3. **Vocabulary Browser** — concept search, concept detail, hierarchy tree
4. **Characterization** — SQL-based feature extraction with 6 domain builders, SMD computation, comparator cohort support
5. **Incidence Rates** — CTE-based person-years computation, gender/age stratification, min-cell-count masking
6. **Pathway Analysis** — treatment sequence discovery with combination windows, PHP-side pathway construction
7. **Patient Profiles** — full clinical timeline with 8 domain queries, cohort member navigation
8. **PLE/PLP** — R sidecar orchestration for CohortMethod and PatientLevelPrediction (stub endpoints with design validation)
9. **Study Orchestrator** — multi-analysis DAG dispatch with execution ordering and progress tracking
10. **Care Gaps** — disease-specific quality measure frameworks adapted from Medgnosis, OMOP-mapped, with overlap deduplication

Cross-cutting:
- **Abby AI** — NLP-driven cohort builder (no external LLM) with OMOP vocabulary search, regex-based prompt analysis
- **Notification System** — email/SMS alerts for analysis completion/failure via NotifiesOnCompletion trait

---

## What Was Built

### Step 5A: Cohort SQL Compiler

**`app/Services/Cohort/CohortSqlCompiler.php`**

A PHP reimplementation of OHDSI Circe, translating a cohort expression JSON object into PostgreSQL-compatible CTEs. Two public methods:

- **`compile(array $expression, string $cdmSchema, string $resultsSchema, string $vocabSchema): string`** — Produces a full `DELETE … INSERT INTO cohort …` statement that writes `(cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)` rows to the results schema.
- **`preview(array $expression, string $cdmSchema, string $resultsSchema, string $vocabSchema): string`** — Produces a `SELECT` only (no writes) for safe display in the UI.

Eight-step CTE pipeline:

| CTE | Purpose |
|---|---|
| `qualified_events` | Primary criteria — UNION ALL of domain queries filtered by concept sets |
| `included_events` | After applying inclusion rule CTEs |
| `inclusion_rule_N` | One CTE per inclusion rule (AND/OR/NOT criteria groups) |
| `best_events` | QualifiedLimit applied (First / All) |
| `cohort_rows` | Date window logic (end strategy — fixed offset, observation period end, date offset) |
| `final_cohort` | After censoring events excluded by censoring criteria |
| (inline concept set) | Each concept set materialised as a UNION ALL subquery |

**`app/Services/Cohort/Schema/CohortExpressionSchema.php`**

Validates and normalises incoming expression JSON before compilation:
- Enforces `PrimaryCriteria` presence
- Normalises 9 optional fields to defaults (`QualifiedLimit`, `EndStrategy`, `CensoringCriteria`, `InclusionRules`, `AdditionalCriteria`, `CollapseSettings`, `ExpressionLimit`, `ObservationWindow`, `DemographicCriteria`)
- Recursively normalises `AdditionalCriteria` groups via `normalizeGroup()`

**`app/Services/Cohort/Criteria/CriteriaBuilderRegistry.php`**

Maps domain key strings to builder instances. Currently registered:

| Domain Key | Builder |
|---|---|
| `ConditionOccurrence` | `ConditionCriteriaBuilder` |
| `DrugExposure` | `DrugCriteriaBuilder` |
| `ProcedureOccurrence` | `ProcedureCriteriaBuilder` |
| `Measurement` | `MeasurementCriteriaBuilder` |
| `Observation` | `ObservationCriteriaBuilder` |
| `VisitOccurrence` | `VisitCriteriaBuilder` |
| `Death` | `DeathCriteriaBuilder` |

`AbstractCriteriaBuilder` provides the shared concept-set subquery injection and occurrence filter helpers used by all domain builders.

**`app/Services/Cohort/Builders/PrimaryCriteriaBuilder.php`**

Builds the `qualified_events` CTE:
- UNION ALL of every domain criteria query (each joined to `observation_period` for event start/end bounds)
- `ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY …)` ordinal for QualifiedLimit First
- Applies `ObservationWindow` start/end offset filters

**Specialised builders** (`ConditionCriteriaBuilder`, `DrugCriteriaBuilder`, `MeasurementCriteriaBuilder`, etc.) each output a domain-specific subquery joining the appropriate CDM table with `WHERE concept_id IN (<concept_set_sql>)` and optional attribute filters (value_as_number range, drug type, visit type, etc.).

**Additional builders:**

- **`InclusionCriteriaBuilder`** — generates one CTE per inclusion rule; handles `AND`/`OR`/`NOT` group logic with correlated sub-SELECTs from the `qualified_events` CTE; supports `OccurrenceFilter` (count ≥ N, ≤ N, = N in window)
- **`CensoringBuilder`** — generates the `final_cohort` filter CTE; excludes persons whose cohort start falls after a censoring event date
- **`EndStrategyBuilder`** — resolves cohort end date: `DateOffset` (start + N days), `CustomEra` (drug exposure with gap), or observation period end
- **`TemporalWindowBuilder`** — translates `StartWindow`/`EndWindow` into SQL `BETWEEN` predicates anchored to `index_date`
- **`OccurrenceFilterBuilder`** — `HAVING COUNT(*) >= N` and related predicates
- **`ConceptSetSqlBuilder`** — renders each concept set as an inline `SELECT DISTINCT concept_id FROM … UNION ALL …` subquery used wherever a domain criteria references a concept set ID

---

### Step 5B: Cohort Generation Service & Queue Job

**`app/Services/Cohort/CohortGenerationService.php`**

Orchestrates the full lifecycle of a cohort generation run:

1. Creates a `cohort_generations` record (status: `queued`)
2. Resolves CDM/results/vocab schema names from the `Source` + `SourceDaimon` relationship
3. Calls `CohortSqlCompiler::compile()` with the expression JSON and resolved schemas
4. Updates status to `running`, records `started_at`
5. Executes the compiled SQL via `DB::unprepared()` (handles multi-statement DDL/DML)
6. Counts `cohort_results` rows for this `cohort_definition_id` to set `person_count`
7. Computes inclusion rule statistics (persons passing/failing each rule) and writes to `cohort_inclusion_stats`
8. Updates status to `completed`, records `completed_at` and `person_count`; on exception sets `failed` + `error_message`

**`app/Jobs/Cohort/GenerateCohortJob.php`**

Thin Horizon queue job wrapping the service: `implements ShouldQueue`, dispatched with `onQueue('cohort-generation')`. Passes `CohortDefinition` and `Source` model instances; retries up to 1 time on failure.

---

### Step 5C: Database Migrations

**`2026_03_01_190000_create_cohort_results_table.php`**

Schema: `results`. Columns:
- `cohort_definition_id` — integer FK to `app.cohort_definitions`
- `subject_id` — integer (OMOP `person_id`)
- `cohort_start_date` — date
- `cohort_end_date` — date
- Primary key: `(cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)` (composite, mirrors OMOP CDM spec)

**`2026_03_01_190001_create_cohort_inclusion_stats_table.php`**

Schema: `results`. Columns:
- `cohort_definition_id`, `rule_sequence` (0-indexed), `mode` (0 = all; 1 = best match)
- `person_count` — persons satisfying this rule in the last generation
- `gain_count` — persons newly included by this rule
- `person_total` — total persons evaluated
- Unique key: `(cohort_definition_id, rule_sequence, mode)`

---

### Step 5D: API Controllers

**`CohortDefinitionController.php`** — 8 endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/cohort-definitions` | Paginated list with person count from latest generation |
| POST | `/cohort-definitions` | Create definition (name, description, expression JSON) |
| GET | `/cohort-definitions/{id}` | Single definition with expression |
| PUT | `/cohort-definitions/{id}` | Update name/description/expression |
| DELETE | `/cohort-definitions/{id}` | Delete definition + cascade generations |
| POST | `/cohort-definitions/{id}/generate` | Queue generation job — returns 202 with generation record |
| GET | `/cohort-definitions/{id}/generations` | Generation history (latest first) |
| GET | `/cohort-definitions/{id}/generations/{gId}` | Single generation with inclusion stats |
| GET | `/cohort-definitions/{id}/preview-sql` | Returns compiled SQL without executing |
| POST | `/cohort-definitions/{id}/copy` | `replicate()` clone with new name |

`generate()` selects the `Source` from `source_id` query param (defaults to first CDM source), creates the generation record, and dispatches `GenerateCohortJob`. The response is 202 to signal async execution.

`previewSql()` falls back to placeholder schema strings (`cdm`, `results`, `vocab`) when no real source is available, allowing SQL inspection in dev environments without a live CDM.

**`ConceptSetController.php`** — CRUD + item management + resolve

| Method | Route | Description |
|---|---|---|
| GET | `/concept-sets` | Paginated list with item count |
| POST | `/concept-sets` | Create with optional initial items |
| GET | `/concept-sets/{id}` | Full concept set with items and concept details |
| PUT | `/concept-sets/{id}` | Update name/description |
| DELETE | `/concept-sets/{id}` | Delete |
| GET | `/concept-sets/{id}/items` | Item list |
| POST | `/concept-sets/{id}/items` | Add item (concept_id + flags) |
| PUT | `/concept-sets/{id}/items/{itemId}` | Update flags |
| DELETE | `/concept-sets/{id}/items/{itemId}` | Remove item |
| POST | `/concept-sets/{id}/resolve` | Expand to flat concept ID list via `ConceptSetResolverService` |

**`VocabularyController.php`** — Extended with:
- `GET /vocabulary/descendants/{conceptId}` — Concept ancestor table traversal, returns all descendant concept records
- `GET /vocabulary/hierarchy/{conceptId}` — Parent/child relationships (1 level up, 1 level down) for tree navigation
- `GET /vocabulary/domains` — Distinct domain list from `concept` table
- `GET /vocabulary/vocabularies` — Vocabulary registry

---

### Step 5E: ConceptSet Resolver Service

**`app/Services/ConceptSet/ConceptSetResolverService.php`**

Two resolution modes:

**`resolve(ConceptSet): array<int>`** — PHP-side resolution. Expands each non-excluded item by querying `ConceptAncestor` (for `include_descendants`) and `ConceptRelationship` where `relationship_id = 'Maps to'` (for `include_mapped`). Returns `array_diff(included, excluded)`.

**`resolveToSql(items, vocabSchema): string`** — SQL-side resolution. Builds a `SELECT DISTINCT concept_id FROM (…) included` subquery using UNION ALL of:
1. Direct concept IDs from `vocab.concepts`
2. Descendants from `vocab.concept_ancestors`
3. Mapped concepts from `vocab.concept_relationships`

Then applies `WHERE concept_id NOT IN (excluded subquery)` if any excluded items exist. This SQL form is embedded directly into cohort compiler CTEs for zero round-trips.

---

### Step 5F: Frontend — Cohort Definitions Feature

New feature directory: `frontend/src/features/cohort-definitions/`

**Type system** (`types/cohortExpression.ts`):

Full TypeScript representation of the Circe cohort expression schema: `CohortExpression`, `PrimaryCriteria`, `CriteriaGroup` (recursive AND/OR/NOT), `InclusionRule`, `DomainCriteria` (union of all domain types), `TemporalWindow`, `StartWindow`/`EndWindow`, `EndStrategy`, `CollapseSettings`, `QualifiedLimit`, `ConceptSetItem`, `DemographicCriteria`. Mirrors the backend schema exactly so the API contract is type-safe end-to-end.

**Zustand store** (`stores/cohortExpressionStore.ts`):

Manages the full in-memory expression tree:
- Immutable update helpers for PrimaryCriteria, InclusionRules, AdditionalCriteria, EndStrategy, CollapseSettings, QualifiedLimit, DemographicCriteria, ConceptSets
- `addCriteria(domain)`, `removeCriteria(index)`, `updateCriteria(index, patch)`
- `addInclusionRule()`, `removeInclusionRule(index)`, `updateInclusionRule(index, patch)`
- `addGroupCriteria(groupPath, domain)`, `removeGroupCriteria(groupPath, index)`, `updateGroup(groupPath, patch)` — recursive path-based updates for nested AND/OR/NOT groups
- `isDirty` / `resetDirty` for tracking unsaved changes

**TanStack Query hooks** (`hooks/useCohortDefinitions.ts`, `hooks/useCohortGeneration.ts`):
- `useCohortDefinitions()` — paginated list
- `useCohortDefinition(id)` — single with expression
- `useCreateCohortDefinition()`, `useUpdateCohortDefinition()`, `useDeleteCohortDefinition()`
- `useGenerateCohort()` — fires POST and invalidates generation history
- `useCohortGenerations(id)` — generation history with polling (`refetchInterval: 3000`) while any generation is in `queued` or `running` status
- `usePreviewSql(id)` — lazy fetch (enabled on demand)

**Pages:**

`CohortDefinitionsPage.tsx` — list page with create button + `CohortDefinitionList` table.

`CohortDefinitionDetailPage.tsx` — tabbed detail page:
- **Expression tab** — full expression editor
- **Generations tab** — `CohortGenerationPanel` + `GenerationHistoryTable`
- **SQL Preview tab** — `CohortSqlPreview`
- Sticky header with name/description edit, Save and Generate buttons; `isDirty` badge when unsaved changes exist

**Key components:**

`CohortExpressionEditor.tsx` — top-level editor orchestrating all sub-panels; passes store actions down.

`PrimaryCriteriaPanel.tsx` — shows the primary criteria list; "Add Criteria" opens `DomainCriteriaSelector`; each criteria row shows domain icon, concept set picker, and a temporal window indicator. Renders `QualifiedLimit` selector (First/All) and `ObservationWindow` inputs.

`DomainCriteriaSelector.tsx` — modal grid of all 8 domain types (Condition, Drug, Procedure, Measurement, Observation, Visit, Death, Demographic); click selects domain and appends a blank criteria object to the store.

`CriteriaGroupEditor.tsx` — recursive component rendering AND/OR/NOT logic groups. Header row: operator toggle (`ANY`/`ALL`/`NONE`), occurrence count input (at least N / exactly N / at most N). Children: criteria rows + nested sub-groups. "Add Criteria" and "Add Group" buttons at bottom of each group.

`InclusionCriteriaPanel.tsx` — accordion list of inclusion rules; each rule expanded shows name field + `CriteriaGroupEditor` for the rule's criteria group.

`InclusionRuleEditor.tsx` — single inclusion rule form: name, description, and the recursive `CriteriaGroupEditor`.

`TemporalWindowEditor.tsx` — renders `StartWindow` / `EndWindow` inputs: anchor (`IndexStartDate`/`IndexEndDate`/`EventStartDate`/`EventEndDate`), direction (before/after/either), and day offset (0 = same day). Inline preview shows the window as a human-readable sentence.

`EndStrategyEditor.tsx` — selector between three end strategies: `DateOffset` (N days after start), `CustomEra` (drug gap days), `ObservationPeriodEnd`. Fields appear conditionally based on selection.

`DemographicFilterEditor.tsx` — age range (min/max), gender (male/female/both), race (multi-select from vocabulary domains), ethnicity, race. All optional; unchecked means no filter applied.

`ConceptSetPicker.tsx` — searchable dropdown of concept sets for the current definition; shows item count badge; "Create New" shortcut opens a new concept set in a side drawer.

`CohortGenerationPanel.tsx` — source selector (data source dropdown), Generate button, status badge (Queued / Running / Completed / Failed with colour coding), progress indicator for running generations, person count on completion.

`GenerationHistoryTable.tsx` — table of past generations with status, person count, started/completed timestamps, and an expand row showing per-rule inclusion stats (`rule_sequence`, `person_count`, `gain_count`, `person_total` displayed as a mini table + bar chart).

`CohortSqlPreview.tsx` — fetches SQL on demand (lazy); displays in a syntax-highlighted `<pre>` block with a copy-to-clipboard button. Source schema selector at top (defaults to placeholder if no source selected).

---

### Step 5G: Frontend — Concept Sets Feature

New feature directory: `frontend/src/features/concept-sets/`

**Type system** (`types/conceptSet.ts`):

`ConceptSet`, `ConceptSetItem` (with `include_descendants`, `include_mapped`, `is_excluded` flags), `ConceptSetResolution` (flat list of resolved concept IDs + count). `Concept` interface (concept_id, name, domain, vocabulary, concept_code, standard_concept, invalid_reason).

**TanStack Query hooks** (`hooks/useConceptSets.ts`):
- List, single, create, update, delete mutations
- `useConceptSetItems(id)`, `useAddConceptSetItem()`, `useUpdateConceptSetItem()`, `useRemoveConceptSetItem()`
- `useResolveConceptSet(id)` — fires POST and displays resolved concept count

**Pages:**

`ConceptSetsPage.tsx` — list with create button; `ConceptSetList` component renders name, description, item count, last modified.

`ConceptSetDetailPage.tsx` — split view: left panel shows concept search (vocabulary search input with domain/vocabulary filters); right panel shows the concept set item list. Drag-to-reorder items. Stats bar: total items, included, excluded, descendants, mapped.

**Components:**

`ConceptSetEditor.tsx` — main editor integrating search results table and item management. Search result row has "+" add button; existing item row shows current flags. Bulk actions: "Select All", "Remove Selected", "Set Descendants on Selected".

`ConceptSetItemRow.tsx` — single item row: concept name, domain badge, concept code, three flag checkboxes (descendants, mapped, excluded). Flag changes dispatch immediate PATCH requests (debounced 300 ms to batch rapid toggles). Excluded items rendered with strikethrough styling.

`ConceptSetList.tsx` — sortable list component with search box (client-side filter on name), pagination, and "New Concept Set" button.

---

### Step 5H: Frontend — Vocabulary Browser Feature

New feature directory: `frontend/src/features/vocabulary/`

**Type system** (`types/vocabulary.ts`):

`Concept`, `ConceptRelationship`, `ConceptAncestor`, `VocabularySearchResult` (paginated), `ConceptHierarchyNode` (recursive tree: `{ concept, children, parents }`).

**TanStack Query hooks:**

`useVocabularySearch.ts` — debounced (300 ms) search with filter state (domain, vocabulary, standard concept only). Fetches `GET /vocabulary/search?q=…&domain=…&vocabulary=…&standard=true`. Manages a local recent-concepts LRU list (stored in `localStorage`, max 20).

`useConceptHierarchy.ts` — fetches parent/child relationships for a given `concept_id`; enables tree expansion.

**Pages & Components:**

`VocabularyPage.tsx` — two-pane layout: `VocabularySearchPanel` on left, `ConceptDetailPanel` on right (conditionally rendered when a concept is selected).

`VocabularySearchPanel.tsx` — search input + domain/vocabulary filter dropdowns + standard-only toggle. Results table: concept name, concept code, domain, vocabulary, standard concept flag (S/C/-). Paginated with load-more. Clicking a row sets the selected concept.

`ConceptDetailPanel.tsx` — full concept card:
- Concept name, ID, code, domain, vocabulary, class, standard flag, invalid reason
- "Add to Concept Set" button (opens `ConceptSetPicker` dropdown)
- Synonyms section (from `concept_synonym` table via API)
- Relationships section (grouped by relationship type; each related concept is a clickable link that navigates the selection)
- **Hierarchy section** — `HierarchyTree` component

`HierarchyTree.tsx` — expandable tree showing parent concepts above (breadcrumb-style) and children below (lazy-loaded on expand). Each node is clickable to navigate to that concept. Depth limited to 3 levels up and 5 levels down by default.

---

## Architectural Notes

### Circe compatibility

The SQL compiler output is structurally equivalent to Circe's PostgreSQL dialect. This means:
1. Existing Atlas cohort expression JSON files can be imported directly — the schema normaliser fills missing optional fields.
2. Generated SQL can be compared against legacy Atlas output for validation.
3. The `previewSql` endpoint allows researchers to inspect and manually run the SQL without the generation pipeline.

### No Kotlin/Java dependency

The original Atlas requires a running WebAPI (Java/Spring + Circe library). Parthenon's compiler is pure PHP, eliminating the runtime dependency and giving full control over the SQL dialect (PostgreSQL-only, no Oracle/SQL Server compatibility shims needed).

### Inline concept set SQL

Rather than materialising concept set expansions into a temp table per generation (Atlas pattern), the resolver embeds concept set SQL as inline CTEs. This trades some query plan predictability for zero-setup cost and simpler session management in a multi-tenant environment.

### Recursive group updates in Zustand

The `CriteriaGroupEditor` passes a `groupPath: number[]` prop (index chain from root to the current group). Store update helpers traverse this path to perform deep immutable updates, avoiding prop-drilling of mutable references into recursive children.

---

## Files Changed / Created

### Backend (new)
- `app/Services/Cohort/CohortSqlCompiler.php`
- `app/Services/Cohort/CohortGenerationService.php`
- `app/Services/Cohort/Schema/CohortExpressionSchema.php`
- `app/Services/Cohort/Criteria/AbstractCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/CriteriaBuilderInterface.php`
- `app/Services/Cohort/Criteria/CriteriaBuilderRegistry.php`
- `app/Services/Cohort/Criteria/ConditionCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DrugCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/ProcedureCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/MeasurementCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/ObservationCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/VisitCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DeathCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DemographicCriteriaBuilder.php`
- `app/Services/Cohort/Builders/PrimaryCriteriaBuilder.php`
- `app/Services/Cohort/Builders/InclusionCriteriaBuilder.php`
- `app/Services/Cohort/Builders/CensoringBuilder.php`
- `app/Services/Cohort/Builders/EndStrategyBuilder.php`
- `app/Services/Cohort/Builders/TemporalWindowBuilder.php`
- `app/Services/Cohort/Builders/OccurrenceFilterBuilder.php`
- `app/Services/Cohort/Builders/ConceptSetSqlBuilder.php`
- `app/Services/ConceptSet/ConceptSetResolverService.php`
- `app/Jobs/Cohort/GenerateCohortJob.php`
- `app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- `app/Http/Controllers/Api/V1/ConceptSetController.php`
- `app/Http/Controllers/Api/V1/VocabularyController.php` (extended)
- `database/migrations/2026_03_01_190000_create_cohort_results_table.php`
- `database/migrations/2026_03_01_190001_create_cohort_inclusion_stats_table.php`

### Frontend (new)
- `features/cohort-definitions/types/cohortExpression.ts`
- `features/cohort-definitions/stores/cohortExpressionStore.ts`
- `features/cohort-definitions/api/cohortApi.ts`
- `features/cohort-definitions/hooks/useCohortDefinitions.ts`
- `features/cohort-definitions/hooks/useCohortGeneration.ts`
- `features/cohort-definitions/components/CohortDefinitionList.tsx`
- `features/cohort-definitions/components/CohortExpressionEditor.tsx`
- `features/cohort-definitions/components/PrimaryCriteriaPanel.tsx`
- `features/cohort-definitions/components/DomainCriteriaSelector.tsx`
- `features/cohort-definitions/components/CriteriaGroupEditor.tsx`
- `features/cohort-definitions/components/InclusionCriteriaPanel.tsx`
- `features/cohort-definitions/components/InclusionRuleEditor.tsx`
- `features/cohort-definitions/components/TemporalWindowEditor.tsx`
- `features/cohort-definitions/components/EndStrategyEditor.tsx`
- `features/cohort-definitions/components/DemographicFilterEditor.tsx`
- `features/cohort-definitions/components/ConceptSetPicker.tsx`
- `features/cohort-definitions/components/CohortGenerationPanel.tsx`
- `features/cohort-definitions/components/GenerationHistoryTable.tsx`
- `features/cohort-definitions/components/CohortSqlPreview.tsx`
- `features/cohort-definitions/pages/CohortDefinitionsPage.tsx`
- `features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- `features/concept-sets/types/conceptSet.ts`
- `features/concept-sets/api/conceptSetApi.ts`
- `features/concept-sets/hooks/useConceptSets.ts`
- `features/concept-sets/components/ConceptSetList.tsx`
- `features/concept-sets/components/ConceptSetEditor.tsx`
- `features/concept-sets/components/ConceptSetItemRow.tsx`
- `features/concept-sets/pages/ConceptSetsPage.tsx`
- `features/concept-sets/pages/ConceptSetDetailPage.tsx`
- `features/vocabulary/types/vocabulary.ts`
- `features/vocabulary/api/vocabularyApi.ts`
- `features/vocabulary/hooks/useVocabularySearch.ts`
- `features/vocabulary/hooks/useConceptHierarchy.ts`
- `features/vocabulary/components/VocabularySearchPanel.tsx`
- `features/vocabulary/components/ConceptDetailPanel.tsx`
- `features/vocabulary/components/HierarchyTree.tsx`
- `features/vocabulary/pages/VocabularyPage.tsx`

### Docs
- `docs/devlog/phase-5-research-workbench.md` — this file
- `docs/devlog/DESIGNLOG.md` — full design decisions log added

---

## Step 5C: Characterization + Incidence Rates

### Backend: CharacterizationService

**`app/Services/Analysis/CharacterizationService.php`**

SQL-based feature extraction for cohort members, replacing FeatureExtraction's R dependency with pure SQL. Orchestrates 6 registered feature builders to compute cohort-level features.

Key methods:
- **`execute(Characterization, Source, AnalysisExecution)`** — resolves schemas via DaimonType, iterates target + comparator cohorts, runs each registered feature builder, computes SMD for comparators, stores results in `execution.result_json`
- **`computeFeaturesForCohort(cohortId, featureTypes, schemas)`** — builds and executes SQL for each selected feature type
- **`computeSmd(targetFeatures, comparatorFeatures)`** — standardised mean difference: `(p1-p2) / sqrt((p1(1-p1) + p2(1-p2))/2)` for binary proportions
- **`applyMinCellCount(features, threshold)`** — privacy masking (counts < threshold replaced with -1)

Registers 6 builders on construction:

| Builder | CDM Table | Output |
|---|---|---|
| `DemographicFeatureBuilder` | `person` | Age groups (0-17, 18-34, 35-49, 50-64, 65+), gender, race distributions |
| `ConditionFeatureBuilder` | `condition_occurrence` | Top 100 conditions by prevalence within cohort period |
| `DrugFeatureBuilder` | `drug_exposure` | Top 100 drugs by prevalence |
| `ProcedureFeatureBuilder` | `procedure_occurrence` | Top 100 procedures |
| `MeasurementFeatureBuilder` | `measurement` | Top 50 measurements with mean/stddev/median |
| `VisitFeatureBuilder` | `visit_occurrence` | Visit type distribution |

Each builder implements `FeatureBuilderInterface` with `key()`, `label()`, and `buildSql(cohortDefId, cdmSchema, resultsSchema, vocabSchema)`. DemographicFeatureBuilder returns 3 separate SQL statements (age/gender/race) split by the service. All other builders return a single query joining the domain table to `cohort` (filtered by cohort_definition_id, event within cohort start/end dates) and LEFT JOINing vocabulary for concept names.

**`app/Http/Controllers/Api/V1/CharacterizationController.php`** — 8 endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/characterizations` | Paginated list with latest execution status |
| POST | `/characterizations` | Create with design_json (targetCohortIds, comparatorCohortIds, featureTypes, stratify flags, minCellCount) |
| GET | `/characterizations/{id}` | Detail with recent executions |
| PUT | `/characterizations/{id}` | Update |
| DELETE | `/characterizations/{id}` | Soft delete |
| POST | `/characterizations/{id}/execute` | Dispatch RunCharacterizationJob (202 Accepted) |
| GET | `/characterizations/{id}/executions` | Execution history |
| GET | `/characterizations/{id}/executions/{execId}` | Execution detail with result_json |

**`app/Jobs/Analysis/RunCharacterizationJob.php`** — queue: `analysis`, timeout: 3600s, tries: 1. Uses `NotifiesOnCompletion` trait. Catches exceptions, marks execution as Failed with `fail_message`, notifies author.

---

### Backend: IncidenceRateService

**`app/Services/Analysis/IncidenceRateService.php`**

CTE-based incidence rate computation. Given a target cohort, outcome cohort(s), and time-at-risk configuration, computes persons at risk, person-years, and incidence rate per 1000 person-years.

Key methods:
- **`execute(IncidenceRateAnalysis, Source, AnalysisExecution)`** — computes IR for each outcome cohort, optionally stratified by gender and/or age groups
- **`buildIncidenceRateSql(targetCohortId, outcomeCohortId, tarConfig, stratification, schemas)`** — constructs CTE pipeline: `tar` (time-at-risk window), `outcomes` (events within TAR), `ir_data` (person-time calculation)
- **`buildTarExpression(dateField, offset)`** — converts StartDate/EndDate + offset to DATEADD expression
- **`buildAgeCaseExpression(ageGroups)`** — generates CASE statement for 5 default age groups (0-17, 18-34, 35-49, 50-64, 65+)
- **`applyMinCellCount(results, threshold)`** — masks small counts

Person-years calculation: `SUM(DATEDIFF(day, tar_start, tar_end)) / 365.25`. IR per 1000 PY: `(outcome_count / person_years) * 1000`.

**`app/Http/Controllers/Api/V1/IncidenceRateController.php`** — same 8-endpoint pattern as Characterization. Design JSON validates: targetCohortId, outcomeCohortIds[], timeAtRisk (start/end with dateField + offset), stratifyByGender, stratifyByAge, ageGroups[], minCellCount.

**`app/Jobs/Analysis/RunIncidenceRateJob.php`** — queue: `analysis`, timeout: 3600s.

---

### Frontend: Analyses Feature

New feature directory: `frontend/src/features/analyses/`

**Type system** (`types/analysis.ts`):

`ExecutionStatus` enum (pending, queued, running, completed, failed, cancelled), `AnalysisExecution`, `CharacterizationDesign`, `Characterization`, `FeatureType`, `IncidenceRateDesign`, `IncidenceRateAnalysis`, `FeatureResult`, `CharacterizationResult`, `IncidenceRateResult`, `IncidenceRateStratum`, `PaginatedResponse`.

**TanStack Query hooks** (`hooks/useCharacterizations.ts`, `hooks/useIncidenceRates.ts`):
- CRUD hooks for both analysis types
- `useExecuteCharacterization()`, `useExecuteIncidenceRate()` — mutation hooks returning 202
- `useCharacterizationExecutions(id)`, `useIncidenceRateExecutions(id)` — execution history with polling (refetchInterval: 3000 while running)

**Pages:**

`AnalysesPage.tsx` — hub page with 5 tabs: Characterizations, Incidence Rates, Pathways, Estimations, Predictions. Each tab shows `AnalysisList` with create button. Tabs dynamically route to sub-lists.

`CharacterizationDetailPage.tsx` — tabbed detail (design/results): `CharacterizationDesigner` for editing, `CharacterizationResults` for viewing execution output, execution history table.

`IncidenceRateDetailPage.tsx` — same structure for incidence rates.

**Key components:**

`AnalysisList.tsx` — generic paginated analysis table supporting all 5 analysis types. Shows name, type badge, latest execution status (via `ExecutionStatusBadge`), created date, actions.

`CharacterizationDesigner.tsx` — form with target/comparator cohort selectors (multi-select), feature type checkboxes (demographics, conditions, drugs, procedures, measurements, visits), stratification toggles, Top N parameter, minCellCount.

`CharacterizationResults.tsx` — feature type tab selector, `FeatureComparisonTable` for each feature type, CSV download button.

`FeatureComparisonTable.tsx` — sortable side-by-side comparison: feature name, target count/%, comparator count/%, SMD. Colour-coded SMD values (> 0.1 highlighted).

`IncidenceRateDesigner.tsx` — form with target cohort (single), outcome cohorts (multi), time-at-risk definition (start/end dateField + offset), stratification toggles, age group configuration.

`IncidenceRateResults.tsx` — results table with forest plot visualisation for outcomes; expandable rows show stratified data.

`ExecutionStatusBadge.tsx` — reusable status indicator: pending (grey), queued (yellow), running (blue pulse), completed (green), failed (red), cancelled (grey strikethrough).

---

## Step 5D: Pathway Analysis + Patient Profiles

### Backend: PathwayService

**`app/Services/Analysis/PathwayService.php`**

Analyses treatment/event sequences for cohort members. Rather than using SQL STRING_AGG (dialect-dependent), pathway construction is done in PHP for cross-dialect reliability.

Key methods:
- **`execute(PathwayAnalysis, Source, AnalysisExecution)`** — queries ordered events per person, builds pathways in PHP, aggregates frequencies
- **`buildPathways(events, config)`** — groups events by person_id, calls `buildPersonPathway()` for each
- **`buildPersonPathway(personEvents, combinationWindow, maxDepth)`** — merges concurrent events (within N days) into combination steps (e.g., "Drug A + Drug B"), truncates at max depth
- **`getComboKey(events)`** — alphabetically sorts and joins concurrent event names with "+"
- **`buildTargetCountSql()`, `buildOrderedEventsSql()`** — SQL helpers for target cohort count and chronologically ordered events

Result structure: array of `{ pathway: string[], count: int, percent: float }` objects, plus summary stats (persons with/without events, unique pathway count).

**`app/Http/Controllers/Api/V1/PathwayController.php`** — 8-endpoint pattern. Design JSON: targetCohortId, eventCohortIds[], maxDepth (default 5), maxPathLength (default 5), combinationWindow (default 1 day), minCellCount.

**`app/Jobs/Analysis/RunPathwayJob.php`** — queue: `analysis`, timeout: 3600s.

---

### Backend: PatientProfileService

**`app/Services/Analysis/PatientProfileService.php`**

Retrieves complete clinical timeline for a single patient. No execution queue needed — reads directly from CDM.

Key methods:
- **`getProfile(personId, source)`** — returns demographics + 7 domain arrays, all LEFT JOINed to vocabulary for concept names
- **`getCohortMembers(source, cohortDefinitionId, limit, offset)`** — paginated cohort member list with basic demographics

8 domain queries: `getDemographics()`, `getConditions()`, `getDrugs()`, `getProcedures()`, `getMeasurements()`, `getObservations()`, `getVisits()`, `getObservationPeriods()`.

**`app/Http/Controllers/Api/V1/PatientProfileController.php`** — 2 endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/sources/{source}/profiles/{personId}` | Full patient profile |
| GET | `/sources/{source}/cohorts/{cohortId}/members` | Paginated cohort members (limit 1-1000) |

---

### Frontend: Pathways Feature

New feature directory: `frontend/src/features/pathways/`

**Type system** (`types/pathway.ts`): `PathwayDesign`, `PathwayAnalysis`, `PathwayResult`, `PathwayEntry`.

**Pages:**

`PathwayDetailPage.tsx` — tabbed detail (design/results) with `SankeyDiagram` and `PathwayTable` visualisations.

**Key components:**

`PathwayDesigner.tsx` — form with target cohort (single), event cohorts (multi-select), max depth, max path length, combination window parameters.

`SankeyDiagram.tsx` — CSS-based stacked bar visualisation of top 25 pathways. Colour-coded by event cohort, interactive pathway selection, summary statistics panel.

`PathwayTable.tsx` — sortable table of up to 50 pathways: rank, pathway sequence (arrow-separated steps), person count, percentage bars.

---

### Frontend: Profiles Feature

New feature directory: `frontend/src/features/profiles/`

**Type system** (`types/profile.ts`): `PatientDemographics`, `ClinicalDomain` (enum: condition, drug, procedure, measurement, observation, visit), `ClinicalEvent`, `ObservationPeriod`, `PatientProfile`, `CohortMember`.

**Pages:**

`PatientProfilePage.tsx` — smart routing: no personId → shows `CohortMemberList` for member selection; with personId → shows full profile. Source selector for multi-CDM environments.

**Key components:**

`PatientDemographicsCard.tsx` — card with gender, birth year, race/ethnicity, observation date ranges.

`PatientTimeline.tsx` — chronological swim-lane timeline of clinical events by domain. Domain filter buttons, zoom/pan controls. Events colour-coded by domain.

`ClinicalEventCard.tsx` — individual event: concept name, dates, domain colour coding, value/unit (for measurements).

`CohortMemberList.tsx` — paginated member list with person_id, cohort start/end dates, demographics. Click navigates to full profile.

---

## Step 5E: PLE/PLP + Study Orchestrator

### Backend: EstimationService + PredictionService

**`app/Services/Analysis/EstimationService.php`**

Orchestrates population-level estimation (PLE) via the R sidecar's CohortMethod endpoint.

Key methods:
- **`execute(EstimationAnalysis, Source, AnalysisExecution)`** — builds payload from design_json (target/comparator cohorts, outcomes, model config, propensity score settings), calls `RService::runEstimation()`, stores results
- **`isNotImplemented(response)`** — detects R 501 stub responses; on stub, stores placeholder with `design_validated: true` so the frontend can show design acceptance

Design payload: targetCohortId, comparatorCohortId, outcomeCohortIds[], model (type: cox/logistic, timeAtRiskStart/End, endAnchor), propensityScore (enabled, trimming, matching, stratification), covariateSettings, negativeControlOutcomes[].

**`app/Services/Analysis/PredictionService.php`**

Same pattern for patient-level prediction (PLP) via `RService::runPrediction()`. Payload: targetCohortId, outcomeCohortId, model (type: lasso_logistic/gradient_boosting/random_forest, hyperParameters), timeAtRisk, covariateSettings, populationSettings (washoutPeriod, removeSubjectsWithPriorOutcome, requireTimeAtRisk, minTimeAtRisk), splitSettings (testFraction, splitSeed).

**`app/Http/Controllers/Api/V1/EstimationController.php`**, **`PredictionController.php`** — 8-endpoint pattern each.

**`app/Jobs/Analysis/RunEstimationJob.php`**, **`RunPredictionJob.php`** — queue: `r-analysis`, timeout: 14400s (4 hours). Uses `NotifiesOnCompletion` trait.

---

### Backend: StudyService

**`app/Services/Analysis/StudyService.php`**

Bundles multiple analyses into a study with DAG-based execution ordering.

Key methods:
- **`executeAll(Study, Source)`** — dispatches all study analyses in execution order (characterizations first → incidence rates → pathways → estimation → prediction)
- **`getProgress(Study)`** — returns per-status counts (pending/queued/running/completed/failed) and overall study status
- **`addAnalysis(Study, analysisType, analysisId)`** — validates type ∈ {characterization, incidence_rate, pathway, estimation, prediction}, attaches via StudyAnalysis pivot
- **`removeAnalysis(Study, studyAnalysisId)`** — detaches from study

Execution order constant: `EXECUTION_ORDER` maps model class names to priorities 1-5. Status flags: `no_analyses`, `pending`, `running`, `completed`, `has_failures`.

**`app/Http/Controllers/Api/V1/StudyController.php`** — 10 endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/studies` | Paginated list |
| POST | `/studies` | Create |
| GET | `/studies/{id}` | Detail |
| PUT | `/studies/{id}` | Update |
| DELETE | `/studies/{id}` | Soft delete |
| POST | `/studies/{id}/execute` | Execute all analyses (202) |
| GET | `/studies/{id}/progress` | Status counts |
| GET | `/studies/{id}/analyses` | List child analyses |
| POST | `/studies/{id}/analyses` | Add analysis to study |
| DELETE | `/studies/{id}/analyses/{saId}` | Remove analysis from study |

---

### R Sidecar Updates

**`r-runtime/api/estimation.R`** (new) — `POST /run` endpoint. Validates required fields (source, cohorts, model). Returns 501 with `spec_received: true`, `spec_keys`, and `model_type`. TODO comments document the 7-step CohortMethod integration plan: connect CDM → create study population → build covariates → fit PS model → match/stratify → fit outcome model → return estimates.

**`r-runtime/api/prediction.R`** (new) — `POST /run` endpoint. Same pattern for PatientLevelPrediction. TODO documents 7-step plan: connect CDM → create study population → build covariates → split train/test → train model → evaluate → return metrics.

**`r-runtime/plumber_api.R`** (modified) — mounts new routers at `/analysis/estimation` and `/analysis/prediction`.

---

### Frontend: Estimation Feature

New feature directory: `frontend/src/features/estimation/`

**Type system** (`types/estimation.ts`): `EstimationDesign`, `EstimationAnalysis`, `EstimationResult`, `EstimateEntry`.

**Pages:**

`EstimationDetailPage.tsx` — tabbed detail with design editor and results display. Shows R-not-implemented banner when stub response detected.

**Key components:**

`EstimationDesigner.tsx` — form for PLE design: target/comparator cohort selectors, outcome cohorts (multi), model type (Cox/logistic), propensity score settings (enabled, trimming, matching, stratification), covariate configuration.

`ForestPlot.tsx` — SVG forest plot with logarithmic scale. Shows hazard/odds ratio point estimates with 95% CI bars per outcome. Reference line at 1.0. Colour-coded by significance.

`EstimationResults.tsx` — summary statistics table + forest plot. Propensity score diagnostics display. Handles stub responses gracefully with "design validated" message.

---

### Frontend: Prediction Feature

New feature directory: `frontend/src/features/prediction/`

**Type system** (`types/prediction.ts`): `PredictionDesign`, `PredictionAnalysis`, `PredictionResult`.

**Pages:**

`PredictionDetailPage.tsx` — tabbed detail (design/results).

**Key components:**

`PredictionDesigner.tsx` — form for PLP design: target/outcome cohort selectors, model type (LASSO logistic, gradient boosting, random forest), time-at-risk window, covariates, population settings (washout, prior outcome removal, min TAR), split settings (test fraction, seed).

`RocCurve.tsx` — SVG ROC curve with AUC annotation. Diagonal reference line. Smooth curve rendering from (fpr, tpr) data points.

`CalibrationPlot.tsx` — SVG scatter plot of predicted vs. observed outcomes. Diagonal reference line for perfect calibration. Points sized by group count.

`PredictionResults.tsx` — performance metrics panel (AUC, Brier score, calibration slope/intercept), top predictors table, ROC and calibration plot components.

---

### Frontend: Studies Feature

New feature directory: `frontend/src/features/studies/`

**Type system** (`types/study.ts`): `Study`, `StudyAnalysisEntry`, `StudyProgress`.

**Pages:**

`StudiesPage.tsx` — hub with study list and create button.

`StudyDetailPage.tsx` — 3 tabs: design, dashboard, analyses. Design tab edits metadata. Dashboard shows progress. Analyses tab manages included analyses.

**Key components:**

`StudyDesigner.tsx` — form for study metadata: name, description, study type, associated metadata.

`StudyDashboard.tsx` — segmented progress bar (pending/running/completed/failed counts), overall completion percentage, execute-all button with source selector.

`StudyList.tsx` — list with status indicators and analysis counts.

---

## Cross-Cutting: Abby AI Cohort Builder

### Backend: AbbyAiService

**`app/Services/AI/AbbyAiService.php`**

NLP-driven cohort builder that requires no external LLM. Translates natural language prompts into OMOP CohortExpression JSON using regex pattern matching and OMOP vocabulary search.

Key methods:
- **`buildCohortFromPrompt(prompt, sourceId)`** — full pipeline: `analyzePrompt()` → `searchConcepts()` → `buildExpression()` → `generateExplanation()`
- **`analyzePrompt(prompt)`** — regex pattern extraction for: study design (new_users, with_condition, without_condition), demographics (age_range/over/under, gender), temporal windows, medical terms
- **`searchConcepts(terms, sourceId)`** — OMOP vocabulary search: case-insensitive name matching, filters standard concepts (`standard_concept='S'`), excludes invalid. Rankings: exact match (0) > prefix match (1) > fuzzy match (2)
- **`buildExpression(components, concepts)`** — constructs full expression JSON: ConceptSets from found concepts, PrimaryCriteria from primary conditions, InclusionRules from inclusion terms, DemographicCriteria from age/gender
- **`buildDomainCriterion(domain)`** — maps domain to Circe domain key (condition→ConditionOccurrence, drug→DrugExposure, etc.)
- **`suggestCriteria(domain, description)`** — vocabulary search for concept suggestions given a domain hint
- **`explainExpression(expression)`** — human-readable markdown description of an existing expression
- **`refineCohort(expression, prompt)`** — iterative refinement: analyses the new prompt, adds criteria to existing expression

Domain hints constant: 30+ condition terms, 15+ drug terms, 10+ procedure terms, 11+ measurement terms — maps medical jargon to OMOP domains for search routing.

**`app/Http/Controllers/Api/V1/AbbyAiController.php`** — 4 endpoints:

| Method | Route | Description |
|---|---|---|
| POST | `/abby/build-cohort` | NL prompt → expression JSON |
| POST | `/abby/suggest-criteria` | Domain + description → concept suggestions |
| POST | `/abby/explain` | Expression → human-readable explanation |
| POST | `/abby/refine` | Expression + prompt → refined expression |

### Frontend: Abby AI Feature

New feature directory: `frontend/src/features/abby-ai/`

**Type system** (`types/abby.ts`): `AbbyBuildRequest`, `AbbyBuildResponse`, `ConceptSetSuggestion`, `AbbySuggestRequest`, `AbbySuggestResponse`, `AbbyExplainResponse`, `AbbyRefineRequest`.

**Components:**

`AbbyAiPanel.tsx` — slide-in panel with gradient border (teal→purple). Text input for natural language prompts, example prompt chips (e.g., "New users of metformin with type 2 diabetes"), loading state, result display with expression preview, "Apply to Editor" button. Refinement mode: after initial build, subsequent prompts refine the existing expression.

`AbbyExplainer.tsx` — inline component that renders human-readable explanation of the current cohort expression. Called from the cohort definition detail page.

`AbbySuggestPanel.tsx` — modal for concept suggestions. Domain selector (condition, drug, procedure, measurement), description input, results list with "Add to Concept Set" actions.

**Integration:** `CohortDefinitionDetailPage.tsx` modified with "Abby AI" button (gradient styling) that opens `AbbyAiPanel` as a slide-over. `onApply` callback loads the returned expression into the Zustand store.

---

## Cross-Cutting: Notification System

### Backend

**`app/Traits/NotifiesOnCompletion.php`**

Trait used by all 6 analysis jobs + `GenerateCohortJob`. Method `notifyAuthor(AnalysisExecution)`:
1. Loads the execution's creator (User)
2. Checks `user.notification_preferences` for event-specific flags (`analysis_completed`, `analysis_failed`)
3. Dispatches `AnalysisCompletedNotification` or `AnalysisFailedNotification` based on execution status

**`app/Notifications/AnalysisCompletedNotification.php`**

`ShouldQueue` notification (queue: `notifications`). Channels determined by user preferences:
- `mail` if `user.notification_email` is true
- `vonage` (SMS) if `user.notification_sms` is true

Email includes: analysis name, duration (diffForHumans), result summary (person_count, record_count), "View Results" link.

**`app/Notifications/AnalysisFailedNotification.php`** — same pattern with error styling and `fail_message` included.

**`app/Notifications/CohortGeneratedNotification.php`** — dispatched from `GenerateCohortJob` on successful generation. Includes cohort name and person_count.

**Migration: `2026_03_01_200000_add_notification_preferences_to_users.php`**

Adds to users table: `notification_email` (boolean, default true), `notification_sms` (boolean, default false), `phone_number` (string, nullable), `notification_preferences` (json, nullable).

**`app/Http/Controllers/Api/V1/NotificationPreferenceController.php`** — 2 endpoints: `GET /user/notification-preferences` (show), `PUT /user/notification-preferences` (update).

### Frontend: Settings Feature

New feature directory: `frontend/src/features/settings/`

`NotificationSettings.tsx` — form with email/SMS toggles, phone number input, event-specific notification flags (analysis completed, analysis failed, cohort generated).

`NotificationSettingsPage.tsx` — full-page settings accessible from admin → notifications route.

---

## Cross-Cutting: Care Gaps & Condition Bundles

### Design: Medgnosis Adaptation

The care gaps framework is adapted from the Medgnosis chronic disease management application. Medgnosis uses a star schema of 45 disease bundles with risk scoring and deduplication rules. Parthenon's adaptation maps this to OMOP CDM:

- **ConditionBundle** — disease-specific groupings mapped via `omop_concept_ids` (array of OMOP condition concept IDs) and `icd10_patterns` (for reference)
- **QualityMeasure** — individual compliance measures (e.g., "HbA1c Monitoring") with `numerator_criteria` defining the CDM table, concept IDs, and lookback window to check
- **BundleOverlapRule** — deduplication rules for multi-morbidity patients (e.g., blood pressure control shared across HTN, DM, CAD, HF — count once, not four times)

### Backend: Models

**`app/Models/App/ConditionBundle.php`** — `bundle_code` (unique), `condition_name`, `icd10_patterns` (json), `omop_concept_ids` (json), `disease_category`, `is_active`. Relations: `measures()` belongsToMany via `bundle_measures` (with ordinal), `evaluations()` hasMany, `author()` belongsTo User.

**`app/Models/App/QualityMeasure.php`** — `measure_code` (unique), `measure_name`, `measure_type` (preventive/chronic/behavioral), `domain`, `numerator_criteria` (json: concept_ids, lookback_days), `denominator_criteria` (json), `exclusion_criteria` (json). Relations: `bundles()` belongsToMany, `conceptSet()` belongsTo.

**`app/Models/App/BundleOverlapRule.php`** — `rule_code` (unique), `shared_domain`, `applicable_bundle_codes` (json array), `canonical_measure_code`. Lookup table, no relations.

**`app/Models/App/CareGapEvaluation.php`** — `bundle_id`, `source_id`, `cohort_definition_id` (nullable), `status`, `result_json` (jsonb), `compliance_summary` (jsonb), `person_count`, `fail_message`. Relations: `bundle()`, `source()`, `cohortDefinition()`, `author()`.

### Backend: Migration

**`2026_03_02_100000_create_care_bundles_tables.php`** — creates 5 tables:

1. **condition_bundles** — id, bundle_code (unique), condition_name, description, icd10_patterns (jsonb), omop_concept_ids (jsonb), bundle_size, ecqm_references (jsonb), disease_category, author_id (FK→users), is_active, timestamps, softDeletes
2. **quality_measures** — id, measure_code (unique), measure_name, description, measure_type, domain, concept_set_id (FK→concept_sets nullable), numerator_criteria (jsonb), denominator_criteria (jsonb), exclusion_criteria (jsonb), frequency, is_active, timestamps
3. **bundle_measures** — pivot: bundle_id (FK, cascade), measure_id (FK, cascade), ordinal, unique(bundle_id, measure_id)
4. **bundle_overlap_rules** — id, rule_code (unique), shared_domain, applicable_bundle_codes (jsonb), canonical_measure_code, description, is_active, timestamps
5. **care_gap_evaluations** — id, bundle_id (FK, cascade), source_id (FK, cascade), cohort_definition_id (FK, nullable), status, evaluated_at, result_json (jsonb), person_count, compliance_summary (jsonb), fail_message, author_id (FK, nullable), timestamps

### Backend: CareGapService

**`app/Services/Analysis/CareGapService.php`**

Evaluates quality measure compliance for patients with a given condition bundle.

Key methods:
- **`evaluate(ConditionBundle, Source, cohortDefinitionId, CareGapEvaluation)`** — finds eligible patients, evaluates each measure, applies overlap deduplication, computes overall compliance, stores results
- **`findEligiblePatients(bundle, source, cohortDefinitionId)`** — queries `condition_occurrence` for persons with any of the bundle's `omop_concept_ids`; optionally intersects with a cohort
- **`evaluateMeasure(measure, patientIds, source)`** — checks compliance per measure: queries the CDM domain table for numerator criteria concept IDs within the lookback window; chunks patient IDs into 1000-person batches for SQL IN clauses
- **`applyOverlapRules(measureResults, bundle)`** — deduplicates: for each applicable overlap rule, keeps only the canonical measure's result and marks others as deduplicated
- **`computeOverallCompliance(measureResults)`** — average compliance across non-deduplicated measures
- **`computeRiskDistribution(overallCompliance)`** — heuristic tiers: high = 100-compliance%, low = compliance-20%, medium = remainder
- **`getPopulationSummary(source)`** — aggregates compliance across all active bundles for a source

**`app/Http/Controllers/Api/V1/CareGapController.php`** — 13 endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/care-bundles` | List bundles (search, disease_category, is_active filters) |
| POST | `/care-bundles` | Create bundle |
| GET | `/care-bundles/{id}` | Detail |
| PUT | `/care-bundles/{id}` | Update |
| DELETE | `/care-bundles/{id}` | Soft delete |
| GET | `/care-bundles/{id}/measures` | List measures |
| POST | `/care-bundles/{id}/measures` | Add/create measure |
| DELETE | `/care-bundles/{id}/measures/{mId}` | Remove measure |
| POST | `/care-bundles/{id}/evaluate` | Dispatch evaluation (202) |
| GET | `/care-bundles/{id}/evaluations` | Evaluation history |
| GET | `/care-bundles/{id}/evaluations/{eId}` | Evaluation detail |
| GET | `/care-bundles/overlap-rules` | List overlap rules |
| GET | `/care-bundles/population-summary` | Aggregate compliance across bundles |

**`app/Jobs/Analysis/RunCareGapEvaluationJob.php`** — queue: `analysis`, timeout: 3600s.

### Backend: Seeder

**`database/seeders/ConditionBundleSeeder.php`** — seeds 10 disease bundles with 56 quality measures and 3 overlap rules.

Bundles:
1. **DM** (Type 2 Diabetes) — 6 measures: HbA1c monitoring, blood pressure control, lipid panel, foot exam, eye exam, kidney function
2. **HTN** (Hypertension) — 4 measures: BP monitoring, medication adherence, lipid screening, renal function
3. **CAD** (Coronary Artery Disease) — 5 measures: lipid management, antiplatelet therapy, BP control, cardiac rehab, statin therapy
4. **HF** (Heart Failure) — 6 measures: LVEF assessment, ACEi/ARB therapy, beta-blocker therapy, diuretic management, BNP monitoring, BP control
5. **CKD** (Chronic Kidney Disease) — 4 measures: eGFR monitoring, proteinuria screening, BP control, nephrology referral
6. **COPD** — 4 measures: spirometry, bronchodilator therapy, vaccination, pulmonary rehab
7. **ASH** (Asthma) — 3 measures: controller medication, action plan, spirometry
8. **DEPR** (Depression) — 3 measures: PHQ-9 screening, antidepressant therapy, follow-up assessment
9. **OSTEO** (Osteoporosis) — 3 measures: DEXA scan, calcium/vitamin D, bisphosphonate therapy
10. **AFF** (Atrial Fibrillation) — 4 measures: anticoagulation therapy, rate/rhythm control, stroke risk assessment, bleeding risk assessment

Overlap rules:
- **DEDUP_BP_CONTROL** (blood_pressure) — applies to HTN, DM, CAD, HF
- **DEDUP_LIPID_MGMT** (lipid_management) — applies to DM, CAD
- **DEDUP_RENAL** (renal_function) — applies to DM, CKD, HF

### Frontend: Care Gaps Feature

New feature directory: `frontend/src/features/care-gaps/`

**Type system** (`types/careGap.ts`): `ConditionBundle`, `QualityMeasure`, `BundleOverlapRule`, `CareGapEvaluation`, `CareGapResult`, `MeasureResult`, `OverlapDeduction`, `ComplianceSummary`, `PopulationSummary`, `BundlePopulationEntry`, `CreateBundlePayload`, `UpdateBundlePayload`, `BundleListParams`, `PaginatedResponse`.

**TanStack Query hooks** (`hooks/useCareGaps.ts`): structured key factory with `useBundles`, `useBundle`, `useBundleMeasures`, `useEvaluations`, `useEvaluation`, `useOverlapRules`, `usePopulationSummary`, plus create/update/delete/evaluate mutations.

**Pages:**

`CareGapsPage.tsx` — 2-tab hub: Bundles (list view) and Population Summary (dashboard view). Bundle list with search, disease category filter, create button.

`BundleDetailPage.tsx` — 3 tabs: Design (edit bundle metadata + OMOP concepts), Measures (manage quality measures), Results (evaluation history + compliance display).

**Key components:**

`ComplianceRing.tsx` — SVG animated circular gauge showing compliance percentage. Colour interpolation: red (0%) → yellow (50%) → green (100%).

`BundleCard.tsx` — card showing bundle name, disease category badge, measure count, latest evaluation compliance score (via ComplianceRing).

`BundleList.tsx` — paginated/searchable grid of BundleCards.

`MeasureComplianceTable.tsx` — table showing measure code, name, eligible/met/not-met/excluded counts, compliance percentage bar.

`BundleDesigner.tsx` — form for bundle metadata: condition name, bundle code, ICD-10 patterns (tag input), OMOP concept IDs (tag input), disease category selector, eCQM references.

`PopulationComplianceDashboard.tsx` — overview grid: each bundle entry shows condition name, eligible patient count, overall compliance, risk distribution bars.

`OverlapRulesPanel.tsx` — read-only display of deduplication rules: rule code, shared domain, applicable bundles, canonical measure.

---

## Architectural Notes

### Circe compatibility

The SQL compiler output is structurally equivalent to Circe's PostgreSQL dialect. This means:
1. Existing Atlas cohort expression JSON files can be imported directly — the schema normaliser fills missing optional fields.
2. Generated SQL can be compared against legacy Atlas output for validation.
3. The `previewSql` endpoint allows researchers to inspect and manually run the SQL without the generation pipeline.

### No Kotlin/Java dependency

The original Atlas requires a running WebAPI (Java/Spring + Circe library). Parthenon's compiler is pure PHP, eliminating the runtime dependency and giving full control over the SQL dialect (PostgreSQL-only, no Oracle/SQL Server compatibility shims needed).

### Inline concept set SQL

Rather than materialising concept set expansions into a temp table per generation (Atlas pattern), the resolver embeds concept set SQL as inline CTEs. This trades some query plan predictability for zero-setup cost and simpler session management in a multi-tenant environment.

### Recursive group updates in Zustand

The `CriteriaGroupEditor` passes a `groupPath: number[]` prop (index chain from root to the current group). Store update helpers traverse this path to perform deep immutable updates, avoiding prop-drilling of mutable references into recursive children.

### SQL-only characterization

Rather than depending on R's FeatureExtraction package, characterization uses SQL templates through `SqlRendererService`. The plugin architecture (`FeatureBuilderInterface`) makes it straightforward to add new feature types (e.g., drug era, condition era, visit detail) without changing the service orchestration layer.

### PHP-side pathway construction

Pathway analysis queries ordered events from the CDM via SQL but constructs pathways in PHP. This avoids `STRING_AGG` / `LISTAGG` dialect differences and gives full control over combination window merging and depth truncation logic.

### R sidecar graceful degradation

The estimation and prediction services detect R 501 stub responses and store `design_validated: true` placeholder results. This allows the full design workflow (create analysis → configure parameters → execute → see validation) to function even before R HADES packages are configured, providing a smooth incremental deployment path.

### Care gap overlap deduplication

Multi-morbidity patients (e.g., diabetic with hypertension and CAD) would have overlapping quality measures counted multiple times. The `BundleOverlapRule` system resolves this by designating a "canonical" measure per shared domain (e.g., BP control canonical = HTN bundle's measure). During evaluation, overlapping measures in other bundles are marked as deduplicated and excluded from compliance averaging.

### Abby AI without LLM dependency

The NLP cohort builder uses regex pattern matching + OMOP vocabulary search rather than calling an external LLM. This means it works fully offline, has deterministic outputs, and incurs no API costs. The trade-off is lower flexibility for truly novel prompts, but the 30+ domain hint terms and study design patterns cover the most common use cases.

---

## Infrastructure Updates

### Horizon Queue Supervisors (modified `config/horizon.php`)

```php
'analysis'   => ['queue' => ['analysis'],   'maxProcesses' => 3, 'timeout' => 3600,  'memory' => 512]
'r-analysis' => ['queue' => ['r-analysis'], 'maxProcesses' => 2, 'timeout' => 14400, 'memory' => 512]
```

### AppServiceProvider (modified `app/Providers/AppServiceProvider.php`)

Registered as singletons: `AbbyAiService`, `CareGapService`, `CharacterizationService`, `IncidenceRateService`, `PathwayService`, `PatientProfileService`, `EstimationService`, `PredictionService`, `StudyService`, `SqlRendererService`.

### Routes (modified `backend/routes/api.php`)

All new routes added within the `auth:sanctum` middleware group. Care bundles and Abby AI each get their own route group prefix.

---

## Files Changed / Created

### Backend (new)
- `app/Services/Cohort/CohortSqlCompiler.php`
- `app/Services/Cohort/CohortGenerationService.php`
- `app/Services/Cohort/Schema/CohortExpressionSchema.php`
- `app/Services/Cohort/Criteria/AbstractCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/CriteriaBuilderInterface.php`
- `app/Services/Cohort/Criteria/CriteriaBuilderRegistry.php`
- `app/Services/Cohort/Criteria/ConditionCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DrugCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/ProcedureCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/MeasurementCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/ObservationCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/VisitCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DeathCriteriaBuilder.php`
- `app/Services/Cohort/Criteria/DemographicCriteriaBuilder.php`
- `app/Services/Cohort/Builders/PrimaryCriteriaBuilder.php`
- `app/Services/Cohort/Builders/InclusionCriteriaBuilder.php`
- `app/Services/Cohort/Builders/CensoringBuilder.php`
- `app/Services/Cohort/Builders/EndStrategyBuilder.php`
- `app/Services/Cohort/Builders/TemporalWindowBuilder.php`
- `app/Services/Cohort/Builders/OccurrenceFilterBuilder.php`
- `app/Services/Cohort/Builders/ConceptSetSqlBuilder.php`
- `app/Services/ConceptSet/ConceptSetResolverService.php`
- `app/Services/Analysis/CharacterizationService.php`
- `app/Services/Analysis/IncidenceRateService.php`
- `app/Services/Analysis/PathwayService.php`
- `app/Services/Analysis/PatientProfileService.php`
- `app/Services/Analysis/EstimationService.php`
- `app/Services/Analysis/PredictionService.php`
- `app/Services/Analysis/StudyService.php`
- `app/Services/Analysis/CareGapService.php`
- `app/Services/Analysis/Features/FeatureBuilderInterface.php`
- `app/Services/Analysis/Features/DemographicFeatureBuilder.php`
- `app/Services/Analysis/Features/ConditionFeatureBuilder.php`
- `app/Services/Analysis/Features/DrugFeatureBuilder.php`
- `app/Services/Analysis/Features/ProcedureFeatureBuilder.php`
- `app/Services/Analysis/Features/MeasurementFeatureBuilder.php`
- `app/Services/Analysis/Features/VisitFeatureBuilder.php`
- `app/Services/AI/AbbyAiService.php`
- `app/Traits/NotifiesOnCompletion.php`
- `app/Notifications/AnalysisCompletedNotification.php`
- `app/Notifications/AnalysisFailedNotification.php`
- `app/Notifications/CohortGeneratedNotification.php`
- `app/Models/App/ConditionBundle.php`
- `app/Models/App/QualityMeasure.php`
- `app/Models/App/BundleOverlapRule.php`
- `app/Models/App/CareGapEvaluation.php`
- `app/Jobs/Cohort/GenerateCohortJob.php`
- `app/Jobs/Analysis/RunCharacterizationJob.php`
- `app/Jobs/Analysis/RunIncidenceRateJob.php`
- `app/Jobs/Analysis/RunPathwayJob.php`
- `app/Jobs/Analysis/RunEstimationJob.php`
- `app/Jobs/Analysis/RunPredictionJob.php`
- `app/Jobs/Analysis/RunCareGapEvaluationJob.php`
- `app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- `app/Http/Controllers/Api/V1/ConceptSetController.php`
- `app/Http/Controllers/Api/V1/CharacterizationController.php`
- `app/Http/Controllers/Api/V1/IncidenceRateController.php`
- `app/Http/Controllers/Api/V1/PathwayController.php`
- `app/Http/Controllers/Api/V1/PatientProfileController.php`
- `app/Http/Controllers/Api/V1/EstimationController.php`
- `app/Http/Controllers/Api/V1/PredictionController.php`
- `app/Http/Controllers/Api/V1/StudyController.php`
- `app/Http/Controllers/Api/V1/CareGapController.php`
- `app/Http/Controllers/Api/V1/AbbyAiController.php`
- `app/Http/Controllers/Api/V1/NotificationPreferenceController.php`
- `database/migrations/2026_03_01_190000_create_cohort_results_table.php`
- `database/migrations/2026_03_01_190001_create_cohort_inclusion_stats_table.php`
- `database/migrations/2026_03_01_200000_add_notification_preferences_to_users.php`
- `database/migrations/2026_03_02_100000_create_care_bundles_tables.php`
- `database/seeders/ConditionBundleSeeder.php`

### Backend (modified)
- `app/Http/Controllers/Api/V1/VocabularyController.php` — extended with descendants, hierarchy, domains, vocabularies
- `app/Providers/AppServiceProvider.php` — registered all new services
- `app/Models/User.php` — notification preference fields
- `config/horizon.php` — analysis + r-analysis supervisors
- `routes/api.php` — all new route groups

### Frontend (new)
- `features/cohort-definitions/types/cohortExpression.ts`
- `features/cohort-definitions/stores/cohortExpressionStore.ts`
- `features/cohort-definitions/api/cohortApi.ts`
- `features/cohort-definitions/hooks/useCohortDefinitions.ts`
- `features/cohort-definitions/hooks/useCohortGeneration.ts`
- `features/cohort-definitions/components/CohortDefinitionList.tsx`
- `features/cohort-definitions/components/CohortExpressionEditor.tsx`
- `features/cohort-definitions/components/PrimaryCriteriaPanel.tsx`
- `features/cohort-definitions/components/DomainCriteriaSelector.tsx`
- `features/cohort-definitions/components/CriteriaGroupEditor.tsx`
- `features/cohort-definitions/components/InclusionCriteriaPanel.tsx`
- `features/cohort-definitions/components/InclusionRuleEditor.tsx`
- `features/cohort-definitions/components/TemporalWindowEditor.tsx`
- `features/cohort-definitions/components/EndStrategyEditor.tsx`
- `features/cohort-definitions/components/DemographicFilterEditor.tsx`
- `features/cohort-definitions/components/ConceptSetPicker.tsx`
- `features/cohort-definitions/components/CohortGenerationPanel.tsx`
- `features/cohort-definitions/components/GenerationHistoryTable.tsx`
- `features/cohort-definitions/components/CohortSqlPreview.tsx`
- `features/cohort-definitions/pages/CohortDefinitionsPage.tsx`
- `features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- `features/concept-sets/types/conceptSet.ts`
- `features/concept-sets/api/conceptSetApi.ts`
- `features/concept-sets/hooks/useConceptSets.ts`
- `features/concept-sets/components/ConceptSetList.tsx`
- `features/concept-sets/components/ConceptSetEditor.tsx`
- `features/concept-sets/components/ConceptSetItemRow.tsx`
- `features/concept-sets/pages/ConceptSetsPage.tsx`
- `features/concept-sets/pages/ConceptSetDetailPage.tsx`
- `features/vocabulary/types/vocabulary.ts`
- `features/vocabulary/api/vocabularyApi.ts`
- `features/vocabulary/hooks/useVocabularySearch.ts`
- `features/vocabulary/hooks/useConceptHierarchy.ts`
- `features/vocabulary/components/VocabularySearchPanel.tsx`
- `features/vocabulary/components/ConceptDetailPanel.tsx`
- `features/vocabulary/components/HierarchyTree.tsx`
- `features/vocabulary/pages/VocabularyPage.tsx`
- `features/analyses/types/analysis.ts`
- `features/analyses/api/characterizationApi.ts`
- `features/analyses/api/incidenceRateApi.ts`
- `features/analyses/hooks/useCharacterizations.ts`
- `features/analyses/hooks/useIncidenceRates.ts`
- `features/analyses/components/AnalysisList.tsx`
- `features/analyses/components/CharacterizationDesigner.tsx`
- `features/analyses/components/CharacterizationResults.tsx`
- `features/analyses/components/FeatureComparisonTable.tsx`
- `features/analyses/components/IncidenceRateDesigner.tsx`
- `features/analyses/components/IncidenceRateResults.tsx`
- `features/analyses/components/ExecutionStatusBadge.tsx`
- `features/analyses/pages/AnalysesPage.tsx`
- `features/analyses/pages/CharacterizationDetailPage.tsx`
- `features/analyses/pages/IncidenceRateDetailPage.tsx`
- `features/pathways/types/pathway.ts`
- `features/pathways/api/pathwayApi.ts`
- `features/pathways/hooks/usePathways.ts`
- `features/pathways/components/PathwayDesigner.tsx`
- `features/pathways/components/SankeyDiagram.tsx`
- `features/pathways/components/PathwayTable.tsx`
- `features/pathways/pages/PathwayDetailPage.tsx`
- `features/profiles/types/profile.ts`
- `features/profiles/api/profileApi.ts`
- `features/profiles/hooks/usePatientProfile.ts`
- `features/profiles/components/PatientDemographicsCard.tsx`
- `features/profiles/components/PatientTimeline.tsx`
- `features/profiles/components/ClinicalEventCard.tsx`
- `features/profiles/components/CohortMemberList.tsx`
- `features/profiles/pages/PatientProfilePage.tsx`
- `features/estimation/types/estimation.ts`
- `features/estimation/api/estimationApi.ts`
- `features/estimation/hooks/useEstimations.ts`
- `features/estimation/components/EstimationDesigner.tsx`
- `features/estimation/components/ForestPlot.tsx`
- `features/estimation/components/EstimationResults.tsx`
- `features/estimation/pages/EstimationDetailPage.tsx`
- `features/prediction/types/prediction.ts`
- `features/prediction/api/predictionApi.ts`
- `features/prediction/hooks/usePredictions.ts`
- `features/prediction/components/PredictionDesigner.tsx`
- `features/prediction/components/RocCurve.tsx`
- `features/prediction/components/CalibrationPlot.tsx`
- `features/prediction/components/PredictionResults.tsx`
- `features/prediction/pages/PredictionDetailPage.tsx`
- `features/studies/types/study.ts`
- `features/studies/api/studyApi.ts`
- `features/studies/hooks/useStudies.ts`
- `features/studies/components/StudyDesigner.tsx`
- `features/studies/components/StudyDashboard.tsx`
- `features/studies/components/StudyList.tsx`
- `features/studies/pages/StudiesPage.tsx`
- `features/studies/pages/StudyDetailPage.tsx`
- `features/abby-ai/types/abby.ts`
- `features/abby-ai/api/abbyApi.ts`
- `features/abby-ai/hooks/useAbbyAi.ts`
- `features/abby-ai/components/AbbyAiPanel.tsx`
- `features/abby-ai/components/AbbyExplainer.tsx`
- `features/abby-ai/components/AbbySuggestPanel.tsx`
- `features/care-gaps/types/careGap.ts`
- `features/care-gaps/api/careGapApi.ts`
- `features/care-gaps/hooks/useCareGaps.ts`
- `features/care-gaps/components/ComplianceRing.tsx`
- `features/care-gaps/components/BundleCard.tsx`
- `features/care-gaps/components/BundleList.tsx`
- `features/care-gaps/components/MeasureComplianceTable.tsx`
- `features/care-gaps/components/BundleDesigner.tsx`
- `features/care-gaps/components/PopulationComplianceDashboard.tsx`
- `features/care-gaps/components/OverlapRulesPanel.tsx`
- `features/care-gaps/pages/CareGapsPage.tsx`
- `features/care-gaps/pages/BundleDetailPage.tsx`
- `features/settings/types/notifications.ts`
- `features/settings/api/notificationApi.ts`
- `features/settings/hooks/useNotificationSettings.ts`
- `features/settings/components/NotificationSettings.tsx`
- `features/settings/pages/NotificationSettingsPage.tsx`

### Frontend (modified)
- `app/router.tsx` — lazy-loaded routes for all new features
- `features/analyses/pages/AnalysesPage.tsx` — 5 tabs (characterizations, incidence rates, pathways, estimations, predictions)
- `features/analyses/components/AnalysisList.tsx` — extended to support all 5 analysis types
- `features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx` — Abby AI button + slide-in panel

### R Sidecar (new)
- `r-runtime/api/estimation.R` — CohortMethod endpoint (501 stub with validation)
- `r-runtime/api/prediction.R` — PatientLevelPrediction endpoint (501 stub with validation)

### R Sidecar (modified)
- `r-runtime/api/stubs.R` — enhanced 501 responses with spec_received, spec_keys, hint fields
- `r-runtime/plumber_api.R` — mounted estimation + prediction routers

### Docs
- `docs/devlog/phase-5-research-workbench.md` — this file (updated)
