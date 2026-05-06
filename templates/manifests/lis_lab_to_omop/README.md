# `lis_lab_to_omop`

Phase 3 Plan 5 (T-023). Community-tier (AGPLv3) template that ingests
HL7 v2.x ORU^R01/R30/R31 lab result messages and projects them to
OMOP CDM v5.4 `MEASUREMENT`. Plan 6 (T-024) extends this with the
commercial-tier AI-assisted LOINC harmonizer.

## Tier boundary

This template is the canonical example of the Phase 3 mixed-tier
split:

- **Community-tier (AGPLv3)** ships *all* the lab interop:
  `Hl7v2OruReader`, the `fmt_oru_*` source tables, the LOINC mapper,
  the unmapped-code queue, and a no-op `LoincHarmonizerStub`.
  Customers running only the community wheel get full lab ingestion
  plus a queue table they can review manually.
- **Commercial-tier (proprietary, Plan 6)** ships the AI-assisted
  `BgeRerankLoincHarmonizer` that consumes the queue and produces
  ranked LOINC suggestions. The wedge is the AI-assisted mapping —
  not the lab interop itself.

## Vocabulary prerequisites

- `LOINC` — required for the standard-concept resolution path. Local
  codes (`coding_system='L'`) and unresolved LOINC codes ride through
  the mapper with `measurement_concept_id = 0` and are appended to
  `unmapped_local_lab_code` for review.

## Stage layout

| Stage | SQL file | Purpose |
|------|---------|--------|
| `bootstrap_source` | `00_bootstrap_source_schema.sql` | Create `fmt_oru_message` + `fmt_oru_observation` |
| `load_oru` | `01_load_oru.sql` | Placeholder; the Python `Hl7v2OruReader` bulk-inserts |
| `map_measurement` | `02_map_measurement.sql` | Project OBX → MEASUREMENT (LOINC + concept_id=0 fallback) |
| `queue_unmapped_local_codes` | `03_queue_unmapped_local_codes.sql` | Append per-(facility, local_code) aggregates for T-024 |

## Trigger event variants

`Hl7v2OruReader` handles three HL7 v2 ORU trigger events:

- **R01** — standard solicited result. PV1 optional.
- **R30** — unsolicited point-of-care observation. PV1 mandatory.
- **R31** — encounter-tied result. PV1 mandatory.

All three share the same OBR-rooted shape; the reader rejects any
other trigger event (e.g. ORU^R32) with a redacted `Hl7v2ParseError`.

## Best-effort decisions (recorded in ADR 0018)

1. **PyPI distribution is `hl7` not `python-hl7`.** The plan referenced
   the GitHub project name (`johnpaulett/python-hl7`) but the actual
   PyPI distribution is named `hl7`. Pin documents this explicitly.
2. **Local-code alias-map deferred to Plan 6.** Task 6's mapper does
   NOT consult a curated `app.lab_local_alias` table. Local codes
   ride through with concept_id=0 and the queue captures them.
   The alias-map design is a Plan 6 deliverable.
3. **`unmapped_local_lab_code` queue lives in `${source_schema}`,
   not `${app_schema}`.** `app.*` is owned by Laravel migrations + Spatie
   RBAC; templates SQL stages must not write across that boundary.
4. **OBX-14 timestamp falls back through OBR-7 → MSH-7.** Plan didn't
   specify; real-world HL7 batches frequently leave OBX-14 empty.
5. **PV1 mandatory for R30/R31, optional for R01.** Inferred from
   the HL7 v2.5 specification; plan didn't pin which trigger
   requires which segments.

## Acceptance gates (Task 11 validation E2E)

- 50 ORU messages parse → 50 OruR01Messages out
- Every LOINC-coded OBX populates a `measurement` row with non-zero
  `measurement_concept_id`
- Every local-coded OBX populates the queue (deduplicated by
  `(local_code, coding_system, sending_facility)`)
- Throughput: 10k OBX rows < 2 minutes (Plan 11 target)

## See also

- ADR 0018 — `lis_lab_to_omop` tiering boundary (Task 12)
- Plan 6 — `ai_assisted_mapping` consumes this template's queue
- `runtime/lab/harmonizer.py` — `LoincHarmonizer` Protocol + stub
