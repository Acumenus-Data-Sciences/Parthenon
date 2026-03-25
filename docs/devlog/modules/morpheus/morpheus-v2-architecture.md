# Morpheus v2 — Inpatient Analytics Workbench Architecture

## Vision

Morpheus is the inpatient data engine for the Parthenon platform. It ingests real-world EHR data from **any vendor** (Epic, Cerner, Meditech, athenahealth, FHIR R4 endpoints, HL7v2 feeds), de-identifies it through an **AI Honest Broker** (Abby), transforms it into **OMOP CDM 5.4**, and serves it to an analytics workbench purpose-built for ICU outcomes research, quality monitoring, process mining, and predictive modeling.

MIMIC-IV is one test dataset. The real targets are hospital EHR exports — Epic Caboodle/Clarity extracts, Cerner Millennium dumps, FHIR bulk exports, ADT feeds — carrying the full richness of clinical operations: perioperative workflows, patient transport, safety events, provider credentials, nursing assessments, real-time vitals, and unstructured clinical notes.

The name "Morpheus" references the god of dreams — appropriate for ICU care where sedation, delirium monitoring, and the ABCDEF Liberation Bundle (waking patients from sedation) are central concerns.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOURCE EHR SYSTEMS                           │
│  Epic Caboodle/Clarity │ Cerner Millennium │ Meditech │ FHIR R4    │
│  HL7v2 ADT feeds       │ CSV/Parquet bulk  │ Custom   │ MIMIC-IV   │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ABBY — AI HONEST BROKER                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ PHI Detection │  │ De-ID Engine │  │ Audit & Compliance Logger │ │
│  │              │  │              │  │                           │ │
│  │ • NER for    │  │ • Date shift │  │ • Every PHI element       │ │
│  │   names,     │  │   (random    │  │   logged before removal   │ │
│  │   MRNs,      │  │   offset per │  │ • HIPAA Safe Harbor +     │ │
│  │   addresses, │  │   patient)   │  │   Expert Determination    │ │
│  │   phone,     │  │ • Pseudonym  │  │ • Re-identification risk  │ │
│  │   SSN, DOB   │  │   generation │  │   scoring                 │ │
│  │ • Clinical   │  │ • Geographic │  │ • Chain-of-custody for    │ │
│  │   note       │  │   coarsening │  │   data provenance         │ │
│  │   scrubbing  │  │ • Age >89    │  │ • IRB linkage metadata    │ │
│  │ • Structured │  │   capping    │  │                           │ │
│  │   field      │  │ • Note       │  │                           │ │
│  │   masking    │  │   redaction  │  │                           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Crosswalk Vault (encrypted, access-controlled)               │   │
│  │ Maps de-identified IDs ↔ real MRNs for authorized re-linkage │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────────────────────┘
               │  De-identified, research-ready data
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  MORPHEUS INGESTION FRAMEWORK                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Source Adapters (vendor-specific → canonical staging)        │   │
│  │                                                             │   │
│  │  EpicAdapter      — Caboodle/Clarity tables → staging       │   │
│  │  CernerAdapter    — Millennium tables → staging             │   │
│  │  MeditechAdapter  — Meditech extracts → staging             │   │
│  │  FhirAdapter      — FHIR R4 Bundle/ndjson → staging         │   │
│  │  Hl7v2Adapter     — ADT/ORU/ORM messages → staging          │   │
│  │  MimicAdapter     — MIMIC-IV CSVs → staging (test/demo)     │   │
│  │  CsvAdapter       — Generic CSV/Parquet → staging            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Canonical Staging Layer (inpatient_staging.*)                │   │
│  │                                                             │   │
│  │  Vendor-neutral intermediate tables with:                    │   │
│  │  • source_system_id (which EHR)                              │   │
│  │  • load_batch_id (which extract)                             │   │
│  │  • raw values + normalized values                            │   │
│  │  • data quality flags                                        │   │
│  │  • provenance metadata                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ OMOP Mapper (staging → CDM 5.4 + extensions)                │   │
│  │                                                             │   │
│  │  • Vocabulary mapping (source codes → OMOP concepts)         │   │
│  │  • Custom concept generation (unmapped source codes)         │   │
│  │  • Domain routing (condition vs observation vs measurement)  │   │
│  │  • Era calculation (condition_era, drug_era, dose_era)       │   │
│  │  • Abby-assisted mapping suggestions for unmapped codes      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Data Quality Gate                                            │   │
│  │                                                             │   │
│  │  • OHDSI DQD checks (automated)                              │   │
│  │  • Mapping coverage thresholds (reject if <70% mapped)       │   │
│  │  • Referential integrity validation                          │   │
│  │  • Date range plausibility                                    │   │
│  │  • Discharge stabilization window (Liu et al.: 4-7 days)     │   │
│  │  • Demographic consistency checks                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────────────────────┘
               │  Validated OMOP CDM 5.4 data
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              parthenon.inpatient (OMOP CDM 5.4)                     │
│                                                                     │
│  CLINICAL DATA         │ VOCABULARY          │ DERIVED              │
│  ─────────────         │ ──────────          │ ───────              │
│  person                │ concept             │ cohort               │
│  visit_occurrence      │ concept_relationship│ cohort_definition    │
│  visit_detail          │ concept_ancestor    │ condition_era        │
│  condition_occurrence  │ vocabulary          │ drug_era             │
│  drug_exposure         │ domain              │ dose_era             │
│  measurement           │ concept_class       │ episode              │
│  procedure_occurrence  │ concept_synonym     │ episode_event        │
│  observation           │ drug_strength       │ observation_period   │
│  note / note_nlp       │ source_to_concept   │                      │
│  specimen              │ relationship        │                      │
│  death                 │                     │                      │
│  device_exposure       │                     │                      │
│  cost                  │                     │                      │
│  payer_plan_period     │                     │                      │
├────────────────────────┴─────────────────────┴──────────────────────┤
│                                                                     │
│  MORPHEUS EXTENSIONS (parthenon.inpatient_ext)                      │
│  ─────────────────────────────────────────────                      │
│                                                                     │
│  Perioperative Domain                                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_surgical_case     — Master case record             │    │
│  │   case_id, person_id, visit_occurrence_id, surgery_date,    │    │
│  │   room_id, primary_surgeon_id, service_concept_id,          │    │
│  │   asa_rating, case_type, case_class, patient_class,         │    │
│  │   scheduled_start, scheduled_duration, status,              │    │
│  │   cancellation_reason_concept_id                            │    │
│  │                                                             │    │
│  │ morpheus_case_timeline     — Phase-level timestamps          │    │
│  │   case_id, periop_arrival_dt, preop_in_dt, preop_out_dt,    │    │
│  │   or_in_dt, anesthesia_start_dt, procedure_start_dt,        │    │
│  │   procedure_close_dt, procedure_end_dt, or_out_dt,          │    │
│  │   anesthesia_end_dt, pacu_in_dt, pacu_out_dt,               │    │
│  │   destination, primary_procedure_concept_id                  │    │
│  │                                                             │    │
│  │ morpheus_case_metrics      — Computed perioperative metrics   │    │
│  │   case_id, turnover_minutes, utilization_pct,                │    │
│  │   in_block_minutes, out_of_block_minutes,                    │    │
│  │   prime_time_minutes, late_start_minutes                     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ICU Domain                                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_icu_stay          — Denormalized ICU admission view  │    │
│  │   visit_detail_id, person_id, hospital_admit_dt,             │    │
│  │   icu_admit_dt, icu_discharge_dt, icu_los_hours,             │    │
│  │   care_site_name, died_in_icu, died_in_hospital,             │    │
│  │   readmission_48h, severity_score, severity_system           │    │
│  │                                                             │    │
│  │ morpheus_bundle_card       — ABCDEF bundle definitions       │    │
│  │   bundle_id, component (A-F), assessment_concept_id,         │    │
│  │   target_frequency_hours, adherence_threshold,               │    │
│  │   sccm_guideline_version                                     │    │
│  │                                                             │    │
│  │ morpheus_bundle_assessment — Bundle adherence per patient     │    │
│  │   person_id, visit_detail_id, assessment_datetime,           │    │
│  │   bundle_component, assessment_concept_id,                   │    │
│  │   value_as_number, value_as_concept_id, adherent_flag        │    │
│  │                                                             │    │
│  │ morpheus_vitals_ts         — High-frequency timeseries       │    │
│  │   person_id, visit_detail_id, measurement_datetime,          │    │
│  │   heart_rate, sbp, dbp, map, resp_rate, temp_c,              │    │
│  │   spo2, fio2, peep, tidal_volume, pip, rr_vent,              │    │
│  │   etco2, cvp, art_line_sbp, art_line_dbp, icp,              │    │
│  │   gcs_total, gcs_eye, gcs_verbal, gcs_motor                 │    │
│  │   (41 variables per BlendedICU specification)                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Patient Flow Domain                                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_transport         — Patient transport events        │    │
│  │   person_id, visit_occurrence_id, transport_type,            │    │
│  │   location_from, location_to, status,                        │    │
│  │   planned_time, actual_start, actual_end,                    │    │
│  │   assigned_provider_id                                       │    │
│  │                                                             │    │
│  │ morpheus_bed_census        — Point-in-time bed occupancy     │    │
│  │   census_datetime, location_id, total_beds,                  │    │
│  │   occupied_beds, available_beds, pending_admits,              │    │
│  │   pending_discharges, boarding_count                          │    │
│  │                                                             │    │
│  │ morpheus_care_milestone    — Patient journey milestones      │    │
│  │   person_id, visit_occurrence_id, milestone_type             │    │
│  │   (H&P, Consent, Labs, Safety_Check, Transport),             │    │
│  │   status, required, completed_at, completed_by               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Safety & Quality Domain                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_safety_event      — Structured safety incidents     │    │
│  │   person_id, visit_occurrence_id, event_type                 │    │
│  │   (Safety_Alert, Barrier, Near_Miss, Adverse_Event),         │    │
│  │   severity (Low, Medium, High, Critical), description,       │    │
│  │   reporting_provider_id, acknowledged_by, resolved_at        │    │
│  │                                                             │    │
│  │ morpheus_quality_measure   — Quality metric tracking         │    │
│  │   measure_id, measure_name, measure_set (CMS, Joint          │    │
│  │   Commission, Leapfrog, internal), numerator_count,          │    │
│  │   denominator_count, rate, period_start, period_end          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Microbiology & Infection Domain                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_antibiogram       — Organism-antibiotic matrix      │    │
│  │   organism_concept_id, antibiotic_concept_id,                │    │
│  │   susceptibility (S/I/R), mic_value, test_method,            │    │
│  │   specimen_concept_id, result_datetime                       │    │
│  │                                                             │    │
│  │ morpheus_infection_episode  — Infection timeline              │    │
│  │   person_id, visit_occurrence_id, infection_concept_id,      │    │
│  │   onset_datetime, resolution_datetime,                       │    │
│  │   hai_flag (hospital-acquired), source_concept_id            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  NLP & Unstructured Data Domain                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_note_section      — Sectioned clinical notes        │    │
│  │   note_id (FK → note), section_concept_id,                   │    │
│  │   section_text, section_order                                │    │
│  │                                                             │    │
│  │ morpheus_note_assertion    — NLP-extracted assertions        │    │
│  │   note_id, concept_id, assertion_type                        │    │
│  │   (present, absent, conditional, historical),                │    │
│  │   confidence_score, extraction_model_version                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Process Mining Domain                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_process_event     — OCEL 2.0 event log              │    │
│  │   event_id, event_type, timestamp,                           │    │
│  │   object_type (patient, provider, room, equipment),          │    │
│  │   object_id, activity, resource, lifecycle_state             │    │
│  │                                                             │    │
│  │ morpheus_process_model     — Discovered process models       │    │
│  │   model_id, model_type (Petri_net, BPMN, DFG),              │    │
│  │   model_data (JSONB), cohort_id, created_at                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Data Provenance & Quality Domain                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_data_source       — Registered EHR sources          │    │
│  │   source_id, source_name, vendor (Epic/Cerner/Meditech/     │    │
│  │   FHIR/MIMIC), connection_type, last_extract_dt,             │    │
│  │   total_patients, dqd_score                                  │    │
│  │                                                             │    │
│  │ morpheus_load_batch        — ETL batch tracking              │    │
│  │   batch_id, source_id, start_dt, end_dt, status,            │    │
│  │   rows_staged, rows_mapped, rows_rejected,                   │    │
│  │   mapping_coverage_pct, dqd_pass                             │    │
│  │                                                             │    │
│  │ morpheus_dq_result         — DQD check results per batch     │    │
│  │   batch_id, check_name, check_level, threshold,              │    │
│  │   result_value, passed                                       │    │
│  │                                                             │    │
│  │ morpheus_concept_gap       — Unmapped source codes            │    │
│  │   source_code, source_vocabulary, frequency,                 │    │
│  │   suggested_concept_id (Abby-suggested),                     │    │
│  │   confidence_score, reviewed_by, accepted                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Prediction & ML Domain                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ morpheus_prediction_model  — Registered ML models            │    │
│  │   model_id, model_name, model_type, version,                 │    │
│  │   target_outcome, training_cohort_id, auc, auprc,            │    │
│  │   feature_set (JSONB), onnx_artifact_path                    │    │
│  │                                                             │    │
│  │ morpheus_prediction_score  — Per-patient model outputs       │    │
│  │   person_id, visit_detail_id, model_id,                      │    │
│  │   score_datetime, predicted_probability,                     │    │
│  │   risk_tier (Low/Medium/High/Critical),                      │    │
│  │   explanation (JSONB — SHAP values)                           │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MORPHEUS ANALYTICS WORKBENCH                      │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ ICU Stay │ │ Bundle   │ │Prediction│ │ Micro-   │ │ Process │ │
│  │Navigator │ │Compliance│ │ Engine   │ │ biology  │ │ Mining  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Periop   │ │ Patient  │ │ Safety   │ │ Data     │ │ Abby    │ │
│  │Dashboard │ │ Flow     │ │ Monitor  │ │ Quality  │ │ AI Chat │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Abby as AI Honest Broker

