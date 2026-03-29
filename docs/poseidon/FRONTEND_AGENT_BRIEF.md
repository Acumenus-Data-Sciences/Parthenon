# Poseidon Frontend Agent Brief

**Date:** 2026-03-28  
**Status:** Ready for implementation  
**Audience:** Next agent responsible for designing and implementing the Poseidon frontend surface

## Purpose

This document captures the agreed frontend direction for Poseidon and gives a concrete implementation brief for another agent to complete the work without needing to reconstruct product intent.

Poseidon is not another upload wizard. It is an operational control plane for repeatable, incremental, dependency-aware OMOP CDM refreshes powered by dbt + Dagster. The frontend should reflect that.

## Product Positioning

Poseidon should be presented as an **operations console** for ingestion maintenance and orchestration.

It should answer questions like:

- Is this source current?
- What is stale?
- What failed?
- What ran most recently?
- What is running now?
- Can I trigger an incremental or full refresh?
- Which assets/tables were affected?
- Is the orchestration layer healthy?

It should **not** feel like:

- another ETL mapping wizard
- a raw infrastructure admin panel
- a generic table dump of runs and logs

## Where It Fits In The Application

### Primary placement: Data Ingestion

Poseidon belongs primarily under **Data Ingestion**, because it is downstream of Aqueduct and part of the ingestion lifecycle.

Recommended placement:

- a dedicated Poseidon page reachable from Data Ingestion, or
- a new Poseidon tab/workspace within the ingestion area

This is the main operational surface for:

- data stewards
- ingestion operators
- source owners

This area should focus on source freshness, schedules, runs, failures, and manual execution.

### Secondary placement: Administration

Poseidon should also have a narrower **Administration** surface for platform health.

This is for:

- service health
- daemon/server status
- scheduler/sensor health
- webhook/config problems
- global infrastructure diagnostics

This should be smaller than the ingestion-facing surface and clearly platform-oriented.

## Recommended Frontend Shape

Build four pages/views.

### 1. Poseidon Dashboard

This should be the primary landing page.

Purpose:

- overall orchestration visibility
- immediate operational triage
- quick drill-down into sources and runs

Should show:

- active runs
- failed runs in the last 24 hours
- stale sources
- freshness summary by source
- next scheduled runs
- recent successful runs
- quick actions for manual rerun

Design guidance:

- treat this as a control tower
- use status cards at the top
- use concise tables/list panels below
- prioritize current issues over historical detail

### 2. Source Detail

This is likely the most-used day-to-day screen.

Purpose:

- inspect one ingestion source or Poseidon schedule target
- understand current freshness and recent run behavior
- trigger remediation

Should show:

- source identity and schedule summary
- last successful run
- current run state
- current freshness/staleness state
- dbt asset/materialization summary
- affected CDM tables/assets
- recent run history
- dbt test failures
- freshness warnings
- buttons for incremental refresh and full refresh

Design guidance:

- optimize for “what is the current state and what do I do next?”
- avoid burying operational status in deep tabs

### 3. Run Detail

Purpose:

- inspect one execution precisely
- support diagnosis and auditability

Should show:

- trigger type: manual, schedule, sensor
- start time, end time, duration
- source
- status
- assets/tables targeted
- dbt build/test outcomes
- failure point
- logs/events timeline
- rerun controls where permitted

Design guidance:

- this page should be linkable from notifications or dashboard rows
- keep the summary high-signal before logs

### 4. Lineage / Asset Graph

Purpose:

- visualize dependencies across staging, intermediate, and CDM assets
- help diagnose impact and failure propagation

Should show:

- staging -> intermediate -> CDM lineage
- failed nodes
- stale nodes
- currently materializing nodes
- click-through to source detail or run detail

Design guidance:

- keep this useful, not ornamental
- avoid an overbuilt graph experience if the graph becomes unreadable
- an intentionally constrained lineage view is better than a noisy one

## Split Between Data Ingestion And Administration

### Data Ingestion should own:

- Poseidon Dashboard
- Source Detail
- Run Detail
- asset freshness
- source schedules
- manual refresh actions
- source-level operational drill-down

