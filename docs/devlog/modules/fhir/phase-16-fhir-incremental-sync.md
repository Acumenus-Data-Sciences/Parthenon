# Phase 16 §16.8–16.12 — FHIR R4 EHR-to-OMOP ETL Pipeline

**Date:** 2026-03-05
**Status:** Complete — all five phases shipped
**Commits:** `0bb55681`, `138ac05f`

---

## Executive Summary

Built a complete, production-grade FHIR R4 Bulk Data pipeline that extracts clinical data from EHR systems (Epic, Cerner, etc.), transforms it through OMOP vocabulary resolution, and loads it into the OMOP CDM — with full incremental sync, deduplication, and real-time monitoring.

This is the core data ingestion pathway for multi-site observational research: a hospital connects once, and Parthenon incrementally ingests their clinical data into the standardized OMOP CDM for cohort building, characterization, and population-level analytics.

---

## Architecture Overview

```
┌──────────────┐   SMART Backend    ┌─────────────┐   $export    ┌──────────────┐
│  EHR System   │◄── Services Auth ──│  Parthenon  │──(async)───►│  FHIR Server │
│ (Epic/Cerner) │    RS384 JWT       │  Backend    │◄──poll──────│  Bulk Export  │
└──────────────┘                     └──────┬──────┘             └──────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  NDJSON Files    │
                                   │  (by resource)   │
                                   └────────┬────────┘
                                            │
                              ┌─────────────▼──────────────┐
                              │  Two-Pass NDJSON Processor  │
                              │                            │
                              │  Pass 1: Patient+Encounter │
                              │    → crosswalk population  │
                              │                            │
                              │  Pass 2: Clinical data     │
                              │    → vocab resolution      │
                              │    → concept-driven routing│
                              │    → dedup check           │
                              │    → CDM write             │
                              └─────────────┬──────────────┘
                                            │
                              ┌─────────────▼──────────────┐
                              │     OMOP CDM Tables        │
                              │  person, visit_occurrence,  │
                              │  condition_occurrence,      │
                              │  drug_exposure, measurement,│
                              │  observation, procedure_occ │
                              └────────────────────────────┘
```

---

## Phase A: FHIR Connection Management (Admin UI)

### What It Does
Provides a full CRUD interface for managing FHIR R4 connections to hospital EHR systems. Each connection stores SMART Backend Services credentials (client ID, RSA private key, token endpoint) and export configuration (Group ID, resource types, scopes).

### Key Components
- **`FhirConnectionsPage.tsx`** — admin page at `/admin/fhir-connections`
- **`ConnectionDialog`** — form for creating/editing connections (site name, vendor, FHIR base URL, token endpoint, client ID, PEM private key, group ID, resource types, scopes)
- **`ConnectionCard`** — displays connection status, key upload indicator, last sync time, expandable details
- **Test Connection** — validates JWT assertion → token exchange → FHIR metadata fetch (3-step verification with timing)
- **Admin nav card** — teal-colored "FHIR EHR Connections" card on Admin Dashboard (superAdminOnly)

### Database
- `fhir_connections` table — site_name, site_key (unique slug), ehr_vendor, fhir_base_url, token_endpoint, client_id, private_key_pem (encrypted), jwks_url, scopes, group_id, export_resource_types, target_source_id, sync_config, is_active, incremental_enabled, last_sync_at/status/records
- `fhir_sync_runs` table — per-run tracking: status, export_url, since_param, resource_types, files_downloaded, records_extracted/mapped/written/failed, mapping_coverage, error_message, started_at/finished_at, triggered_by

### Models
- `FhirConnection` — encrypted PEM via `encrypted` cast, `has_private_key` computed attribute (appended to JSON, key itself hidden), relationships to Source, SyncRuns, User
- `FhirSyncRun` — status lifecycle tracking, belongs to connection and user

---

## Phase B: Bulk Data Extraction Service

