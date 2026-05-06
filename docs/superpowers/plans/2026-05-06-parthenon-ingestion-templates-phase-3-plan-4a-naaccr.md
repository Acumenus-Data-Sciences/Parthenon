# Parthenon Ingestion Templates — Phase 3, Plan 4A: T-022A — NAACCR Cancer Registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First slice of T-022. Lands `registry_to_omop` template's NAACCR sub-template — extending OHDSI Oncology subgroup's existing NAACCR ETL (Phase 3 Q7=(a)), pinned to a commit SHA. Projects NAACCR EAV-format files to OMOP `CONDITION_OCCURRENCE` + `EPISODE` + `EPISODE_EVENT` (oncology extension). Commercial-tier per Phase 3 spec.

**Architecture:** New commercial-tier node `NAACCRReader` reads NAACCR's flat-file EAV format (one row per patient-tumor, ~700 columns including ICD-O-3 morphology + topography codes, AJCC staging, treatment summary). Materializer ports OHDSI Oncology subgroup's NAACCR-to-OMOP SQL into our template runtime, expressing it as 5 sql_file:// stages. The OHDSI source is pinned via commit SHA in a `tools/ohdsi-naaccr-pin.txt` file; an upstream-diff workflow (mirrors ARTEMIS Phase 2 ADR 0014) tracks drift.

**Tech Stack:** Python 3.12, no new heavy deps. Re-uses Phase 3 Plan 0's `sql_file://` reader for the OHDSI-derived SQL.

**Depends on:**
- Phase 3 Plan 0 (sql_file:// reader merged)
- Phase 3 Plan 1 (commercial-tier wheel scaffolding)

**Unblocks:**
- Plan 4B (T-022B, STS) and Plan 4C (T-022C, NCDR) — share the `registry_base.yaml` partial established here.

---

## Conventions

Same as prior plans. Branch: `feature/phase-3-plan-4a-naaccr`. Type names: `NAACCRReader`, `NAACCRRecord`, `NAACCRItem`, `NAACCRReadError`.

---

## Task index (10 tasks)

1. Pin OHDSI Oncology NAACCR ETL commit SHA + clone-into-build script
2. `NAACCRRecord` typed Pydantic model (curated ~80 columns, NOT all 700)
3. `NAACCRReader` flat-file parser (EAV format)
4. Port OHDSI NAACCR SQL into 5 sql_file:// stages
5. `registry_base.yaml` partial — shared manifest fragments for T-022B/C
6. Manifest scaffold — `registry_to_omop_naaccr/manifest.yaml`
7. Synthetic NAACCR fixture (deterministic 50-tumor corpus, seed=42, real ICD-O-3 codes)
8. Validation pack — DQD-equivalent post-conditions + EPISODE row counts
9. Upstream-diff workflow (quarterly cron, mirrors ARTEMIS pattern)
10. ADR 0017 — registry_to_omop strategy and OHDSI extension posture

---

## Task 1: Pin OHDSI source

**Files:**
- Create: `templates/commercial/runtime/commercial/registry/naaccr/ohdsi_pin.txt` (commit SHA + repo URL)
- Create: `templates/commercial/manifests/registry_to_omop_naaccr/scripts/fetch_ohdsi_naaccr.sh` (clones at pinned SHA, copies SQL into `sql/`)

**Commit:** `chore(templates/commercial): pin OHDSI NAACCR ETL commit + fetch script`.

---

## Task 2: `NAACCRRecord` types

NAACCR has 700+ items per spec; we curate the ~80 we need: patient demographics, primary site, histology (ICD-O-3), AJCC stage, treatment summary, cause of death. Reference: NAACCR Data Dictionary v23. Pydantic v2, frozen, extra="forbid". **Commit:** `feat(templates/commercial): NAACCRRecord typed model (curated 80-column subset)`.

---

## Task 3: Reader

NAACCR records are fixed-width flat files. `NAACCRReader.read(path)` parses each line per the column-position spec. Test against in-memory NAACCR row. **Commit:** `feat(templates/commercial): NAACCRReader fixed-width parser`.

---

## Task 4: Port OHDSI SQL

Five SQL stages copied (with attribution) from OHDSI Oncology NAACCR ETL, modified to use `${parameters.cdm_schema}` / `${parameters.vocab_schema}`:
- `00_bootstrap_naaccr_source.sql` — `fmt_naaccr_record` table
- `01_load_naaccr_csv.sql` — COPY into source schema
- `02a_map_condition_occurrence.sql` — ICD-O-3 → SNOMED
- `02b_map_episode.sql` — primary diagnosis → EPISODE (oncology extension)
- `02c_map_episode_event.sql` — treatments → EPISODE_EVENT

**Commit:** `feat(templates/commercial): port OHDSI NAACCR SQL to Parthenon sql_file:// stages`.

---

## Task 5: `registry_base.yaml`

Shared manifest fragment under `templates/commercial/manifests/_partials/registry_base.yaml`. Defines: required vocabularies (SNOMED, ICDO3, NAACCR), default cdm_schema/vocab_schema parameter shapes, common post_conditions structure. Plans 4B/4C reference this. **Commit:** `feat(templates/commercial): registry_base.yaml manifest partial`.

---

## Task 6: Manifest scaffold

`registry_to_omop_naaccr/manifest.yaml` — 7-stage pipeline using sql_file:// stages from Task 4. **Commit:** `feat(templates/commercial): registry_to_omop_naaccr manifest`.

---

## Task 7: Synthetic fixtures

Deterministic 50-tumor NAACCR corpus (seed=42). Real ICD-O-3 codes for breast, prostate, lung, colon. Real AJCC stages. **Commit:** `feat(templates/commercial): synthetic NAACCR 50-tumor corpus`.

---

## Task 8: Validation pack

DQD-style post_conditions: every CONDITION_OCCURRENCE has a non-null `condition_concept_id`; every EPISODE has a `episode_start_date`; every treatment has a corresponding EPISODE_EVENT linked via `episode_parent_id`. **Commit:** `test(templates/commercial): registry_to_omop_naaccr E2E + DQD post_conditions`.

---

## Task 9: Upstream-diff workflow

`.github/workflows/ohdsi-naaccr-diff.yml` — runs weekly, fetches the OHDSI repo HEAD, diffs against pinned SHA in `ohdsi_pin.txt`, opens an issue if diff > N lines. Mirrors ARTEMIS Phase 2 pattern. **Commit:** `ci(templates): OHDSI NAACCR upstream-diff workflow (weekly)`.

---

## Task 10: ADR 0017

ADR records:
- **Context:** Phase 3 Q7=(a). NAACCR has 700+ items + annual code-set updates; reinventing it is multi-month work.
- **Decision:** Pin OHDSI commit SHA, port their SQL into sql_file:// stages with attribution, monitor upstream via weekly diff workflow. Same pattern as ARTEMIS R-package fetch (ADR 0014).
- **Consequences:** Customers running NAACCR ingestion get OHDSI's correctness; we own UX (the manifest + validation pack); annual NAACCR releases require us to refresh the pin + revalidate.
- **Alternatives:** Re-implement (multi-month); customer-supplied SQL (ops burden).

**Commit:** `docs(adr): ADR 0017 — registry_to_omop OHDSI-extension strategy`.

---

## Done

After Task 10, NAACCR sub-template ships. Plan 4B (STS) and 4C (NCDR) follow the same shape using `registry_base.yaml`.
