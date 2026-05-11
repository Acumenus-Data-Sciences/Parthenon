# Aqueduct ETL Mapping Designer — Design Specification

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Phased (3 phases, each independently shippable)

## Overview

Aqueduct is a web-based visual ETL mapping designer that replaces OHDSI's Rabbit-in-a-Hat desktop application. It lives inside the ETL Tools page as the second step of a two-step pipeline (Source Profiler → Aqueduct) and enables interactive design of source-to-OMOP CDM mappings with AI-assisted suggestions, live vocabulary search, stem table support, and executable SQL generation.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Page structure | ETL Tools = 2-step pipeline (Source Profiler → Aqueduct). Synthea moves to Workbench. FHIR tab removed (dedicated page exists). | Clean pipeline: profile → map |
| Canvas layout | Hybrid two-level: table-to-table React Flow overview + field-level detail drill-down | Full overview + focused detail. Scales to large schemas. Familiar RiaH two-level pattern |
| Canvas library | React Flow (`@xyflow/react`) | MIT licensed, interactive nodes/edges, built-in zoom/pan/minimap, widely used in data pipeline UIs |
| Project scope | One project per (source, CDM version) pair | Deterministic. Future-proofed for CDM version upgrades |
| AI suggestions | Auto-suggest on project creation, all proposals require explicit user review | Head start for users. Leverages existing AiService + Hecate. Nothing executes without confirmation |
| Output formats | Markdown spec + executable SQL + JSON export | Markdown for humans, runnable SQL for developers (RiaH's most-requested feature), JSON for tool integration |
| Stem tables | Built-in first-class support with pre-built OHDSI domain routing | Required for real-world ETL where source records span multiple CDM domains |

## Phase 1: Page Restructure + Mapping Canvas + Persistence

### 1.1 ETL Tools Page Restructure

**Current state:** 3-tab layout (Source Profiler, Synthea, FHIR).

**New state:** 2-step stepper pipeline:
- **Step 1: Source Profiler** — Full profiler moved from standalone `/source-profiler` page into ETL Tools. The `/source-profiler` sidenav link routes to `/etl-tools?step=profiler`. All profiler components (scan, history, CDM context, PII, comparison, FK graph) render here.
- **Step 2: Aqueduct** — Mapping designer. Available after selecting a source with at least one scan profile. "Start mapping →" button transitions from Step 1 to Step 2.

Synthea Generator removed from ETL Tools (future: move to Workbench). FHIR tab removed (dedicated page exists in sidenav).

### 1.2 Data Model

Three new tables in the `app` schema.

**`etl_projects`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `source_id` | bigint FK → sources | NOT NULL |
| `cdm_version` | varchar(10), default '5.4' | NOT NULL |
| `name` | varchar(255) | Auto-generated: "{source_name} → CDM {version}" |
| `status` | varchar(20), default 'draft' | Enum: draft, in_review, approved, archived |
| `created_by` | bigint FK → users | NOT NULL |
| `scan_profile_id` | bigint FK → source_profiles | NOT NULL. Links to the scan this mapping is based on. A scan is required before mapping. |
| `notes` | text, nullable | Project-level notes |
| `deleted_at` | timestamp, nullable | Soft delete support |
| `timestamps` | created_at, updated_at | |

Uses `SoftDeletes` trait — accidental deletion of significant mapping work is recoverable.

Unique constraint: partial unique index on `(source_id, cdm_version) WHERE deleted_at IS NULL` — one active project per source + CDM version pair. Soft-deleted projects don't block creation of new ones, enabling "start over" workflow.

**`etl_table_mappings`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `etl_project_id` | bigint FK → etl_projects | NOT NULL, cascade delete |
| `source_table` | varchar(255) | NOT NULL. Value `'_stem'` for stem-to-CDM fan-out mappings |
| `target_table` | varchar(255) | NOT NULL. OMOP CDM table name |
| `logic` | text, nullable | Table-level transformation notes |
| `is_completed` | boolean, default false | Completion tracking |
| `is_stem` | boolean, default false | Marks stem table mappings |
| `sort_order` | integer, default 0 | Display ordering |
| `timestamps` | | |

Unique constraint: `(etl_project_id, source_table, target_table)`.

**`etl_field_mappings`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `etl_table_mapping_id` | bigint FK → etl_table_mappings | NOT NULL, cascade delete |
| `source_column` | varchar(255), nullable | NULL for unmapped/constant fields |
| `target_column` | varchar(255) | NOT NULL. CDM column name |
| `mapping_type` | varchar(20), default 'direct' | Enum: direct, transform, lookup, constant, concat, expression |
| `logic` | text, nullable | Transformation expression or notes |
| `is_required` | boolean, default false | From CDM schema definition |
| `confidence` | float, nullable | AI suggestion confidence 0.0–1.0 |
| `is_ai_suggested` | boolean, default false | |
| `is_reviewed` | boolean, default false | |
| `timestamps` | | |

Unique constraint: `(etl_table_mapping_id, target_column)` — each CDM column mapped once per table pair.

**Relationships:**
```
Source (1) → (N) EtlProject (1) → (N) EtlTableMapping (1) → (N) EtlFieldMapping
                 ↑ scan_profile_id
            SourceProfile
```

**Eloquent models:** `EtlProject`, `EtlTableMapping`, `EtlFieldMapping` in `App\Models\App\`. Standard `$fillable`, no `$guarded = []` per HIGHSEC §3.1.

### 1.3 CDM Schema Definition

A static TypeScript constant and PHP array defining all OMOP CDM v5.4 tables and columns. Not fetched from the database — bundled in the codebase.

**Frontend:** `frontend/src/features/etl/lib/cdm-schema-v54.ts`
```typescript
export interface CdmColumn {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface CdmTable {
  name: string;
  domain: string; // Person, Visit, Condition, Drug, Procedure, Measurement, Observation, Other
  columns: CdmColumn[];
}

export const CDM_SCHEMA_V54: CdmTable[] = [...]
```

**Backend:** `backend/config/cdm-schema-v54.php` — same data as PHP array, used for validation and SQL generation.

Derived from the official OHDSI CDM CSV (`https://github.com/OHDSI/CommonDataModel`). Approximately 37 tables, ~400 columns.

**Sync strategy:** Both files are generated from the same OHDSI CDM CSV source via a build script (`scripts/generate-cdm-schema.py`). When CDM version changes, re-run the script to update both. Both files include a `// GENERATED — do not edit manually. Run scripts/generate-cdm-schema.py` header comment.

### 1.4 API Endpoints

All under `auth:sanctum` middleware.

All routes require `auth:sanctum` + `EtlProjectPolicy` ownership check. Scoped to the authenticated user's projects (admins see all).

**Project management:**

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/etl-projects` | `etl.view` | List user's projects (paginated, scoped by ownership) |
| `POST` | `/etl-projects` | `etl.create` | Create project for source + CDM version |
| `GET` | `/etl-projects/{project}` | `etl.view` | Get project with table mappings (ownership enforced) |
| `PUT` | `/etl-projects/{project}` | `etl.create` | Update project metadata (name, status, notes) |
| `DELETE` | `/etl-projects/{project}` | `etl.delete` | Soft-delete project + all mappings |

**Table mappings:**

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/etl-projects/{project}/table-mappings` | `etl.view` | List all table mappings with completion status |
| `POST` | `/etl-projects/{project}/table-mappings` | `etl.create` | Create table mapping (source → target) |
| `PUT` | `/etl-projects/{project}/table-mappings/{mapping}` | `etl.create` | Update logic, completion |
| `DELETE` | `/etl-projects/{project}/table-mappings/{mapping}` | `etl.create` | Remove table mapping + field mappings |

**Field mappings:**

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/etl-projects/{project}/table-mappings/{mapping}/fields` | `etl.view` | List field mappings for a table pair |
| `PUT` | `/etl-projects/{project}/table-mappings/{mapping}/fields` | `etl.create` | Bulk upsert field mappings (auto-save from canvas) |

The `PUT /fields` endpoint accepts the full field mapping array and upserts with optimistic locking — includes `updated_at` timestamp on the table mapping; API returns 409 Conflict if stale. This prevents auto-save race conditions.

**Form Requests:**
- `CreateEtlProjectRequest` — validates source_id (required, exists), cdm_version (required, in allowed list), scan_profile_id (required, exists), notes (nullable string)
- `UpdateEtlProjectRequest` — validates name (nullable string, max 255), status (nullable, in: draft/in_review/approved/archived), notes (nullable string)
- `CreateTableMappingRequest` — validates source_table (required, max 255), target_table (required, must exist in CDM schema), logic (nullable string), is_stem (boolean)
- `UpdateFieldMappingsRequest` — validates fields array with per-field rules: target_column (required), source_column (nullable), mapping_type (in allowed enum), logic (nullable), is_reviewed (boolean)

### 1.5 Mapping Canvas — Table Overview (React Flow)

Full-width interactive canvas using `@xyflow/react`.

**Node types:**

- **SourceTableNode** — Gold border (`#C9A227`), shows table name, column count, row count from scan. Right-side connection handle.
- **CdmTableNode** — Teal border (`#2DD4BF`), shows table name, required field count, domain color. Left-side connection handle. Grouped by domain.

**Edge type:**

- **MappingEdge** — Custom edge showing progress badge ("N/M fields mapped"). Color by status: teal = complete, amber = partial, red = has unmapped required fields. Animated dashed line for AI-suggested (unreviewed) connections. Click → drill into field detail.

**Layout:**
- Source nodes auto-positioned in left column, CDM nodes in right column
- Auto-layout via dagre algorithm (`@dagrejs/dagre`) for clean edge routing
- Unmapped tables dimmed to 30% opacity
- CDM tables grouped by domain with visual section dividers

**Interactions:**
- Drag from source handle to CDM handle → creates `etl_table_mapping` via API
- Click edge → navigate to field-level detail view
- Right-click node/edge → context menu (remove mapping, edit notes, mark complete)
- Built-in React Flow controls: zoom, pan, minimap, fit-view

**Top toolbar:**
- Project name + status badge
- Progress bar: "N of M CDM tables mapped • X% field coverage"
- Filter: all / mapped only / unmapped only
- "AI Suggest All" button (Phase 2 — disabled in Phase 1)
- Export dropdown (Phase 3 — disabled in Phase 1)

### 1.6 Mapping Canvas — Field-Level Detail

Accessed by clicking an edge in the table overview.

**Layout — split panel with React Flow center:**
- **Left panel (35%):** Source table columns from scan data. Each row: column name, type badge, null%, distinct count, sample values. Right-side React Flow handles.
- **Center canvas (30%):** React Flow mini-canvas showing field-to-field edges. Drag from source handle to CDM handle to create mapping.
- **Right panel (35%):** CDM target columns from schema definition. Each row: column name, type, required marker (*), description. Left-side handles.

**Per-field mapping detail (inline expandable):**
When a field edge is selected, expand below the center canvas:
- **Mapping type** dropdown: direct | transform | lookup | constant | concat | expression
- **Logic** text area: transformation expression or notes
- **Concept search** (for `*_concept_id` columns): inline Hecate typeahead search. Shows concept_id, name, domain, vocabulary, standard status.
- **Confidence badge** (if AI-suggested): score + "AI suggested" label
- **Review toggle**: mark as reviewed ✓

**CDM column status indicators:**
- Green check (✓): mapped and reviewed
- Amber dot (●): mapped but not reviewed / AI-suggested pending review
- Red asterisk (*): required but unmapped
- Gray dash (—): optional and unmapped

**Navigation:**
- Breadcrumb: `Project > source_table → cdm_table`
- "← Back to overview" returns to table canvas
- "← Previous pair" / "Next pair →" for sequential navigation

**Auto-save:** Field mapping changes debounce 500ms then `PUT /fields` with the full mapping array. No save button.

### 1.7 Frontend File Structure

```
frontend/src/features/etl/
  pages/
    EtlToolsPage.tsx              — Restructured: 2-step stepper
  components/
    aqueduct/
      AqueductCanvas.tsx           — Main React Flow canvas (table overview)
      FieldMappingDetail.tsx       — Field-level mapping view
      SourceTableNode.tsx          — Custom React Flow node for source tables
      CdmTableNode.tsx             — Custom React Flow node for CDM tables
      MappingEdge.tsx              — Custom React Flow edge with progress badge
      MappingToolbar.tsx           — Top toolbar (progress, filters, actions)
      FieldRow.tsx                 — Single field row with handle + metadata
      MappingTypeEditor.tsx        — Inline mapping type + logic editor
      ConceptSearchInline.tsx      — Hecate concept search for *_concept_id fields
    (existing profiler components unchanged)
  hooks/
    useAqueductData.ts             — TanStack Query hooks for project/mapping CRUD
    (existing useProfilerData.ts unchanged)
  lib/
    cdm-schema-v54.ts              — Static CDM v5.4 schema definition
    aqueduct-layout.ts             — Dagre layout helpers for React Flow
    (existing profiler-utils.ts unchanged)
  api.ts                           — Append Aqueduct API functions
```

### 1.8 Backend File Structure

```
backend/
  app/
    Models/App/
      EtlProject.php
      EtlTableMapping.php
      EtlFieldMapping.php
    Http/Controllers/Api/V1/
      EtlProjectController.php     — Project + table mapping CRUD
      EtlFieldMappingController.php — Field mapping bulk upsert
    Http/Requests/
      CreateEtlProjectRequest.php
      UpdateEtlProjectRequest.php
      CreateTableMappingRequest.php
      UpdateFieldMappingsRequest.php
    Policies/
      EtlProjectPolicy.php         — Ownership enforcement (HIGHSEC §2 Layer 3)
    Services/Etl/
      EtlProjectService.php        — Project lifecycle management
  config/
    cdm-schema-v54.php             — Static CDM schema (PHP array)
  database/migrations/
    xxxx_create_etl_projects_table.php
    xxxx_create_etl_table_mappings_table.php
    xxxx_create_etl_field_mappings_table.php
  routes/api.php                   — New route group for etl-projects
```

## Phase 2: AI-Assisted Suggestions + Vocabulary Integration

### 2.1 Suggestion Pipeline

`EtlSuggestionService` analyzes source scan data against CDM schema and proposes mappings.

**Table-level matching:**
- Exact/fuzzy name matching (e.g., `patients` → `person`)
- Column overlap analysis (source table with CDM-like column names)
- Row count heuristics

**Field-level matching:**
- Column name similarity
- Type compatibility
- CDM convention patterns (`*_concept_id` → lookup, `*_date` → cast_date)
- Sample value analysis from scan data

**Confidence scoring:**
- 0.9+ → auto-accept tier (exact match + type match)
- 0.7–0.9 → quick review tier
- 0.5–0.7 → full review tier
- Below 0.5 → not suggested

**API endpoint:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/etl-projects/{project}/suggest` | Generate AI suggestions for all unmapped tables/fields. `etl.create` + `throttle:3,10` |

### 2.2 UX Flow

1. User creates project → "Generating AI suggestions..." progress
2. Suggestions arrive → overview shows proposed connections as dashed amber edges
3. Banner: "Abby suggested N table mappings and M field mappings. Review suggestions →"
4. User accepts/dismisses per-table or per-field. Accepted → solid edges. Dismissed → removed.
5. Manual mapping always available alongside AI suggestions

### 2.3 Live Vocabulary Integration

For `*_concept_id` columns in the field detail view:
- Inline Hecate typeahead search via existing `/vocabulary/semantic/autocomplete` endpoint
- Results show: concept_id, concept_name, domain, vocabulary_id, standard_concept flag
- Filter to standard concepts only (standard_concept = 'S')
- Selected concept ID populates the `logic` field as a constant or lookup expression

### 2.4 Backend Files

```
backend/app/Services/Etl/
  EtlSuggestionService.php       — Table + field matching engine
  EtlSuggestionScorer.php        — Confidence scoring
```

## Phase 3: Stem Table Support + Document/SQL Generation

### 3.1 Stem Table

**Activation:** "Map via stem table" option on source node context menu in the overview canvas. Creates a stem node (dashed purple border, `#A855F7`) in the React Flow canvas between source and CDM columns.

**Stem table schema:** Pre-built TypeScript constant containing union of all clinical event table columns (~50 columns). Matches OHDSI `StemTableDefaultMappingV5.4.csv`.

**Mapping flow:**
1. User maps source columns → stem columns (field-level detail, same UX)
2. Domain routing rules defined on stem node: `domain_id = 'Condition' → condition_occurrence`, etc.
3. Stem → CDM mappings are pre-built from OHDSI defaults (reviewable but rarely changed)

**Data model:** `is_stem = true` on the `etl_table_mapping` row. Stem fan-out connections stored as additional rows where `source_table = '_stem'`.

**Canvas visualization:** Stem node positioned between source and CDM columns. Edges fan out from stem to multiple CDM tables.

### 3.2 Document Generation

`EtlDocumentService` generates Markdown ETL specification:

- Header: project metadata
- Summary table: all table mappings with completion %
- Per-CDM-table sections: source tables, field mapping table (CDM column | Required | Source column | Mapping type | Logic), unmapped warnings
- Stem table section: domain routing rules + fan-out diagram
- Source appendix: all source tables with column metadata from scan

### 3.3 Executable SQL Generation

`EtlSqlGeneratorService` produces runnable PostgreSQL:

- One `.sql` file per table mapping
- `_all.sql` with dependency-ordered execution (person first, then visits, then clinical events)
- Schema placeholders (`{cdm_schema}`, `{source_schema}`, `{vocab_schema}`) auto-populated from source daimon configuration
- Mapping type → SQL pattern:
  - `direct` → column reference
  - `transform` → user's logic expression wrapper
  - `lookup` → `LEFT JOIN concept_relationship + concept` for standard concept resolution
  - `constant` → literal value
  - `concat` → `CONCAT()` expression
  - `expression` → raw SQL from logic field
- Stem table SQL: `INSERT INTO stem_table` + domain-based `INSERT INTO {cdm_table} WHERE domain_id = '{domain}'`
- Warning comments for unmapped required fields

### 3.4 JSON Export

Full project serialization: `EtlProject` + all `EtlTableMapping` + all `EtlFieldMapping` + source metadata. Importable back into Aqueduct.

### 3.5 Export API Endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/etl-projects/{project}/export/markdown` | `etl.export` | Download Markdown spec |
| `GET` | `/etl-projects/{project}/export/sql` | `etl.export` | Download SQL files (zip) |
| `GET` | `/etl-projects/{project}/export/json` | `etl.export` | Download full project JSON |

**SQL injection mitigation for `expression` mapping type:** Generated SQL includes a prominent header warning: "WARNING: This SQL contains user-defined expressions. Review all `expression` type mappings before execution." Server-side validation rejects expression logic containing DDL keywords (`DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`) and statement-terminating semicolons.

### 3.6 Backend Files

```
backend/app/Services/Etl/
  EtlDocumentService.php          — Markdown generation
  EtlSqlGeneratorService.php      — Executable SQL generation
  StemTableDefinition.php          — Static stem table schema + OHDSI routing defaults
```

## RBAC

New `etl` permission domain — separate from `profiler.*` because scanning and mapping are distinct activities with different authorization needs.

| Permission | Roles | Protects |
|---|---|---|
| `etl.view` | viewer, researcher, data-steward, admin, super-admin | Read projects, mappings, exports |
| `etl.create` | researcher, data-steward, admin, super-admin | Create/edit projects and mappings |
| `etl.delete` | admin, super-admin | Delete projects |
| `etl.export` | researcher, data-steward, admin, super-admin | Download Markdown/SQL/JSON exports |

Added to `RolePermissionSeeder` in Phase 1.

**Ownership enforcement (HIGHSEC §2 Layer 3):**
- `EtlProjectPolicy` class enforces ownership: users can only view/edit/delete their own projects
- Admin/super-admin can access all projects (override)
- Index queries scoped to `where('created_by', auth()->id())` (admins see all)
- Show/update/delete verify `$project->created_by === auth()->id()` via policy

Rate limiting: `throttle:3,10` on `POST /suggest` (AI suggestions are expensive).

## File Impact Summary

### New Dependencies
- `@xyflow/react` — React Flow canvas library (MIT, install with `--legacy-peer-deps`)
- `@dagrejs/dagre` — Auto-layout algorithm for node positioning

### Backend (new files)
- `app/Models/App/EtlProject.php`
- `app/Models/App/EtlTableMapping.php`
- `app/Models/App/EtlFieldMapping.php`
- `app/Http/Controllers/Api/V1/EtlProjectController.php`
- `app/Http/Controllers/Api/V1/EtlFieldMappingController.php`
- `app/Http/Requests/CreateEtlProjectRequest.php`
- `app/Http/Requests/UpdateFieldMappingsRequest.php`
- `app/Services/Etl/EtlProjectService.php`
- `app/Services/Etl/EtlSuggestionService.php` (Phase 2)
- `app/Services/Etl/EtlSuggestionScorer.php` (Phase 2)
- `app/Services/Etl/EtlDocumentService.php` (Phase 3)
- `app/Services/Etl/EtlSqlGeneratorService.php` (Phase 3)
- `app/Services/Etl/StemTableDefinition.php` (Phase 3)
- `config/cdm-schema-v54.php`
- 3 migrations

### Backend (modified files)
- `routes/api.php` — New route group for etl-projects
- `app/Models/App/Source.php` — Add `etlProjects(): HasMany`

### Frontend (new files)
- `features/etl/components/aqueduct/AqueductCanvas.tsx`
- `features/etl/components/aqueduct/FieldMappingDetail.tsx`
- `features/etl/components/aqueduct/SourceTableNode.tsx`
- `features/etl/components/aqueduct/CdmTableNode.tsx`
- `features/etl/components/aqueduct/MappingEdge.tsx`
- `features/etl/components/aqueduct/MappingToolbar.tsx`
- `features/etl/components/aqueduct/FieldRow.tsx`
- `features/etl/components/aqueduct/MappingTypeEditor.tsx`
- `features/etl/components/aqueduct/ConceptSearchInline.tsx`
- `features/etl/components/aqueduct/StemTableNode.tsx` (Phase 3)
- `features/etl/components/aqueduct/DomainRoutingEditor.tsx` (Phase 3)
- `features/etl/hooks/useAqueductData.ts`
- `features/etl/lib/cdm-schema-v54.ts`
- `features/etl/lib/aqueduct-layout.ts`

### Frontend (modified files)
- `features/etl/pages/EtlToolsPage.tsx` — Restructured to 2-step stepper
- `features/etl/api.ts` — Append Aqueduct API functions
- `app/router.tsx` — Update `/source-profiler` route to redirect to `/etl-tools?step=profiler`

## Non-Goals

- Real-time multi-user collaboration (future — would use Reverb WebSockets)
- ETL execution (Aqueduct designs the mapping; execution is a separate pipeline)
- Non-PostgreSQL SQL dialects (only generates PostgreSQL; other DBMS support is future)
- Import of existing RiaH `.json.gz` files (could be added later as a migration tool)
- Undo/redo (complex state management — defer to future enhancement)
