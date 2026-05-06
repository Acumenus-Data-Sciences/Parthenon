# Parthenon Ingestion Templates — Phase 3, Plan 4C: T-022C — NCDR Cardiovascular Registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Third slice of T-022. Lands `registry_to_omop_ncdr` — National Cardiovascular Data Registry sub-template (CathPCI v5.0 module). Projects PCI procedure records to OMOP `PROCEDURE_OCCURRENCE` + `MEASUREMENT` (cath findings) + `CONDITION_OCCURRENCE` + `DEVICE_EXPOSURE` (stents). Closes T-022. Commercial-tier per Phase 3 spec.

**Architecture:** NCDR exports come as CSV files from the ACC's NCDR registry. Same shape as Plan 4B (no upstream OHDSI ETL exists). Reuses `registry_base.yaml` partial. Adds DEVICE_EXPOSURE projection (the Plan 4A/B-shape templates didn't ship this; first commercial-tier template to use the OMOP DEVICE_EXPOSURE table for implant tracking).

**Tech Stack:** Python 3.12, pandas. No new heavy deps.

**Depends on:**
- Phase 3 Plan 4A (registry_base.yaml partial)
- Phase 3 Plan 4B (confirms the partial generalizes)

**Unblocks:** None directly. Closes T-022.

---

## Conventions

Same as 4A/4B. Branch: `feature/phase-3-plan-4c-ncdr`. Type names: `NCDRReader`, `NCDRRecord`, `NCDRColumnMap`.

---

## Task index (8 tasks)

1. NCDR CathPCI v5.0 column-mapping table (~120 fields)
2. `NCDRRecord` typed Pydantic model
3. `NCDRReader` CSV parser
4. SQL stages: bootstrap source, load CSV, map procedure_occurrence, map measurement, map device_exposure (stents), map condition_occurrence
5. Manifest — `registry_to_omop_ncdr/manifest.yaml`
6. Synthetic NCDR fixture (deterministic 50-PCI corpus)
7. Validation pack — DQD post-conditions + DEVICE_EXPOSURE coverage
8. README — NCDR-specific operator notes

---

## Task 1: Column map

`templates/commercial/manifests/registry_to_omop_ncdr/column_map.csv` covering CathPCI v5.0 fields → OMOP. Includes lesion-level data, stent FDA UDI codes (→ DEVICE_EXPOSURE), hemodynamic measurements (→ MEASUREMENT). **Commit:** `feat(templates/commercial): NCDR CathPCI v5.0 column map`.

---

## Task 2: `NCDRRecord` types

Pydantic v2 model. Includes nested lesion records (one PCI can treat multiple lesions; one lesion can receive multiple stents). **Commit:** `feat(templates/commercial): NCDRRecord typed model`.

---

## Task 3: Reader

`NCDRReader.read(csv_path) -> Iterable[NCDRRecord]` with explicit dtype map. **Commit:** `feat(templates/commercial): NCDRReader CSV parser`.

---

## Task 4: SQL stages

Six SQL stages including `02d_map_device_exposure.sql` for stent UDI codes. UDI → SPL → RxNorm-Extension `Device` concept lookup. **Commit:** `feat(templates/commercial): registry_to_omop_ncdr SQL stages including DEVICE_EXPOSURE`.

---

## Task 5: Manifest

8-stage pipeline reusing `_partials/registry_base.yaml`. **Commit:** `feat(templates/commercial): registry_to_omop_ncdr manifest`.

---

## Task 6: Fixtures

Deterministic 50-PCI corpus (seed=42). Real CPT codes, real stent UDI examples (publicly published FDA UDI database entries). **Commit:** `feat(templates/commercial): synthetic NCDR 50-PCI corpus`.

---

## Task 7: Validation pack

DQD post_conditions:
- Every PROCEDURE_OCCURRENCE for PCI has ≥1 linked DEVICE_EXPOSURE (stent)
- Every DEVICE_EXPOSURE has non-null `device_concept_id`
- Hemodynamic measurements are ≤24h before procedure_date
- Throughput: 10k PCIs < 5 min

**Commit:** `test(templates/commercial): registry_to_omop_ncdr E2E + DQD checks`.

---

## Task 8: README

NCDR license caveats (ACC Participant Agreement required), CathPCI v5.0 vs v4.4 version policy, UDI → device_concept_id lookup convention. **Commit:** `docs(templates/commercial): registry_to_omop_ncdr README`.

---

## Done

T-022 (`registry_to_omop`) is complete after Task 8. The template ingests NAACCR + STS + NCDR registry exports.
