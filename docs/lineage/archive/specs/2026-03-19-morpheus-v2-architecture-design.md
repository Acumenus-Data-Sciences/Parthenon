# Morpheus v2 — Inpatient Analytics Workbench Architecture Design

**Date:** 2026-03-19
**Status:** Approved
**Author:** Dr. Sanjay Udoshi + Claude
**Module:** Morpheus (Parthenon Inpatient Workbench)

---

## 1. Problem Statement

Parthenon needs an inpatient analytics workbench that can ingest real-world EHR data from any vendor (Epic, Cerner, Meditech), de-identify it for research use, transform it into OMOP CDM 5.4, and serve it through a clinical analytics UI covering ICU outcomes, bundle compliance, perioperative workflows, patient flow, microbiology, safety, process mining, and predictive modeling.

Existing tools (OHDSI Atlas, WebAPI) don't handle real-world inpatient data richness — they lack perioperative workflows, real-time patient flow, safety events, and AI-powered de-identification. MIMIC-IV (the standard research dataset) is a thin, de-identified slice that misses the operational depth of production EHR data.

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pipeline relationship | Separate pipeline, shared services | Real-world EHR ingestion is batch/automated, fundamentally different from Parthenon's interactive CSV upload flow |
| De-ID boundary | Abby de-IDs before Parthenon enters | Honest broker model: PHI never touches the research environment |
| De-ID strategy | Streaming for structured data, staged NLP for notes | Structured fields can be de-identified in-flight; clinical notes need multi-pass NLP with human review |
| Honest broker database | `abby-hb` — dedicated, hardened PostgreSQL | Physical isolation of crosswalk and audit trail from research data |
| First EHR sources | FHIR R4 Bulk Export + HL7v2 ADT | Vendor-neutral (ONC-mandated), covers batch clinical data + real-time patient movement |
| Vocabulary strategy | Shared `omop.*` | Single source of truth, no duplication of 139M rows |
| Deployment model | Docker for dev, separate host for production PHI | Pragmatic: easy development, strong isolation when real data involved |
| Service architecture | Three-service mesh | Clean separation: de-ID (abby-hb), ingestion (morpheus-ingest), analytics (Parthenon) |

## 3. Architecture Overview

### 3.1 Service Mesh

Three services with clean boundaries:

**Service 1: `abby-hb`** (Python FastAPI, port 8003)
- Receives raw EHR data (PHI-authorized endpoint)
- Detects PHI in structured fields and clinical notes
- De-identifies: date shift, pseudonymize, redact notes
- Maintains encrypted crosswalk vault
- Audit logs every PHI operation
- Emits clean data to morpheus-ingest via HTTP
- Scores re-identification risk
- Own database: `abby-hb` (separate PostgreSQL instance)
- Does NOT: store clinical data, run analytics, serve UI

**Service 2: `morpheus-ingest`** (Python FastAPI, port 8004)
- Source adapters (FHIR R4, HL7v2, MIMIC-IV, generic CSV)
- Canonical staging (vendor-neutral intermediate tables)
- OMOP mapper (staging → CDM 5.4 via `omop.*` vocabulary)
- Extension mapper (staging → `inpatient_ext.*` tables)
- Quality gates (DQD checks, mapping coverage, validation)
- Batch orchestration and progress tracking
- Concept gap tracking (unmapped codes → Abby for suggestions)
- Database: `parthenon` (schemas: `inpatient_staging`, `inpatient`, `inpatient_ext`)
- Does NOT: handle PHI, de-identify, serve analytics UI

**Service 3: Parthenon** (existing Laravel + existing `ai/` service)
- Laravel API routes (`/api/v1/morpheus/*`) for workbench UI
- React frontend (`features/morpheus/`)
- Abby AI integration for NL queries, concept suggestions
- Prediction model serving (via `ai/` service + ONNX)
- Process mining APIs
- Cohort builder integration with Studies module
- Reads from: `inpatient.*`, `inpatient_ext.*`, `omop.*` vocabulary
- Does NOT: ingest EHR data directly, handle PHI

### 3.2 Boundary Rules

1. Raw PHI only enters `abby-hb`. Period.
2. `morpheus-ingest` only receives pre-cleaned data from `abby-hb` (or already de-identified data like MIMIC-IV directly).
3. Parthenon/Laravel only reads finished OMOP data for analytics and UI.
4. The `omop.*` vocabulary is read by both `morpheus-ingest` (for mapping) and Parthenon (for display/search).

## 4. Database Schema Layout

### 4.1 `abby-hb` Database (separate PostgreSQL instance)

