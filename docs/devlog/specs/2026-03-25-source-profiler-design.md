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

## Phase 1: Persistence + CDM Context + Scan Progress + RBAC

### 1.1 Data Model

Repurpose existing `source_profiles` and `field_profiles` tables with additive migrations.

**Migration: `alter_source_profiles_for_whiterabbit`**

This migration both adds new columns and relaxes existing NOT NULL constraints for WhiteRabbit scan compatibility:

*New columns:*

| Column | Type | Notes |
|---|---|---|
| `source_id` | bigint, nullable, FK → sources | Links scan to a Parthenon source |
| `scan_type` | varchar(20), default 'whiterabbit' | Enum: `whiterabbit`, `ingestion` |
| `scan_time_seconds` | float, nullable | Elapsed scan duration |
| `overall_grade` | varchar(2), nullable | A+ through F |
| `table_count` | integer, nullable | Number of tables scanned |
| `column_count` | integer, nullable | Total columns across all tables |
| `total_rows` | bigint, nullable | Sum of all table row counts |
| `summary_json` | jsonb, nullable | Quality scorecard: high-null count, empty tables, low-cardinality count, single-value count |

*Relaxed constraints (required for WhiteRabbit scans which have no ingestion job):*

| Column | Change |
|---|---|
| `ingestion_job_id` | Drop NOT NULL, drop FK constraint (make nullable with SET NULL on delete) |
| `file_name` | Drop NOT NULL |
| `file_format` | Drop NOT NULL |
| `file_size` | Drop NOT NULL |
| `storage_path` | Drop NOT NULL |

This is backward-compatible — existing ingestion-based profiles still populate these fields.

**Migration: `add_table_fields_to_field_profiles`**

