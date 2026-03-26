# Ingestion Page Redesign — Connect to Database + Upload Files

**Date:** 2026-03-26
**Status:** Approved

## Overview

Rename the "Upload Files" tab to "Ingestion" and split it into two columns: "Connect to Database" (left) and "Upload Files" (right). This gives users two paths to bring data into an Ingestion Project — connect directly to a source database or upload flat files. Both paths feed into the same project and downstream pipeline (BlackRabbit profiling, Aqueduct mapping, CDM load).

## Page Layout

The ProjectDetailView content area splits into two equal columns within the existing file upload section.

### Left Column: Connect to Database

**Empty state:** A "Connect to Database" button centered in the column.

**Modal (on button click):**
1. DB Type dropdown — all 12 HADES dialects (PostgreSQL, SQL Server, Oracle, MySQL, MariaDB, BigQuery, Redshift, Snowflake, Spark/Databricks, DuckDB, SQLite, Synapse)
2. Host/IP text input
3. Port number input (auto-filled with dialect default)
4. Username text input
5. Password text input (masked)
6. Database text input
7. Schema text input
8. "Test Connection" button — validates connectivity, on success fetches table list
9. Table list with checkboxes — shows all tables in the schema with row counts if available
10. Select All / Deselect All toggle
11. "Confirm" and "Cancel" buttons at the bottom

**Connected state (after confirm):** The left column shows:
- Connection summary line (e.g., "PostgreSQL — host.internal/parthenon — synthetic_ehr")
- List of selected tables with names
- "Change" button to reopen the modal with current settings pre-filled
- "Disconnect" button to clear the connection

### Right Column: Upload Files

Existing MultiFileUploadZone + FileReviewList — no changes to behavior. Drag-and-drop CSV/TSV/Excel files, assign table names, stage.

### Both Columns

Both paths feed into the same IngestionProject. A project can have database-connected tables, uploaded files, or both. The existing "Stage" / proceed mechanism triggers:
- For DB tables: BlackRabbit scan on selected tables → creates IngestionJobs + SourceProfiles
- For uploaded files: existing StageFileJob pipeline (unchanged)

## Backend Changes

### Migration

Add two nullable columns to `ingestion_projects`:
- `db_connection_config` — `text` column, `encrypted:array` cast. Stores: `{dbms, host, port, user, password, database, schema}`. Encrypted at rest per HIGHSEC.
- `selected_tables` — `jsonb` column, `array` cast. Stores: `["patient", "visit", ...]`

### New Endpoints

**POST /ingestion-projects/{id}/connect-db**

Request:
```json
{
  "dbms": "postgresql",
  "host": "host.docker.internal",
  "port": 5432,
  "user": "smudoshi",
  "password": "acumenus",
  "database": "parthenon",
  "schema": "synthetic_ehr"
}
```

Behavior:
1. Build a BlackRabbit-compatible connection payload (`server` = `host/database`)
2. POST to BlackRabbit `/scan` with `tables: []` (or a lightweight schema-only endpoint) — actually, use SQLAlchemy reflection via a new BlackRabbit endpoint
3. Return the list of tables with column counts

Response:
```json
{
  "data": {
    "connected": true,
    "tables": [
      {"name": "patient", "column_count": 20},
      {"name": "visit", "column_count": 21},
      ...
    ]
  }
}
```

Save connection config (encrypted) to the project's `db_connection_config` field.

**POST /ingestion-projects/{id}/confirm-tables**

Request:
```json
{
  "tables": ["patient", "visit", "encounter_diagnosis", "lab_result"]
}
```

Behavior: Save selected tables to `selected_tables` field on the project.

**POST /ingestion-projects/{id}/stage-db**

Behavior:
1. Read `db_connection_config` and `selected_tables` from the project
2. POST to BlackRabbit `/scan` with the connection details and selected tables
3. Wait for scan completion (poll `/scan/{id}/result`)
4. For each table in the result, create an IngestionJob + SourceProfile with field profiles
5. Update project status to 'profiling' → 'ready'

Response: Same shape as the existing `stage` endpoint — returns job IDs.

### New BlackRabbit Endpoint

**POST /tables** — Lightweight schema inspection (no profiling)

Request: Same connection payload as `/scan`

Response:
```json
{
  "tables": [
    {"name": "patient", "column_count": 20, "row_count": 1000},
    {"name": "visit", "column_count": 21, "row_count": 4014},
    ...
  ]
}
```

This uses SchemaInspector + a quick `COUNT(*)` per table. Much faster than a full scan since it skips column profiling.

### RBAC

All new endpoints use existing `permission:ingestion.upload` middleware (same as the file staging endpoint).

## Frontend Changes

### Modified Files

- `frontend/src/features/ingestion/pages/DataIngestionPage.tsx` — rename tab from "Upload Files" to "Ingestion"
- `frontend/src/features/ingestion/components/ProjectDetailView.tsx` — split upload section into two columns

### New Components

- `frontend/src/features/ingestion/components/ConnectDatabaseButton.tsx` — the "Connect to Database" button + connected state display
- `frontend/src/features/ingestion/components/ConnectDatabaseModal.tsx` — connection form, test, table selection, confirm/cancel
- `frontend/src/features/ingestion/components/SelectedTablesPanel.tsx` — shows selected tables after connection confirmed

### New API Functions

- `connectDatabase(projectId, config)` — POST `/ingestion-projects/{id}/connect-db`
- `confirmTables(projectId, tables)` — POST `/ingestion-projects/{id}/confirm-tables`
- `stageDatabase(projectId)` — POST `/ingestion-projects/{id}/stage-db`

### New Hooks

- `useConnectDatabase(projectId)` — mutation for testing connection
- `useConfirmTables(projectId)` — mutation for saving table selection
- `useStageDatabase(projectId)` — mutation for triggering DB staging

## What Doesn't Change

- File upload path (right column) — MultiFileUploadZone, FileReviewList, StageFileJob
- Aqueduct integration — still reads from SourceProfiles regardless of origin
- Staging preview — works for both DB-sourced and file-sourced tables
- PII detection — runs on all SourceProfiles after profiling
- Scan comparison — works on any SourceProfile
- BlackRabbit core service — only adds one new `/tables` endpoint
- Source registration — Sources remain CDM-only, never created from ingestion