### The Problem

Real-world EHR data contains Protected Health Information (PHI) that cannot be used for research without either:
1. **Patient consent** (impractical at population scale)
2. **IRB-approved de-identification** (HIPAA Safe Harbor or Expert Determination)

Current de-identification tools are rule-based, brittle, and require extensive manual review. They miss PHI in clinical notes, fail on unusual name patterns, and can't handle the volume of modern EHR exports.

### Abby's Role

Abby serves as the **AI Honest Broker** — a trusted intermediary that:

1. **Receives raw PHI data** from EHR exports (Abby has authorized access)
2. **Detects all PHI elements** using LLM-powered NER + rule-based patterns
3. **Applies de-identification transforms** (date shifting, pseudonymization, geographic coarsening, age capping, note redaction)
4. **Maintains an encrypted crosswalk** mapping de-identified IDs to real MRNs (access-controlled, audit-logged, for authorized re-linkage only)
5. **Logs every operation** for HIPAA compliance and IRB audit trails
6. **Scores re-identification risk** using k-anonymity, l-diversity, and t-closeness metrics
7. **Releases de-identified data** to the Morpheus ingestion pipeline

### De-Identification Strategy

```
HIPAA Safe Harbor (18 identifiers to remove/transform):
 1. Names                    → Pseudonyms (consistent per patient)
 2. Geographic (< state)     → State-level or region only
 3. Dates (except year)      → Random date shift (±180 days, consistent per patient)
 4. Phone numbers            → Remove
 5. Fax numbers              → Remove
 6. Email addresses          → Remove
 7. SSN                      → Remove
 8. MRN                      → Pseudonymized ID (crosswalk vault)
 9. Health plan beneficiary  → Remove
10. Account numbers          → Remove
11. Certificate/license      → Remove
12. Vehicle identifiers      → Remove
13. Device identifiers       → Pseudonymize (for device_exposure tracking)
14. Web URLs                 → Remove
15. IP addresses             → Remove
16. Biometric identifiers    → Remove
17. Full-face photos         → Remove
18. Any other unique ID      → Review and remove/pseudonymize
```

