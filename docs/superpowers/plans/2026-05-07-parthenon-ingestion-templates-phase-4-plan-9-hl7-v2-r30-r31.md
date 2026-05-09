# Parthenon Ingestion Templates — Phase 4, Plan 9: HL7 v2 ORU trigger event coverage (R30 + R31)

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

**Goal:** Extend Plan 5 (`lis_lab_to_omop`)'s HL7 v2 ORU reader from R01-only to R01 + R30 + R31. Closes the trigger-event gap noted in Phase 3 spec §6 R5.

**Architecture:**

- **Trigger events:**
  - **R01** — unsolicited observation (existing, Plan 5).
  - **R30** — unsolicited point-of-care observation (lab order). Production trigger when LIS auto-creates a result for a panel without an explicit order ack.
  - **R31** — unsolicited new lab order/result. Carries result-correction flows; common in modern LIS.
- **Parser:** same `python-hl7` backend (Q9 — shares the parser; small marginal cost).
- **Dispatcher:** `templates/runtime/nodes/hl7v2_oru_reader.py` already has a trigger-type dispatch; extend with R30 + R31 handlers. Each handler returns the same internal row shape so downstream LOINC-harmonizer + SQL stages don't change.
- **Test corpus:** extend `templates/tests/fixtures/hl7v2/` with CDISC + LZZT examples for R30 + R31. Cover the result-correction edge case (R31 carries a `RFV` segment that supersedes a prior result).

**Tech Stack:** Existing python-hl7 parser, Plan 5 reader extension.

**Depends on:** Phase 3 closed.

**Unblocks:** Trigger-event completeness for the templates subproject's lab path.

---

## Conventions

- Branch: `feature/phase-4-plan-9-hl7-v2-r30-r31`.
- Type names: `R30Handler`, `R31Handler` (mirror existing `R01Handler`).

---

## Task index (6 tasks)

1. **R30 fixture corpus** — `templates/tests/fixtures/hl7v2/r30/*.hl7`. 5+ realistic R30 messages (point-of-care glucose, urinalysis, common bedside panels). Anonymized.
2. **R30 handler** — `R30Handler::parse(message) -> list[InternalRow]`. Extracts OBX segments same shape as R01; differences are MSH-9 trigger code + a few segment ordering quirks.
3. **R31 fixture corpus** — `templates/tests/fixtures/hl7v2/r31/*.hl7`. 5+ messages including the result-correction edge case (RFV segment supersedes prior result).
4. **R31 handler** — `R31Handler::parse(message)`. Includes the supersede logic: when an RFV segment is present, mark the prior result row with `superseded_at` so the downstream SQL stage filters it out.
5. **Dispatcher extension** — `Hl7v2OruReader.read()` switches on MSH-9 trigger event. Add R30 + R31 to the existing R01 dispatch. Unknown trigger events → log warning + skip (don't crash).
6. **Unit + E2E + ADR amendment** — pytest unit cases per handler; E2E asserts a mixed-trigger ORU stream produces correct OMOP measurement counts. ADR 0018 amended with the trigger-event coverage section.

---

## Done

After Task 6: R30 + R31 ship with full trigger dispatch + result-correction handling. Plan 5 reader covers the realistic majority of LIS-emitted ORU traffic.
