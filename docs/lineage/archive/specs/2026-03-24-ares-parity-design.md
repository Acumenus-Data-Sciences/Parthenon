# Ares Parity+ Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Author:** Claude Code + Dr. Sanjay Udoshi
**Scope:** Full Ares feature parity with superior UX, integrated as a new "Ares" tab in the Data Explorer

---

## 1. Problem Statement

OHDSI's Ares is a standalone Vue.js application that visualizes Achilles characterization and DQD quality results across data sources. Parthenon already exceeds Ares in single-source data characterization (127 Achilles analyses, 170+ DQD checks, live execution with progress tracking, population risk scoring, clinical coherence). However, Parthenon lacks several cross-source and longitudinal capabilities that Ares provides:

1. **Network Concept Comparison** — Compare concept prevalence across all sources
2. **DQ History + Delta Tracking** — Track quality changes between releases (NEW/RESOLVED/STABLE/EXISTING)
3. **Release-Level Versioning** — Formal data release model with CDM/vocab/ETL version metadata
4. **Unmapped Source Codes Report** — Surface codes that failed to map to standard OMOP concepts
5. **Domain Continuity** — Records per domain across releases over time
6. **Chart Annotations** — User notes on time-series charts, shared across team
7. **Cost Table Report** — OMOP cost table visualization by domain and over time
8. **Coverage Matrix (Strand Report)** — Domain × source availability heatmap
9. **Diversity Report** — Race/ethnicity/gender proportions across sources
10. **Feasibility Report** — Can the network support a proposed study?

## 2. Context

- **Current sources:** 3 large data sources
- **Expected within 1 month:** 3-5 additional sources (6-8 total)
- **Source update patterns:** Mix of scheduled ETL and continuous ingestion
- **Team usage:** Annotations are critical — team reviews charts together and needs shared context
- **All capabilities equally prioritized:** Feasibility, quality monitoring, and characterization comparison

## 3. Design Decision

### UX Pattern: Dashboard Hub + Drill-In

The Ares tab is a new 6th tab in the Data Explorer (alongside Overview, Domains, Temporal, Achilles, Data Quality). It opens as a **network health dashboard hub** with 9 summary cards showing live KPIs. Each card is clickable and drills into a full-page view with a sticky breadcrumb bar for navigation back to the hub.

**Why this pattern:**
- With 8 sources, the first question is "what needs my attention?" — not "which tool do I want?"
- Hub surfaces problems (low DQ scores, unmapped codes, pending releases) before you drill in
- Scales to any number of subsections (just add cards)
- Natural mobile layout (cards stack vertically)
- Most distinctive UX vs Ares (which uses flat tab navigation)

**Navigation:** Click card → drill-in view. Sticky breadcrumb: `Ares › Section Name`. Click "Ares" to return to hub.

**URL routing:** The Ares tab uses `/data-explorer/ares/:section` (no sourceId prefix) since most views are network-level. The existing Data Explorer source selector is hidden when the Ares tab is active. Source-scoped views (DQ History, Releases, Unmapped Codes, Domain Continuity, Cost) include their own source dropdown within the drill-in view. Network-level views (Overview, Comparison, Coverage, Diversity, Feasibility, Annotations) have no source selector.

## 4. Data Model

### 4.1 New Tables

#### `app.source_releases`

Versions each data source. Supports both manual creation (scheduled ETL) and automatic snapshots (continuous ingestion).

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `source_id` | integer | FK → sources, NOT NULL | Which data source |
| `release_key` | varchar(255) | UNIQUE(source_id, release_key), NOT NULL | Auto-generated or manual identifier (unique per source) |
| `release_name` | varchar(255) | NOT NULL | Human label ("Q1 2026 Refresh", "v2.3") |
| `release_type` | varchar(20) | NOT NULL, CHECK IN ('scheduled_etl', 'snapshot') | How the release was created |
| `cdm_version` | varchar(20) | | e.g. "5.4" |
| `vocabulary_version` | varchar(100) | | e.g. "v5.0 20-JAN-24" |
| `etl_version` | varchar(100) | nullable | e.g. "SynPUF-ETL v1.2" |
| `person_count` | bigint | | Cached at release creation |
| `record_count` | bigint | | Total records across domains |
| `notes` | text | nullable | Free-form release notes |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

Index: `(source_id, created_at DESC)` for timeline queries.

#### `app.dqd_deltas`

Computed after each DQD run completes on a release. Stores per-check delta status compared to previous release.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `source_id` | integer | FK → sources, NOT NULL | |
| `current_release_id` | integer | FK → source_releases, NOT NULL | This release |
| `previous_release_id` | integer | FK → source_releases, nullable | Compared against (NULL for first release — all checks treated as NEW) |
| `check_id` | varchar(100) | NOT NULL | DQD check identifier |
| `delta_status` | varchar(20) | NOT NULL, CHECK IN ('new', 'existing', 'resolved', 'stable') | |
| `current_passed` | boolean | NOT NULL | Pass/fail in current release |
| `previous_passed` | boolean | nullable | Pass/fail in previous release (NULL for first-release records) |
| `created_at` | timestamp | NOT NULL | |