### Clinical Note De-Identification

Clinical notes are the richest and most dangerous data element. Abby uses a multi-pass approach:

```
Pass 1: Structured field masking (MRN, account numbers in note headers)
Pass 2: LLM-powered NER (names, locations, dates, ages >89 in free text)
Pass 3: Rule-based pattern matching (phone formats, SSN patterns, email)
Pass 4: Contextual review (references to specific doctors, facilities, family members)
Pass 5: Confidence scoring (flag low-confidence redactions for human review)
```

### Technology Stack

```
Abby De-ID Service (Python FastAPI):
  ├── PHI Detector (MedGemma / fine-tuned clinical NER)
  ├── Transform Engine (date shift, pseudonym generation, geographic coarsening)
  ├── Crosswalk Vault (PostgreSQL with pgcrypto, encrypted at rest)
  ├── Risk Scorer (k-anonymity / l-diversity computation)
  ├── Audit Logger (immutable append-only log)
  └── Quality Reviewer (human-in-the-loop for low-confidence detections)
```

---

## Source Adapters

### Adapter Interface

Every source adapter implements a common interface:

```python
class SourceAdapter(ABC):
    """Base class for all EHR source adapters."""

    @abstractmethod
    def connect(self, config: SourceConfig) -> Connection:
        """Establish connection to source system."""

    @abstractmethod
    def extract(self, tables: list[str], batch_id: str) -> StagingData:
        """Extract raw data into canonical staging format."""

    @abstractmethod
    def get_schema_map(self) -> dict[str, str]:
        """Map source table/column names to canonical staging names."""

    @abstractmethod
    def get_vocabulary_map(self) -> dict[str, str]:
        """Map source code systems to OMOP vocabulary IDs."""

    def validate(self, data: StagingData) -> QualityReport:
        """Run source-specific validation rules."""
```

