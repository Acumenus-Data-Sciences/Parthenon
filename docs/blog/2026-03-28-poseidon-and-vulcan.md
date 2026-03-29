---
slug: poseidon-and-vulcan
title: "Poseidon and Vulcan: The Gods of Continuous Data Ingestion"
description: "Two new engines join the Parthenon pantheon — Vulcan commands the FHIR, while Poseidon rules the tides of transactional data. Together they deliver continuous, incremental, dependency-aware OMOP CDM ingestion."
authors: [mudoshi]
tags: [architecture, ingestion, fhir, dbt, dagster, omop, pipeline]
date: 2026-03-28T18:00:00
---

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/poseidon-vulcan.png" alt="Poseidon and Vulcan — the gods of continuous data ingestion" style={{width: '100%', display: 'block'}} />
</div>

Healthcare data does not arrive in neat packages. It streams — continuously, chaotically, from dozens of transactional systems that were never designed to talk to each other. EHR encounters appear as HL7 ADT messages. Lab results materialize through OBX segments hours after the draw. Radiology reports surface from PACS archives with inconsistent coding. Claims trickle in from clearinghouses days or weeks after the visit. Genomic panels arrive as VCF files from external laboratories with their own nomenclatures and timelines.

Transforming this unruly sea of clinical data into a coherent, research-ready OMOP Common Data Model is the central engineering challenge of any outcomes research platform. And until now, Parthenon handled it the same way most platforms do: as a series of one-time bulk loads. Upload a file. Map the concepts. Write the CDM. Move on.

That era is over.

Today we introduce two new engines to the Parthenon pantheon — **Vulcan** and **Poseidon** — purpose-built for the reality of continuous healthcare data integration.

<!-- truncate -->

## Vulcan: God of the FHIR

In Roman mythology, Vulcan was the god of fire and the forge — the divine craftsman who shaped raw materials into instruments of power. His forge burned at the heart of Mount Etna, transforming crude ore into the weapons and tools that the other gods depended on.

In Parthenon, Vulcan occupies an analogous role. He is the **FHIR integration engine** — the system that connects directly to EHR servers, extracts clinical data through standardized FHIR R4 interfaces, and forges it into OMOP CDM records ready for analysis.

### What Vulcan Does

Vulcan operates through a connection-backed bulk sync architecture. Data stewards attach a registered FHIR server connection to an ingestion project, then trigger incremental or full exports. The pipeline handles the rest:

**FHIR Bulk Data Access ($export)** — Vulcan initiates SMART Backend Services or anonymous bulk export requests against FHIR R4 servers. It manages the asynchronous polling lifecycle — submitting the export, monitoring the status endpoint, downloading NDJSON files when ready, and handling the inevitable timeouts and retries that bulk exports entail.

**Connection Management** — Each FHIR connection is a named configuration: server URL, authentication mode (SMART Backend Services with JWKS, client credentials, or anonymous for public test servers), target resource types, group identifiers for filtered exports, and incremental sync tracking. Connections are registered once by administrators and reused across projects.

**Incremental Sync** — After the initial full export, subsequent syncs request only resources modified since the last successful run. Vulcan tracks the `_since` parameter per connection, ensuring that each sync captures new admissions, updated lab results, and corrected diagnoses without re-processing the entire dataset.

**Workspace Operations Console** — The Vulcan workspace provides real-time visibility into sync operations: connection status, last sync time, record counts, mapping coverage percentages, and a full history of sync runs with extraction and mapping metrics. Sync controls are immediate — one button for incremental refresh, another for full re-export.

**NDJSON Bundle Sandbox** — For ad-hoc validation, Vulcan includes a sandbox mode where individual FHIR bundles or NDJSON files can be uploaded directly for concept mapping spot-checks — useful for verifying that a new server's coding conventions map cleanly before committing to a full sync.

### The Architecture of FHIR at Scale

Vulcan's design reflects the operational reality of FHIR bulk data access. Public test servers like HAPI R4 and Firely are useful for development but unreliable for sustained bulk exports. Production Epic, Cerner, and MEDITECH deployments behave differently — they enforce rate limits, require SMART Backend Services authentication with rotating JWKS keys, and produce NDJSON files that can exceed gigabytes for large patient populations.

Vulcan handles this through a queue-driven architecture. Each sync run dispatches a `RunFhirSyncJob` onto Laravel Horizon's Redis-backed queue. The job manages the full export lifecycle asynchronously — polling status endpoints, downloading resources, mapping FHIR codes to OMOP concepts, and writing CDM records — while the frontend auto-refreshes every 10 seconds to reflect progress. If the export fails or times out, the run is marked with a clear error message and the connection remains ready for retry.

The key insight: FHIR integration in healthcare is inherently asynchronous and failure-prone. Vulcan's architecture embraces this rather than fighting it. Every operation is resumable, every failure is visible, and every run produces an auditable record of what was extracted, what was mapped, and what was written.