### What It Does
Implements the complete FHIR Bulk Data Access (Flat FHIR) specification — authenticates via SMART Backend Services, kicks off async $export requests, polls for completion, and downloads NDJSON output files.

### Services

**`FhirAuthService`**
- Builds RS384 JWT client assertions per the SMART Backend Services spec
- Claims: iss=client_id, sub=client_id, aud=token_endpoint, jti=UUID, exp=+5min
- Exchanges assertion for access token via `client_credentials` grant
- Returns `{access_token, expires_in}`

**`FhirBulkExportService`**
- `startExport()` — kicks off `Group/{id}/$export` or `Patient/$export` with `_type`, `_since`, `_outputFormat` params. Returns Content-Location polling URL from 202 response
- `pollExportStatus()` — polls status URL; returns null (202, still processing) or manifest array (200, complete)
- `downloadNdjsonFiles()` — downloads all NDJSON files from manifest to `storage/fhir-exports/{site_key}/{run_id}/`. Returns `array<string, string[]>` (type → file paths)
- `cleanupFiles()` — removes downloaded NDJSON after processing

**`RunFhirSyncJob`**
- Queued job implementing `ShouldQueue` (4hr timeout, 1 try)
- Orchestrates: authenticate → export → poll → download → process → finalize
- Exponential backoff polling: 10s → 15s → 22s → 33s → ... → 120s max (2hr timeout)
- Status progression: `pending` → `exporting` → `downloading` → `processing` → `completed`/`failed`
- Updates `FhirConnection.last_sync_*` and `FhirSyncRun` metrics at each step
- Cleans up NDJSON files on completion

### API Endpoints
- `POST /admin/fhir-connections/{id}/sync` — trigger sync (accepts `force_full` param)
- `GET /admin/fhir-connections/{id}/sync-runs` — paginated sync history
- Concurrent sync prevention — checks for active runs before dispatching

### Gotcha: `$connection` Property Collision
Laravel's `Queueable` trait defines a `$connection` property (queue connection name). Our job constructor initially used `$connection` for the `FhirConnection` model, causing a fatal "incompatible property" error. Renamed to `$fhirConnection`.

---

## Phase C: NDJSON-to-OMOP Transformation Pipeline

### What It Does
The intelligence layer — takes raw FHIR R4 NDJSON resources and transforms them into properly coded, cross-referenced OMOP CDM rows using vocabulary resolution, concept-driven domain routing, and identity crosswalks.

### Vocabulary Resolution (`VocabularyLookupService`)

Resolves FHIR `coding` arrays to OMOP `concept_id` values using the OMOP vocabulary tables. Implements the HL7 Vulcan IG mapping algorithm:

1. **Direct standard match** — look up code in vocabulary, if `standard_concept = 'S'`, use it
2. **"Maps to" following** — if non-standard, follow `concept_relationship` where `relationship_id = 'Maps to'` to find the standard concept
3. **Unmapped** — `concept_id = 0` with `source_value` preserved

**Priority hierarchy:** SNOMED > LOINC > RxNorm (direct standard vocabularies take precedence over mapped source vocabularies like ICD-10-CM, CPT4)

**12 FHIR code system URIs mapped:**
| FHIR System URI | OHDSI Vocabulary |
|---|---|
| `http://snomed.info/sct` | SNOMED |
| `http://loinc.org` | LOINC |
| `http://www.nlm.nih.gov/research/umls/rxnorm` | RxNorm |
| `http://hl7.org/fhir/sid/icd-10-cm` | ICD10CM |
| `http://hl7.org/fhir/sid/icd-10` | ICD10 |
| `http://hl7.org/fhir/sid/icd-9-cm` | ICD9CM |
| `http://www.ama-assn.org/go/cpt` | CPT4 |
| `http://hl7.org/fhir/sid/ndc` | NDC |
| `http://hl7.org/fhir/sid/cvx` | CVX |
| `http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets` | HCPCS |
| `urn:oid:2.16.840.1.113883.6.238` | Race |
| `urn:oid:2.16.840.1.113883.6.12` | CPT4 |

