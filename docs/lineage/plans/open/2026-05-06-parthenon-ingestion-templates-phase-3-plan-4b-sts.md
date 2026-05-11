# Parthenon Ingestion Templates — Phase 3, Plan 4B: T-022B — STS National Database

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Second slice of T-022. Lands `registry_to_omop_sts` — the Society of Thoracic Surgeons National Database sub-template. Projects STS adult cardiac surgery (ACSD) records to OMOP `PROCEDURE_OCCURRENCE` + `CONDITION_OCCURRENCE` + `EPISODE`. Commercial-tier per Phase 3 spec.

**Architecture:** STS publishes a CSV/Excel export shape rather than a flat-file standard. New commercial-tier node `STSReader` consumes the canonical CSV; we maintain the column-mapping table (~150 STS items mapped to OMOP) ourselves since no OHDSI ETL exists for STS. Inherits `registry_base.yaml` partial from Plan 4A. Projects to PROCEDURE_OCCURRENCE (CABG, valve replacement, etc.), CONDITION_OCCURRENCE (preoperative diagnoses, postoperative complications), and EPISODE (the surgical hospitalization).

**Tech Stack:** Python 3.12, pandas (already pinned). No new heavy deps.

**Depends on:**
- Phase 3 Plan 4A (registry_base.yaml partial)

**Unblocks:**
- Plan 4C (NCDR) — confirms the registry_base.yaml partial generalizes beyond NAACCR.

---

## Conventions

Same as 4A. Branch: `feature/phase-3-plan-4b-sts`. Type names: `STSReader`, `STSRecord`, `STSColumnMap`.

---

## Task index (8 tasks)

1. STS column-mapping table (`column_map.csv`) — STS field → OMOP target table + column + concept lookup rule
2. `STSRecord` typed Pydantic model (~150 columns, curated)
3. `STSReader` CSV parser
4. SQL stages: bootstrap source, load CSV, map procedure_occurrence, map condition_occurrence, map episode
5. Manifest — `registry_to_omop_sts/manifest.yaml` reusing `_partials/registry_base.yaml`
6. Synthetic STS fixture (deterministic 50-surgery corpus)
7. Validation pack — DQD-equivalent post-conditions + EPISODE coverage
8. README — STS-specific operator notes (vocabulary requirements, license caveats)

---

## Task 1: Column map

CSV file at `templates/commercial/manifests/registry_to_omop_sts/column_map.csv` with the STS-to-OMOP mapping table. Columns: `sts_field`, `omop_table`, `omop_column`, `vocabulary_id`, `concept_lookup_rule`. ~150 rows curated from the STS Adult Cardiac Surgery v4.20.2 spec.

**Commit:** `feat(templates/commercial): STS column-mapping table (v4.20.2)`.

---

## Task 2: `STSRecord` types

Pydantic v2 model covering the ~150 columns in the curated map. **Commit:** `feat(templates/commercial): STSRecord typed model`.

---

## Task 3: Reader

`STSReader.read(csv_path) -> Iterable[STSRecord]` using `pandas.read_csv` with explicit dtype map. **Commit:** `feat(templates/commercial): STSReader CSV parser`.

---

## Task 4: SQL stages

Five SQL stages: `00_bootstrap_sts_source.sql`, `01_load_sts_csv.sql`, `02a_map_procedure_occurrence.sql`, `02b_map_condition_occurrence.sql`, `02c_map_episode.sql`. Use `${parameters.cdm_schema}` and `${parameters.vocab_schema}` per the registry_base.yaml convention. **Commit:** `feat(templates/commercial): registry_to_omop_sts SQL stages`.

---

## Task 5: Manifest

7-stage pipeline reusing `_partials/registry_base.yaml` for shared parameter shapes + post-condition structure. **Commit:** `feat(templates/commercial): registry_to_omop_sts manifest`.

---

## Task 6: Fixtures

Deterministic 50-surgery STS corpus (seed=42), mix of CABG, valve replacement, aortic surgery. Procedure codes are real CPT/HCPCS values; conditions use real SNOMED concepts. **Commit:** `feat(templates/commercial): synthetic STS 50-surgery corpus`.

---

## Task 7: Validation pack

DQD post_conditions:
- Every PROCEDURE_OCCURRENCE has non-null `procedure_concept_id`
- Every EPISODE links to ≥1 PROCEDURE_OCCURRENCE
- Postoperative-complication conditions land within `episode_end_date` ± 30 days
- Throughput: 10k surgeries < 5 min

**Commit:** `test(templates/commercial): registry_to_omop_sts E2E + DQD checks`.

---

## Task 8: README

`templates/commercial/manifests/registry_to_omop_sts/README.md` — STS license caveats, vocabulary prerequisites, "how to obtain a real STS export" pointer (customers must have a STS Participant Agreement).

**Commit:** `docs(templates/commercial): registry_to_omop_sts README + license notes`.

---

## Done

STS sub-template ships after Task 8. Plan 4C (NCDR) follows the same pattern.