Index: `(current_release_id)` for delta report queries.

Delta logic:
- `new` = failed in current, not present in previous (or first release)
- `resolved` = passed in current, failed in previous
- `existing` = failed in both
- `stable` = passed in both

#### `app.chart_annotations`

User annotations on any chart across the application.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `source_id` | integer | FK → sources, nullable | null = network-level annotation |
| `chart_type` | varchar(50) | NOT NULL | e.g. "temporal_trend", "dq_history", "domain_continuity" |
| `chart_context` | jsonb | NOT NULL, DEFAULT '{}' | Chart-specific keys (domain, concept_id, analysis_id, etc.) |
| `x_value` | varchar(100) | NOT NULL | X-axis position (date string or category) |
| `y_value` | double precision | nullable | Y-axis position if applicable |
| `annotation_text` | text | NOT NULL | The note content |
| `created_by` | integer | FK → users, NOT NULL | |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

Index: `(chart_type, source_id)` for per-chart queries.

#### `app.unmapped_source_codes`

Populated during Achilles runs. Identifies source codes without standard OMOP mappings. Stored in the `app` schema (not `results`) to avoid cross-schema FK complexity — `source_id` and `release_id` reference `app` tables directly.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `source_id` | integer | FK → sources, NOT NULL | |
| `release_id` | integer | FK → source_releases, NOT NULL | |
| `source_code` | varchar(255) | NOT NULL | The unmapped code |
| `source_vocabulary_id` | varchar(50) | NOT NULL | Origin vocabulary |
| `cdm_table` | varchar(100) | NOT NULL | Target table (condition_occurrence, drug_exposure, etc.) |
| `cdm_field` | varchar(100) | NOT NULL | Target field |
| `record_count` | bigint | NOT NULL | How many records affected |
| `created_at` | timestamp | NOT NULL | When this record was captured |

Index: `(source_id, release_id)` for per-release queries. Index: `(cdm_table)` for network aggregation.

#### `app.feasibility_assessments`

Saved feasibility assessment criteria and summary results.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | varchar(255) | NOT NULL | Assessment label |
| `criteria` | jsonb | NOT NULL | Full criteria object (domains, concepts, visits, dates, min_patients) |
| `sources_assessed` | integer | NOT NULL | How many sources evaluated |
| `sources_passed` | integer | NOT NULL | How many passed all criteria |
| `created_by` | integer | FK → users, NOT NULL | |
| `created_at` | timestamp | NOT NULL | |

#### `app.feasibility_assessment_results`

Per-source pass/fail breakdown for each assessment.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | serial | PK | |
| `assessment_id` | integer | FK → feasibility_assessments, NOT NULL | |
| `source_id` | integer | FK → sources, NOT NULL | |
| `domain_pass` | boolean | NOT NULL | Required domains available |
| `concept_pass` | boolean | NOT NULL | Required concepts present |
| `visit_pass` | boolean | NOT NULL | Required visit types available |
| `date_pass` | boolean | NOT NULL | Observation period overlaps date range |
| `patient_pass` | boolean | NOT NULL | Meets minimum patient count |
| `overall_pass` | boolean | NOT NULL | All criteria met |
| `details` | jsonb | NOT NULL | Per-criterion detail (which concepts missing, actual patient count, etc.) |

Index: `(assessment_id)` for loading results.

### 4.2 Altered Existing Tables

| Table | New Column | Type | Purpose |
|---|---|---|---|
| `app.sources` | `release_mode` | varchar(10), DEFAULT 'auto', CHECK IN ('auto', 'manual') | Controls auto-snapshot behavior |
| `app.achilles_runs` | `release_id` | integer, FK → source_releases, nullable | Links run to release |
| `app.dqd_results` | `release_id` | integer, FK → source_releases, nullable | Links DQD results to release |

### 4.3 Migration Count

8 migration files total:
- 6 new table migrations (source_releases, dqd_deltas, chart_annotations, unmapped_source_codes, feasibility_assessments, feasibility_assessment_results)
- 2 alter-table migrations (add release_mode to sources, add release_id to achilles_runs + dqd_results)

All additive — no destructive changes to existing tables.

## 5. API Layer

### 5.1 Source-Scoped Endpoints (`/v1/sources/{source}/ares/`)

All require `auth:sanctum` middleware.