**Caching:** In-memory LRU with 50K max entries each for concept lookups and "Maps to" lookups — avoids repeated DB queries within a sync run.

### Concept-Driven Domain Routing

Following the HL7 Vulcan IG principle: the vocabulary domain determines the CDM table, not the FHIR resource type name.

| Domain | CDM Table |
|---|---|
| Condition | condition_occurrence |
| Drug | drug_exposure |
| Procedure | procedure_occurrence |
| Measurement | measurement |
| Observation | observation |
| Device | device_exposure |
| Specimen | specimen |

**Example:** A FHIR `Condition` resource coded with a concept whose domain is "Observation" routes to the `observation` table, not `condition_occurrence`. This is correct OMOP behavior.

### Identity Crosswalks (`CrosswalkService`)

OMOP CDM requires integer IDs. FHIR uses string-based resource IDs. Three crosswalk tables bridge this gap:

- `fhir_patient_crosswalk` — `(site_key, fhir_patient_id)` → `person_id` (auto-increment)
- `fhir_encounter_crosswalk` — `(site_key, fhir_encounter_id)` → `visit_occurrence_id` (auto-increment)
- `fhir_provider_crosswalk` — `(site_key, fhir_practitioner_id)` → `provider_id` (auto-increment)

**Get-or-create pattern:** First sync creates mappings; subsequent syncs reuse them. In-memory caching avoids repeated DB lookups.

### FHIR-to-OMOP Mapper (`FhirBulkMapper`)

Maps 10 FHIR R4 resource types to OMOP CDM rows:

| FHIR Resource | Primary CDM Table | Notes |
|---|---|---|
| Patient | person | Gender/race/ethnicity from US Core extensions |
| Encounter | visit_occurrence | Class code → visit_concept_id (AMB→9202, IMP→9201, EMER→9203) |
| Condition | condition_occurrence (or observation) | Concept-driven routing |
| MedicationRequest | drug_exposure | type_concept_id = 32817 (EHR) |
| MedicationStatement | drug_exposure | type_concept_id = 32865 (Patient-reported) |
| MedicationAdministration | drug_exposure | type_concept_id = 32818 (Administered) |
| Procedure | procedure_occurrence | |
| Observation | measurement or observation | Category-based fallback: lab/vitals → measurement |
| DiagnosticReport | measurement | Conclusion as value_as_string |
| Immunization | drug_exposure | |
| AllergyIntolerance | observation | Allergy type as value_as_string |

### Two-Pass Processing (`FhirNdjsonProcessorService`)

**Pass 1:** Process `Patient` + `Encounter` NDJSON files first → populates crosswalk tables with `person_id` and `visit_occurrence_id` mappings.

**Pass 2:** Process all remaining clinical resource types → uses crosswalks to resolve `person_id` and `visit_occurrence_id` references. Without Pass 1 completing first, clinical records would have broken foreign key references.

**Batching:** Rows buffered in memory (500 per table), flushed via batch `INSERT`. On batch failure, falls back to row-by-row insert (skips individual bad rows without losing the entire batch).

---

## Phase D: Sync Monitoring Dashboard

### What It Does
Real-time monitoring of ETL pipeline health across all FHIR connections — aggregate metrics, pipeline throughput visualization, sync activity timeline, and error drill-down.

### Dashboard Page (`/admin/fhir-sync-monitor`)

**Top-level Metrics (6 cards):**
- Connections (active/total)
- Total Runs
- Completed Runs
- Failed Runs
- Records Written (formatted: K/M)
- Average Mapping Coverage

**Pipeline Funnel:**
Visual flow: Extracted → Mapped → Written | Failed — shows all-time throughput with per-stage counts and icons.

**30-Day Sync Activity Timeline:**
Stacked bar chart showing completed (teal) vs failed (red) syncs per day. Hover tooltips with exact counts. Auto-scales to max daily count.

