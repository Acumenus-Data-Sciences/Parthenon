# Aqueduct — ETL Mapping Workbench Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Extract valuable algorithms and data models from OHDSI/Perseus and integrate them as a single native Workbench tool called Aqueduct, delivered through the Community Workbench SDK.

---

## 1. Context

### What Perseus Is

OHDSI/Perseus is a 16-container microservices ETL platform (Angular 12, Python 3.7, Java, .NET, R) that unifies White Rabbit scanning, Rabbit-in-a-Hat visual mapping, Usagi concept mapping, CDM Builder execution, and DQD quality checks. Apache 2.0 licensed.

### Why Not Integrate Perseus Directly

- **Dormant:** No commits since Nov 2023. Zero releases. 15 unanswered issues.
- **Outdated:** Python 3.7, Flask 2.0, Angular 12, .NET Core 3.1 — all with known CVEs.
- **Heavy:** 16 containers for what is essentially an ETL designer.
- **No SDK mode:** Monolithic webapp, not composable.
- **Stale forks:** Depends on SoftwareCountry forks of White Rabbit, CDM Builder, DQD years behind upstream.

### What IS Worth Extracting

Three systems contain valuable domain knowledge and proven data models:

1. **The batch concept mapping workflow** — CSV upload, column mapping, automated matching, manual review, SOURCE_TO_CONCEPT_MAP export. Parthenon has a superior scoring engine (SapBERT + pgvector + MedGemma + ensemble ranking) but lacks this end-user workflow.

2. **The ETL mapping data model** — Source schema to CDM target column arrows with SQL transforms and vocabulary lookups. Perseus stores this as a single JSON object (`EtlConfiguration`) with five dictionaries. This is entirely new to Parthenon.

3. **The 12 vocabulary lookup SQL templates** — Pre-built CTE queries for ICD10CM, ICD9CM, NDC, LOINC, SNOMED, CVX, NUCC, procedure, Read, revenue, UCUM that generate SOURCE_TO_CONCEPT_MAP entries from the OMOP vocabulary tables. Pure domain knowledge encoded as SQL.

### Key Discovery: Parthenon Already Beats Perseus's Scoring Algorithm

Perseus's Usagi uses `CountVectorizer` with character 3-4 grams and cosine similarity — a basic approach. Parthenon's existing concept mapping pipeline (`ai/app/routers/concept_mapping.py`) has a 5-strategy ensemble:

1. Historical cache lookup
2. Exact code match (vocab.concepts + source_to_concept_maps)
3. SapBERT cosine similarity (768-dim biomedical embeddings + pgvector)
4. LLM reasoning (MedGemma — triggered for moderate-confidence scores)
5. Ensemble ranking with domain-specific weights

The scoring algorithm is NOT extracted. Only the workflow and data models are.

---

## 2. Design Decision: Single Unified Tool

**Decision:** One Workbench tool (`etl_mapping_workbench`) with three tabs, not three separate tools.

**Rationale:**
- These three capabilities form one conceptual workflow (understand source → map to CDM → resolve concepts → generate lookups)
- Single service descriptor, single run model, shared source/session context across tabs
- Mirrors how researchers think about ETL — as one task, not three disconnected tools
- SDK contracts support multi-capability tools via the `capabilities` object

---

## 3. Architecture

### Service Descriptor

```yaml
service_name: etl_mapping_workbench
display_name: Aqueduct
description: Visual source-to-CDM mapping with concept matching and vocabulary lookup generation
mode: native
enabled: true
healthy: true
ui_hints:
  title: Aqueduct
  summary: Design and validate ETL mappings from source data to OMOP CDM
  accent: teal
  workspace: etl-workbench
  repository: null
capabilities:
  source_scoped: true
  replay_supported: true
  export_supported: true
  write_operations: true
```

### Backend Layer

Aqueduct gets its own dedicated controller (not extending `StudyAgentController`) to avoid bloating the existing 625-line controller. Service discovery still flows through `StudyAgentController::services()` via `AqueductService::serviceEntry()`.

