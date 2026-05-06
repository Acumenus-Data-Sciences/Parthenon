# Parthenon Ingestion Templates — Phase 3, Plan 5: T-023 — `lis_lab_to_omop` (HL7 v2 ORU + LOINC harmonizer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lands `lis_lab_to_omop` template — parses HL7 v2.x ORU^R01 (lab results) messages, projects to OMOP `MEASUREMENT`, and ships a LOINC harmonizer that suggests LOINC candidates for unmapped local lab codes. Mixed-tier: HL7 v2 reader is **community** (AGPLv3); the LOINC harmonizer's AI-assisted-mapping handoff lives in **commercial** (proprietary). Uses `python-hl7` (Phase 3 Q6=(b)).

**Architecture:** New community-tier node `Hl7v2OruReader` (`templates/runtime/nodes/hl7v2_oru_reader.py`) parses HL7 v2.5/2.5.1 ORU^R01 messages and emits one row per OBX segment. The mapper SQL projects OBX rows to MEASUREMENT, joining on `vocab.concept` (LOINC) where the source-system local code maps cleanly. Unmapped local codes flow into a `unmapped_local_lab_code` queue table — the commercial-tier T-024 mapping backend (Plan 6) reads from this queue.

The LOINC harmonizer's *suggester* (the AI side) is commercial-tier; the *queue table* itself is community-tier (just data). This way customers running only the community wheel get a queue they can review manually, and customers with the commercial wheel get the AI-assisted suggestions.

**Tech Stack:** Python 3.12, `python-hl7==0.4.5` (BSD).

