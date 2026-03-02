# Phase 5: Research Workbench — Development Log

**Date:** 2026-03-01
**Branch:** `master`
**Status:** Complete — Cohort SQL Compiler, ConceptSet resolver, Vocabulary browser, and full frontend workbench delivered.

---

## Overview

Phase 5 delivers the core research tooling: the ability to define, generate, and inspect patient cohorts using OMOP CDM data. The work replaces the legacy Circe-Java cohort SQL engine with a native PHP implementation, builds a concept set resolver that respects the OMOP vocabulary graph, and ships a fully-interactive React workbench replacing Atlas's Knockout.js UI.

Three feature areas:
1. **Cohort Definitions** — expression editor, SQL compiler, generation pipeline, SQL preview, history table
2. **Concept Sets** — full CRUD with per-item flags (descendants, mapped, excluded) and vocabulary resolution
3. **Vocabulary Browser** — concept search, concept detail, hierarchy tree

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