### Epic Adapter

Maps Epic Caboodle/Clarity structures to canonical staging:

```
Epic Caboodle/Clarity              → Canonical Staging
─────────────────────              ─────────────────────
PatientDim                         → stg_patient
EncounterFact                      → stg_encounter
DiagnosisFact                      → stg_condition
ProcedureFact / ORLog              → stg_procedure
MedicationAdministration           → stg_drug
LabResultFact / FlowsheetMeasure   → stg_measurement
ClinicalNoteFact                   → stg_note
ORCase / SurgicalCase              → stg_surgical_case
ORLog (timestamps)                 → stg_case_timeline
TransportEvent                     → stg_transport
BedTracking / ADT                  → stg_bed_census
SafetyEvent                        → stg_safety_event
MicrobiologyResult                 → stg_microbiology
```

### MIMIC-IV Adapter (Test/Demo)

The simplest adapter — data is already de-identified:

```
MIMIC-IV                           → Canonical Staging
────────                           ─────────────────────
patients + admissions              → stg_patient, stg_encounter
diagnoses_icd                      → stg_condition
procedures_icd                     → stg_procedure
prescriptions + pharmacy           → stg_drug
labevents + chartevents            → stg_measurement
(no notes in demo)                 → (skip)
icustays + transfers               → stg_icu_stay
microbiologyevents                 → stg_microbiology
```