**Connection Health Panel:**
Per-connection status: active indicator, run count, last sync status badge, last sync time. Links to connection management page.

**Recent Runs Table (last 20):**
Cross-connection view with: status badge (animated spinner for active), connection name, start time, duration, metrics (extracted/written/failed), coverage bar, user who triggered, expandable error messages.

### Auto-Refresh
- 10-second refresh when active syncs detected (any run in pending/exporting/downloading/processing)
- 60-second refresh when idle
- SyncRunsPanel on FhirConnectionsPage also auto-refreshes during active syncs

### API Endpoints
- `GET /admin/fhir-sync/dashboard` — aggregate stats, per-connection summaries, recent runs, 30-day timeline
- `GET /admin/fhir-connections/{id}/sync-runs/{runId}` — individual run detail

---

## Phase E: Incremental Sync with Deduplication

### What It Does
After the first full sync, subsequent syncs only request data modified since the last successful sync (`_since` parameter). A content-hash deduplication system prevents duplicate CDM rows and efficiently detects what actually changed.

### `_since` Parameter

The FHIR Bulk Data spec supports `_since` to request only resources modified after a given timestamp. On each sync:

1. If `incremental_enabled = true` AND `last_sync_at` is set AND `force_full = false`:
   - Adds `_since={last_sync_at}` to the `$export` request
   - Records `since_param` on the sync run for audit
2. Otherwise: full export (no `_since`)

### Content-Hash Deduplication (`FhirDedupService`)

**Problem:** Even with `_since`, the FHIR server may re-export resources that haven't meaningfully changed (e.g., metadata-only updates). And a "Force Full Sync" re-downloads everything.

**Solution:** SHA-256 hash of each mapped CDM row, stored in a tracking table:

```
fhir_dedup_tracking
├── site_key                  (e.g., "jhu-epic")
├── fhir_resource_type        (e.g., "Condition")
├── fhir_resource_id          (e.g., "abc-123")
├── cdm_table                 (e.g., "condition_occurrence")
├── cdm_row_id                (PK in CDM table)
├── content_hash              (SHA-256 of mapped data)
├── last_synced_at
└── UNIQUE(site_key, fhir_resource_type, fhir_resource_id)
```

**Three-state dedup check:**

| Status | Action | Effect |
|---|---|---|
| `new` | Insert normally | New CDM row created, tracked |
| `unchanged` | Skip entirely | No DB write — content hash matches |
| `changed` | Delete old CDM row → insert new | Old row removed, new row tracked |

**Performance:**
- Cache warming: loads all tracking records for the site into memory before processing
- Batch upsert: tracking records written in chunks of 500
- Deterministic hashing: `ksort()` + `json_encode()` + SHA-256

### Architecture Decision: CDM-Preserving Dedup

Instead of adding `fhir_source_id` columns to OMOP CDM tables (which would break schema compatibility with OHDSI tools), we use a separate tracking table. The CDM schema remains pure OMOP v5.4 while we maintain the FHIR→CDM mapping externally.

### Force Full Sync

Available via split-button dropdown on each connection card:

- **Incremental Sync** (default when available) — uses `_since`, skips unchanged resources
- **Force Full Sync** — bypasses `_since` (re-downloads everything), but dedup still tracks (prevents duplicates)

The API accepts `POST /admin/fhir-connections/{id}/sync` with `{ "force_full": true }`.

### Frontend Split Button

When a connection has `incremental_enabled = true` AND a previous sync exists:
- Primary button click → incremental sync
- Dropdown chevron → menu with "Incremental Sync" and "Force Full Sync" (amber)

When no previous sync exists or incremental is disabled:
- Button shows "Full Sync" — no dropdown needed

---

## Database Migrations Summary

