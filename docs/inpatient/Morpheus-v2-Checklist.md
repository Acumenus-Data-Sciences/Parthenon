# Morpheus v2 — Implementation Checklist

## Design Decisions

- [x] Pipeline model: Separate pipeline, shared services (Option B)
- [x] De-ID boundary: Abby de-IDs before Parthenon + streaming for structured data (Option A+C)
- [x] Honest broker database: `abby-hb` — dedicated, hardened, physically isolated
- [x] First EHR sources: FHIR R4 Bulk Export + HL7v2 ADT
- [x] Vocabulary strategy: Shared `omop.*`, no duplication
- [x] Deployment model: Docker for dev, separate host for production PHI (Option C)
- [x] Architecture: Three-service mesh (abby-hb, morpheus-ingest, Parthenon)

---

## Phase A: Foundation

- [ ] A.0 Prerequisite: Verify `omop.*` vocabulary on host PG 17, drop duplicate vocabulary tables from Docker `inpatient.*`
- [ ] A.1 Create `inpatient_staging` schema DDL (canonical staging tables)
  - [ ] stg_patient
  - [ ] stg_encounter
  - [ ] stg_condition
  - [ ] stg_procedure
  - [ ] stg_drug
  - [ ] stg_measurement
  - [ ] stg_note
  - [ ] stg_device
  - [ ] stg_specimen
  - [ ] stg_microbiology
  - [ ] stg_surgical_case
  - [ ] stg_case_timeline
  - [ ] stg_transport
  - [ ] stg_safety_event
  - [ ] stg_bed_census
  - [ ] load_batch
  - [ ] concept_gap
- [ ] A.2 Create `inpatient_ext` schema DDL (extension tables)
  - [ ] Perioperative: surgical_case, case_timeline, case_metrics
  - [ ] ICU: icu_stay, bundle_card, bundle_assessment, vitals_ts
  - [ ] Patient Flow: transport, bed_census, care_milestone
  - [ ] Safety & Quality: safety_event, quality_measure
  - [ ] Microbiology: antibiogram, infection_episode
  - [ ] NLP: note_section, note_assertion
  - [ ] Process Mining: process_event, process_model
  - [ ] Predictions: prediction_model, prediction_score
  - [ ] Data Provenance: data_source, load_batch, dq_result
- [ ] A.3 Reconfigure `inpatient.*` to use `omop.*` vocabulary (drop duplicated vocab tables from inpatient)
- [ ] A.4 Add `inpatient` Laravel DB connection in `config/database.php`
- [ ] A.5 Build MimicAdapter in morpheus-ingest
  - [ ] morpheus-ingest FastAPI service skeleton (port 8004)
  - [ ] MimicAdapter: MIMIC-IV CSVs → canonical staging tables
  - [ ] Bulk writer using COPY FROM STDIN
- [ ] A.6 Build OMOP mapper
  - [ ] person_mapper (stg_patient → person + location)
  - [ ] visit_mapper (stg_encounter → visit_occurrence + visit_detail)
  - [ ] condition_mapper (stg_condition → condition_occurrence, ICD→SNOMED)
  - [ ] drug_mapper (stg_drug → drug_exposure, NDC→RxNorm)
  - [ ] measurement_mapper (stg_measurement → measurement, LOINC)
  - [ ] procedure_mapper (stg_procedure → procedure_occurrence)
  - [ ] observation_mapper (overflow → observation via domain routing)
  - [ ] note_mapper (stg_note → note)
  - [ ] specimen_mapper (stg_specimen → specimen)
  - [ ] death_mapper (stg_patient death_date → death)
  - [ ] domain_router (route by concept.domain_id)
  - [ ] era_builder (condition_era, drug_era, dose_era, observation_period)
- [ ] A.7 Build quality gate
  - [ ] DQD check runner
  - [ ] Mapping coverage checker (target: ≥70%)
  - [ ] Referential integrity checker
  - [ ] Date plausibility checker
  - [ ] Pass/fail gate decision
- [ ] A.8 End-to-end validation
  - [ ] Run: MIMIC-IV demo → staging → CDM → validate
  - [ ] Verify row counts match expectations
  - [ ] Verify DQD passes

---

## Phase B: Honest Broker Foundation