```
AqueductController (new, dedicated)
  └── AqueductService (umbrella)
        ├── AqueductSchemaMapperService    — mapping CRUD, SQL validation, archive I/O
        ├── AqueductConceptMatcherService  — CSV upload, batch mapping, snapshots, S2C export
        └── AqueductLookupGeneratorService — template assembly, vocabulary filter catalog
```

### Route Group

All under `api/v1/etl/aqueduct/` (nested under the existing `etl/` prefix group to colocate all ETL tooling — WhiteRabbit, Synthea, FHIR, and now Aqueduct). Middleware: `auth:sanctum`, `role:researcher|super-admin`.

Mutation endpoints use `throttle:10,1`. Read/polling endpoints use `throttle:60,1` to support progress polling.

```
# Schema Mapper
POST   /etl/aqueduct/schema-mapper/sessions          — create mapping session (upload scan report)
GET    /etl/aqueduct/schema-mapper/sessions           — list user sessions
GET    /etl/aqueduct/schema-mapper/sessions/{id}      — get session with full mapping config
PUT    /etl/aqueduct/schema-mapper/sessions/{id}      — update mapping config (arrows, transforms)
POST   /etl/aqueduct/schema-mapper/sessions/{id}/validate-sql  — validate SQL transform
POST   /etl/aqueduct/schema-mapper/sessions/{id}/export        — export as .etl archive
GET    /etl/aqueduct/schema-mapper/cdm-schemas/{version}       — get CDM target schema (v5.3.1, v5.4)

# Concept Matcher
POST   /etl/aqueduct/concept-matcher/upload           — upload CSV, return column preview
POST   /etl/aqueduct/concept-matcher/launch           — trigger batch mapping job
GET    /etl/aqueduct/concept-matcher/jobs/{id}/status  — poll job progress (throttle:60,1)
GET    /etl/aqueduct/concept-matcher/jobs/{id}/result  — retrieve mapping results
POST   /etl/aqueduct/concept-matcher/snapshots        — save mapping snapshot
GET    /etl/aqueduct/concept-matcher/snapshots        — list snapshots
GET    /etl/aqueduct/concept-matcher/snapshots/{id}   — get snapshot
POST   /etl/aqueduct/concept-matcher/snapshots/{id}/export  — generate SOURCE_TO_CONCEPT_MAP SQL

# Lookup Generator
GET    /etl/aqueduct/lookups/vocabularies              — list available vocabulary filters
GET    /etl/aqueduct/lookups/preview/{vocabulary}      — preview assembled SQL for a vocabulary
POST   /etl/aqueduct/lookups/generate                  — generate lookup SQL for selected vocabularies
POST   /etl/aqueduct/lookups/custom                    — create user-defined lookup filter

# Shared
GET    /etl/aqueduct/runs                              — run history across all three tabs
GET    /etl/aqueduct/runs/{id}                         — run detail
POST   /etl/aqueduct/runs/{id}/replay                  — replay a run
GET    /etl/aqueduct/runs/{id}/export                  — export run artifacts
```

**Note:** The existing `api/v1/etl/` route group contains WhiteRabbit scan report endpoints. WhiteRabbit output is a direct input to Aqueduct's Schema Mapper tab — placing them under the same `etl/` prefix makes this relationship visible in the API structure.

### Frontend

```
frontend/src/features/aqueduct/
  ├── pages/
  │   └── AqueductPage.tsx              — tab container (Schema Mapper | Concept Matcher | Lookups)
  ├── components/
  │   ├── SchemaMapperTab.tsx           — visual mapping canvas + SQL transform editor
  │   ├── ConceptMatcherTab.tsx         — CSV upload, results table, approve/flag/ignore
  │   ├── LookupGeneratorTab.tsx        — vocabulary picker, SQL preview, generate
  │   ├── MappingCanvas.tsx             — drag-drop source→target column arrows
  │   ├── ConceptReviewTable.tsx        — row-level review with alternative search
  │   └── LookupPreview.tsx             — SQL preview panel
  ├── hooks/
  │   ├── useAqueductSession.ts
  │   ├── useConceptMatcherJob.ts
  │   └── useLookupGenerator.ts
  ├── api.ts                            — TanStack Query hooks for all endpoints
  └── types.ts                          — TypeScript types matching result envelopes
```

