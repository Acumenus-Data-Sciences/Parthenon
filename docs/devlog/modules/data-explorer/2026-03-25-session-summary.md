# Session Summary — 2026-03-25

**Duration:** Full day session
**Scope:** Achilles reliability, Source Profiler, Aqueduct ETL designer, Multi-file ingestion

## What Was Built

### 1. Achilles Race Condition Fix
- Prevented concurrent Achilles runs (`ShouldBeUnique` + 409 guard + CLI guard)
- Fixed `ReleaseService` duplicate key crash (`firstOrCreate`)
- Fixed `ComputeDqDeltas` missing 3 Ares v2 cache invalidation keys
- Added Analysis 10 (age pyramid) — was never registered
- Cleaned up 4 failed runs + 635 orphaned step records

### 2. Source Profiler (3 phases — complete)
- **Phase 1:** Server-side scan persistence, Achilles CDM context panel, phased scan progress, RBAC
- **Phase 2:** PII detection (8 name patterns + 4 value patterns + OMOP allowlist + sample value redaction), scan comparison (summary cards + drill-down diff)
- **Phase 3:** FK relationship visualization (SVG radial graph, 20 CDM tables, domain-colored)
- Fixed WhiteRabbit payload format (flat, not wrapped), response normalization, route collision with patient profiles

### 3. Aqueduct ETL Mapping Designer (Phase 1 — complete)
- React Flow canvas with source tables (gold) and CDM tables (teal, domain-colored)
- Two-level navigation: table overview → field detail drill-down
- Drag-to-connect creates table/field mappings via API
- Auto-save with 500ms debounce + optimistic locking (409 on stale)
- CDM v5.4 schema (39 tables, 432 columns) with Python generator
- `EtlProject` + `EtlTableMapping` + `EtlFieldMapping` models with policy
- RBAC (`etl.*` permissions), soft deletes, partial unique index
- 12 API endpoints with Form Requests

### 4. Sidenav Consolidation
- Reduced from 6 Data items to 3: Data Sources, Data Ingestion, Data Explorer
- Data Ingestion = 4 tabs: Upload Files, Source Profiler, Aqueduct, FHIR Ingestion
- Gold standard tab styling matching Data Explorer
- Legacy route redirects preserved

### 5. Multi-File Ingestion with Staging Tables (Phase 1 + Phase 2 — complete)
- `IngestionProject` model as parent of `IngestionJob` (non-breaking)
- Per-project PostgreSQL staging schemas (`staging_{id}`) with TEXT-only tables
- Batch upload with editable review list (rename table names before staging)
- Hybrid parsing: inline < 5MB, Horizon queue for larger/batch
- `ColumnNameSanitizer` with 65 PostgreSQL reserved words + `__row_id` collision protection
- `StagingService` with `COPY FROM` bulk loading, Excel support (PhpSpreadsheet)
- Per-column profiling after staging (null%, distinct count, sample values)
- PII detection on staged data (caught SSN, names, DOB in test)
- SQL injection prevention: strict regex validation + identifier quoting
- Auto-created Source when project reaches `ready` (Aqueduct integration)
- Preview endpoint with table validation against project jobs
- Fixed existing ingestion routes missing permission middleware (HIGHSEC)

## Bugs Found & Fixed
| Bug | Impact |
|---|---|
| Achilles concurrent run race condition | Data loss — runs deleted each other's results |
| Analysis 10 never registered | Age distribution blank on dashboard |
| WhiteRabbit payload format wrong | Scans failed silently |
| Route collision `/profiles` vs patient profiles | 500 errors on profile detail |
| `fetchEtlProject` response shape mismatch | Frontend couldn't load projects |
| Duplicate project creation returned 500 | Should be 409 with existing_project_id |
| WhiteRabbit health response not mapped | Badge always showed "unavailable" |
| `StageFileJob.$job` property conflict | Fatal error — trait conflict |
| `ingestion_jobs.source_id` NOT NULL | Staging projects have no source initially |
| Relative file paths in StageFileJob | `fopen()` failed |
| No profiling after staging | PII detection never ran, 0 field profiles |

## Commit Count
~50+ commits across all features

## What's Next
- Aqueduct Phase 2: AI-assisted mapping suggestions + live vocabulary search
- Aqueduct Phase 3: Stem table support + document/SQL generation + JSON export
- Multi-file ingestion v2: HL7 and JSON file staging strategies
- SynPUF enrichment (spec exists at `docs/superpowers/specs/2026-03-25-synpuf-enrichment-design.md`)