- [ ] B.1 Create `abby-hb` PostgreSQL instance (Docker container for dev)
- [ ] B.2 Create `abby-hb` schema
  - [ ] vault.crosswalk (encrypted: real_id ↔ pseudo_id)
  - [ ] vault.date_shift (encrypted: person_pseudo_id → shift_days)
  - [ ] staging.phi_note (temporary clinical note holding)
  - [ ] audit.deid_log (immutable: PHI detection/transform log)
  - [ ] audit.access_log (immutable: crosswalk access log)
  - [ ] config.source_registry (registered EHR sources)
- [ ] B.3 Build abby-hb FastAPI service skeleton (port 8003)
  - [ ] Dockerfile
  - [ ] docker-compose.yml additions (abby-hb service + abby-hb-db)
  - [ ] SQLAlchemy models + Alembic migrations
  - [ ] Health check endpoint
- [ ] B.4 Implement PHI detection
  - [ ] StructuredDetector (regex + field heuristics for SSN, MRN, phone, email, DOB, names)
  - [ ] Integration with existing Abby PHI sanitizer patterns
- [ ] B.5 Implement de-identification transforms
  - [ ] DateShifter (±180 days, consistent per patient, preserves day-of-week)
  - [ ] Pseudonymizer (deterministic: same real ID → same pseudo ID)
  - [ ] GeoCoarsener (address → state, zip → first 3 digits if pop >20K)
  - [ ] AgeCapper (age >89 → 90)
  - [ ] FieldStripper (remove phone, fax, email, SSN, URLs, IPs)
- [ ] B.6 Implement crosswalk vault
  - [ ] pgcrypto encryption for crosswalk fields
  - [ ] store() — insert real_id → pseudo_id mapping
  - [ ] lookup() — retrieve mapping (audit-logged, ACL-gated)
  - [ ] rotate() — re-key pseudonyms (breach response)
- [ ] B.7 Implement immutable audit log
  - [ ] log_detection() — what PHI was found, where
  - [ ] log_transform() — what transform was applied
  - [ ] log_access() — every crosswalk lookup
  - [ ] log_release() — data released to morpheus-ingest
  - [ ] No DELETE/TRUNCATE permissions on audit tables
- [ ] B.8 Build `/deid/fhir-resource` endpoint (single resource de-ID)
- [ ] B.9 Build `/deid/fhir-batch` endpoint (NDJSON streaming)
- [ ] B.10 End-to-end test
  - [ ] Generate synthetic FHIR Patient bundle with PHI
  - [ ] Send through abby-hb → verify PHI removed
  - [ ] Forward to morpheus-ingest → verify CDM tables populated
  - [ ] Verify audit log entries
  - [ ] Verify crosswalk contains mapping

---

## Phase C: FHIR R4 Adapter

- [ ] C.1 Build FhirAdapter (FHIR R4 resources → canonical staging)
  - [ ] Patient → stg_patient
  - [ ] Encounter → stg_encounter
  - [ ] Condition → stg_condition
  - [ ] Procedure → stg_procedure
  - [ ] MedicationRequest/MedicationAdministration → stg_drug
  - [ ] Observation (vitals, labs) → stg_measurement
  - [ ] DiagnosticReport → stg_measurement
  - [ ] DocumentReference → stg_note
  - [ ] ServiceRequest → stg_procedure
- [ ] C.2 Implement domain routing (concept.domain_id → correct CDM table)
- [ ] C.3 Implement concept gap tracking
  - [ ] Track unmapped codes with frequency
  - [ ] Abby suggestion integration (SapBERT + MedGemma)
  - [ ] UI for human review (accept/reject/custom)
- [ ] C.4 Build FHIR $export client
  - [ ] Kick-off request
  - [ ] Status polling
  - [ ] NDJSON download and streaming to abby-hb
- [ ] C.5 FHIR-specific validation rules in quality gate
- [ ] C.6 Test with external FHIR sources
  - [ ] HAPI FHIR test server
  - [ ] Synthea-generated patient bundles
  - [ ] Verify end-to-end: $export → abby-hb → ingest → CDM → DQD pass

---

## Phase D: HL7v2 ADT Real-Time