| Column | Type | Notes |
|---|---|---|
| `table_name` | varchar(255), nullable | Table this column belongs to (WhiteRabbit scans don't use ingestion jobs) |
| `row_count` | bigint, nullable | Table-level row count (denormalized for query performance) |

Existing columns (`is_potential_pii`, `pii_type`, `sample_values`, etc.) are already present.

**Model updates:**

`SourceProfile.php` — Add to `$fillable`: `source_id`, `scan_type`, `scan_time_seconds`, `overall_grade`, `table_count`, `column_count`, `total_rows`, `summary_json`. Add `$casts`: `summary_json` → `array`. Add `source(): BelongsTo` relationship.

`FieldProfile.php` — Add to `$fillable`: `table_name`, `row_count`. Existing `is_potential_pii`, `pii_type`, `sample_values` already in `$fillable`.

`Source.php` — Add `sourceProfiles(): HasMany` relationship.

**Relationships:**

```
Source (1) ──→ (N) SourceProfile (1) ──→ (N) FieldProfile
                   scan_type: whiterabbit      table_name: person
                   overall_grade: A            column_name: gender_concept_id
                   scan_time_seconds: 12.3     null_percentage: 0.0
```

### 1.2 RBAC Permissions

RBAC ships with Phase 1 — all new endpoints are permission-protected from day one per HIGHSEC §2.

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
- Existing `POST /etl/scan`: add `permission:profiler.scan` (currently unprotected — fixed as part of this work)

### 1.3 API Endpoints

All under `auth:sanctum` + permission middleware.

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `GET` | `/sources/{source}/profiles` | `permission:profiler.view` | List scan history (paginated, newest first) |
| `GET` | `/sources/{source}/profiles/{profile}` | `permission:profiler.view` | Single scan with all field profiles |
| `POST` | `/sources/{source}/profiles/scan` | `permission:profiler.scan`, `throttle:3,10` | Trigger scan, persist results, return profile ID |
| `DELETE` | `/sources/{source}/profiles/{profile}` | `permission:profiler.delete` | Delete a scan and its field profiles |

Rate limiting: `throttle:3,10` on the scan endpoint (3 scans per 10 minutes per user) since scans are expensive.

**`POST /sources/{source}/profiles/scan`** flow:
1. Validate via `RunScanRequest` Form Request (optional `tables` array, optional `sample_rows` integer min:100 max:1000000)
2. Resolve source daimons for connection spec
3. Call WhiteRabbit `/scan` (existing proxy, 600s timeout)
4. Compute overall grade and summary metrics
5. Create `source_profile` record
6. Create `field_profile` records for each column
7. Return profile ID + summary

**Form Request: `RunScanRequest`**

| Field | Type | Rules |
|---|---|---|
| `tables` | array, optional | `array`, `each:string,max:255` |
| `sample_rows` | integer, optional | `integer`, `min:100`, `max:1000000` |

**Frontend migration:** `SourceProfilerPage.tsx` switches from `POST /etl/scan` to `POST /sources/{source}/profiles/scan`. Existing `POST /etl/scan` is deprecated (docblock annotation) but retained. On first load after upgrade, existing localStorage history is silently discarded (was transient data) and the localStorage key is cleared.

**Infrastructure timeout note:** The 600s WhiteRabbit timeout requires Nginx `proxy_read_timeout 600s` and PHP-FPM `request_terminate_timeout = 600` on this endpoint. These are already configured for the existing `/etl/scan` endpoint; the same Nginx location block should cover the new route.

### 1.4 Achilles CDM Context Panel

Horizontal card row at the top of results, shown only when the source has a results daimon and at least one Achilles run.

**Cards:**

| Metric | Source | Analysis ID | Notes |
|---|---|---|---|
| Person Count | `achilles_results` | 0 | Verified in DB |
| Observation Period Span | `achilles_results_dist` | 105 (min/max) | Verify against DB before implementation |
| Domain Coverage | `achilles_results` | 117 (records by domain) | Verify against DB before implementation |
| Latest Achilles Run | `achilles_runs` table | — | status, date, pass count |
| DQ Grade | `dqd_results` | — | latest run pass rate (if exists) |

**Behavior:**
- Fetched via existing endpoints: `/sources/{source}/achilles/record-counts`, `/sources/{source}/achilles/demographics`
- No Achilles data → muted message: "No characterization data — run Achilles from Data Explorer" with link
- "View full characterization →" link routes to `/data-explorer/{sourceId}`
- Read-only context — no charts, no drill-down

### 1.5 Real-Time Scan Progress

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

**PII sample value redaction:** When `is_potential_pii` is true, sample values are replaced with `"[REDACTED — potential PII]"` before persistence. The API never serves raw PII sample values to the frontend. This applies to both the `sample_values` JSONB field and the `top_values` field in `field_profiles`.

**Frontend display:**
- Red shield icon badge on PII columns (alongside type badge)
- Tooltip: "Potential PII detected: SSN (column name match)"
- Quality scorecard: new "PII columns: N" metric with advisory severity

### 2.2 Comparison View

**Entry point:** Scan history sidebar — checkboxes on two scans → "Compare" button. Or from scan detail: "Compare with..." dropdown.

**API endpoint:**

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `GET` | `/sources/{source}/profiles/compare?current={id}&baseline={id}` | `permission:profiler.view` | Compute diff between two scans |

Using query parameters for clarity — avoids ambiguity about which path segment is baseline vs. current.

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
  "improvements": [],
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

## Phase 3: FK Visualization

### 3.1 FK Relationship Visualization

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
- `app/Services/Profiler/PiiDetectionService.php` — Pattern-based PII detection (Phase 2)
- `app/Services/Profiler/ScanComparisonService.php` — Diff computation (Phase 2)
- `app/Http/Controllers/Api/V1/SourceProfilerController.php` — New API endpoints
- `app/Http/Requests/RunScanRequest.php` — Form Request validation
- `database/migrations/xxxx_alter_source_profiles_for_whiterabbit.php`
- `database/migrations/xxxx_add_table_fields_to_field_profiles.php`

### Backend (modified files)
- `app/Models/App/SourceProfile.php` — Add `$fillable`, `$casts`, `source()` relationship
- `app/Models/App/FieldProfile.php` — Add `table_name`, `row_count` to `$fillable`
- `app/Models/App/Source.php` — Add `sourceProfiles(): HasMany` relationship
- `routes/api.php` — New route group for source profiler + permission middleware on existing `/etl/scan`
- `database/seeders/RolePermissionSeeder.php` — Add `profiler.view`, `profiler.scan`, `profiler.delete` permissions
- `app/Http/Controllers/Api/V1/WhiteRabbitController.php` — Add `@deprecated` docblock on `scan()` method

### Frontend (new files)
- `features/etl/components/CdmContextPanel.tsx` — Achilles metrics overlay
- `features/etl/components/ScanProgressIndicator.tsx` — Phased progress UX
- `features/etl/components/PiiBadge.tsx` — PII warning badge (Phase 2)
- `features/etl/components/ComparisonSummary.tsx` — Summary cards (Phase 2)
- `features/etl/components/ComparisonDiff.tsx` — Drill-down diff table (Phase 2)
- `features/etl/components/FkRelationshipGraph.tsx` — FK visualization (Phase 3)
- `features/etl/hooks/useProfilerData.ts` — TanStack Query hooks for new endpoints

### Frontend (modified files)
- `features/etl/pages/SourceProfilerPage.tsx` — Integrate new components, switch to server-side persistence, clear localStorage on upgrade
- `features/etl/components/DataQualityScorecard.tsx` — Add PII metric (Phase 2)
- `features/etl/components/ScanHistorySidebar.tsx` — Add compare checkboxes, server-side history
- `features/etl/api.ts` — New API functions for persistence endpoints

## Non-Goals

- Auto-triggering WhiteRabbit scans on Achilles completion (deferred — keep pipelines independent)
- Interactive force-directed graph (static layout is sufficient)
- Blocking workflows based on PII detection (advisory only)
- Profiling non-PostgreSQL sources (WhiteRabbit handles this, but we only persist for Parthenon sources)