**Depends on:**
- Phase 3 Plan 0 (sql_file:// reader merged)
- Optional: Phase 3 Plan 1 commercial-tier wheel scaffolding (only if the harmonizer's commercial-side stub lands here; can be deferred to Plan 6)

**Unblocks:**
- Plan 6 (T-024A) — `ai_assisted_mapping` reads from the `unmapped_local_lab_code` queue.

---

## Conventions

Same as prior plans. Branch: `feature/phase-3-plan-5-lis-lab`. Type names: `Hl7v2OruReader`, `OruR01Message`, `OruObservation`, `Hl7v2ParseError`, `LoincHarmonizerStub`.

---

## Task index (12 tasks)

1. Pin `python-hl7==0.4.5` (BSD)
2. `OruR01Message` + `OruObservation` typed Pydantic models
3. `Hl7v2OruReader` core (handles MSH/PID/PV1/OBR/OBX segments)
4. ORU^R30 (unsolicited ED result) + ORU^R31 (encounter-tied result) variant support
5. SQL bootstrap — `fmt_oru_message` + `fmt_oru_observation` source tables
6. Mapper — OBX rows → MEASUREMENT with LOINC concept_id lookup
7. `unmapped_local_lab_code` queue table — appended on every unmapped code
8. Synthetic ORU corpus (50 messages, deterministic, real LOINC codes mixed with synthetic local codes)
9. `LoincHarmonizerStub` — minimal community-tier interface (Plan 6 implements the suggester)
10. Manifest scaffold — `lis_lab_to_omop/manifest.yaml`
11. Validation pack — DQD post-conditions + queue-population check
12. ADR 0018 — lis_lab_to_omop tiering boundary

---

## Task 1: Pin python-hl7

Add `python-hl7==0.4.5` to `templates/pyproject.toml` (community wheel — python-hl7 is BSD). **Commit:** `chore(templates): pin python-hl7==0.4.5 (BSD) for HL7 v2.x parsing`.

---

## Task 2: Types

```python
class OruObservation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    set_id: int = Field(ge=1)  # OBX-1
    value_type: str  # OBX-2 (e.g. "NM" numeric, "CE" coded entry, "ST" string)
    observation_id: str  # OBX-3 — the local lab code
    observation_id_text: str  # human-readable
    coding_system: str  # OBX-3 system field, often "L" or "LN" (LOINC)
    observation_value: str
    units: str | None = None
    observation_date: datetime
    abnormal_flag: str | None = None  # OBX-8


class OruR01Message(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    message_control_id: str  # MSH-10
    sending_application: str  # MSH-3
    sending_facility: str  # MSH-4
    patient_id: str  # PID-3 — de-identified per HIGHSEC
    encounter_id: str | None = None  # PV1-19
    order_control_code: str  # OBR-11
    universal_service_id: str  # OBR-4 — the order-level local code
    observations: list[OruObservation]
```

**Commit:** `feat(templates): OruR01Message + OruObservation typed models`.

---

## Task 3: Reader core

`Hl7v2OruReader.read(text: str) -> Iterable[OruR01Message]`. Splits on MSH segment, walks segments using `python-hl7`, materializes one message per MSH-rooted block. **Commit:** `feat(templates): Hl7v2OruReader core (R01 segment walker)`.

---

## Task 4: R30 + R31 variants

ORU^R30 (unsolicited point-of-care result) and ORU^R31 (encounter-tied) share the OBX shape but differ in the controlling segments. Reader handles both via the trigger-event field MSH-9. **Commit:** `feat(templates): Hl7v2OruReader R30/R31 trigger-event variants`.

---

## Task 5: SQL bootstrap

`fmt_oru_message` (one row per HL7 message) + `fmt_oru_observation` (one row per OBX segment). **Commit:** `feat(templates): lis_lab_to_omop bootstrap SQL`.

---

## Task 6: MEASUREMENT mapper

`02_map_measurement.sql` joins `fmt_oru_observation` to `vocab.concept` where `coding_system` is `LN` or where `observation_id` matches a curated alias map. Emits `${cdm_schema}.measurement` rows. **Commit:** `feat(templates): lis_lab_to_omop OBX → MEASUREMENT mapper`.

---

## Task 7: Unmapped queue

`03_queue_unmapped.sql` inserts unmapped (local-coded, no LOINC match) observations into `${app_schema}.unmapped_local_lab_code` for downstream T-024 review. Schema: `(local_code, local_code_text, sending_facility, observation_count, first_seen_at, last_seen_at)`. **Commit:** `feat(templates): unmapped_local_lab_code queue for T-024 handoff`.

---

## Task 8: Synthetic ORU corpus

Deterministic 50-message corpus (seed=42). Mix: 30 messages with all OBX segments mapping to standard LOINC; 20 messages with 50% local-coded OBX (queue-populated path). **Commit:** `feat(templates): synthetic ORU corpus + LOINC mix`.

---

## Task 9: `LoincHarmonizerStub`

Community-tier interface at `templates/runtime/lab/harmonizer.py`:

```python
class LoincHarmonizer(Protocol):
    def suggest(self, local_code: str, local_text: str, examples: list[str]) -> list[Suggestion]: ...
```

Stub implementation returns empty list (no suggestions in community tier). Plan 6 implements the commercial suggester. **Commit:** `feat(templates): LoincHarmonizer protocol + community-tier stub`.

---

## Task 10: Manifest

7-stage `lis_lab_to_omop/manifest.yaml` (community-tier, lives in `templates/manifests/`). **Commit:** `feat(templates): lis_lab_to_omop manifest`.

---

## Task 11: Validation pack

DQD post-conditions:
- Every MEASUREMENT has non-null `measurement_concept_id`
- Every unmapped observation populates the queue
- Throughput: 10k OBX < 2 min

**Commit:** `test(templates): lis_lab_to_omop E2E with queue population check`.

---

## Task 12: ADR 0018

ADR records:
- **Context:** Lab data is community-tier (FHIR-grade interop), but AI-assisted mapping for unmapped local codes is the commercial wedge.
- **Decision:** Split the template along this seam — reader + mapper + queue are AGPLv3 community; harmonizer (suggester) is proprietary commercial.
- **Consequences:** Customers on the community wheel get full lab ingestion + a queue they can manually review. Commercial customers get the queue + AI suggestions on top.
- **Alternatives:** Whole template commercial (loses lab interop as community capability); whole template community (gives away the AI wedge).

**Commit:** `docs(adr): ADR 0018 — lis_lab_to_omop tiering boundary`.

---

## Done

T-023 ships after Task 12. The community-tier template ingests HL7 v2 ORU and produces a queue of unmapped local codes that Plan 6's commercial harmonizer reads.