**Route:** `/workbench/aqueduct`

---

## 4. Data Models

### 4.1 Database Tables

#### `aqueduct_sessions` — Mapping project container

```sql
CREATE TABLE app.aqueduct_sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    source_id       BIGINT REFERENCES app.sources(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    cdm_version     VARCHAR(10) NOT NULL DEFAULT '5.4',
    scan_report_name VARCHAR(255),
    scan_report_path VARCHAR(500),
    source_schema   JSONB NOT NULL DEFAULT '[]',    -- parsed source tables/columns
    mapping_config  JSONB NOT NULL DEFAULT '{}',    -- full ArrowCache (see 4.2) — opaque blob, never queried by content
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, exported
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP                       -- soft deletes (protects researcher work)
);

CREATE INDEX idx_aqueduct_sessions_user ON app.aqueduct_sessions(user_id);
CREATE INDEX idx_aqueduct_sessions_source ON app.aqueduct_sessions(source_id);
-- No GIN index on mapping_config: it is opaque and never queried by content.
```

#### `aqueduct_concept_mapping_jobs` — Batch concept mapping jobs

```sql
CREATE TABLE app.aqueduct_concept_mapping_jobs (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT REFERENCES app.aqueduct_sessions(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    source_file_name VARCHAR(255) NOT NULL,
    column_config   JSONB NOT NULL,     -- which CSV columns map to source_code, source_name, etc.
    filter_config   JSONB DEFAULT '{}', -- domain/vocabulary/class filters
    total_rows      INTEGER NOT NULL DEFAULT 0,
    processed_rows  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);
```

#### `aqueduct_concept_mapping_snapshots` — Saved mapping states

```sql
CREATE TABLE app.aqueduct_concept_mapping_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT NOT NULL REFERENCES app.aqueduct_concept_mapping_jobs(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    mappings        JSONB NOT NULL,     -- array of CodeMapping objects (see 4.3)
    filters         JSONB DEFAULT '{}',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,              -- soft deletes
    UNIQUE(job_id, name)
);
```

#### `aqueduct_runs` — Shared run history (follows FinnGenRun pattern)

```sql
CREATE TABLE app.aqueduct_runs (
    id               BIGSERIAL PRIMARY KEY,
    session_id       BIGINT REFERENCES app.aqueduct_sessions(id) ON DELETE SET NULL,
    service_name     VARCHAR(80) NOT NULL,  -- schema_mapper, concept_matcher, lookup_generator
    status           VARCHAR(20) NOT NULL DEFAULT 'ok',
    source_id        BIGINT REFERENCES app.sources(id) ON DELETE SET NULL,
    submitted_by     BIGINT REFERENCES app.users(id) ON DELETE SET NULL,
    source_snapshot  JSONB,
    request_payload  JSONB,
    result_payload   JSONB,
    runtime_payload  JSONB,
    artifact_index   JSONB,
    submitted_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aqueduct_runs_service ON app.aqueduct_runs(service_name, source_id);
CREATE INDEX idx_aqueduct_runs_session ON app.aqueduct_runs(session_id);
CREATE INDEX idx_aqueduct_runs_submitted ON app.aqueduct_runs(submitted_at);
```

### 4.2 Mapping Config (ArrowCache) — Extracted from Perseus

The `mapping_config` JSONB column stores the full ETL mapping state. Structure extracted from Perseus's `EtlConfiguration`, adapted for Parthenon:

```typescript
interface AqueductMappingConfig {
  // Column-to-column arrows with transforms
  // Key: "{sourceTableId}-{sourceColumnId}/{targetTableId}-{targetColumnId}"
  connections: Record<string, AqueductConnection>;

  // Constant values assigned to target columns
  // Key: "{sourceTableId}/{targetTableId}-{targetColumnId}"
  constants: Record<string, string>;

  // Cloned target tables (when one source maps to multiple CDM table instances)
  // Key: target table ID
  clones: Record<string, { name: string; condition: string }[]>;

  // Concept field groupings (concept_id + source_value + type_concept_id + source_concept_id)
  concepts: Record<string, AqueductConceptConfig>;

  // Per-table settings (era gaps, person validation, observation periods)
  tableSettings: Record<string, AqueductTableSettings>;
}

// Groups the four related concept fields that always travel together in CDM tables
interface AqueductConceptConfig {
  conceptIdField: string;         // e.g., "condition_concept_id"
  sourceValueField: string;       // e.g., "condition_source_value"
  typeConceptIdField: string;     // e.g., "condition_type_concept_id"
  sourceConceptIdField: string;   // e.g., "condition_source_concept_id"
  lookup?: {
    name: string;
    type: 'source_to_standard' | 'source_to_source';
    custom: boolean;
  };
}

interface AqueductConnection {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  connectorType: 'direct' | 'lookup' | 'transform' | 'manual';
  sqlTransform?: string;          // SQL expression
  lookup?: {
    name: string;                 // e.g., "icd10cm"
    type: 'source_to_standard' | 'source_to_source';
    custom: boolean;              // user-defined vs pre-built
  };
}

interface AqueductTableSettings {
  gapWindow?: number;             // days (default: 30 for eras, 32 for obs_period)
  conceptId?: number;             // type concept ID for era tables
  withinObservationPeriod?: boolean;
  personValidation?: {
    allowUnknownGender: boolean;
    allowGenderChanges: boolean;
    allowMultipleYearsOfBirth: boolean;
    allowUnknownYearOfBirth: boolean;
    implausibleYearOfBirthBefore: number;
    implausibleYearOfBirthAfter: number;
    allowInvalidObservationTime: boolean;
  };
}
```

### 4.3 Concept Mapping Result — Extracted from Perseus, Adapted

Each row in a concept mapping snapshot:

```typescript
interface AqueductCodeMapping {
  sourceCode: string;
  sourceName: string;
  sourceFrequency?: number;
  matchScore: number;                     // from Parthenon's ensemble ranker (0-1)
  status: 'approved' | 'unchecked' | 'flagged' | 'ignored';
  equivalence: 'equal' | 'equivalent' | 'wider' | 'narrower' | 'inexact' | 'unmatched';
  targetConcept: {
    conceptId: number;
    conceptName: string;
    domainId: string;
    vocabularyId: string;
    conceptCode: string;
    conceptClassId: string;
    standardConcept: string;
  } | null;
  candidates: Array<{
    conceptId: number;
    conceptName: string;
    domainId: string;
    vocabularyId: string;
    finalScore: number;
    primaryStrategy: string;              // which Parthenon strategy scored highest
  }>;
  comment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}
```

### 4.4 CDM Target Schema — Static Reference Data

CDM v5.4 and v5.3.1 table/column definitions stored as static JSON files in `backend/resources/etl/cdm-schemas/`:

```
backend/resources/etl/cdm-schemas/
  v5.3.1.json
  v5.4.json
```

Each file contains:
```json
{
  "version": "5.4",
  "tables": [
    {
      "name": "person",
      "columns": [
        { "name": "person_id", "type": "INTEGER", "nullable": false, "primaryKey": true },
        { "name": "gender_concept_id", "type": "INTEGER", "nullable": false },
        ...
      ]
    }
  ]
}
```

Sourced from Perseus's `CDMv5.4.csv` and the OHDSI CDM specification.

---

## 5. Vocabulary Lookup Templates — Extracted from Perseus

### Template Architecture

Three-layer assembly system stored in `backend/resources/etl/lookups/`:

```
backend/resources/etl/lookups/
  templates/
    cte_source_to_standard.sql      — base CTE joining CONCEPT → CONCEPT_RELATIONSHIP → CONCEPT
    cte_source_to_source.sql        — base CTE for source concept self-join
    cte_result.sql                  — final SELECT combining both CTEs
    cte_result_standard_only.sql    — variant without source_to_source
  filters/
    source_to_standard/
      icd10cm.sql                   — WHERE lower(c.vocabulary_id) IN ('icd10cm') AND ...
      icd9cm.sql
      ndc.sql
      loinc.sql
      snomed.sql
      cvx.sql
      nucc.sql
      procedure.sql
      read.sql
      revenue.sql
      ucum.sql
    source_to_source/
      (same 11 files)
```