#### Releases

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/releases` | `analyses.view` | List all releases for source (ordered by created_at desc) |
| POST | `/releases` | `analyses.create` | Create manual release |
| GET | `/releases/{releaseId}` | `analyses.view` | Release detail with linked run IDs |
| PUT | `/releases/{releaseId}` | `analyses.edit` | Update release metadata |
| DELETE | `/releases/{releaseId}` | `analyses.delete` | Delete release and unlink runs |

#### DQ History

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/dq-history` | `analyses.view` | Pass rate over all releases (time series) |
| GET | `/dq-history/deltas?release_id={id}` | `analyses.view` | Delta report for release vs predecessor |
| GET | `/dq-history/category-trends` | `analyses.view` | Pass rate by category over releases |
| GET | `/dq-history/domain-trends` | `analyses.view` | Pass rate by CDM table over releases |

#### Unmapped Codes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/unmapped-codes?release_id=&table=&field=&page=` | `analyses.view` | Paginated unmapped codes with filters |
| GET | `/unmapped-codes/summary` | `analyses.view` | Aggregated counts by table/field |

#### Domain Continuity

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/domain-continuity` | `analyses.view` | Records per domain across releases |

#### Annotations

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/annotations?chart_type=&chart_context=` | `analyses.view` | Annotations for specific chart |
| POST | `/annotations` | `analyses.create` | Create annotation |
| PUT | `/annotations/{id}` | `analyses.edit` | Edit (creator only) |
| DELETE | `/annotations/{id}` | `analyses.delete` | Delete (creator or admin) |

#### Cost

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/cost/summary` | `analyses.view` | Cost aggregates by domain |
| GET | `/cost/trends` | `analyses.view` | Monthly cost totals |
| GET | `/cost/domains/{domain}` | `analyses.view` | Top cost concepts in domain |

### 5.2 Network-Scoped Endpoints (`/v1/network/ares/`)

All require `auth:sanctum` middleware.

#### Hub Overview

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/overview` | `analyses.view` | Aggregated KPIs for hub cards |

#### Concept Comparison

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/compare?concept_id={id}` | `analyses.view` | Concept prevalence across all sources |
| GET | `/compare/search?q={term}` | `analyses.view` | Vocabulary search for comparison |
| GET | `/compare/batch?concept_ids={ids}` | `analyses.view` | Multi-concept comparison |

#### Coverage

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/coverage` | `analyses.view` | Domain × source matrix |

#### Diversity

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/diversity` | `analyses.view` | Demographic proportions per source |

#### Feasibility

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/feasibility` | `analyses.create` | Run feasibility assessment |
| GET | `/feasibility/{id}` | `analyses.view` | Assessment results |
| GET | `/feasibility` | `analyses.view` | List past assessments |

#### Network DQ

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/dq-summary` | `analyses.view` | DQ pass rates per source with trend indicators |

#### Network Annotations

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/annotations` | `analyses.view` | All annotations across all sources |