- [ ] D.1 Build MLLP listener in abby-hb (TCP port 2575)
- [ ] D.2 Build HL7v2 parser
  - [ ] PID segment (patient identity)
  - [ ] PV1 segment (patient visit)
  - [ ] EVN segment (event type/timestamp)
  - [ ] NK1 segment (next of kin — strip entirely)
- [ ] D.3 Implement ADT-specific de-ID (fast path, <100ms target)
- [ ] D.4 Set up Redis Stream: abby-hb → morpheus-ingest
- [ ] D.5 Build ADT consumer in morpheus-ingest
  - [ ] A01 handler (Admit → visit_occurrence + bed_census + milestones)
  - [ ] A02 handler (Transfer → visit_detail + transport + bed_census)
  - [ ] A03 handler (Discharge → visit_occurrence update + bed_census)
  - [ ] A04 handler (Register/ED arrival)
  - [ ] A06/A07 handler (Class change: outpatient ↔ inpatient)
  - [ ] A08 handler (Update demographics/location)
  - [ ] A11/A12/A13 handler (Cancellations — soft-reverse, never hard delete)
- [ ] D.6 Build bed_census running state table (updated per ADT event)
- [ ] D.7 Wire Laravel Reverb for WebSocket push
  - [ ] ADT event broadcasting
  - [ ] Frontend subscription in useMorpheusWebSocket.ts
- [ ] D.8 Test with HL7v2 message simulator
  - [ ] Simulate admit → transfer → discharge sequence
  - [ ] Verify bed census updates in real-time
  - [ ] Verify WebSocket events reach frontend
  - [ ] Verify <100ms de-ID latency

---

## Phase E: Analytics Workbench — Core

- [ ] E.1 Build ICU stay derivation
  - [ ] visit_detail → icu_stay (filter by ICU care_site concepts)
  - [ ] LOS calculation, severity scoring
  - [ ] Readmission detection (48h ICU, 30-day hospital)
- [ ] E.2 Build bundle assessment mapper
  - [ ] Identify RASS measurements → B_Sedation
  - [ ] Identify CAM-ICU measurements → D_Delirium
  - [ ] Identify pain scale measurements → A_Pain
  - [ ] Adherence scoring against SCCM criteria
- [ ] E.3 Laravel controllers
  - [ ] IcuStayController (index, show, vitals, timeline)
  - [ ] BundleController (adherence, assessments, cards)
  - [ ] PatientFlowController (census, censusHistory, transport, milestones)
  - [ ] MorpheusSourceController (sources CRUD, batch history)
- [ ] E.4 Eloquent models
  - [ ] MorpheusModel abstract base (connection: 'inpatient')
  - [ ] Cdm/ models (Person, VisitOccurrence, VisitDetail, etc.)
  - [ ] Ext/ models (IcuStay, BundleAssessment, BedCensus, etc.)
- [ ] E.5 React pages
  - [ ] MorpheusLayout.tsx (module shell, sidebar nav)
  - [ ] DashboardPage.tsx (KPIs, recent batches, alerts)
  - [ ] IcuNavigatorPage.tsx
  - [ ] BundleCompliancePage.tsx
  - [ ] PatientFlowPage.tsx
  - [ ] SourcesPage.tsx
- [ ] E.6 React components
  - [ ] IcuStayTimeline.tsx
  - [ ] VitalsChart.tsx (Recharts multi-parameter)
  - [ ] BundleRadar.tsx
  - [ ] BundleComplianceCard.tsx
  - [ ] BedCensusHeatmap.tsx
  - [ ] TransportMap.tsx
  - [ ] BatchProgressBar.tsx
  - [ ] MorpheusMetricCard.tsx
- [ ] E.7 Frontend infrastructure
  - [ ] api.ts (TanStack Query hooks)
  - [ ] morpheusStore.ts (Zustand)
  - [ ] useMorpheusWebSocket.ts (Reverb for live ADT)
  - [ ] morpheus.types.ts (TypeScript interfaces)

---

## Phase F: Clinical Note De-ID

- [ ] F.1 Build NER pipeline
  - [ ] MedGemma clinical entity detection (names, locations, dates in free text)
  - [ ] Integration with existing Abby NER capabilities
