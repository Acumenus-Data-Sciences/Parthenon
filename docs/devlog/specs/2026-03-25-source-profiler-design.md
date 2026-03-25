# Source Profiler Enhancement — Design Specification

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Phased (3 phases, each independently shippable)

## Overview

Transform the Source Profiler from a transient WhiteRabbit scanning tool into the definitive source intelligence page. Adds server-side persistence, Achilles CDM context overlay, PII detection, scan comparison, RBAC, and FK visualization.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Achilles relationship | Enhanced profiler with Achilles overlay | Avoids duplicating Data Explorer; pulls key CDM metrics as read-only context |
| Scan persistence | Per-source timeline, server-side | Enables comparison and historical tracking; reuses existing `source_profiles`/`field_profiles` tables |
| PII detection | Pattern-based (name + value regex) with advisory warnings | Reliable, low noise, no workflow blocking |
| Comparison view | Dashboard summary cards + drill-down diff | Quick "better or worse?" at a glance with detail on demand |
| Implementation | 3 phases | Each phase ships independently and delivers value |

## Phase 1: Persistence + CDM Context + Scan Progress

### 1.1 Data Model

Repurpose existing `source_profiles` and `field_profiles` tables with additive migrations.

**Migration: `add_scan_fields_to_source_profiles`**

| Column | Type | Notes |
|---|---|---|
| `source_id` | bigint, nullable, FK → sources | Links scan to a Parthenon source |
| `scan_type` | varchar(20), default 'whiterabbit' | Enum: `whiterabbit`, `ingestion` |
| `scan_time_seconds` | float, nullable | Elapsed scan duration |
| `overall_grade` | char(2), nullable | A+ through F |
| `table_count` | integer, nullable | Number of tables scanned |
| `column_count` | integer, nullable | Total columns across all tables |
| `total_rows` | bigint, nullable | Sum of all table row counts |
| `summary_json` | jsonb, nullable | Quality scorecard: high-null count, empty tables, low-cardinality count, single-value count |

Existing columns (`ingestion_job_id`, `file_name`, `file_format`, etc.) remain nullable for backward compatibility.

**Migration: `add_table_fields_to_field_profiles`**