```
abby-hb
├── vault.crosswalk          — Encrypted: real_id ↔ pseudo_id, per-source
├── vault.date_shift         — Encrypted: person_pseudo_id → shift_days (±180)
├── staging.phi_note         — Temporary: raw clinical notes awaiting NLP de-ID
├── audit.deid_log           — Immutable: every PHI element detected/transformed
├── audit.access_log         — Immutable: every crosswalk lookup
└── config.source_registry   — Which EHR sources are registered for de-ID
```

**Protection profile:**
- Separate PostgreSQL instance (not Parthenon's Docker postgres, not the host PG 17)
- `pgcrypto` for column-level encryption on crosswalk fields
- TLS required for all connections
- Dedicated service account — only Abby's de-ID service connects
- No access from Laravel, frontend, or R runtime
- Connection credentials in secrets manager, not `.env` files
- WAL archiving for audit log (append-only, no DELETE or TRUNCATE permitted)
- Auto-purge on PHI staging (72h after de-ID completion + verification)

### 4.2 `parthenon` Database (existing, new schemas added)

```
parthenon
├── omop.*                   — Shared OMOP vocabulary (single source of truth)
│   ├── concept, concept_relationship, concept_ancestor
│   ├── vocabulary, domain, concept_class, relationship
│   ├── concept_synonym, drug_strength
│   └── source_to_concept_map (includes Abby-generated custom mappings)
│
├── inpatient_staging.*      — Canonical staging layer (vendor-neutral, transient)
│   ├── stg_patient, stg_encounter, stg_condition
│   ├── stg_procedure, stg_drug, stg_measurement
│   ├── stg_note, stg_device, stg_specimen, stg_microbiology
│   ├── stg_surgical_case, stg_case_timeline
│   ├── stg_transport, stg_safety_event, stg_bed_census
│   └── concept_gap (unmapped source codes for review)
│
├── inpatient.*              — OMOP CDM 5.4 clinical tables (standard)
│   ├── person, visit_occurrence, visit_detail
│   ├── condition_occurrence, procedure_occurrence
│   ├── drug_exposure, measurement, observation
│   ├── note, note_nlp, specimen, death
│   ├── device_exposure, cost, payer_plan_period
│   ├── condition_era, drug_era, dose_era
│   ├── episode, episode_event, observation_period
│   ├── fact_relationship, care_site, location, provider
│   └── cdm_source, cohort, cohort_definition
│
├── inpatient_ext.*          — Morpheus extension tables
│   ├── Perioperative: surgical_case, case_timeline, case_metrics
│   ├── ICU: icu_stay, bundle_card, bundle_assessment, vitals_ts
│   ├── Patient Flow: transport, bed_census, care_milestone
│   ├── Safety & Quality: safety_event, quality_measure
│   ├── Microbiology: antibiogram, infection_episode
│   ├── NLP: note_section, note_assertion
│   ├── Process Mining: process_event, process_model
│   ├── Predictions: prediction_model, prediction_score
│   └── Data Provenance: data_source, load_batch, dq_result
│
├── app.*                    — (existing) Users, roles, cohorts, sources
├── results.*                — (existing) Achilles/DQD output
├── gis.*                    — (existing) Geospatial
├── eunomia.*                — (existing) GiBleed demo
└── php.*                    — (existing) Laravel internals
```

**Relationship between `omop.*` and `inpatient.*`:**

The existing `omop.*` schema contains both CDM clinical tables (from the Acumenus data source) and vocabulary tables. In the Morpheus architecture, `omop.*` serves as the shared vocabulary layer — its vocabulary tables (concept, concept_relationship, concept_ancestor, etc.) are read by both Morpheus and the existing Parthenon modules. Existing clinical data in `omop.*` (Acumenus source) remains unchanged. Morpheus operates on a separate `inpatient.*` schema for its own patient population (MIMIC-IV demo, FHIR imports, HL7v2 feeds). The two clinical datasets are independent — different source populations, different schemas.

**Prerequisite (Phase A.0):** Vocabulary tables were temporarily loaded into `inpatient.*` during initial setup. Before Phase A begins, these must be verified to exist in `omop.*` (on the host PG 17 `parthenon` database) and the duplicate copies in Docker's `inpatient.*` must be dropped. The `inpatient` connection's `search_path` includes `omop` for vocabulary lookups, so all concept joins resolve transparently.

**Schema boundary rules:**
- `inpatient_staging.*` is transient — data lives here during ETL, old batches purged after validation.
- `inpatient.*` is standard OMOP CDM 5.4 clinical tables only (no vocabulary) — any OHDSI tool can connect.
- `inpatient_ext.*` is Morpheus-specific — extensions referencing `inpatient.*` via FKs.
- `omop.*` is the shared vocabulary layer — read-only for Morpheus, never written to by morpheus-ingest except via `source_to_concept_map` for accepted concept gap mappings.
- `load_batch` lives in `inpatient_ext.*` only (persists after staging purge). Staging tables FK to it.
- Schema DDL for `inpatient.*`, `inpatient_ext.*`, and `inpatient_staging.*` is managed by morpheus-ingest via Alembic migrations. Laravel does not run migrations against these schemas.
- The `vitals_ts` wide table (41+ columns) is an intentional denormalization for analytics query performance, following the BlendedICU specification. New variables require schema migration. The canonical OMOP `measurement` table stores these values in normalized EAV form; `vitals_ts` is a materialized view pattern.

### 4.3 Canonical Staging Table Design

Every staging table includes metadata columns:

```sql
source_system_id    INTEGER NOT NULL    -- which EHR system (FK → data_source)
load_batch_id       INTEGER NOT NULL    -- which extract run
source_table        TEXT                -- original table name in source system
source_row_id       TEXT                -- original PK in source system
dq_flags            JSONB DEFAULT '{}'  -- data quality annotations
```

This enables full traceability from any CDM record back to its source system and row.

## 5. Data Flows

### 5.1 FHIR R4 Bulk Export Path (Batch)

```
Hospital FHIR Server
    │  GET /$export → poll status → download NDJSON
    ▼
abby-hb: /api/v1/deid/fhir-batch
    │  Per NDJSON line (one FHIR resource):
    │    1. Parse resource type
    │    2. Detect PHI in structured fields
    │    3. Apply transforms (date shift, pseudonymize, coarsen, strip)
    │    4. Clinical notes → stage in phi_note → multi-pass NLP de-ID
    │    5. Audit log every PHI element
    │    6. Emit clean resource to morpheus-ingest
    ▼
morpheus-ingest: /api/v1/ingest/fhir
    │  STAGE:  FHIR resource → canonical staging table
    │  MAP:    staging → OMOP CDM 5.4 (via omop.* vocabulary)
    │  EXTEND: staging → Morpheus extensions (where source supports it)
    │  DERIVE: era_builder (condition_era, drug_era, observation_period)
    │  VALIDATE: DQD + coverage + integrity + plausibility
    │  COMMIT or REJECT
    ▼
parthenon.inpatient.* — ready for analytics
```

**Key points:**
- Abby processes FHIR resources one at a time (streaming NDJSON lines), keeping memory bounded.
- Date shifting uses consistent per-patient random offset (±180 days), stored only in `abby-hb`.
- The FHIR adapter in `morpheus-ingest` doesn't know about de-identification — it receives clean resources.
- Unmapped codes go to `concept_gap` for Abby-assisted suggestions.

### 5.2 HL7v2 ADT Real-Time Path

```
Hospital Interface Engine
    │  HL7v2 via MLLP (TCP port 2575)
    │  A01 Admit, A02 Transfer, A03 Discharge, A04 Register,
    │  A06/A07 Class change, A08 Update, A11-13 Cancellations
    ▼
abby-hb: MLLP Listener
    │  Per message (<100ms target):
    │    1. Parse PID, PV1, EVN, NK1 segments
    │    2. Pseudonymize MRN, strip name/address/phone
    │    3. Date-shift timestamps (same offset as batch path)
    │    4. Strip NK1 entirely
    │    5. Audit log
    │    6. Emit to Redis Stream
    ▼
morpheus-ingest: Redis Stream → ADT Consumer
    │  A01/A04 → visit_occurrence + bed_census + care_milestone
    │  A02     → visit_detail + transport + bed_census update
    │  A03     → visit_occurrence update + bed_census decrement
    │  A08     → update relevant records
    │  A11-13  → soft-reverse (never hard delete)
    ▼
parthenon.inpatient.* + inpatient_ext.* — updated near-real-time
    │
    ▼
Frontend: WebSocket push via Laravel Reverb
    → Patient Flow dashboard updates live
    → Bed census heatmap refreshes
    → ICU navigator shows new admissions
```

**Key points:**
- Redis Stream used only for HL7v2 path (backpressure, replay capability). FHIR batch stays HTTP.
- ADT de-identification is lightweight (structured fields only) — sub-100ms target.
- Cancellation messages create reversal records, never hard deletes.
- `bed_census` is a running state table updated per event, not recomputed.
- Frontend receives live updates via Laravel Reverb (WebSocket), already configured in Parthenon.

### 5.3 MIMIC-IV Test Path (No De-ID)

```
MIMIC-IV CSVs (already de-identified)
    │  Bypasses abby-hb entirely
    ▼
morpheus-ingest: /api/v1/ingest/mimic
    │  MimicAdapter: CSVs → canonical staging
    │  Same mapper/validator pipeline as FHIR path
    ▼
parthenon.inpatient.* — test/validation data
```

### 5.4 Failure Handling and Retry Semantics

**HTTP path (FHIR batch):**
- morpheus-ingest returns HTTP 200 per accepted resource. If abby-hb gets a non-200, it retries with exponential backoff (3 attempts, 1s/5s/30s delays).
- Idempotency: each resource carries a `source_row_id` key. morpheus-ingest upserts to staging — re-sending the same resource is safe.
- If morpheus-ingest is completely down, abby-hb queues clean resources to a local file buffer and retries when the health check passes.

**Redis Stream path (HL7v2 ADT):**
- Consumer group with pending entry list (PEL) provides at-least-once delivery.
- Messages that fail processing N times (default: 5) move to a dead letter stream (`morpheus:adt:dead`) for manual review.
- Idempotency: ADT messages carry `source_row_id` (message control ID). Duplicate detection prevents double-processing.

**Batch-level failures:**
- If a batch fails quality gate, the entire batch is marked `rejected` but data remains in staging for review.
- Individual record failures during mapping are logged to `load_batch.stats` (JSONB) with error details. The batch continues — a 5% error rate is tolerable; >20% triggers batch rejection.

## 6. Abby Honest Broker Service Design

### 6.1 Service Structure

```
abby-hb service (Python FastAPI)
├── api/
│   ├── /deid/fhir-batch       — NDJSON bundle streaming de-ID
│   ├── /deid/fhir-resource    — Single FHIR resource de-ID
│   ├── /deid/hl7v2            — HL7v2 message de-ID (also MLLP)
│   ├── /deid/csv              — CSV with PHI column annotations
│   ├── /deid/note             — Clinical note NLP de-ID
│   ├── /deid/note/{id}/status — Note de-ID status poll
│   ├── /deid/batch/{id}       — Batch job status
│   ├── /audit/log             — Query audit trail (read-only)
│   ├── /audit/risk-score      — Re-identification risk assessment
│   ├── /crosswalk/lookup      — Authorized re-linkage (strict ACL)
│   └── /health
│
├── core/
│   ├── phi_detector.py        — PHI detection engine
│   │   ├── StructuredDetector   — Regex + field heuristics
│   │   ├── NerDetector          — MedGemma/spaCy NER for free text
│   │   └── ContextDetector      — Contextual inference
│   │
│   ├── transforms.py          — De-identification transforms
│   │   ├── DateShifter          — ±180 days, consistent per patient
│   │   ├── Pseudonymizer        — Deterministic pseudonym generation
│   │   ├── GeoCoarsener         — Address → state, zip → 3 digits
│   │   ├── AgeCapper            — Age >89 → 90
│   │   ├── NoteRedactor         — Replace PHI spans with tags
│   │   └── FieldStripper        — Remove fields entirely
│   │
│   ├── crosswalk.py           — Encrypted crosswalk vault
│   ├── risk_scorer.py         — k-anonymity, l-diversity, t-closeness
│   └── audit.py               — Immutable audit logging
│
├── adapters/
│   ├── fhir_parser.py         — FHIR R4 resource PHI field identification
│   ├── hl7v2_parser.py        — HL7v2 segment parsing
│   ├── csv_parser.py          — Annotated CSV parsing
│   └── mllp_listener.py       — MLLP TCP server
│
├── notes/
│   ├── note_pipeline.py       — Multi-pass clinical note de-ID
│   │   Pass 1: Structured header masking
│   │   Pass 2: NER (MedGemma) for names, locations, dates
│   │   Pass 3: Regex patterns (phone, SSN, email)
│   │   Pass 4: Context inference (doctor names, facilities)
│   │   Pass 5: Confidence scoring
│   ├── review_queue.py        — Human review for confidence <0.8
│   └── note_store.py          — Temporary PHI storage (auto-purge 72h)
│
└── db/
    ├── models.py              — SQLAlchemy models
    └── migrations/            — Alembic migrations
```

### 6.2 HIPAA Safe Harbor Compliance

The 18 HIPAA identifiers and their transforms:

| # | Identifier | Transform |
|---|-----------|-----------|
| 1 | Names | Pseudonyms (consistent per patient) |
| 2 | Geographic (< state) | Coarsen to state; zip → first 3 digits if pop >20K |
| 3 | Dates (except year) | Random shift ±180 days (consistent per patient) |
| 4 | Phone numbers | Remove |
| 5 | Fax numbers | Remove |
| 6 | Email addresses | Remove |
| 7 | SSN | Remove |
| 8 | MRN | Pseudonymized ID (crosswalk vault) |
| 9 | Health plan beneficiary | Remove |
| 10 | Account numbers | Remove |
| 11 | Certificate/license | Remove |
| 12 | Vehicle identifiers | Remove |
| 13 | Device identifiers | Pseudonymize (preserve for device_exposure) |
| 14 | Web URLs | Remove |
| 15 | IP addresses | Remove |
| 16 | Biometric identifiers | Remove |
| 17 | Full-face photos | Remove |
| 18 | Any other unique ID | Review and remove/pseudonymize |

### 6.3 Clinical Note De-Identification

Notes require staged processing in `abby-hb`:

1. Raw note persisted in `staging.phi_note` (encrypted at rest)
2. Five-pass NLP pipeline processes the note
3. Notes with all detections at confidence ≥0.8 auto-release after de-ID
4. Notes with any detection <0.8 queued for human review
5. Reviewer confirms, adjusts, or adds missed PHI
6. De-identified text released to morpheus-ingest
7. Raw note purged from `abby-hb` after 72h post-release

## 7. Morpheus Ingest Service Design

### 7.1 Service Structure

```
morpheus-ingest service (Python FastAPI)
├── api/                       — HTTP endpoints
├── adapters/                  — Source-specific parsers
│   ├── base.py                  SourceAdapter ABC
│   ├── fhir_adapter.py          FHIR R4 → staging
│   ├── adt_adapter.py           HL7v2 ADT → staging + extensions
│   ├── mimic_adapter.py         MIMIC-IV → staging
│   └── csv_adapter.py           Generic CSV → staging
├── staging/                   — Canonical staging layer
│   ├── models.py, writer.py, cleaner.py
├── mapper/                    — Staging → OMOP CDM 5.4
│   ├── omop_mapper.py           Pipeline orchestrator
│   ├── person_mapper.py         stg_patient → person
│   ├── visit_mapper.py          stg_encounter → visit_occurrence/detail
│   ├── condition_mapper.py      ICD → SNOMED via concept_relationship
│   ├── drug_mapper.py           NDC → RxNorm
│   ├── measurement_mapper.py    LOINC direct mapping
│   ├── procedure_mapper.py
│   ├── observation_mapper.py    Domain routing overflow
│   ├── note_mapper.py, specimen_mapper.py, device_mapper.py, death_mapper.py
│   ├── era_builder.py           condition_era, drug_era, dose_era
│   └── domain_router.py         Route by concept.domain_id
├── extensions/                — Staging → Morpheus extensions
│   ├── icu_mapper.py, periop_mapper.py, flow_mapper.py
│   ├── safety_mapper.py, micro_mapper.py
│   ├── bundle_mapper.py, process_mapper.py
├── vocabulary/                — Concept mapping utilities
│   ├── concept_lookup.py        Query omop.concept
│   ├── relationship_walker.py   Source → standard mapping
│   ├── ancestor_lookup.py       Hierarchy queries
│   ├── custom_concept.py        Generate custom concepts (>2B IDs)
│   └── abby_suggest.py          SapBERT + MedGemma suggestions
├── quality/                   — Data quality validation
│   ├── dqd_runner.py, coverage_checker.py, integrity_checker.py
│   ├── plausibility_checker.py, stabilization.py, gate.py
└── orchestrator/              — Batch coordination
    ├── batch_runner.py, progress.py, retry.py, state.py
```

### 7.2 Mapping Pipeline

For each batch:

1. **STAGE** — Adapter writes to `inpatient_staging.stg_*` with source metadata
2. **MAP** — For each record: look up source_code in `omop.concept` → if found, use standard concept_id → if not, check `omop.source_to_concept_map` → if still not, log to `concept_gap`, use concept_id=0 → check domain_id for routing → write to appropriate CDM table
3. **EXTEND** — Derive extension tables from CDM + staging (ICU stays from visit_detail, bundle assessments from measurements, antibiogram from microbiology, OCEL events from timestamps)
4. **DERIVE** — Build eras (condition_era, drug_era) and observation_period
5. **VALIDATE** — DQD checks, coverage ≥70%, referential integrity, date plausibility
6. **COMMIT or REJECT** — Mark batch complete or flag for review

### 7.3 Concept Gap Workflow

```
Unmapped code found → insert into concept_gap (code, vocabulary, frequency)
    → Trigger Abby suggestion (SapBERT similarity + MedGemma reasoning)
    → Return top-3 suggestions with confidence
    → Human reviewer via Parthenon UI: accept / reject / custom
    → Accepted → insert into omop.source_to_concept_map
    → Next batch: previously accepted mappings apply automatically
```

## 8. Parthenon Integration

### 8.1 Laravel Backend

**Database connection:**

```php
// config/database.php
'inpatient' => [
    'driver'   => 'pgsql',
    'host'     => env('DB_HOST'),
    'port'     => env('DB_PORT', '5432'),
    'database' => env('DB_DATABASE', 'parthenon'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
    'schema'   => 'inpatient,inpatient_ext,omop',  // staging access via morpheus-ingest API only
],
```

**Model structure:**

```
backend/app/Models/Morpheus/
├── MorpheusModel.php          — Abstract base (connection: 'inpatient')
├── Cdm/                       — Standard OMOP CDM (read-only)
│   ├── Person.php, VisitOccurrence.php, VisitDetail.php
│   ├── ConditionOccurrence.php, DrugExposure.php, Measurement.php
│   ├── Observation.php, ProcedureOccurrence.php, Note.php, Death.php
└── Ext/                       — Morpheus extensions
    ├── IcuStay.php, BundleCard.php, BundleAssessment.php
    ├── SurgicalCase.php, CaseTimeline.php, CaseMetrics.php
    ├── Transport.php, BedCensus.php, CareMilestone.php
    ├── SafetyEvent.php, Antibiogram.php, InfectionEpisode.php
    ├── PredictionModel.php, PredictionScore.php
    ├── DataSource.php, LoadBatch.php
```

**API routes:** All under `/api/v1/morpheus/` with Sanctum auth, covering: sources, batches, concept-gaps, icu-stays, bundle, surgical-cases, census, transport, milestones, predictions, antibiogram, infections, safety-events, quality-measures, process events/models, data quality.

### 8.2 React Frontend

```
frontend/src/features/morpheus/
├── pages/
│   ├── MorpheusLayout.tsx           — Module shell with sidebar nav
│   ├── DashboardPage.tsx            — KPIs, recent batches, alerts
│   ├── SourcesPage.tsx              — Data source management
│   ├── IcuNavigatorPage.tsx         — ICU stay explorer
│   ├── BundleCompliancePage.tsx     — ABCDEF adherence dashboard
│   ├── PerioperativePage.tsx        — OR case analytics
│   ├── PatientFlowPage.tsx          — Live census, transport
│   ├── PredictionsPage.tsx          — Model outputs
│   ├── MicrobiologyPage.tsx         — Antibiogram, infections
│   ├── SafetyPage.tsx               — Safety events
│   ├── ProcessMiningPage.tsx        — Pathway analysis
│   ├── DataQualityPage.tsx          — DQD results
│   └── ConceptGapPage.tsx           — Unmapped code reviewer
├── components/
│   ├── IcuStayTimeline.tsx, VitalsChart.tsx, BundleRadar.tsx
│   ├── CaseTimelineChart.tsx, BedCensusHeatmap.tsx, TransportMap.tsx
│   ├── AntibiogramMatrix.tsx, PredictionGauge.tsx, ShapWaterfall.tsx
│   ├── ProcessSankey.tsx, DqScoreCard.tsx, ConceptGapTable.tsx
│   └── BatchProgressBar.tsx, MorpheusMetricCard.tsx
├── api.ts                           — TanStack Query hooks
├── hooks/                           — useIcuStays, useBundleCompliance, etc.
├── stores/morpheusStore.ts          — Zustand
└── types/morpheus.types.ts          — TypeScript interfaces
```

**Follows existing Parthenon patterns:** Sanctum auth, Spatie RBAC, TanStack Query, Zustand, dark clinical theme (#0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal).

## 9. Extension Table Definitions

### 9.1 Perioperative Domain

**`inpatient_ext.surgical_case`** — Master surgical case record
- case_id (PK), person_id (FK → person), visit_occurrence_id (FK), surgery_date, room_id, primary_surgeon_provider_id (FK → provider), service_concept_id, asa_rating, case_type_concept_id, case_class_concept_id, patient_class_concept_id, scheduled_start_datetime, scheduled_duration_minutes, status_concept_id, cancellation_reason_concept_id, source_system_id, load_batch_id

**`inpatient_ext.case_timeline`** — Phase-level timestamps
- case_id (FK), periop_arrival_dt, preop_in_dt, preop_out_dt, or_in_dt, anesthesia_start_dt, procedure_start_dt, procedure_close_dt, procedure_end_dt, or_out_dt, anesthesia_end_dt, pacu_in_dt, pacu_out_dt, destination, primary_procedure_concept_id

**`inpatient_ext.case_metrics`** — Computed perioperative metrics
- case_id (FK), turnover_minutes, utilization_pct, in_block_minutes, out_of_block_minutes, prime_time_minutes, non_prime_time_minutes, late_start_minutes, early_finish_minutes

### 9.2 ICU Domain

**`inpatient_ext.icu_stay`** — Denormalized ICU admission
- icu_stay_id (PK), visit_detail_id (FK), person_id (FK), visit_occurrence_id (FK), hospital_admit_dt, hospital_discharge_dt, icu_admit_dt, icu_discharge_dt, icu_los_hours, hospital_los_days, care_site_name, died_in_hospital, died_in_icu, readmission_48h, severity_score, severity_system_concept_id

**`inpatient_ext.bundle_card`** — ABCDEF Liberation Bundle definitions
- bundle_card_id (PK), component (A-F), component_name, assessment_concept_id, target_frequency_hours, adherence_threshold, sccm_guideline_version

**`inpatient_ext.bundle_assessment`** — Per-patient bundle adherence
- assessment_id (PK), person_id (FK), visit_detail_id (FK), assessment_datetime, bundle_component, assessment_concept_id, value_as_number, value_as_concept_id, adherent_flag

**`inpatient_ext.vitals_ts`** — High-frequency timeseries (41 variables per BlendedICU spec)
- person_id (FK), visit_detail_id (FK), measurement_datetime, heart_rate, sbp, dbp, map, resp_rate, temp_c, spo2, fio2, peep, tidal_volume, pip, rr_vent, etco2, cvp, art_line_sbp, art_line_dbp, icp, gcs_total, gcs_eye, gcs_verbal, gcs_motor (and remaining BlendedICU variables)

### 9.3 Patient Flow Domain

**`inpatient_ext.transport`** — Patient movement events
- transport_id (PK), person_id (FK), visit_occurrence_id (FK), transport_type, location_from, location_to, status, planned_time, actual_start, actual_end, assigned_provider_id (FK)

**`inpatient_ext.bed_census`** — Point-in-time bed occupancy (running state)
- census_id (PK), census_datetime, location_id, total_beds, occupied_beds, available_beds, pending_admits, pending_discharges, boarding_count

**`inpatient_ext.care_milestone`** — Patient journey milestones
- milestone_id (PK), person_id (FK), visit_occurrence_id (FK), milestone_type (H&P, Consent, Labs, Safety_Check, Transport), status (Pending, In_Progress, Completed, Verified), required, completed_at, completed_by_provider_id (FK)

### 9.4 Safety & Quality Domain

**`inpatient_ext.safety_event`** — Structured safety incidents
- event_id (PK), person_id (FK), visit_occurrence_id (FK), event_type (Safety_Alert, Barrier, Near_Miss, Adverse_Event), severity (Low, Medium, High, Critical), description, reporting_provider_id (FK), acknowledged_by_provider_id, acknowledged_at, resolved_at

**`inpatient_ext.quality_measure`** — Quality metric tracking
- measure_id (PK), measure_name, measure_set (CMS, Joint_Commission, Leapfrog, Internal), numerator_count, denominator_count, rate, period_start, period_end

### 9.5 Microbiology Domain

**`inpatient_ext.antibiogram`** — Organism x antibiotic susceptibility
- antibiogram_id (PK), person_id (FK), visit_occurrence_id (FK), organism_concept_id, antibiotic_concept_id, susceptibility (S/I/R), mic_value, test_method, specimen_concept_id, result_datetime

**`inpatient_ext.infection_episode`** — Infection timeline
- episode_id (PK), person_id (FK), visit_occurrence_id (FK), infection_concept_id, onset_datetime, resolution_datetime, hai_flag (hospital-acquired), source_concept_id

### 9.6 NLP Domain

**`inpatient_ext.note_section`** — Sectioned clinical notes
- section_id (PK), note_id (FK → note), section_concept_id, section_text, section_order

**`inpatient_ext.note_assertion`** — NLP-extracted assertions
- assertion_id (PK), note_id (FK), concept_id, assertion_type (present, absent, conditional, historical), confidence_score, extraction_model_version

### 9.7 Process Mining Domain

**`inpatient_ext.process_event`** — OCEL 2.0 event log
- event_id (PK), event_type, timestamp, object_type (patient, provider, room, equipment), object_id, activity, resource, lifecycle_state

**`inpatient_ext.process_model`** — Discovered process models
- model_id (PK), model_type (Petri_net, BPMN, DFG), model_data (JSONB), cohort_id, created_at

### 9.8 Predictions Domain

**`inpatient_ext.prediction_model`** — Registered ML models
- model_id (PK), model_name, model_type, version, target_outcome, training_cohort_id, auc, auprc, feature_set (JSONB), onnx_artifact_path

**`inpatient_ext.prediction_score`** — Per-patient model outputs
- score_id (PK), person_id (FK), visit_detail_id (FK), model_id (FK), score_datetime, predicted_probability, risk_tier (Low/Medium/High/Critical), explanation (JSONB — SHAP values)

### 9.9 Data Provenance Domain

**`inpatient_ext.data_source`** — Registered EHR sources
- source_id (PK), source_name, vendor (Epic/Cerner/Meditech/FHIR/MIMIC), connection_type, last_extract_dt, total_patients, dqd_score

**`inpatient_ext.load_batch`** — ETL batch tracking
- batch_id (PK), source_id (FK), start_dt, end_dt, status (pending/staging/mapping/validating/complete/failed/rejected), rows_staged, rows_mapped, rows_rejected, mapping_coverage_pct, dqd_pass

**`inpatient_ext.dq_result`** — DQD check results per batch
- result_id (PK), batch_id (FK), check_name, check_level, threshold, result_value, passed

## 10. Implementation Phases

### Phase A: Foundation (2 weeks)
Create schemas, build MIMIC-IV adapter, OMOP mapper, quality gate. End-to-end: MIMIC demo → staging → CDM → validate. Dependencies: none.

### Phase B: Honest Broker Foundation (3 weeks)
Create `abby-hb` service with structured data de-ID, crosswalk vault, audit log. End-to-end: synthetic FHIR bundle → abby-hb → morpheus-ingest → CDM. Dependencies: Phase A.

### Phase C: FHIR R4 Adapter (2 weeks)
FHIR resource → staging adapter, FHIR $export client, domain routing, concept gap tracking. Test with HAPI FHIR and Synthea. Dependencies: Phase A + B.

### Phase D: HL7v2 ADT Real-Time (2 weeks)
MLLP listener, HL7v2 parser, Redis Stream, ADT consumer, bed census, Reverb WebSocket push. Dependencies: Phase A + B.

### Phase E: Analytics Workbench — Core (3 weeks)
ICU stay derivation, bundle assessment mapper, Laravel controllers, React pages (ICU Navigator, Bundle Compliance, Patient Flow), live WebSocket updates. Dependencies: Phase A + D.

### Phase F: Clinical Note De-ID (3 weeks)
Multi-pass NLP pipeline, confidence scoring, human review queue, temporary PHI storage, note → note_nlp mapper. Dependencies: Phase B.

### Phase G: Analytics Workbench — Advanced (3 weeks)
Perioperative dashboard, microbiology workbench, safety monitor, process mining, prediction engine, data quality management. Dependencies: Phase E + C/D.

### Phase H: Production Hardening (ongoing)
Separate host for abby-hb, TLS, secrets management, risk scoring, retention policies, HIPAA documentation, load testing, additional adapters. Dependencies: all prior phases.

**Critical path:** A → B → C (first real FHIR data through the pipeline)

**Parallel opportunities:** D alongside C (after B), E alongside C (after A), F independent of C/D (after B)

## 11. Key Literature

1. Paris et al. (2021) — First MIMIC→OMOP ETL, denormalized view patterns
2. Sheikhalishahi et al. (2025) — Federated ventilator weaning prediction
3. Schwinn et al. (2025) — Federated blood transfusion prediction
4. Islam et al. (2026) — ICU Liberation Bundle OMOP vocabulary mappings
5. Oliver et al. (2023) — BlendedICU multi-database harmonization (41 timeseries vars)
6. Park et al. (2024) — OMOP CDM → OCEL process mining
7. Liu et al. (2026) — EHR data quality benchmarking (4-7 day stabilization)
8. Kim et al. (2026) — MedRep OMOP concept embeddings
9. Xiao et al. (2022) — FHIR-Ontop-OMOP knowledge graphs

## 12. References

- **Morpheus v2 Checklist:** `docs/inpatient/Morpheus-v2-Checklist.md`
- **Original Morpheus spec (superseded):** `docs/inpatient/Morpheus.md`
- **Draft architecture (superseded):** `docs/inpatient/Morpheus-v2-Architecture.md`
- **Zephyrus EPIC data model:** `/home/smudoshi/Github/Zephyrus/` (reference for real-world EHR richness)
- **Parthenon CLAUDE.md:** Project context and conventions
- **Existing Abby AI service:** `ai/app/` (PHI sanitizer, clinical NLP, SapBERT, MedGemma)
- **Existing ingestion pipeline:** `backend/app/Services/Ingestion/` (6-stage queue pattern)
- **ETL repos (Phase 1 clones):** `~/inpatient/etl/` (6 repos + CDM DDL)
- **MIMIC-IV demo data:** loaded in Docker `parthenon.mimiciv.*` (100 patients, 31 tables)
- **OMOP vocabulary:** canonical location is `omop.*` on host PG 17. Temporary copy in Docker `inpatient.*` to be dropped per Phase A.0 prerequisite.
