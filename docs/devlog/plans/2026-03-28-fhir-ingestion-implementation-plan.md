# FHIR Ingestion in Data Ingestion — Implementation Plan

**Date:** 2026-03-28  
**Status:** Proposed

## Why This Plan Exists

Parthenon already contains substantial FHIR ingestion infrastructure, but it is split across two different paths:

1. **Legacy interactive FHIR upload flow**
   - `frontend/src/features/ingestion/pages/DataIngestionPage.tsx` mounts `@/features/etl/pages/FhirIngestionPage`
   - `frontend/src/features/etl/pages/FhirIngestionPage.tsx` supports pasted Bundle JSON and uploaded NDJSON
   - `backend/app/Http/Controllers/Api/V1/FhirToCdmController.php` proxies requests to an external `fhir-to-cdm` sidecar
   - This is useful for demos and ad hoc testing, but it is not the repo's strongest production ingestion path

2. **First-party bulk-sync FHIR pipeline**
   - `backend/app/Services/Fhir/*`
   - `backend/app/Jobs/Fhir/RunFhirSyncJob.php`
   - `backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php`
   - This path already has SMART Backend Services auth, Bulk FHIR export, NDJSON download, two-pass processing, crosswalks, vocabulary resolution, incremental sync, deduplication, and sync monitoring

The research in [docs/research/omop-on-fhir-landscape-2026.md](/home/smudoshi/Github/Parthenon/docs/research/omop-on-fhir-landscape-2026.md) and the shipped FHIR sync implementation in [docs/devlog/modules/fhir/phase-16-fhir-incremental-sync.md](/home/smudoshi/Github/Parthenon/docs/devlog/modules/fhir/phase-16-fhir-incremental-sync.md) point to the same conclusion: **Parthenon should treat the first-party bulk-sync pipeline as the canonical production FHIR ingestion pathway**.

## Current-State Findings

### What exists already

- The repo already implements the hard backend parts needed for production FHIR ingestion:
  - FHIR connection management
  - SMART Backend Services authentication
  - Bulk export orchestration
  - NDJSON processing into OMOP CDM
  - Vocabulary-based concept routing
  - Crosswalk tables for person, visit, provider, location, and care_site
  - Incremental sync and SHA-256 dedup

- The Data Ingestion section already has a dedicated FHIR tab:
  - [DataIngestionPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/pages/DataIngestionPage.tsx)

- The existing ingestion project model already unifies file upload and database-connection workflows:
  - [IngestionProject.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/IngestionProject.php)
  - [2026-03-26-ingestion-page-redesign.md](/home/smudoshi/Github/Parthenon/docs/superpowers/specs/2026-03-26-ingestion-page-redesign.md)

### What is missing

- `ingestion_projects` has no notion of an attached FHIR source, connection, or sync run
- The FHIR tab is not integrated with the ingestion project workflow
- The UI exposed under Data Ingestion is still oriented around direct paste/upload, not connection-driven institutional sync
- The legacy sidecar flow and the first-party pipeline overlap but do not share state, RBAC, history, or metrics
- Documentation is inconsistent:
  - [17b-fhir-ingestion.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part5-ingestion/17b-fhir-ingestion.mdx) documents older endpoints and a standalone tool mental model
  - Actual routes include `/api/v1/etl/fhir/*` for the sidecar path and `/api/v1/admin/fhir-connections/*` plus `/api/v1/admin/fhir-sync/dashboard` for the first-party path

## Decision

### Canonical path

Use the **first-party Laravel FHIR bulk-sync pipeline** as the production FHIR ingestion implementation in Data Ingestion.

### Role of the existing sidecar upload tool

Keep the current bundle/NDJSON upload tool only as one of these:

1. **A test/sandbox utility** for local debugging and small-sample mapper validation, or
2. **A temporary compatibility surface** until the project-based FHIR workspace is complete

It should no longer be presented as the primary production FHIR ingestion workflow.

## Product Shape

The FHIR tab in Data Ingestion should become a **project-based FHIR workspace** that matches the rest of the ingestion surface.

### User model

- **Super admin**
  - Creates and manages FHIR connections in Admin
  - Tests credentials and configures export parameters