### FHIR R4 Adapter

For systems with FHIR Bulk Export ($export) or SMART on FHIR:

```
FHIR R4 Resources                  → Canonical Staging
─────────────────                  ─────────────────────
Patient                            → stg_patient
Encounter                          → stg_encounter
Condition                          → stg_condition
Procedure                          → stg_procedure
MedicationRequest/Administration   → stg_drug
Observation (vitals, labs)         → stg_measurement
DiagnosticReport                   → stg_measurement
DocumentReference                  → stg_note
ServiceRequest                     → stg_procedure
```

---

## Canonical Staging Tables

The staging layer is the vendor-neutral bridge between source adapters and OMOP mapping. All adapters produce data in this format.

```sql
-- Every staging table includes these metadata columns
-- source_system_id:  which EHR system (FK → morpheus_data_source)
-- load_batch_id:     which extract run
-- source_table:      original table name in source system
-- source_row_id:     original PK in source system
-- dq_flags:          JSONB with data quality annotations

CREATE TABLE inpatient_staging.stg_patient (
    staging_id          BIGSERIAL PRIMARY KEY,
    person_source_value TEXT NOT NULL,       -- de-identified patient ID
    birth_year          INTEGER,
    gender_source_value TEXT,
    race_source_value   TEXT,
    ethnicity_source_value TEXT,
    death_date          DATE,
    -- metadata
    source_system_id    INTEGER NOT NULL,
    load_batch_id       INTEGER NOT NULL,
    source_table        TEXT,
    source_row_id       TEXT,
    dq_flags            JSONB DEFAULT '{}'
);

CREATE TABLE inpatient_staging.stg_encounter (
    staging_id          BIGSERIAL PRIMARY KEY,
    person_source_value TEXT NOT NULL,
    encounter_source_value TEXT NOT NULL,
    encounter_type      TEXT,               -- inpatient, outpatient, ED, observation
    admit_datetime      TIMESTAMP,
    discharge_datetime  TIMESTAMP,
    admit_source        TEXT,
    discharge_disposition TEXT,
    care_site_source_value TEXT,
    -- metadata
    source_system_id    INTEGER NOT NULL,
    load_batch_id       INTEGER NOT NULL,
    source_table        TEXT,
    source_row_id       TEXT,
    dq_flags            JSONB DEFAULT '{}'
);

CREATE TABLE inpatient_staging.stg_measurement (
    staging_id          BIGSERIAL PRIMARY KEY,
    person_source_value TEXT NOT NULL,
    encounter_source_value TEXT,
    measurement_datetime TIMESTAMP,
    source_code         TEXT NOT NULL,       -- LOINC, local code, itemid
    source_vocabulary   TEXT,                -- LOINC, MIMIC-chartevents, Epic-flowsheet
    value_as_number     NUMERIC,
    value_as_text       TEXT,
    unit_source_value   TEXT,
    range_low           NUMERIC,
    range_high          NUMERIC,
    -- metadata
    source_system_id    INTEGER NOT NULL,
    load_batch_id       INTEGER NOT NULL,
    source_table        TEXT,
    source_row_id       TEXT,
    dq_flags            JSONB DEFAULT '{}'
);

-- ... similar staging tables for:
-- stg_condition, stg_procedure, stg_drug, stg_note,
-- stg_surgical_case, stg_case_timeline, stg_transport,
-- stg_bed_census, stg_safety_event, stg_microbiology,
-- stg_device, stg_specimen
```