## Poseidon: Ruler of the Data Seas

Where Vulcan commands the fire of FHIR, Poseidon rules the seas — the vast, churning ocean of transactional data that flows from every clinical system in the enterprise.

In mythology, Poseidon wielded his trident to control the waves, calm storms, and shake the earth itself. In Parthenon, Poseidon is the **CDM refresh orchestration engine** — powered by **dbt** (Data Build Tool) for SQL-based transformations and **Dagster** for dependency-aware scheduling and observability. He takes the raw data that Aqueduct stages and transforms it into a living, breathing OMOP CDM that stays current as the underlying sources change.

### Why Poseidon Exists

Aqueduct — Parthenon's existing ingestion pipeline — handles the initial ETL brilliantly: file upload, profiling, AI-assisted concept mapping, schema mapping, and CDM writing. But Aqueduct operates on a batch paradigm. You upload data, map it, write it, and the job is done.

Healthcare data sources are not batch systems. EHR databases accumulate new encounters hourly. LIMS systems process lab results continuously. PACS archives ingest imaging studies around the clock. Claims feeds arrive on weekly or monthly cycles. Each of these sources produces data that must flow into the CDM incrementally — without duplicating existing records, without violating foreign key constraints, and without requiring a full rebuild every time.

This is the problem Poseidon was designed to solve.

### The dbt Transformation Layer

At Poseidon's core is a **dbt project** — a collection of SQL-based models that define how raw staged data transforms into OMOP CDM tables. Each CDM table (person, visit_occurrence, condition_occurrence, drug_exposure, measurement, observation, procedure_occurrence, and more) is a dbt model with:

**Incremental Materialization** — Poseidon's models use dbt's `incremental` materialization strategy with `merge` semantics. On each run, only new or modified records are processed. The `WHERE modified_date > last_run_date` filter ensures that a nightly refresh of a million-patient CDM processes only the day's new encounters — not the entire history.

**Dependency-Aware Execution** — dbt understands the directed acyclic graph (DAG) of table dependencies. `person` must load before `visit_occurrence`. Visits must exist before `condition_occurrence` can reference them via foreign keys. `observation_period` depends on the union of all clinical event tables. Poseidon respects this dependency graph automatically — no manual ordering, no failed runs from FK violations.

**Schema Tests** — Every CDM model carries built-in data quality assertions: not-null constraints on required fields, uniqueness checks on primary keys, foreign key relationships validated against the vocabulary and person tables, accepted-value checks on concept IDs, and temporal plausibility tests (no events before birth, no events after death). These tests run as part of every refresh, catching data quality issues before they propagate into analyses.

**Vocabulary-Aware Transformations** — Poseidon's custom macros (`concept_lookup`, `standard_concept`) perform source-to-standard concept mapping within dbt SQL. Source codes from EHR systems are resolved to standard OMOP concepts through the shared vocabulary schema — the same vocabulary that powers Parthenon's Concept Explorer and Hecate semantic search.

**Schema Routing** — A custom `generate_schema_name` macro routes each model to the correct PostgreSQL schema per source. The same dbt models can produce CDM tables in `omop`, `synpuf`, `irsf`, `pancreas`, or any other source schema — controlled by a single variable at run time.

### The Dagster Orchestration Layer

dbt handles the what — Dagster handles the when, how, and what-if:

**Software-Defined Assets** — Every CDM table is a Dagster asset backed by a dbt model. Dagster tracks the materialization state of each asset — when it was last refreshed, whether the refresh succeeded, and what downstream assets depend on it. The asset graph provides a complete lineage view from staging tables through intermediate transformations to final CDM tables.

**Per-Source Scheduling** — Different data sources have different cadences. EHR feeds might refresh nightly at 2 AM. LIMS data might arrive hourly. Claims feeds might land weekly. Poseidon supports per-source cron schedules, each with its own cadence, dbt selector (e.g., `tag:ehr` or `source:staging_acumenus`), and activation state.

**Event-Driven Sensors** — Beyond cron schedules, Poseidon can watch for events: new rows in a staging table, a FHIR webhook notification from Vulcan, or a file drop in a monitored directory. When the sensor fires, Poseidon automatically triggers the appropriate refresh pipeline.

**Manual Triggers** — Data stewards can trigger incremental or full refreshes on demand through the Poseidon operations console — useful for ad-hoc loads, post-mapping corrections, or testing new source integrations.

### The Operations Console

Poseidon's frontend is a single-page operations console designed for the daily reality of data stewardship — not a DevOps dashboard, but a clinical data control tower:

**Overview Metrics** — Active schedules, runs in progress, success/failure counts at a glance.

**Source Schedules** — Each configured source shows its schedule type (cron, sensor, or manual), cron expression, last run time, next scheduled run, and run count. Activate, pause, or trigger runs directly from the schedule card.

**Recent Runs** — A live table of recent pipeline executions with source, run type, status, trigger method, and duration. Click any run to expand inline details: rows inserted, rows updated, models materialized, tests passed and failed, and full error messages for failed runs.