- **Admin / data steward**
  - Attaches an approved FHIR connection to an ingestion project
  - Triggers syncs from Data Ingestion
  - Reviews sync status, mapping coverage, failures, and table-level results

### Workspace model

Each ingestion project can have one or more acquisition modes over time:

- Uploaded files
- Connected source database
- FHIR connection

FHIR should become another first-class project input, not a separate application.

## Scope

### In scope

- Integrate FHIR ingestion into `ingestion_projects`
- Expose connection-backed sync operations in the Data Ingestion FHIR tab
- Reuse existing first-party sync pipeline and monitoring data
- Add project-level state, history, and status for FHIR runs
- Update docs and route contracts

### Out of scope

- Replacing the underlying `backend/app/Services/Fhir/*` pipeline
- Rewriting mapper logic already shipped in Phase 16 unless a gap blocks project integration
- Implementing full HL7 IG parity beyond what is required for the project-based workflow
- Building real-time streaming or subscription-based FHIR ingestion

## Proposed Architecture

### Backend

Add project-level linkage from ingestion projects to the existing FHIR connection and sync-run infrastructure.

#### Schema changes

Extend `ingestion_projects` with:

- `fhir_connection_id` nullable FK to `fhir_connections`
- `fhir_sync_mode` string or enum
  - `bulk_group`
  - `patient_export`
  - `sandbox_upload` if the legacy uploader is retained inside the project workflow
- `fhir_config` encrypted JSON
  - project-specific resource selections
  - optional `_since` override behavior
  - sync labels or notes
- `last_fhir_sync_run_id` nullable FK to `fhir_sync_runs`
- `last_fhir_sync_at` nullable timestamp
- `last_fhir_sync_status` nullable string

If project linkage should be queryable from the sync side as well, also add:

- `ingestion_project_id` nullable FK on `fhir_sync_runs`

That makes run history project-aware without changing the existing connection-centric model.

#### New API surface

Add ingestion-project endpoints under the existing project namespace, for example:

- `GET /api/v1/ingestion-projects/{project}/fhir`
- `POST /api/v1/ingestion-projects/{project}/fhir/attach-connection`
- `POST /api/v1/ingestion-projects/{project}/fhir/sync`
- `GET /api/v1/ingestion-projects/{project}/fhir/sync-runs`
- `GET /api/v1/ingestion-projects/{project}/fhir/sync-runs/{run}`

These endpoints should orchestrate existing services rather than duplicate sync logic.

#### Service-layer principle

Do not create a second mapper or second bulk processor.

Instead:

- keep `FhirConnectionController` for admin lifecycle management
- extract any controller-only sync startup logic into a reusable application service if needed
- let project endpoints dispatch the same `RunFhirSyncJob`
- persist project metadata around runs and summarize run results back into the project

## Frontend Plan

Replace the current FHIR tab content inside Data Ingestion with a project-aware page.

### New page behavior

For the selected ingestion project, the FHIR tab should show:

1. **Connection state**
   - no connection attached
   - attached connection summary
   - last sync status

2. **Sync controls**
   - trigger incremental sync
   - trigger full sync
   - optional resource-type override if allowed by role

3. **Recent run history**
   - started at
   - duration
   - extracted / mapped / written / failed
   - mapping coverage
   - error summary

4. **Operational drill-down**
   - resource files downloaded
   - table counts written
   - skipped / updated counts for incremental mode

5. **Fallback sandbox mode**
   - only if the legacy upload flow is retained
   - clearly labeled as sample validation or local testing, not production ingestion

### Frontend file strategy

Expected new or modified files:

- `frontend/src/features/ingestion/pages/DataIngestionPage.tsx`
- new project-aware FHIR page under `frontend/src/features/ingestion/pages/`
- `frontend/src/features/ingestion/api/ingestionApi.ts`
- new FHIR ingestion hooks in `frontend/src/features/ingestion/hooks/`

The existing ETL feature implementation should either:

- be migrated into reusable components, or
- remain mounted only behind a clearly separate sandbox/test entry point

## Phased Delivery

## Phase 1: Unify the model

Goal: make FHIR a first-class ingestion project input.

Deliverables:

- migration for project-level FHIR linkage
- Eloquent relationships on `IngestionProject`, `FhirConnection`, and `FhirSyncRun`
- project-scoped FHIR API endpoints
- backend tests for attach, start sync, and fetch run history

## Phase 2: Replace the tab stub with a project workspace

Goal: the Data Ingestion FHIR tab becomes useful without leaving the ingestion project flow.

Deliverables:

- new FHIR project panel/page
- connection attach UI
- run trigger UI
- sync history and status cards
- loading, error, and empty states

## Phase 3: Reconcile the legacy upload flow

Goal: eliminate ambiguity about which FHIR ingestion path is canonical.

Choose one:

1. Move the current bundle/NDJSON uploader into a clearly labeled sandbox panel within the project FHIR workspace
2. Move it out of Data Ingestion entirely and expose it as a developer/admin tool
3. Remove it once equivalent project-scoped validation exists

My recommendation is option 1 first, then option 2 or 3 after usage confirms it is no longer needed.

## Phase 4: Documentation and contract cleanup

Goal: remove stale mental models and stale endpoint documentation.

Deliverables:

- update [17b-fhir-ingestion.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part5-ingestion/17b-fhir-ingestion.mdx)
- update [17c-etl-tools.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part5-ingestion/17c-etl-tools.mdx)
- document the difference between:
  - connection-backed production sync
  - sandbox bundle/NDJSON validation, if retained
- fix endpoint references to match actual route prefixes

## Phase 5: IG-aligned hardening

Goal: use the HL7/Vulcan guidance to strengthen the integrated workflow rather than leaving it as a backend-only concern.

Deliverables:

- expose mapping coverage in terms meaningful to stewards
- add surfaced warnings for unmapped vocabularies and concept_id `0` rates
- add resource-type/table-level quality summaries per run
- identify any remaining field-level IG compliance gaps that block operational use

This phase should consume the existing IG work in:

- [2026-03-11-fhir-omop-ig-compliance-design.md](/home/smudoshi/Github/Parthenon/docs/devlog/specs/2026-03-11-fhir-omop-ig-compliance-design.md)

## Testing Plan

### Backend

- request tests for new ingestion-project FHIR endpoints
- queue/job tests for project-linked sync dispatch
- sync run persistence tests
- authorization tests across super-admin, admin, and data-steward roles

### Frontend

- component tests for empty, attached, syncing, completed, and failed states
- API hook tests
- route-level regression for `/ingestion?tab=fhir`

### End-to-end

- attach connection to project
- trigger sync
- observe run lifecycle in the project UI
- confirm metrics match `fhir_sync_runs`

## Risks and Constraints

### Risk: three overlapping ingestion concepts

Parthenon already has:

- file ingestion
- database-connected ingestion
- FHIR connection management in Admin

If FHIR is added to Data Ingestion without being anchored to `ingestion_projects`, the product will gain a third disconnected workflow. This plan avoids that.

### Risk: RBAC mismatch

FHIR connection setup is currently super-admin only. Data Ingestion is broader. The project workflow must distinguish:

- who can create/edit connection credentials
- who can attach an approved connection to a project
- who can trigger syncs

### Risk: stale docs and API drift

The current documentation describes a standalone tool and endpoint contract that no longer matches the best architecture. This should be cleaned up in the same implementation cycle.

## Recommended Order of Execution

1. Add project-level FHIR linkage in the backend data model
2. Add project-scoped FHIR endpoints that reuse the existing sync pipeline
3. Build the project-aware FHIR tab UI in Data Ingestion
4. Reposition the current upload-based FHIR page as sandbox or retire it
5. Update docs to reflect the canonical workflow

## Summary

The repo does **not** need a brand-new FHIR ingestion engine. It already has one.

What is needed is product integration:

- connect the existing first-party FHIR sync pipeline to `ingestion_projects`
- make the Data Ingestion FHIR tab project-aware
- stop presenting the legacy sidecar uploader as the primary production path
- align docs, routes, and UI around one canonical workflow

That gives Parthenon a coherent FHIR ingestion story: **admin-configured connection, project-level sync, OMOP load, run visibility, and downstream ETL integration in one place**.