### Administration should own:

- Poseidon service health
- server/daemon state
- failing sensors or schedules at the system level
- configuration or webhook issues
- cross-source infrastructure diagnostics

## UX Principles

Use the existing app language established by:

- ingestion pages
- sync monitors
- administration dashboards

Prefer:

- status cards
- concise operational tables
- slide-over panels or drawers for details when appropriate
- strong status badges for `running`, `failed`, `stale`, `healthy`, `scheduled`
- obvious quick actions

Avoid:

- “DevOps slop” dashboards with dozens of tiny widgets
- giant raw log walls as the primary UI
- collapsing everything into one overloaded page
- abstract lineage visualizations without practical context

## Recommended Route Structure

Use this as the target route shape unless local routing constraints require small adjustments.

### Data Ingestion-facing routes

- `/ingestion/poseidon`
- `/ingestion/poseidon/sources/:sourceId`
- `/ingestion/poseidon/runs/:runId`
- `/ingestion/poseidon/lineage`

### Admin-facing routes

- `/admin/poseidon`

If the repo already has a better ingestion route grouping pattern, preserve it. Do not invent a parallel routing style that conflicts with the rest of the app.

## Suggested Frontend Information Architecture

### Poseidon Dashboard sections

- top summary cards
  - active runs
  - stale sources
  - failed runs in last 24h
  - next scheduled run
- current activity panel
  - running jobs with durations and status
- stale sources panel
  - sources overdue for refresh
- recent failures panel
  - latest failed runs with short error summaries
- schedule snapshot panel
  - next few scheduled jobs

### Source Detail sections

- source header
  - source name
  - schedule
  - status badge
  - last success
  - next scheduled run
- action bar
  - run incremental refresh
  - run full refresh
  - open lineage
- freshness and health summary
- recent runs
- assets/tables summary
- dbt tests and warnings
- operational notes/errors

### Run Detail sections

- run header
  - run id
  - trigger type
  - source
  - status
  - start/end/duration
- affected assets
- step or event timeline
- test results
- error summary
- logs

### Admin Poseidon page sections

- server health
- daemon health
- schedule engine health
- recent global failures
- problematic sensors/schedules
- config/webhook warnings

## Suggested Component Breakdown

Build the UI in a way that keeps the monitor reusable.

Recommended component set:

- `PoseidonDashboardPage`
- `PoseidonSourceDetailPage`
- `PoseidonRunDetailPage`
- `PoseidonLineagePage`
- `PoseidonAdminPage`
- `PoseidonStatusBadge`
- `PoseidonSummaryCard`
- `PoseidonRunTable`
- `PoseidonSourceTable`
- `PoseidonRunTimeline`
- `PoseidonAssetLineage`
- `PoseidonHealthPanel`
- `PoseidonActionBar`

Recommended supporting hooks:

- `usePoseidonDashboard`
- `usePoseidonSource`
- `usePoseidonRun`
- `usePoseidonLineage`
- `usePoseidonAdminStatus`
- `useTriggerPoseidonRun`

Recommended API client grouping:

- `frontend/src/features/poseidon/api/poseidonApi.ts`
- `frontend/src/features/poseidon/hooks/*`
- `frontend/src/features/poseidon/pages/*`
- `frontend/src/features/poseidon/components/*`

## Backend/API Expectations For The Frontend

If the backend does not yet expose these endpoints, the next agent should either:

- implement minimal backend support, or
- stub frontend types and page structure first, clearly marking missing backend dependencies

Ideal API shapes:

- `GET /api/v1/poseidon/dashboard`
- `GET /api/v1/poseidon/sources`
- `GET /api/v1/poseidon/sources/{id}`
- `POST /api/v1/poseidon/sources/{id}/run`
- `GET /api/v1/poseidon/runs`
- `GET /api/v1/poseidon/runs/{id}`
- `GET /api/v1/poseidon/lineage`
- `GET /api/v1/admin/poseidon/status`

Expected response domains:

- source freshness
- schedule metadata
- run state
- trigger type
- asset/table outcomes
- dbt test outcomes
- short error summaries
- global service health