- [ ] F.2 Build multi-pass note de-ID orchestrator
  - [ ] Pass 1: Structured header masking (MRN, account # in metadata)
  - [ ] Pass 2: NER (MedGemma) for names, locations, dates
  - [ ] Pass 3: Regex patterns (phone, SSN, email formats)
  - [ ] Pass 4: Context inference (doctor names, facility references)
  - [ ] Pass 5: Confidence scoring
- [ ] F.3 Implement human review queue
  - [ ] Queue notes with any detection confidence <0.8
  - [ ] Review UI: highlighted spans + confidence scores
  - [ ] Accept/adjust/flag missed PHI workflow
- [ ] F.4 Build temporary PHI note store
  - [ ] Auto-purge after de-ID complete + 72h verification window
  - [ ] Encrypted at rest
- [ ] F.5 Build `/deid/note` endpoint in abby-hb
- [ ] F.6 Build note → note_nlp mapper in morpheus-ingest
  - [ ] Section segmentation (note_section)
  - [ ] Assertion extraction: present/absent/conditional/historical (note_assertion)
- [ ] F.7 Test with synthetic clinical notes
  - [ ] Discharge summaries
  - [ ] Progress notes
  - [ ] Radiology reports
  - [ ] Verify PHI removal across all note types
  - [ ] Measure detection recall/precision

---

## Phase G: Analytics Workbench — Advanced

- [ ] G.1 Perioperative module
  - [ ] periop_mapper (stg_surgical_case → extension tables)
  - [ ] SurgicalCaseController + React PerioperativePage
  - [ ] CaseTimelineChart component (15-phase Gantt)
  - [ ] OR utilization analytics
- [ ] G.2 Microbiology module
  - [ ] micro_mapper (stg_microbiology → antibiogram + infection_episode)
  - [ ] MicrobiologyController + React MicrobiologyPage
  - [ ] AntibiogramMatrix component (organism × antibiotic heatmap)
- [ ] G.3 Safety & Quality module
  - [ ] safety_mapper (stg_safety_event → safety_event)
  - [ ] SafetyController + QualityController
  - [ ] React SafetyPage
- [ ] G.4 Process Mining module
  - [ ] process_mapper (visit/procedure timestamps → OCEL 2.0 events)
  - [ ] ProcessMiningController + React ProcessMiningPage
  - [ ] ProcessSankey component (care pathway visualization)
- [ ] G.5 Prediction Engine
  - [ ] ONNX model serving via ai/ service
  - [ ] SHAP explanation generation
  - [ ] PredictionController + React PredictionsPage
  - [ ] PredictionGauge + ShapWaterfall components
- [ ] G.6 Data Quality Management
  - [ ] DataQualityController + React DataQualityPage
  - [ ] ConceptGapController + React ConceptGapPage
  - [ ] DqScoreCard + ConceptGapTable components

---

## Phase H: Production Hardening

- [ ] H.1 Infrastructure separation
  - [ ] Move abby-hb to separate host/VM
  - [ ] Separate PostgreSQL instance for abby-hb DB
  - [ ] Network isolation (abby-hb ↔ morpheus-ingest only)
- [ ] H.2 Security hardening
  - [ ] TLS enforcement on all abby-hb connections
  - [ ] Secrets manager integration (not .env files)
  - [ ] Dedicated service account for abby-hb DB
  - [ ] No Laravel/frontend/R access to abby-hb
- [ ] H.3 Risk assessment
  - [ ] Re-identification risk scoring (k-anonymity, l-diversity)
  - [ ] Risk reporting per batch/dataset
- [ ] H.4 Data lifecycle
  - [ ] PHI auto-purge verification (72h window)
  - [ ] Staging data retention policies
  - [ ] Crosswalk backup procedures
- [ ] H.5 Compliance
  - [ ] HIPAA Safe Harbor compliance documentation
  - [ ] IRB integration metadata
  - [ ] Audit report generation
- [ ] H.6 Performance
  - [ ] Load testing with realistic data volumes
  - [ ] ADT throughput testing (target: 1000 msgs/min)
  - [ ] FHIR batch testing (target: 100K resources/batch)
- [ ] H.7 Additional adapters (as partnerships form)
  - [ ] Cerner Millennium adapter
  - [ ] Native Epic Caboodle/Clarity adapter
  - [ ] Meditech adapter
