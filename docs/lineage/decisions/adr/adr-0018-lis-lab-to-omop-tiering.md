# ADR 0018 — `lis_lab_to_omop` tiering boundary

**Status:** Accepted (2026-05-06)
**Deciders:** Phase 3 spec Q6 (HL7 v2 parser choice) + Q12 (commercial wedge).
**Implements:** Phase 3 Plan 5 (T-023). Referenced by Plan 6 (T-024).

## Context

The `lis_lab_to_omop` template ingests HL7 v2.x ORU^R01/R30/R31 lab
result messages and projects them to OMOP CDM v5.4 `MEASUREMENT`. Two
domains intersect here:

1. **Lab interoperability** is a community-grade capability. Customers
   on the AGPLv3 wheel must be able to ingest HL7 v2 ORU end-to-end —
   anything less means we're not a serious clinical-data platform.
2. **AI-assisted concept mapping** is the commercial wedge. Plan 6
   (T-024) lands a hybrid bge-base + LLM rerank harmonizer with hard
   acceptance gates (top-1 ≥ 60%, top-5 ≥ 85%) — that work is the
   reason customers pay for the proprietary wheel.

Putting the entire template in one tier loses one of the two:

- **Whole-template-community** gives away the AI mapping wedge.
- **Whole-template-commercial** loses lab interop as a community
  capability and gates lab data behind a license fee.

Neither is acceptable.

## Decision

**Split the template along the harmonizer seam.** Concretely:

| Component | Tier | License |
|----------|------|--------|
| `Hl7v2OruReader` (R01/R30/R31) | Community | AGPLv3 |
| `OruR01Message` + `OruObservation` types | Community | AGPLv3 |
| `fmt_oru_message` + `fmt_oru_observation` source tables | Community | AGPLv3 |
| `02_map_measurement.sql` (LOINC + concept_id=0 fallback) | Community | AGPLv3 |
| `03_queue_unmapped_local_codes.sql` (queue table) | Community | AGPLv3 |
| `LoincHarmonizer` Protocol | Community | AGPLv3 |
| `LoincHarmonizerStub` (no-op) | Community | AGPLv3 |
| Synthetic ORU corpus + validation E2E | Community | AGPLv3 |
| `BgeRerankLoincHarmonizer` (Plan 6) | **Commercial** | **Proprietary** |
| AI suggester model weights + LLM rerank prompts | **Commercial** | **Proprietary** |
| Suggestion review UI (Plan 6 frontend) | **Commercial** | **Proprietary** |

The Protocol lives in the community wheel so the queue UI / downstream
code can `isinstance(x, LoincHarmonizer)` without branching on tier;
the stub returns `[]` so callers don't need to special-case "no
suggester". Plan 6 ships an additional implementation of the same
Protocol in `commercial/runtime/commercial/lab/harmonizer.py`.

### HL7 v2 parser choice

Phase 3 spec Q6 had three options for the HL7 v2.x parser:

- (a) `hl7apy` — full-featured but heavier and primarily targets
  HL7 v2.5 / v2.6 / v2.7 message validation.
- (b) **`python-hl7` (PyPI: `hl7`) — minimal, BSD-licensed, focused
  on parsing rather than generation.** ✓ **Chosen.**
- (c) Hand-rolled segment splitter — not worth the maintenance burden
  for ~10 segment types we actually care about.

Option (b) won on license + footprint. The reader handles MSH/PID/
PV1/OBR/OBX directly without leaning on `hl7apy`'s validation machinery
(which would force us to bring HL7 v2 schemas into the wheel).

## Consequences

### What customers running only the community wheel get

- Full HL7 v2 ORU R01/R30/R31 ingestion.
- LOINC-coded labs project to MEASUREMENT with non-zero
  `measurement_concept_id` automatically.
- Local-coded labs ride through with `measurement_concept_id = 0`
  and are aggregated into `${source_schema}.unmapped_local_lab_code`
  for manual review.