---

## Analytics Workbench Modules

### 1. ICU Stay Navigator
- Denormalized ICU stay timeline (visit_detail hierarchy)
- Patient trajectory: ED → ICU → step-down → discharge
- Length-of-stay analytics with percentile benchmarking
- Severity scoring (APACHE-II, SAPS-II, SOFA via OMOP measurements)
- Readmission tracking (48h ICU, 30-day hospital)

### 2. Bundle Compliance Dashboard
- ABCDEF Liberation Bundle monitoring (Islam et al. 2026)
- Real-time adherence scoring against SCCM criteria
- Pain assessment frequency (target: q4h)
- Sedation depth (RASS targets, daily awakening trials)
- Delirium screening (CAM-ICU completion rates)
- Early mobility milestones
- Family engagement documentation
- Components E & F vocabulary gap tracking

### 3. Outcome Prediction Engine
- Ventilator weaning prediction (Sheikhalishahi et al.)
- Blood transfusion prediction (Schwinn et al.)
- Mortality risk (SAPS-II, APACHE-II)
- Sepsis onset (Sepsis-3 criteria)
- Readmission risk
- Architecture: FastAPI model serving, ONNX runtime, SHAP explanations

### 4. Perioperative Dashboard
- OR utilization and block efficiency (from Zephyrus patterns)
- Case timeline visualization (15+ phase timestamps)
- Turnover analysis
- Cancellation tracking and root cause
- Provider utilization

### 5. Patient Flow Monitor
- Real-time bed census and capacity forecasting
- Transport tracking and delays
- Care milestone completion (H&P, consent, labs, safety check)
- Boarding detection and escalation

### 6. Safety & Quality Monitor
- Structured safety event tracking
- Quality measure reporting (CMS, Joint Commission, Leapfrog)
- HAI surveillance integration
- Near-miss and adverse event trending