### Assembly Logic

`AqueductLookupGeneratorService` assembles lookup SQL:

1. Read `cte_source_to_standard.sql` template
2. Append vocabulary-specific WHERE clause from `filters/source_to_standard/{vocab}.sql`
3. Read `cte_source_to_source.sql` template (if source_to_source included)
4. Append vocabulary-specific WHERE clause from `filters/source_to_source/{vocab}.sql`
5. Wrap both in `cte_result.sql` template
6. Replace `{vocab_schema}` placeholder with the source's vocabulary daimon schema name

The assembled SQL runs against the user's vocabulary schema and returns SOURCE_TO_CONCEPT_MAP-compatible rows.

---

## 6. Python AI Service Integration

### No New Endpoints Needed

The Concept Matcher tab calls Parthenon's existing AI pipeline:

- **Single term:** `POST /concept-mapping/map-term` — returns top-5 candidates with strategy breakdown
- **Batch:** `POST /concept-mapping/map-batch` — maps multiple terms in parallel

Laravel orchestrates the workflow (CSV parsing, job tracking, snapshot management). Python does the scoring. This keeps the AI service focused on what it does well (ML inference) and avoids duplicating workflow state in Python.

### Solr Vocabulary Core — Already Sufficient

The existing `vocabulary` Solr core already indexes:
- `concept_name` (text_general, eDisMax with ^3 boost)
- `concept_code` (string, ^2 boost)
- `concept_synonyms` (text_general, multiValued)
- `domain_id`, `vocabulary_id`, `concept_class_id`, `standard_concept` (facet fields)

Perseus's Solr schema indexes the same fields with simpler analysis (no eDisMax, no field boosting). Parthenon's is strictly better. No Solr changes needed.

**No new Solr configset needed.** Aqueduct sessions and snapshots are queried by relational keys (user_id, session_id), not full-text search. The existing `vocabulary` core handles concept search for the Concept Matcher tab.

---

## 7. SDK Integration

### Generator Invocation

```bash
./community-workbench-sdk/scripts/new-workbench-tool.sh \
  --tool-id etl_mapping_workbench \
  --display-name "Aqueduct" \
  --description "Visual source-to-CDM mapping with concept matching and vocabulary lookup generation" \
  --domain etl \
  --mode native \
  --route-slug etl-mapping \
  --env-prefix ETL_MAPPING_WORKBENCH \
  --output-dir community-workbench-sdk/generated-samples
```

### Service Registration

Added to `study-agent/docs/SERVICE_REGISTRY.yaml`:

```yaml
etl_mapping_workbench:
  endpoint: /flows/etl-mapping
  description: Visual source-to-CDM mapping with concept matching and vocabulary lookup generation
  mcp_tools:
    - etl_mapping_workbench_catalog
  input:
    - source_key
    - scan_report
    - mapping_config
    - source_codes_csv
    - vocabulary_filters
  output:
    - mapping_summary
    - concept_matches
    - lookup_sql
    - etl_archive
  validation:
    - registration gated by ETL_MAPPING_WORKBENCH_ENABLED
    - writes require explicit confirmation before execution tools are added
  ui_hints:
    title: Aqueduct
    summary: Design and validate ETL mappings from source data to OMOP CDM
    accent: teal
    repository: null
    workspace: etl-workbench
```

### MCP Tool

Added to `OPTIONAL_TOOL_MODULES` in `study_agent_mcp/tools/__init__.py`:

```python
("ETL_MAPPING_WORKBENCH_ENABLED", "study_agent_mcp.tools.etl_mapping_workbench")
```

### Workbench Discovery

Appended to `/api/v1/study-agent/services` response via `AqueductService::serviceEntry()`, following the `CommunityWorkbenchSdkDemoService` pattern.

### Frontend Discovery

Aqueduct appears in the Workbench page as a discovery card alongside FinnGen tools and the Community SDK demo, with accent color `teal` and a link to `/workbench/aqueduct`.

---

## 8. Result Envelope

All three tabs return results conforming to the SDK's `result-envelope.schema.json`:

```json
{
  "status": "ok",
  "runtime": {
    "status": "ready",
    "adapter_mode": "native",
    "fallback_active": false,
    "upstream_ready": true,
    "dependency_issues": [],
    "notes": [],
    "timings": { "mapping_ms": 1250 }
  },
  "source": {
    "id": 1,
    "name": "Acumenus CDM",
    "key": "acumenus",
    "dialect": "postgresql"
  },
  "summary": {
    "tab": "concept_matcher",
    "total_codes": 150,
    "mapped_codes": 142,
    "approved": 98,
    "flagged": 12,
    "ignored": 5,
    "unchecked": 27,
    "average_score": 0.89
  },
  "panels": [],
  "artifacts": {
    "artifacts": [
      {
        "id": "source_to_concept_map_sql",
        "label": "SOURCE_TO_CONCEPT_MAP Inserts",
        "kind": "sql",
        "content_type": "text/sql",
        "summary": "98 approved mappings as INSERT statements",
        "downloadable": true,
        "previewable": true
      }
    ]
  },
  "warnings": [],
  "next_actions": ["Review 27 unchecked mappings", "Generate lookup SQL for flagged codes"]
}
```

---

## 9. Build Order

Implementation phases within the single Aqueduct tool:

### Phase 1: Foundation + Lookup Generator Tab

- Run SDK generator to scaffold `etl_mapping_workbench`
- Create database migrations for `aqueduct_sessions` and `aqueduct_runs` (Phase 1 tables only)
- Create `AqueductController` + `AqueductService` umbrella + `AqueductLookupGeneratorService`
- Port 12 vocabulary lookup SQL templates from Perseus
- Implement lookup assembly logic
- Build frontend tab: vocabulary picker, SQL preview, generate/download
- Register in service discovery
- Wire routes + controller methods

### Phase 2: Concept Matcher Tab

- Create migration for `aqueduct_concept_mapping_jobs` and `aqueduct_concept_mapping_snapshots`
- Create `AqueductConceptMatcherService`
- Create Form Request classes: `AqueductUploadCsvRequest`, `AqueductLaunchBatchRequest`, `AqueductSaveSnapshotRequest`
- Implement CSV upload + column mapping UI
- Wire batch mapping to existing `/concept-mapping/map-batch` AI endpoint
- Build review UI (approve/flag/ignore per row, search alternatives)
- Implement snapshot save/load
- Implement SOURCE_TO_CONCEPT_MAP SQL export
- Add job tracking (progress polling)

### Phase 3: Schema Mapper Tab

- Create `AqueductSchemaMapperService`
- Build CDM target schema reference files (v5.3.1, v5.4)
- Implement scan report upload + source schema parsing
- Build visual mapping canvas (React drag-drop, source→target arrows)
- Implement SQL transform editor with validation (via `EXPLAIN`)
- Implement .etl archive export/import
- Wire lookups from Lookup Generator tab into mapping connections

---

## 10. What Is NOT Extracted from Perseus

| Component | Reason |
|-----------|--------|
| Usagi scoring algorithm (CountVectorizer + cosine) | Parthenon's 5-strategy ensemble is strictly superior |
| Angular UI code | Rebuilt in React with Parthenon design system |
| Flask routing/auth | Laravel + Sanctum handles this |
| Per-user PostgreSQL schemas for SQL validation | Use `EXPLAIN` instead — lighter, no schema materialization |
| .NET CDM Builder | Not needed — Aqueduct designs ETL, doesn't execute it |
| Files-manager Java service | Laravel file storage already exists |
| White Rabbit Java wrapper | Parthenon already has White Rabbit as a Docker service |
| Shared-db 7-schema architecture | Parthenon has its own multi-schema pattern |
| DQD integration | Parthenon already has DQD via the R runtime |

---

## 11. Security Considerations