**CDM Freshness** — A grid view of every CDM asset with its last materialization timestamp. Stale assets (not refreshed in 24+ hours) are highlighted in gold — immediately visible, immediately actionable.

**Asset Lineage** — A tiered dependency view showing the flow from staging through intermediate transformations to CDM tables and quality models. Not a decorative graph — a diagnostic tool for understanding impact when a source fails or a model changes.

## How They Work Together

Vulcan and Poseidon are not competing systems. They occupy different positions in the data lifecycle and are designed to complement each other:

```
EHR / FHIR Server
      |
      v
  [ Vulcan ]  ------>  FHIR Bulk Export  ------>  Staged Data
                                                      |
Flat Files / DB                                       |
      |                                               v
      v                                        [ Poseidon ]
  [ Aqueduct ]  ------>  Profiling + Mapping         |
      |                                               v
      v                                     Incremental CDM
  Staged Data  -------------------------------->  Refresh
                                                      |
                                                      v
                                              OMOP CDM Tables
                                                      |
                                                      v
                                            Achilles / DQD / Analyses
```

**Vulcan** handles the FHIR-specific integration layer: connecting to servers, managing authentication, handling the bulk export lifecycle, and staging FHIR resources as relational data. Once staged, the data enters the same pipeline as any other source.

**Poseidon** handles the transformation layer: taking staged data from any source (Vulcan, Aqueduct file uploads, direct database connections) and maintaining the CDM through incremental, dependency-aware, vocabulary-mapped, quality-tested refreshes.

**Aqueduct** remains the one-time bulk ETL tool: file upload, profiling, AI-assisted concept mapping, schema mapping, and initial CDM writing. It is the craftsman's workshop where new data sources are onboarded. Once the mappings are confirmed, Poseidon takes over for ongoing maintenance.

Together, they transform Parthenon from a platform that receives data to one that continuously integrates it — a living analytical environment where the CDM reflects the current state of the clinical enterprise, not a snapshot from the last quarterly load.

## The Naming Convention

Parthenon's feature naming follows the architecture of classical mythology:

| Feature | Namesake | Domain |
|---------|----------|--------|
| **Parthenon** | The temple of Athena | The platform itself — wisdom through evidence |
| **Aqueduct** | Roman water engineering | Bulk data ingestion and ETL pipelines |
| **Vulcan** | God of fire and the forge | FHIR integration — forging interoperability standards into CDM |
| **Poseidon** | God of the sea | Continuous data orchestration — commanding the waves of transactional data |
| **Achilles** | Greatest warrior of Troy | Data characterization — relentless, thorough, exhaustive |
| **Hecate** | Goddess of crossroads | Semantic vocabulary search — navigating the intersections of meaning |
| **Abby** | (Athena's owl) | AI assistant — intelligence through accumulated knowledge |
| **Ares** | God of war | Data quality dashboard — aggressive defense of data integrity |

Each name is chosen not just for flavor but for functional resonance. Vulcan forges raw FHIR resources into structured CDM records. Poseidon governs the tidal rhythms of data flow. The names tell you what each system does if you know the mythology — and they make the platform memorable for those who don't.

## What This Means for Research

The practical impact of continuous ingestion is profound:

**Near-real-time cohort surveillance** — Cohort definitions that previously reflected quarterly snapshots now reflect yesterday's admissions. Researchers can monitor recruitment criteria as patients enter the system, not after the fact.

**Faster time to analysis** — When a new data source is onboarded through Aqueduct and handed off to Poseidon, subsequent updates are automatic. The analyst's CDM stays current without manual intervention.

**Reduced data engineering burden** — Data stewards configure a schedule once. Poseidon handles the recurring execution, monitors for failures, and surfaces freshness issues. The human role shifts from executing pipelines to overseeing them.

**Improved data quality** — Every Poseidon refresh runs dbt's built-in schema tests and custom quality assertions. Data quality is validated on every load, not as an afterthought.

**Auditable provenance** — Every sync run, every CDM refresh, every test outcome is recorded. When a researcher asks "when was this data last updated?" or "did any quality checks fail?", the answer is one click away.

## Looking Ahead

Vulcan and Poseidon represent Phase 1 and Phase 5 of a six-phase implementation plan. The remaining phases will add:

- **Core dbt models** covering all 20+ OMOP CDM clinical tables with incremental materialization
- **Dagster sensors and schedules** for fully automated, event-driven pipeline execution
- **Aqueduct-to-Poseidon handoff** — confirmed mappings automatically generate dbt models
- **Production hardening** — retry policies, alerting, run history management, and Dagit UI proxy

The gods have taken their stations. The data flows.

---

*Vulcan and Poseidon are available now in Parthenon's Data Ingestion module. Navigate to the Poseidon or Vulcan tabs to begin configuring continuous ingestion for your data sources.*