### 7. Microbiology Workbench
- Antibiogram analysis (organism × antibiotic heatmap)
- Blood culture cascade visualization
- Infection timeline correlation with interventions
- AMR pattern detection across cohorts

### 8. Process Mining Console
- OCEL 2.0 event log generation (Park et al.)
- Care pathway discovery and conformance checking
- Bottleneck identification
- Variant analysis by outcome

### 9. Data Quality Monitor
- Per-source DQD scores
- Mapping coverage tracking
- Concept gap management (Abby-assisted)
- Batch load monitoring

### 10. Abby AI Assistant
- Natural language querying of inpatient cohorts
- Concept mapping suggestions for unmapped codes
- Clinical note summarization
- Prediction model explanation
- Literature-backed clinical decision support

---

## API Layer

```
/api/v1/morpheus/
  # Ingestion & Data Management
  /sources/                   — Registered EHR data sources
  /sources/{id}/loads         — Load batch history and status
  /sources/{id}/quality       — DQD results per source
  /deid/                      — De-identification job management
  /deid/{job_id}/audit        — PHI audit trail
  /concept-gaps/              — Unmapped source codes for review
  /concept-gaps/{id}/suggest  — Abby mapping suggestions

  # Clinical Analytics
  /patients/                  — Patient search and demographics
  /icu-stays/                 — ICU stay timelines
  /measurements/              — Vitals, labs, ventilator parameters
  /surgical-cases/            — Perioperative case records
  /surgical-cases/{id}/timeline — Phase-level timestamps
  /bundle/                    — ABCDEF compliance data
  /bundle/adherence           — Adherence scores and trends
  /predictions/               — Model predictions
  /predictions/{model}/explain — SHAP explanations
  /microbiology/              — Culture results and antibiograms
  /infections/                — Infection episode tracking

  # Operations
  /flow/census                — Real-time bed census
  /flow/transport             — Transport events
  /flow/milestones            — Care journey milestones
  /safety/                    — Safety events
  /quality/measures           — Quality metrics

  # Process Mining
  /process/events             — OCEL event logs
  /process/models             — Discovered process models
  /process/conformance        — Conformance checking results

  # Cohort Integration
  /cohorts/                   — Cohort builder (ties into Parthenon Studies)
```

---

## Frontend Structure

```
frontend/src/features/morpheus/
  pages/
    MorpheusDashboard.tsx           — Module landing page
    IngestionPage.tsx               — Source management, load monitoring
    DeIdentificationPage.tsx        — De-ID job management, audit viewer
    IcuNavigatorPage.tsx            — ICU stay explorer
    BundleCompliancePage.tsx        — ABCDEF dashboard
    PerioperativePage.tsx           — Surgical case analytics
    PatientFlowPage.tsx             — Bed census, transport, milestones
    PredictionsPage.tsx             — ML model outputs
    MicrobiologyPage.tsx            — Antibiogram, infection tracking
    SafetyPage.tsx                  — Safety event monitoring
    ProcessMiningPage.tsx           — Care pathway analysis
    DataQualityPage.tsx             — DQD results, concept gap management
  components/
    IcuStayTimeline.tsx             — Patient trajectory visualization
    BundleComplianceCard.tsx        — Individual bundle component card
    CaseTimelineChart.tsx           — 15-phase perioperative timeline
    VitalsTimeseries.tsx            — Multi-parameter vitals chart
    PredictionPanel.tsx             — Risk scores with SHAP
    AntibiogramMatrix.tsx           — Organism × antibiotic heatmap
    BedCensusHeatmap.tsx            — Unit-level occupancy
    TransportTracker.tsx            — Patient movement map
    ProcessFlowDiagram.tsx          — Care pathway Sankey/flow
    ConceptGapReviewer.tsx          — Unmapped code review with Abby
    DeIdAuditViewer.tsx             — PHI removal audit trail
    DataQualityGauge.tsx            — DQ metrics visualization
  hooks/
    useMorpheusQuery.ts             — OMOP-aware data fetching
    useIcuMetrics.ts                — Computed ICU metrics
    useBundleCompliance.ts          — Bundle adherence calculations
    usePredictions.ts               — ML model integration
    useProcessMining.ts             — OCEL event queries
  stores/
    morpheusStore.ts                — Module state management
  types/
    morpheus.types.ts               — TypeScript interfaces
```