| Column | Type | Notes |
|---|---|---|
| `table_name` | varchar(255), nullable | Table this column belongs to (WhiteRabbit scans don't use ingestion jobs) |
| `row_count` | bigint, nullable | Table-level row count (denormalized for query performance) |

Existing columns (`is_potential_pii`, `pii_type`, `sample_values`, etc.) are already present.

**Relationships:**

```
Source (1) ──→ (N) SourceProfile (1) ──→ (N) FieldProfile
                   scan_type: whiterabbit      table_name: person
                   overall_grade: A            column_name: gender_concept_id
                   scan_time_seconds: 12.3     null_percentage: 0.0
```

### 1.2 API Endpoints

All under `auth:sanctum` middleware. Permission middleware added in Phase 3.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sources/{source}/profiles` | List scan history (paginated, newest first) |
| `GET` | `/sources/{source}/profiles/{profile}` | Single scan with all field profiles |
| `POST` | `/sources/{source}/profiles/scan` | Trigger scan, persist results, return profile ID |
| `DELETE` | `/sources/{source}/profiles/{profile}` | Delete a scan and its field profiles |

**`POST /sources/{source}/profiles/scan`** flow:
1. Resolve source daimons for connection spec
2. Call WhiteRabbit `/scan` (existing proxy, 600s timeout)
3. Compute overall grade and summary metrics
4. Create `source_profile` record
5. Create `field_profile` records for each column
6. Return profile ID + summary

Existing `POST /etl/scan` remains as-is for backward compatibility. The new endpoint wraps it with persistence.

### 1.3 Achilles CDM Context Panel

Horizontal card row at the top of results, shown only when the source has a results daimon and at least one Achilles run.

**Cards:**

| Metric | Source | Analysis ID |
|---|---|---|
| Person Count | `achilles_results` | 0 |
| Observation Period Span | `achilles_results_dist` | 105 (min/max) |
| Domain Coverage | `achilles_results` | 117 (records by domain) |
| Latest Achilles Run | `achilles_runs` table | status, date, pass count |
| DQ Grade | `dqd_results` | latest run pass rate (if exists) |

**Behavior:**
- Fetched via existing endpoints: `/sources/{source}/achilles/record-counts`, `/sources/{source}/achilles/demographics`
- No Achilles data → muted message: "No characterization data — run Achilles from Data Explorer" with link
- "View full characterization →" link routes to `/data-explorer/{sourceId}`
- Read-only context — no charts, no drill-down

### 1.4 Real-Time Scan Progress

Replace generic spinner with phased progress indicator.

**Frontend phases (time-estimated):**
1. "Connecting to database..." (immediate)
2. "Scanning tables..." (after 2s)
3. "Profiling columns..." (after 5s)
4. "Computing quality metrics..." (after response, during client-side grading)

**Additional UX:**
- Elapsed time counter
- Indeterminate pulsing progress bar
- After 60s: "Large databases may take several minutes" reassurance
- Cancel button (aborts HTTP request)

No WebSocket or polling — single HTTP request with time-estimated frontend phases.

## Phase 2: PII Detection + Comparison View

### 2.1 PII Detection

`PiiDetectionService` in backend, called after WhiteRabbit results arrive, before persisting field profiles.

**Pass 1 — Column name patterns (high confidence):**

| Pattern | PII Type |
|---|---|
| `/ssn\|social.?sec/i` | `ssn` |
| `/\bemail\b/i` | `email` |
| `/phone\|mobile\|fax/i` | `phone` |
| `/\bmrn\b\|medical.?record/i` | `mrn` |
| `/first.?name\|last.?name\|full.?name/i` | `name` |
| `/\baddr\b\|street\|zip.?code\|postal/i` | `address` |
| `/\bdob\b\|date.?of.?birth\|birth.?date/i` | `dob` |
| `/\bip.?addr\b/i` | `ip_address` |

**Pass 2 — Sample value patterns:**

| Pattern | PII Type |
|---|---|
| `/^\d{3}-\d{2}-\d{4}$/` | `ssn` |
| `/^[^@]+@[^@]+\.[^@]+$/` | `email` |
| `/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/` | `phone` |
| `/^\d{5}(-\d{4})?$/` | `zip` |

**OMOP CDM allowlist:** Standard `_source_value` columns (e.g., `person_source_value`, `provider_source_value`) are expected to hold source identifiers. These are excluded from PII flagging.

**Frontend display:**
- Red shield icon badge on PII columns (alongside type badge)
- Tooltip: "Potential PII detected: SSN (column name match)"
- Quality scorecard: new "PII columns: N" metric with advisory severity

### 2.2 Comparison View

**Entry point:** Scan history sidebar — checkboxes on two scans → "Compare" button. Or from scan detail: "Compare with..." dropdown.

**API endpoint:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sources/{source}/profiles/{profile}/compare/{baseline}` | Compute diff between two scans |

**Response structure:**

```json
{
  "summary": {
    "grade_change": { "baseline": "B+", "current": "A-" },
    "regressions": 3,
    "improvements": 7,
    "schema_changes": 2,
    "row_count_delta": { "baseline": 1005788, "current": 1018234, "delta_pct": 1.2 }
  },
  "regressions": [
    { "table": "person", "column": "race_source_value", "metric": "null_pct", "baseline": 12.0, "current": 48.0, "delta": 36.0 }
  ],
  "improvements": [...],
  "schema_changes": [
    { "table": "cost", "column": "total_charge", "change": "added", "type": "VARCHAR" }
  ]
}
```

**Summary dashboard:** Four cards:
- Grade Change (color-coded arrow)
- Regressions (red count)
- Improvements (green count)
- Schema Changes (purple count)

If row count delta > 10%, a fifth "Data Volume" card appears.

**Drill-down diff:** Clicking any card filters the detail table to that category. Table shows: table.column, baseline value, current value, delta, category.

**Thresholds:**
- Regression: null% increase > 5pp, or distinct count drop > 20%
- Improvement: null% decrease > 5pp
- Schema change: column added, removed, or type changed

## Phase 3: RBAC + FK Visualization

### 3.1 RBAC Permissions

New permission domain `profiler` added to `RolePermissionSeeder`:

| Permission | Roles |
|---|---|
| `profiler.view` | viewer, researcher, data-steward, admin, super-admin |
| `profiler.scan` | data-steward, admin, super-admin |
| `profiler.delete` | admin, super-admin |

**Route middleware:**
- `GET` routes: `permission:profiler.view`
- `POST /scan`: `permission:profiler.scan`
- `DELETE`: `permission:profiler.delete`
- Existing `POST /etl/scan`: add `permission:profiler.scan`

### 3.2 FK Relationship Visualization

Inferred from OMOP CDM conventions — not database introspection.

**Detection logic:**
- Parse column names ending in `_id`
- Match against known CDM table names (`person`, `visit_occurrence`, `concept`, etc.)
- Build directed graph: `condition_occurrence.person_id → person.person_id`

**Display:**
- Compact tree/graph layout (static SVG, not force-directed)
- CDM tables as nodes, colored by domain (Person=teal, Visit=blue, Condition=gold, Drug=crimson, etc.)
- FK edges with relationship indicators
- Click node → jump to that table's column profile
- Only shown for sources with CDM daimons

## File Impact Summary

### Backend (new files)
- `app/Services/Profiler/SourceProfilerService.php` — Orchestrates scan + persistence
- `app/Services/Profiler/PiiDetectionService.php` — Pattern-based PII detection
- `app/Services/Profiler/ScanComparisonService.php` — Diff computation
- `app/Http/Controllers/Api/V1/SourceProfilerController.php` — New API endpoints
- `database/migrations/xxxx_add_scan_fields_to_source_profiles.php`
- `database/migrations/xxxx_add_table_fields_to_field_profiles.php`

### Backend (modified files)
- `routes/api.php` — New route group for source profiler
- `database/seeders/RolePermissionSeeder.php` — Add profiler permissions (Phase 3)

### Frontend (new files)
- `features/etl/components/CdmContextPanel.tsx` — Achilles metrics overlay
- `features/etl/components/ScanProgressIndicator.tsx` — Phased progress UX
- `features/etl/components/PiiBadge.tsx` — PII warning badge
- `features/etl/components/ComparisonSummary.tsx` — Summary cards
- `features/etl/components/ComparisonDiff.tsx` — Drill-down diff table
- `features/etl/components/FkRelationshipGraph.tsx` — FK visualization (Phase 3)
- `features/etl/hooks/useProfilerData.ts` — TanStack Query hooks for new endpoints

### Frontend (modified files)
- `features/etl/pages/SourceProfilerPage.tsx` — Integrate new components, switch to server-side persistence
- `features/etl/components/DataQualityScorecard.tsx` — Add PII metric
- `features/etl/components/ScanHistorySidebar.tsx` — Add compare checkboxes, server-side history
- `features/etl/api.ts` — New API functions for persistence endpoints

## Non-Goals

- Auto-triggering WhiteRabbit scans on Achilles completion (deferred — keep pipelines independent)
- Interactive force-directed graph (static layout is sufficient)
- Blocking workflows based on PII detection (advisory only)
- Profiling non-PostgreSQL sources (WhiteRabbit handles this, but we only persist for Parthenon sources)