## Implementation Strategy

The next agent should not try to build every Poseidon page at once.

Recommended order:

1. Build the route shell and feature module under `frontend/src/features/poseidon/`
2. Add the **Poseidon Dashboard** page first
3. Add the **Source Detail** page second
4. Add the **Run Detail** page third
5. Add the **Admin Poseidon** page after the ingestion-facing pages exist
6. Add **Lineage** last unless the backend already provides a clean graph payload

## Minimum Useful First Slice

If time is limited, ship this subset first:

- Poseidon Dashboard in Data Ingestion
- Source Detail page
- manual trigger controls
- recent runs list
- freshness/status badges
- Admin Poseidon health page stub

This first slice is enough to make Poseidon understandable and usable.

## Detailed Agent Instructions

The next agent should follow these instructions closely.

### Step 1: Inspect existing app patterns

Before coding:

- inspect current ingestion pages
- inspect current admin dashboards
- inspect existing sync monitor pages
- reuse existing UI patterns for:
  - summary cards
  - status badges
  - run tables
  - page headers
  - action bars

Do not introduce a disconnected visual language.

### Step 2: Create the Poseidon feature module

Add:

- `frontend/src/features/poseidon/api/poseidonApi.ts`
- `frontend/src/features/poseidon/hooks/`
- `frontend/src/features/poseidon/components/`
- `frontend/src/features/poseidon/pages/`

Define strong TypeScript interfaces for:

- dashboard summary
- source record
- run record
- schedule record
- asset record
- test result record
- admin health record

### Step 3: Add routing

Wire routes into the app router.

Target pages:

- Data Ingestion-facing Poseidon landing page
- source detail page
- run detail page
- optional lineage page
- admin Poseidon page

### Step 4: Add navigation entry points

Add:

- a Poseidon entry under the ingestion area
- an admin Poseidon/service health entry under administration

Do not bury Poseidon behind unrelated FHIR or ETL-only pages.

### Step 5: Implement dashboard and source detail first

These are the highest-value pages.

The dashboard must show:

- current issues
- current activity
- stale sources
- failures

The source detail must show:

- the current state
- recent runs
- action buttons
- freshness
- assets/tests/errors

### Step 6: Keep action semantics explicit

Buttons should be unambiguous:

- `Run Incremental Refresh`
- `Run Full Refresh`
- `View Run Detail`
- `Open Lineage`

Avoid vague labels like:

- `Run`
- `Execute`
- `Refresh`

unless context makes them unambiguous.

### Step 7: Use clear operational statuses

Define and standardize frontend status badges around concepts like:

- `running`
- `failed`
- `healthy`
- `stale`
- `scheduled`
- `paused`
- `succeeded`

Keep these visually consistent across all Poseidon pages.

### Step 8: Prefer concise summaries over raw logs

Always show:

- short failure summary
- duration
- source
- trigger type
- affected assets count

before dumping logs or event streams.

### Step 9: If backend gaps block progress

If the backend is not ready:

- still build the page shell
- define types and mock adapters if needed
- leave focused TODO comments
- document missing endpoints in the final handoff

Do not block all frontend progress waiting on perfect backend completeness.

### Step 10: Verification

The next agent should run:

- relevant frontend lint checks
- any route/type checks available in the repo
- focused manual verification of navigation and page rendering

At minimum verify:

- routes load
- nav links work
- loading/empty/error states render
- status badges are readable
- primary actions are clearly placed

## Deliverables Expected From The Next Agent

At completion, the next agent should provide:

- implemented Poseidon frontend module
- routing updates
- nav integration
- at least dashboard + source detail pages
- clear note of any backend/API gaps
- screenshots or a concise visual summary if available

## Final Recommendation

The best elegant version of this feature is:

- **Poseidon Dashboard** and **Source Detail** in Data Ingestion
- **Poseidon Service Health** in Administration
- shared operational visual language with existing sync monitors
- a design that privileges actionability and current-state clarity over backend novelty

That is the agreed direction. The next agent should implement toward that target unless a codebase constraint makes a small route or component adjustment necessary.