- **CSV upload:**
  - Validate file extension (`.csv` only — do not rely solely on MIME type).
  - Enforce file size (max 10MB) and row count (max 10,000).
  - Enforce UTF-8 encoding. Reject files with invalid byte sequences.
  - Sanitize cell contents for CSV/formula injection: strip leading `=`, `+`, `-`, `@` characters from cell values (these can execute as formulas when opened in Excel).
  - Sanitize column names (alphanumeric + underscore only).
  - Temp file cleanup: uploaded CSVs stored in `storage/app/tmp/aqueduct/` with a 24-hour TTL cron job.
  - Use dedicated Form Request classes for all endpoints: `AqueductUploadCsvRequest`, `AqueductCreateSessionRequest`, `AqueductLaunchBatchRequest`, etc.

- **SQL validation (Schema Mapper transforms):**
  - Run `EXPLAIN` inside a read-only transaction that is always rolled back.
  - `SET search_path` to restrict visible schemas to only the source's CDM and vocabulary schemas before running `EXPLAIN`.
  - Pre-parse allow list: only `SELECT` and `WITH` statements allowed. Reject DDL keywords (`CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `INSERT`, `UPDATE`, `DELETE`).
  - Use a dedicated database role (`aqueduct_readonly`) with SELECT-only grants for validation queries.

- **Lookup templates:** Pre-built SQL uses parameterized schema placeholders (`{vocab_schema}`). User-defined lookups stored as text, validated with the same `EXPLAIN` + allow list pattern before assembly.

- **JSONB payloads:** Mapping configs can be large. Enforce max size (5MB) on `mapping_config` column via Form Request validation.

- **Auth:** All endpoints behind `auth:sanctum` + `role:researcher|super-admin`.

- **Rate limiting:** `throttle:10,1` on mutation endpoints. `throttle:60,1` on read/polling endpoints (concept matcher job status polling needs higher throughput).

- **Soft deletes:** `aqueduct_sessions` and `aqueduct_concept_mapping_snapshots` use Laravel's `SoftDeletes` trait (`deleted_at` column) to protect researcher work from accidental deletion.

---

## 12. Naming Glossary

| Context | Identifier | Example |
|---------|-----------|---------|
| SDK service name | `etl_mapping_workbench` | Service descriptor `service_name` field |
| User-facing name | **Aqueduct** | UI title, docs, discovery card |
| Route prefix | `/etl/aqueduct/` | `api/v1/etl/aqueduct/...` |
| Frontend feature dir | `frontend/src/features/aqueduct/` | React feature module |
| Service Registry endpoint | `/flows/etl-mapping` | StudyAgent registry |
| Env prefix | `ETL_MAPPING_WORKBENCH_` | `ETL_MAPPING_WORKBENCH_ENABLED` |
| PHP class prefix | `Aqueduct` | `AqueductController`, `AqueductService` |
| DB table prefix | `aqueduct_` | `aqueduct_sessions`, `aqueduct_runs` |
| Run `service_name` values | `schema_mapper`, `concept_matcher`, `lookup_generator` | Discriminator within `aqueduct_runs` |

---

## 13. ETL Archive Format

The `.etl` export from the Schema Mapper tab is a ZIP file (with `.etl` extension) containing:

```
{session_name}.etl (ZIP)
  ├── mapping.json          — full AqueductMappingConfig JSON + session metadata
  ├── source_schema.json    — parsed source tables/columns from scan report
  └── scan_report.xlsx      — original White Rabbit scan report (if available)
```

The `mapping.json` structure:
```json
{
  "aqueduct_version": "1.0",
  "cdm_version": "5.4",
  "session_name": "My ETL Project",
  "source_name": "Hospital EHR",
  "exported_at": "2026-03-16T20:00:00Z",
  "mapping_config": { /* full AqueductMappingConfig */ },
  "table_settings": { /* per-table era/person settings */ }
}
```

Import reads the ZIP, validates the JSON structure, creates a new `aqueduct_sessions` record, and restores the mapping config to the frontend canvas.

---

## 14. Testing Strategy

- **Unit tests:** Each service method (assembly logic, CSV parsing, schema loading)
- **Integration tests:** Full endpoint flows (upload → launch → status → result → export)
- **Contract validation:** Result envelopes validated against SDK JSON schemas
- **Lookup SQL tests:** Each of 12 templates executed with `EXPLAIN` against vocab schema to verify valid SQL