- A no-op `LoincHarmonizerStub` so the queue UI works out of the box
  (it just shows zero suggestions per code).

### What customers with the commercial wheel get on top

- The Plan 6 `BgeRerankLoincHarmonizer` consumes the queue and
  produces ranked LOINC suggestions per local code.
- Acceptance gates: top-1 ≥ 60%, top-5 ≥ 85% on the held-out
  evaluation corpus.

### What this means for the codebase

- Community tier (this Plan): `templates/runtime/lab/`,
  `templates/runtime/nodes/hl7v2_oru_reader.py`,
  `templates/manifests/lis_lab_to_omop/`.
- Commercial tier (Plan 6): `commercial/runtime/commercial/lab/`.
- The `import-linter` contract continues to enforce that community
  code never imports `commercial.*`; the Plan 6 module imports the
  community Protocol and types but not vice versa.

## Best-effort implementation deviations from the plan

These were decided during execution; recording for future-self.

1. **PyPI distribution name is `hl7`, not `python-hl7`.** The Plan 5
   spec referenced the GitHub project name (`johnpaulett/python-hl7`).
   The actual PyPI distribution is `hl7==0.4.5`. The pin in
   `templates/pyproject.toml` documents both.
2. **Local-code alias map deferred to Plan 6.** Plan 5 Task 6 had
   three options for handling local codes: (a) `concept_id = 0` and
   queue, (b) a new `app.lab_local_alias` table + manual mappings,
   (c) defer alias-map design entirely to Plan 6. We chose **(c)**:
   the Task 6 mapper does NOT consult an alias table. Local codes
   ride through with `concept_id = 0` and Task 7's queue captures
   them. Adding `app.lab_local_alias` now would conflate the
   community-tier ETL with Plan 6's commercial-tier mapping work.
3. **`unmapped_local_lab_code` queue lives in `${source_schema}`,
   not `${app_schema}`.** Plan 5 referenced `${app_schema}.*`, but
   `app.*` is owned by Laravel migrations + Spatie RBAC; templates
   SQL stages must not write across that boundary. The queue lives
   alongside the `fmt_oru_*` tables in `${source_schema}`, and Plan 6's
   commercial harmonizer reads from there directly. If the customer
   wants the queue surfaced in the Laravel UI, the T-024 stack
   exposes it through its own controller — not by mutating `app.*`
   from a community-tier SQL stage.
4. **OBX-14 timestamp falls back through OBR-7 → MSH-7.** Real-world
   HL7 batches frequently leave OBX-14 empty for panel-style results
   where the panel-level timestamp on OBR-7 is the authoritative one.
   The reader walks this fallback chain so `observation_date` is
   always populated in the OruObservation model (which requires it).
5. **PV1 mandatory for R30/R31, optional for R01.** Inferred from
   the HL7 v2.5 specification. Plan 5 didn't pin which trigger
   requires which segments; the reader fails closed on
   R30/R31-without-PV1 and accepts R01-without-PV1.

## Alternatives considered

- **Whole-template-commercial.** Rejected — gates lab interop
  behind a license fee; loses the community claim of "open-source
  clinical data platform."
- **Whole-template-community.** Rejected — gives away the AI
  wedge that Plan 6 is the commercial revenue lever for.
- **Move only the suggester into commercial; keep the Suggestion
  type in commercial too.** Rejected — that forces every queue UI
  caller to branch on tier (community = no Suggestion type
  available, commercial = Protocol shape changes). Keeping
  Protocol + Suggestion types community-side gives a stable
  contract on both sides.

## See also

- ADR 0017 — `registry_to_omop` strategy (sister Phase 3 ADR).
- ADR 0016 — `claims_to_omop` cost projection (sister Phase 3 ADR).
- Plan 6 (T-024) — `ai_assisted_mapping` consumes
  `unmapped_local_lab_code`.
- `templates/runtime/lab/harmonizer.py` — the Protocol seam.