#### Network Cost

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/cost` | `analyses.view` | Cost aggregated across sources |

### 5.3 Controllers

| Controller | File | Routes |
|---|---|---|
| `AresController` | `Http/Controllers/Api/V1/AresController.php` | `/v1/sources/{source}/ares/*` |
| `NetworkAresController` | `Http/Controllers/Api/V1/NetworkAresController.php` | `/v1/network/ares/*` |

## 6. Backend Service Layer

### 6.1 Service Directory

```
backend/app/Services/Ares/
├── ReleaseService.php
├── DqHistoryService.php
├── UnmappedCodeService.php
├── AnnotationService.php
├── CostService.php
├── FeasibilityService.php
├── NetworkComparisonService.php
├── CoverageService.php
└── DiversityService.php
```

### 6.2 Service Responsibilities

**ReleaseService** — CRUD + auto-snapshot logic.
- `createRelease(Source, data)` — Manual creation for scheduled ETL sources
- `autoSnapshot(Source, AchillesRun|DqdRun)` — Auto-creates release when Achilles/DQD completes on a source with `release_mode = 'auto'`. Caches person_count and record_count from the completed run.
- `getTimeline(Source)` — All releases chronologically with linked run IDs and summary stats
- Fires `ReleaseCreated` event → triggers `DqHistoryService::computeDeltas()` asynchronously

**DqHistoryService** — Delta computation + trend aggregation.
- `computeDeltas(Release $current)` — Finds previous release for same source, joins DQD results by check_id, computes delta status (new/existing/resolved/stable)
- `getTrends(Source)` — Pass rate per release (overall + per category + per domain)
- `getNetworkDqSummary()` — Latest DQ scores across all sources with trend indicators (up/down vs prior release)

**NetworkComparisonService** — Cross-source concept prevalence.
- `compareConcept(conceptId)` — For each active source: queries `achilles_results` for concept prevalence using the appropriate analysis ID by domain (401 for conditions, 701 for drugs, 601 for procedures, etc.), computes rate per 1000 persons, fetches temporal trend points. Returns `{source, count, rate_per_1000, trend_points[]}` per source.
- `compareBatch(conceptIds[])` — Parallel execution for multiple concepts
- Uses `AchillesResultReaderService::setSchemaForSource()` for multi-source schema switching

**FeasibilityService** — Study feasibility assessment engine.
- `assess(FeasibilityRequest)` — Evaluates each source against criteria: required_domains, required_concepts (by concept_id), visit_types, date_range, min_patients
- Per-source checks: domain coverage (record counts > 0), concept presence (achilles_results), visit type availability (analysis 200), observation period overlap, person count threshold
- Returns per-source scorecard with overall pass/fail + per-criterion details
- Stores results in `feasibility_assessments` + `feasibility_assessment_results`

**UnmappedCodeService** — Source code mapping gap analysis.
- Populated during Achilles runs via new analysis step querying `source_to_concept_map` for `target_concept_id = 0` or NULL
- `getSummary(Source, Release)` — Counts by CDM table/field
- `getNetworkSummary()` — Aggregated across all sources
- `getDetails(Source, Release, filters)` — Paginated with source_code, vocabulary, table, field, record_count

**CoverageService** — Domain × source matrix.
- `getMatrix()` — For each active source, queries record counts per domain. Returns `{sources[], domains[], matrix[][]}` where cells contain `{record_count, has_data, density_per_person}`

**DiversityService** — Demographic parity.
- `getDiversity()` — Queries Achilles analyses 2 (gender), 4 (race), 5 (ethnicity) per source. Returns proportional breakdowns for side-by-side comparison.

**CostService** — OMOP cost table analysis.
- `getSummary(Source, Release)` — Aggregates from `omop.cost` joined to domain tables, grouped by domain
- `getTrends(Source)` — Monthly cost totals
- `getNetworkCost()` — Cross-source aggregation

**AnnotationService** — CRUD with authorization.
- `create(user, chartContext, data)` — Stores with chart_type + chart_context jsonb
- `forChart(chartType, chartContext)` — Returns annotations matching a specific chart
- `update(user, id, data)` — Creator-only edit
- `delete(user, id)` — Creator or admin
- `allForSource(sourceId)` / `allForNetwork()` — Browse views

### 6.3 Event Infrastructure (New — Must Be Created)

**IMPORTANT:** The events referenced below do NOT currently exist. They must be created as part of Phase 1.

**New events to create:**
- `App\Events\AchillesRunCompleted` — Dispatched at the end of `RunAchillesJob::handle()` after successful completion. Payload: `AchillesRun $run, Source $source`.
- `App\Events\DqdRunCompleted` — Dispatched at the end of `RunDqdJob::handle()` after successful completion. Payload: `DqdRun $run, Source $source`.
- `App\Events\ReleaseCreated` — Dispatched by `ReleaseService::createRelease()` and `autoSnapshot()`. Payload: `SourceRelease $release`.

**Modifications to existing jobs:**
- `RunAchillesJob::handle()` — Add `event(new AchillesRunCompleted($run, $source))` before return on success path
- `RunDqdJob::handle()` — Add `event(new DqdRunCompleted($run, $source))` before return on success path

**New listeners:**
- `CreateAutoRelease` — Listens to `AchillesRunCompleted`. Checks `source.release_mode === 'auto'`, calls `ReleaseService::autoSnapshot()`.
- `AssociateDqdWithRelease` — Listens to `DqdRunCompleted`. Links DQD run to current release via `release_id` FK, triggers delta computation.
- `ComputeDqDeltas` — Listens to `ReleaseCreated` (queued). Calls `DqHistoryService::computeDeltas()`.

**Unmapped codes during Achilles:**
- New optional analysis step added to `RunAchillesJob` (runs after standard 127 analyses)
- Queries `source_to_concept_map` for unmapped codes, populates `app.unmapped_source_codes`

### 6.4 Legacy Data Backfill

Existing sources have Achilles/DQD runs with no `release_id`. On first deployment, the Ares hub would show empty releases, no deltas, and no trend charts for all 3 existing sources.

**Backfill artisan command:** `php artisan ares:backfill-releases`

Behavior:
1. For each source with existing Achilles runs and `release_id = NULL`:
   - Create a single "Legacy" release with `release_type = 'snapshot'`, `release_name = 'Pre-Ares Legacy'`
   - Populate `person_count` and `record_count` from the latest Achilles record counts
   - Set `cdm_version` from `cdm_source` table if available
2. Backfill `release_id` on all existing `achilles_runs` and `dqd_results` rows for that source
3. If the source has multiple DQD runs, create one release per run and compute deltas between them
4. Log what was backfilled for auditability

This command runs once during Phase 1 deployment and is idempotent (skips sources that already have releases).

### 6.5 Form Request Validation Classes

All POST/PUT endpoints use dedicated Form Request classes per project convention:

| Class | Endpoint | Validation Rules |
|---|---|---|
| `StoreReleaseRequest` | `POST /releases` | release_name: required, string, max:255; release_type: required, in:scheduled_etl,snapshot; cdm_version: nullable, string, max:20; vocabulary_version: nullable, string, max:100; etl_version: nullable, string, max:100; notes: nullable, string |
| `UpdateReleaseRequest` | `PUT /releases/{id}` | release_name: sometimes, string, max:255; cdm_version: nullable, string, max:20; vocabulary_version: nullable, string, max:100; etl_version: nullable, string, max:100; notes: nullable, string |
| `StoreAnnotationRequest` | `POST /annotations` | chart_type: required, string, max:50; chart_context: required, array; x_value: required, string, max:100; y_value: nullable, numeric; annotation_text: required, string, max:2000 |
| `UpdateAnnotationRequest` | `PUT /annotations/{id}` | annotation_text: required, string, max:2000 |
| `RunFeasibilityRequest` | `POST /feasibility` | name: required, string, max:255; criteria.required_domains: required, array, min:1; criteria.required_domains.*: string, in:condition,drug,procedure,measurement,observation,visit; criteria.required_concepts: nullable, array; criteria.required_concepts.*: integer; criteria.visit_types: nullable, array; criteria.date_range: nullable, array; criteria.date_range.start: date; criteria.date_range.end: date, after:criteria.date_range.start; criteria.min_patients: nullable, integer, min:1 |

### 6.6 Caching Strategy

Network-level endpoints aggregate across all sources and can be expensive. Redis caching with event-driven invalidation:

| Endpoint | Cache Key | TTL | Invalidated By |
|---|---|---|---|
| `GET /network/ares/overview` | `ares:network:overview` | 5 min | `ReleaseCreated` event |
| `GET /network/ares/coverage` | `ares:network:coverage` | 10 min | `ReleaseCreated` event |
| `GET /network/ares/diversity` | `ares:network:diversity` | 10 min | `ReleaseCreated` event |
| `GET /network/ares/dq-summary` | `ares:network:dq-summary` | 5 min | `ReleaseCreated` event |
| `GET /network/ares/cost` | `ares:network:cost` | 10 min | `ReleaseCreated` event |

Source-scoped endpoints are not cached (they're already scoped to a single source and fast).

### 6.7 Rate Limiting

Per HIGHSEC Section 2.3, expensive endpoints get rate limiting:

| Endpoint | Limit | Reason |
|---|---|---|
| `POST /network/ares/feasibility` | 10/hour per user | Queries all sources in parallel |
| `GET /network/ares/compare/batch` | 30/minute per user | Multi-concept cross-source queries |

## 7. Frontend Architecture

### 7.1 File Structure

```
frontend/src/features/data-explorer/
├── pages/
│   └── AresTab.tsx                        # Hub + drill-in router (new)
├── components/
│   └── ares/
│       ├── AresHub.tsx                    # Hub card grid layout
│       ├── AresHealthBanner.tsx           # Top banner with network KPIs
│       ├── AresBreadcrumb.tsx             # Sticky breadcrumb (Ares › Section)
│       ├── HubCard.tsx                    # Reusable card with KPI preview
│       │
│       ├── network-overview/
│       │   └── NetworkOverviewView.tsx    # Source list + DQ scores + trends
│       ├── concept-comparison/
│       │   ├── ConceptComparisonView.tsx  # Search + cross-source charts
│       │   └── ComparisonChart.tsx        # Grouped bar: concept × source
│       ├── dq-history/
│       │   ├── DqHistoryView.tsx          # Trend chart + delta table
│       │   ├── DqTrendChart.tsx           # Line: DQ pass rate over releases
│       │   └── DqDeltaTable.tsx           # NEW/RESOLVED/STABLE badges
│       ├── coverage/
│       │   └── CoverageMatrixView.tsx     # Domain × source heatmap
│       ├── feasibility/
│       │   ├── FeasibilityView.tsx        # Assessment list + builder
│       │   └── FeasibilityForm.tsx        # Criteria form (domains, concepts, dates)
│       ├── diversity/
│       │   └── DiversityView.tsx          # Stacked demographic bars per source
│       ├── releases/
│       │   └── ReleasesView.tsx           # Timeline + create/edit
│       ├── unmapped-codes/
│       │   └── UnmappedCodesView.tsx      # Filterable paginated table
│       ├── cost/
│       │   └── CostView.tsx              # Domain aggregates + time series
│       └── annotations/
│           ├── AnnotationsView.tsx        # Browse all annotations
│           ├── AnnotationMarker.tsx       # Overlay for any chart (composable)
│           └── AnnotationPopover.tsx      # Create/edit form
├── hooks/
│   ├── useReleaseData.ts                  # Release + backfill hooks
│   ├── useDqHistoryData.ts                # DQ trends + deltas hooks
│   ├── useNetworkData.ts                  # Comparison, coverage, diversity, feasibility hooks
│   ├── useAnnotationData.ts               # Annotation CRUD hooks
│   ├── useCostData.ts                     # Cost query hooks
│   └── useAresHub.ts                      # Hub overview KPI hooks
├── api/
│   ├── releaseApi.ts                      # Release endpoints
│   ├── dqHistoryApi.ts                    # DQ history endpoints
│   ├── networkAresApi.ts                  # Network comparison/coverage/diversity/feasibility
│   ├── annotationApi.ts                   # Annotation endpoints
│   └── costApi.ts                         # Cost endpoints
└── types/
    └── ares.ts                            # Ares TypeScript interfaces
```

### 7.2 Hub State Management

`AresTab` manages active view via React state:
- `activeView: 'hub' | 'network-overview' | 'concept-comparison' | 'dq-history' | 'coverage' | 'feasibility' | 'diversity' | 'releases' | 'unmapped-codes' | 'cost' | 'annotations'`
- Hub renders `AresHealthBanner` + `AresHub` (grid of `HubCard` components)
- Click card → sets `activeView` → renders corresponding `*View` component
- `AresBreadcrumb` always visible — click "Ares" resets to hub
- URL syncs: `/data-explorer/ares/:section` for deep-linking (no sourceId — Ares tab is network-scoped)

### 7.3 Hub Layout

Three rows of cards in a 3-column grid:

**Row 1 (Primary):** Network Overview, Concept Comparison, DQ History
**Row 2 (Secondary):** Coverage Matrix, Feasibility, Diversity
**Row 3 (Tertiary):** Releases, Unmapped Codes, Annotations
**Row 4 (Bottom):** Cost (full-width card, since cost data may be unavailable for some sources)

10 cards total, each with its own dedicated drill-in view. No shared/stacked cards.

Top banner shows aggregate KPIs: source count, avg DQ score, total unmapped codes, annotation count.

Each `HubCard` shows:
- Accent-colored dot + section name
- Mini preview (sparkline, mini table, mini heatmap, etc.)
- Live KPI number
- Hover: border color change to accent color

### 7.4 Annotation Integration

`AnnotationMarker` is a composable overlay component that works with any Recharts chart:
- Accepts `chartType` and `chartContext` props
- Queries annotations via `useAresData.useAnnotations(chartType, chartContext)`
- Renders small markers at `(x_value, y_value)` positions on the chart
- Hover → `AnnotationPopover` shows text + author + timestamp
- Click "+" button on any chart → `AnnotationPopover` in create mode

This component can be retroactively added to existing charts in Overview, Domain, and Temporal tabs — not just Ares drill-in views.

### 7.5 Key Component Behaviors

**ConceptComparisonView:** Vocabulary search → select concept → grouped bar chart showing prevalence per source with rate-per-1000 overlay. Supports selecting multiple concepts for batch comparison. Recent searches persisted in localStorage. The `/compare/search` endpoint delegates to the existing Solr vocabulary search service (vocabulary configset) — no new search implementation required.

**DqHistoryView:** Source selector dropdown → line chart of DQ pass rate over releases (overall + category toggles) → click a release point → delta table appears below with NEW (red badge), RESOLVED (green), EXISTING (amber), STABLE (gray) per check. Annotation markers on the trend chart.

**CoverageMatrixView:** Heatmap grid — rows = sources, columns = domains. Cell color: green (has data, high density), amber (has data, low density), red (no data). Cell click → navigates to that source's Domain tab for the selected domain.

**FeasibilityView:** Two sections: (1) Past assessments list with pass/fail summary, (2) "New Assessment" form with multi-step criteria: select required domains (checkboxes), search and add required concepts, select visit types, set date range, set min patient count. Submit → shows results as a per-source scorecard with green/red badges per criterion.

**DiversityView:** Stacked horizontal bars per source for race, ethnicity, and gender. Legend below. Sources sorted by population size.

**UnmappedCodesView:** Paginated table with filters: source (dropdown), CDM table (dropdown), CDM field (dropdown), search (text). Columns: source_code, source_vocabulary, cdm_table, cdm_field, record_count. Sortable by record_count.

**ReleasesView:** Vertical timeline per source. Each release shows: name, type badge (ETL/Snapshot), CDM/vocab/ETL versions, person count, record count, linked Achilles + DQD run IDs, created_at. Create button opens form. Edit inline.

**CostView:** Two sections: (1) Bar chart of cost by domain for selected source, (2) Line chart of monthly cost trends. Source selector dropdown. Network toggle shows cross-source aggregation. **Empty-state handling:** Many OMOP datasets (especially non-claims like SynPUF, MIMIC-IV) have empty cost tables. The CostView must detect this and show an informative empty state: "No cost data available for this source" with an explanation that cost data requires claims-based datasets. The hub card also shows "No cost data" instead of zero values when no sources have cost records. The `CostService` checks `SELECT COUNT(*) FROM omop.cost` per source and returns a `has_cost_data: boolean` flag.

## 8. Security & Permissions

All endpoints comply with HIGHSEC spec:
- Every route behind `auth:sanctum` middleware
- Read endpoints: `permission:analyses.view`
- Write endpoints (create release, annotation, feasibility): `permission:analyses.create`
- Delete endpoints: `permission:analyses.delete` + ownership check for annotations (creator or admin)
- No public routes — all Ares data requires authentication
- Annotations store `created_by` FK for ownership enforcement
- Feasibility assessments store `created_by` FK

No PHI is exposed through Ares endpoints — all data is aggregate-level (counts, rates, proportions). Concept-level data from Achilles results does not contain patient identifiers.

## 9. Testing Strategy

### 9.1 Backend (Pest)

**Unit tests per service:**
- `ReleaseServiceTest` — CRUD, auto-snapshot trigger on Achilles/DQD completion, manual creation, timeline ordering, release_mode filtering
- `DqHistoryServiceTest` — Delta computation (all 4 statuses), first-release edge case (no previous = all NEW), category/domain trend aggregation
- `NetworkComparisonServiceTest` — Cross-source concept query, rate-per-1000 calculation, multi-source schema switching, missing concept handling
- `FeasibilityServiceTest` — All 5 criteria combinations, partial pass, full pass, full fail, source with missing domains
- `UnmappedCodeServiceTest` — Aggregation by table/field, pagination, network summary, empty result handling
- `CoverageServiceTest` — Matrix generation with mixed empty/populated sources, density calculation
- `DiversityServiceTest` — Demographic proportions, missing race/ethnicity data handling
- `CostServiceTest` — Domain aggregation, monthly trends, sources without cost table
- `AnnotationServiceTest` — CRUD, creator-only edit, admin delete, chart context query filtering

**Integration tests per controller:**
- `AresControllerTest` — All source-scoped endpoints with auth + permission middleware verification
- `NetworkAresControllerTest` — All network-scoped endpoints with auth + permission verification
- HIGHSEC: verify unauthenticated requests return 401, unpermissioned return 403

### 9.2 Frontend (Vitest)

**Component tests:**
- `AresHub.test.tsx` — Renders 9 cards, click navigation to drill-in, breadcrumb state
- `DqTrendChart.test.tsx` — Renders with release data, empty state, annotation markers
- `DqDeltaTable.test.tsx` — Badge rendering per status (color + text)
- `ComparisonChart.test.tsx` — Multi-source grouped bars, missing source handling
- `CoverageMatrixView.test.tsx` — Heatmap cell rendering, domain × source grid
- `FeasibilityForm.test.tsx` — Validation, criteria submission, results display
- `AnnotationMarker.test.tsx` — Overlay positioning, hover popover, create mode
- `AresBreadcrumb.test.tsx` — Navigation state, deep-link URL sync

**Hook tests:**
- `useAresData.test.ts` — API mocking, loading/error states, cache invalidation

## 10. Rollout Plan

### Phase 1: Foundation

Data model + releases + annotations + event infrastructure.

1. Database migrations (6 new tables, 2 alter tables)
2. Create `AchillesRunCompleted` and `DqdRunCompleted` events; modify `RunAchillesJob` and `RunDqdJob` to dispatch them on successful completion
3. Create `ReleaseCreated` event
4. `ReleaseService` + `AnnotationService` with full CRUD
5. Form Request classes: `StoreReleaseRequest`, `UpdateReleaseRequest`, `StoreAnnotationRequest`, `UpdateAnnotationRequest`
6. Release + annotation API endpoints + `AresController`
7. Create listeners: `CreateAutoRelease`, `AssociateDqdWithRelease`, `ComputeDqDeltas`
8. Run `php artisan ares:backfill-releases` to create legacy releases for existing sources
9. `AresTab` hub skeleton + `AresHub` + `AresBreadcrumb` + `HubCard`
10. `ReleasesView` drill-in page
11. `AnnotationsView` drill-in page + `AnnotationMarker` overlay component
12. Backend + frontend tests for Phase 1

### Phase 2: Quality Intelligence

DQ history + unmapped codes. Depends on Phase 1 (releases).

1. `DqHistoryService` with delta computation
2. `UnmappedCodeService` + Achilles integration (new analysis step)
3. DQ history + unmapped codes API endpoints
4. `DqHistoryView` + `DqTrendChart` + `DqDeltaTable`
5. `UnmappedCodesView` with filterable paginated table
6. Domain continuity endpoint + visualization
7. Hub cards wired to live data (DQ History, Unmapped Codes)
8. Backend + frontend tests for Phase 2

### Phase 3: Network Intelligence

Cross-source comparison + coverage + diversity + feasibility. Depends on Phase 1 (releases). Can run in parallel with Phase 2.

1. `NetworkComparisonService` with cross-source queries
2. `CoverageService` + `DiversityService`
3. `FeasibilityService` with assessment engine + `RunFeasibilityRequest` Form Request
4. `NetworkAresController` with all network endpoints + rate limiting on feasibility/batch-compare
5. `ConceptComparisonView` + `ComparisonChart`
6. `CoverageMatrixView` (domain × source heatmap)
7. `DiversityView` (stacked demographic bars)
8. `FeasibilityView` + `FeasibilityForm`
9. `NetworkOverviewView` with source health list
10. Hub banner + overview card wired to live network data
11. Backend + frontend tests for Phase 3

### Phase 4: Cost + Polish

Depends on Phases 2 and 3.

1. `CostService` with OMOP cost table queries
2. Cost API endpoints (source-scoped + network)
3. `CostView` drill-in page
4. Retrofit `AnnotationMarker` into existing Overview/Domain/Temporal tabs
5. Hub card loading skeletons + animations
6. Responsive layout (cards stack on mobile, breadcrumb collapses)
7. Final integration tests across all phases
8. Run `./deploy.sh --openapi` to regenerate OpenAPI spec + TypeScript types
9. Deploy via `./deploy.sh`

### Phase Dependencies

```
Phase 1 (Foundation) ──→ Phase 2 (Quality)  ──→ Phase 4 (Cost + Polish)
         │                                              ↑
         └──────────→ Phase 3 (Network)  ──────────────┘
```

Phases 2 and 3 are independent and can execute in parallel after Phase 1 completes.

## 11. Ares Parity Checklist

| Ares Feature | Parthenon Implementation | Phase |
|---|---|---|
| Network Overview | `NetworkOverviewView` — source health list with DQ scores + trends | 3 |
| Network Concept Comparison | `ConceptComparisonView` — search + cross-source prevalence bars | 3 |
| Network DQ Summary | `GET /network/ares/dq-summary` + hub banner | 3 |
| Network Coverage (Strand) | `CoverageMatrixView` — domain × source heatmap | 3 |
| Network Diversity | `DiversityView` — stacked demographic bars per source | 3 |
| Network Feasibility | `FeasibilityView` — criteria builder + per-source scorecard | 3 |
| Network Annotations | `AnnotationsView` — browse all annotations | 1 |
| Network Cost | `CostView` — cross-source cost aggregation | 4 |
| DQ History + Deltas | `DqHistoryView` — trend chart + NEW/RESOLVED/STABLE/EXISTING table | 2 |
| Release Versioning | `ReleasesView` — timeline with auto/manual release management | 1 |
| Unmapped Source Codes | `UnmappedCodesView` — filterable paginated table | 2 |
| Domain Continuity | Domain continuity endpoint + chart in DQ History view | 2 |
| Chart Annotations | `AnnotationMarker` — composable overlay for any chart | 1 |
| Cost Report | `CostView` — domain aggregates + monthly trends | 4 |
| Person Report | Already exists: Overview tab demographics | — |
| Observation Period Report | Already exists: Overview tab observation analysis | — |
| Domain Reports + Drilldown | Already exists: Domains tab with concept drilldown | — |
| Death Report | Already exists: Overview tab death analysis | — |
| DQD Results Display | Already exists: Data Quality tab | — |
| Performance Report | Already exists: Achilles tab performance section | — |

## 12. Parity+ Features (Beyond Ares)

These Parthenon capabilities have no Ares equivalent:

| Feature | Description |
|---|---|
| Native Achilles/DQD/Heel execution | Live run with real-time progress modal (Ares is read-only) |
| Population Risk Scoring | 20 clinical risk tiers |
| Clinical Coherence | 12 native clinical validation analyses |
| Network Analytics (NA001-008) | Cross-source heterogeneity, density, structural patterns |
| Population Characterization (PC001-006) | Charlson, polypharmacy, treatment pathways, etc. |
| Solr-powered analysis search | Full-text search across all analyses |
| Feasibility persistence | Saved assessments with history (Ares has no persistence) |
| Annotation on any chart | Composable overlay works across all tabs, not just Ares views |
| Dashboard hub UX | Ares uses flat navigation; Parthenon surfaces KPIs and problems first |