---

## Implementation Phases

### Phase A: Foundation (Current)
- [x] Directory structure and ETL repos cloned
- [x] MIMIC-IV demo loaded as test data
- [x] OMOP CDM 5.4 tables created in `inpatient` schema
- [x] OMOP vocabularies loaded (139M rows)
- [ ] Revise Morpheus.md spec (this document)
- [ ] Design canonical staging schema DDL
- [ ] Design extension table DDL
- [ ] Create `inpatient_staging` and `inpatient_ext` schemas

### Phase B: MIMIC-IV Adapter + Basic ETL
- [ ] Implement MimicAdapter (simplest case — already de-identified)
- [ ] Build canonical staging → OMOP mapper
- [ ] Run ETL for 100-patient demo
- [ ] Validate with DQD
- [ ] Create denormalized ICU views

### Phase C: Abby De-Identification Service
- [ ] PHI detection engine (structured fields + clinical notes)
- [ ] Date shifting with consistent per-patient offset
- [ ] Pseudonymization service
- [ ] Encrypted crosswalk vault
- [ ] Audit logging
- [ ] Re-identification risk scoring
- [ ] Human review interface for low-confidence detections

### Phase D: Epic Adapter
- [ ] Map Caboodle/Clarity → canonical staging
- [ ] Perioperative data mapping (OR cases, timelines, metrics)
- [ ] Patient flow data (transport, bed census, milestones)
- [ ] Safety events
- [ ] Clinical notes (through Abby de-ID)
- [ ] End-to-end: Epic extract → Abby → staging → OMOP

### Phase E: Analytics Workbench UI
- [ ] ICU Stay Navigator
- [ ] Bundle Compliance Dashboard
- [ ] Perioperative Dashboard
- [ ] Patient Flow Monitor
- [ ] Data Quality Monitor

### Phase F: Prediction Engine
- [ ] Ventilator weaning model
- [ ] Sepsis onset detection
- [ ] Mortality risk stratification
- [ ] ONNX serving infrastructure
- [ ] SHAP explanation generation

### Phase G: Advanced Analytics
- [ ] Microbiology Workbench
- [ ] Process Mining Console
- [ ] Safety & Quality Monitor
- [ ] Abby AI integration (NL querying, concept mapping, note summarization)

### Phase H: Production Hardening
- [ ] FHIR R4 adapter
- [ ] Cerner adapter
- [ ] Real-time HL7v2 feed processing
- [ ] Federated learning support
- [ ] Multi-site deployment patterns

---

## Key Literature

1. Paris et al. (2021) — First MIMIC→OMOP ETL, denormalized view patterns
2. Sheikhalishahi et al. (2025) — Federated ventilator weaning prediction
3. Schwinn et al. (2025) — Federated blood transfusion prediction
4. Islam et al. (2026) — ICU Liberation Bundle OMOP vocabulary mappings
5. Oliver et al. (2023) — BlendedICU multi-database harmonization
6. Park et al. (2024) — OMOP CDM → OCEL process mining
7. Liu et al. (2026) — EHR data quality benchmarking
8. Kim et al. (2026) — MedRep OMOP concept embeddings
9. Xiao et al. (2022) — FHIR-Ontop-OMOP knowledge graphs

---

## Database Schema Summary

```
parthenon
├── inpatient               — OMOP CDM 5.4 clinical tables + vocabulary
├── inpatient_staging       — Canonical staging layer (vendor-neutral)
├── inpatient_ext           — Morpheus extension tables
├── inpatient_deid          — De-identification crosswalk vault (encrypted)
├── app                     — Parthenon application tables
├── omop                    — Main OMOP CDM (existing)
├── results                 — Achilles/DQD output
├── gis                     — Geospatial tables
├── eunomia                 — GiBleed demo dataset
├── eunomia_results         — Demo Achilles results
├── php                     — Laravel internals
└── webapi                  — Legacy OHDSI WebAPI
```