| Migration | Tables Created |
|---|---|
| `2026_03_05_260001_create_fhir_connections_table` | `fhir_connections`, `fhir_sync_runs` |
| `2026_03_05_270001_create_fhir_crosswalk_tables` | `fhir_patient_crosswalk`, `fhir_encounter_crosswalk`, `fhir_provider_crosswalk` |
| `2026_03_05_280001_create_fhir_dedup_tracking_table` | `fhir_dedup_tracking` |

---

## Complete File Inventory

### Backend — New Files (17)
```
app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php
app/Jobs/Fhir/RunFhirSyncJob.php
app/Models/App/FhirConnection.php
app/Models/App/FhirSyncRun.php
app/Services/Fhir/FhirAuthService.php
app/Services/Fhir/FhirBulkExportService.php
app/Services/Fhir/FhirBulkMapper.php
app/Services/Fhir/FhirNdjsonProcessorService.php
app/Services/Fhir/VocabularyLookupService.php
app/Services/Fhir/CrosswalkService.php
app/Services/Fhir/FhirDedupService.php
database/migrations/2026_03_05_260001_create_fhir_connections_table.php
database/migrations/2026_03_05_270001_create_fhir_crosswalk_tables.php
database/migrations/2026_03_05_280001_create_fhir_dedup_tracking_table.php
```

### Backend — Modified Files
```
routes/api.php  (11 FHIR routes added)
```

### Frontend — New Files (3)
```
src/features/administration/pages/FhirConnectionsPage.tsx
src/features/administration/pages/FhirSyncDashboardPage.tsx
src/features/administration/hooks/useFhirConnections.ts
```

### Frontend — Modified Files
```
src/app/router.tsx  (2 routes: fhir-connections, fhir-sync-monitor)
src/features/administration/api/adminApi.ts  (types + API functions)
src/features/administration/pages/AdminDashboardPage.tsx  (nav card)
```

---

## API Routes (11 total)

```
GET    /admin/fhir-connections                              → index
POST   /admin/fhir-connections                              → store
GET    /admin/fhir-connections/{id}                         → show
PUT    /admin/fhir-connections/{id}                         → update
DELETE /admin/fhir-connections/{id}                         → destroy
POST   /admin/fhir-connections/{id}/test                    → testConnection
POST   /admin/fhir-connections/{id}/sync                    → startSync
GET    /admin/fhir-connections/{id}/sync-runs               → syncRuns
GET    /admin/fhir-connections/{id}/sync-runs/{runId}       → syncRunDetail
GET    /admin/fhir-sync/dashboard                           → syncDashboard
```

---

## Key Gotchas & Lessons Learned

1. **Laravel `$connection` collision** — `Queueable` trait owns `$connection` for queue routing. Any job accepting a model named `$connection` will crash. Always use a distinct name like `$fhirConnection`.

2. **Concept-driven routing ≠ resource type** — A FHIR Condition coded with SNOMED 38341003 (Hypertension) maps to `condition_occurrence`, but one coded with a concept whose domain is "Observation" (e.g., a social determinant) maps to `observation`. The vocabulary domain is the authority, not the resource type.

3. **Two-pass processing is mandatory** — Clinical resources (Condition, MedicationRequest, etc.) reference `Patient/{id}` and `Encounter/{id}` via FHIR references. The crosswalk must already have those mappings or `person_id`/`visit_occurrence_id` resolution returns 0/null. Patient and Encounter MUST be processed first.

4. **CDM schema purity** — Adding custom columns to OMOP CDM tables breaks compatibility with OHDSI tools (Achilles, CohortDiagnostics, etc.). The dedup tracking table is external to CDM, preserving full OHDSI compatibility.

5. **Content hash determinism** — `ksort()` before `json_encode()` ensures the same data always produces the same SHA-256 hash regardless of key ordering in the source array.

6. **Batch insert fallback** — A single malformed row in a 500-row batch would fail the entire INSERT. Row-by-row fallback catches individual failures without losing the entire batch, at the cost of N individual queries.
