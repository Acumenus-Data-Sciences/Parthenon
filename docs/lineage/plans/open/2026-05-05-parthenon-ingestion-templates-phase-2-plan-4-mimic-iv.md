# Parthenon Ingestion Templates — Phase 2, Plan 4: MIMIC-IV ETL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `load_mimic_iv_omop` template — a port of the OHDSI MIMIC-IV ETL into the Parthenon template runtime. After this plan, customers with MIMIC-IV access can ingest the corpus into a per-source CDM schema (`mimic_iv`) and the resulting OMOP database passes the same data-quality post-conditions as Phase 1's FHIR-to-OMOP templates. The MIMIC-IV demo subset (100 patients, freely downloadable) is the gating fixture; row counts must match the OHDSI reference within ±2%.

**Architecture:** A single template manifest (`templates/manifests/load_mimic_iv_omop/`) runs an 8-stage pipeline. Stage 1 bootstraps a `mimic_iv_source` schema and loads raw CSVs (or a Postgres dump) into typed `fmt_*` tables. Stages 2-7 map source → CDM following OHDSI's MIMIC-IV ETL flow (https://github.com/OHDSI/MIMIC), with each stage owning one OMOP table family. Stage 8 (`summarize`) emits row counts and gates on a ±2% acceptance threshold against an OHDSI-published reference. All clinical data lands in a per-source schema (`mimic_iv`) following the Phase 0 isolation pattern; vocabulary lookups use the shared `vocab` schema. The port is in **SQL**, not in Python — each stage is a `sql_node` invocation against a `.sql` file in the manifest's `sql/` directory. This preserves OHDSI's logic ownership while integrating with our materializer / orchestration / audit stack.

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 toolchain (uv, ruff, black --line-length 100, mypy --strict, pytest, pytest-asyncio). No new Python deps — the load_mimic_iv_omop pipeline is SQL + the Phase 0 sql_node. Pinned: `psycopg[binary]>=3.2.3` (already a Phase 0 dep).

**Depends on:** Phase 1 — all 7 plans merged (PRs #253–#259) plus Phase 2 spec (PR #263). Specifically:
- `sql_node` from Phase 0 with `${parameters.*}` interpolation + `db_dsn` threading
- Phase 0 audit conventions for run state
- `vocab.concept` + `vocab.concept_relationship` populated with the vocabularies in `metadata.required_vocabularies` (Q7): SNOMED, LOINC, RxNorm, NDC, ICD-10-CM, ICD-9-CM, ICD-10-PCS, CPT4, HCPCS

**Unblocks:** Phase 2 Plan 5 (ARTEMIS chemo regimens) — ARTEMIS reads MIMIC-IV `drug_exposure` rows produced here.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **Working directory** for all `php artisan` / `vendor/bin` commands is `/home/smudoshi/Github/Parthenon/backend`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`). No `unittest`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on the Phase 2 Plan 4 branch (per `feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** (stable across all tasks): `MimicIvSource`, `MimicIvVisitMapper`, `MimicIvConditionMapper`, `MimicIvProcedureMapper`, `MimicIvDrugMapper`, `MimicIvMeasurementMapper`, `MimicIvObservationMapper`, `MimicIvNoteMapper`, `MimicIvSummary`.
- **Schemas:** raw MIMIC-IV CSVs land in `mimic_iv_source.*` tables; CDM output in `mimic_iv.*` tables; vocabulary in shared `vocab.*`.
- **No new Python deps** — this plan is SQL-heavy, leveraging the existing `sql_node`.

---

## Task index (16 tasks)

1. `mimic_iv_source` schema + `fmt_*` raw-load tables
2. CSV → `fmt_*` loader (Stage 1: bootstrap)
3. Vocabulary mapping helpers (Stage 2: vocab lookup tables)
4. `mimic_iv` CDM schema + bootstrap migration
5. PERSON + DEATH mapper (Stage 3a)
6. LOCATION + CARE_SITE + PROVIDER mapper (Stage 3b)
7. VISIT_OCCURRENCE + VISIT_DETAIL mapper (Stage 4)
8. CONDITION_OCCURRENCE mapper (Stage 5a — diagnoses_icd)
9. PROCEDURE_OCCURRENCE mapper (Stage 5b — procedures_icd)
10. MEASUREMENT mapper (Stage 6a — labevents)
11. DRUG_EXPOSURE mapper (Stage 6b — prescriptions, drugevents)
12. OBSERVATION mapper (Stage 6c — selected chartevents)
13. NOTE mapper (Stage 7 — noteevents)
14. SUMMARIZE node + ±2% acceptance check (Stage 8)
15. Synthetic fixture corpus + E2E test
16. ADR 0010 — MIMIC-IV ETL strategy

---

## Task 1: `mimic_iv_source` schema + `fmt_*` raw-load tables

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/00_bootstrap_source_schema.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_bootstrap.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_mimic_iv_bootstrap.py
"""Bootstrap SQL creates mimic_iv_source schema with the expected fmt_ tables."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_mimic_iv_omop" / "sql" / "00_bootstrap_source_schema.sql"
)


def test_bootstrap_creates_schema() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(r"CREATE SCHEMA IF NOT EXISTS\s+mimic_iv_source", body, re.I)


@pytest.mark.parametrize("tbl", [
    "fmt_patients", "fmt_admissions", "fmt_transfers", "fmt_diagnoses_icd",
    "fmt_procedures_icd", "fmt_labevents", "fmt_prescriptions",
    "fmt_chartevents", "fmt_noteevents", "fmt_drgcodes", "fmt_icustays",
])
def test_bootstrap_creates_table(tbl: str) -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?mimic_iv_source\.{tbl}\b", body, re.I)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_bootstrap.py -v
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `00_bootstrap_source_schema.sql` with the schema + 11 raw `fmt_*` tables. Column types match MIMIC-IV's `mimiciv` Postgres dump exactly (varchar primary keys for hadm_id/subject_id/stay_id are kept as `BIGINT` per the OHDSI ETL convention).

```sql
CREATE SCHEMA IF NOT EXISTS mimic_iv_source;

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_patients (
    subject_id BIGINT PRIMARY KEY,
    gender CHAR(1),
    anchor_age INT,
    anchor_year INT,
    anchor_year_group VARCHAR(20),
    dod DATE
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_admissions (
    hadm_id BIGINT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    admittime TIMESTAMP NOT NULL,
    dischtime TIMESTAMP,
    deathtime TIMESTAMP,
    admission_type VARCHAR(50),
    admission_location VARCHAR(50),
    discharge_location VARCHAR(50),
    insurance VARCHAR(255),
    language VARCHAR(20),
    marital_status VARCHAR(50),
    race VARCHAR(80),
    edregtime TIMESTAMP,
    edouttime TIMESTAMP,
    hospital_expire_flag SMALLINT
);

-- Additional fmt_* tables follow the same MIMIC-IV column shape.
-- Full table list: fmt_transfers, fmt_diagnoses_icd, fmt_procedures_icd,
-- fmt_labevents, fmt_prescriptions, fmt_chartevents, fmt_noteevents,
-- fmt_drgcodes, fmt_icustays.
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_bootstrap.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): mimic_iv_source schema + raw fmt_* tables (Stage 1 bootstrap)`.

---

## Task 2: CSV → `fmt_*` loader (Stage 1)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/01_load_source_csv.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_csv_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_mimic_iv_csv_loader.py
"""Stage 1 loader uses COPY FROM to bulk-load fmt_* tables from a CSV directory."""
from __future__ import annotations

import re
from pathlib import Path

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_mimic_iv_omop" / "sql" / "01_load_source_csv.sql"
)


def test_loader_uses_copy_for_each_fmt_table() -> None:
    body = SQL.read_text(encoding="utf-8")
    for tbl in ("fmt_patients", "fmt_admissions", "fmt_diagnoses_icd"):
        assert re.search(rf"COPY mimic_iv_source\.{tbl}", body, re.I), \
            f"missing COPY for {tbl}"


def test_loader_parameterizes_csv_root() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "${parameters.csv_root}" in body
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_csv_loader.py -v
```

Expected: FAIL — file missing.

- [ ] **Step 3: Write minimal implementation**

```sql
-- templates/manifests/load_mimic_iv_omop/sql/01_load_source_csv.sql
-- Stage 1: bulk-load MIMIC-IV CSVs into fmt_* tables via COPY FROM.
-- Customer mounts the MIMIC-IV directory at the path passed via parameters.csv_root.

COPY mimic_iv_source.fmt_patients
FROM '${parameters.csv_root}/hosp/patients.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_admissions
FROM '${parameters.csv_root}/hosp/admissions.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_diagnoses_icd
FROM '${parameters.csv_root}/hosp/diagnoses_icd.csv' WITH (FORMAT csv, HEADER);

-- Additional COPY statements for fmt_procedures_icd, fmt_labevents,
-- fmt_prescriptions, fmt_chartevents, fmt_noteevents, fmt_drgcodes,
-- fmt_icustays, fmt_transfers (paths under hosp/ or icu/ as appropriate).
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_csv_loader.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): MIMIC-IV CSV→fmt_ loader (Stage 1)`.

---

## Task 3: Vocabulary mapping helpers (Stage 2)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/02_vocab_lookup_tables.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_vocab_lookups.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_mimic_iv_vocab_lookups.py
"""Stage 2 builds vocabulary lookup tables in mimic_iv_source for each downstream stage."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_mimic_iv_omop" / "sql" / "02_vocab_lookup_tables.sql"
)


@pytest.mark.parametrize("lookup", [
    "lkp_icd9_to_snomed_condition", "lkp_icd10_to_snomed_condition",
    "lkp_icd9_pcs_to_snomed_procedure", "lkp_icd10_pcs_to_snomed_procedure",
    "lkp_loinc_for_lab", "lkp_rxnorm_for_med", "lkp_ndc_for_drug",
])
def test_lookup_table_created(lookup: str) -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?mimic_iv_source\.{lookup}\b", body, re.I)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_vocab_lookups.py -v
```

Expected: FAIL — file missing.

- [ ] **Step 3: Write minimal implementation**

`02_vocab_lookup_tables.sql` builds lookup tables joining `vocab.concept` + `vocab.concept_relationship` (relationship_id = 'Maps to') for each source vocabulary used by MIMIC-IV. Result: small, indexed lookup tables that downstream mappers JOIN against.

- [ ] **Step 4-5: Test pass + gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_mimic_iv_vocab_lookups.py -v
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
```

Expected: all clean. **Commit:** `feat(templates): MIMIC-IV vocabulary lookup tables (Stage 2)`.

---

## Task 4: `mimic_iv` CDM schema bootstrap

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/03_bootstrap_cdm_schema.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_cdm_bootstrap.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_mimic_iv_cdm_bootstrap.py
"""Stage 3 bootstrap creates the mimic_iv schema + 13 OMOP CDM v5.4 tables."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_mimic_iv_omop" / "sql" / "03_bootstrap_cdm_schema.sql"
)


def test_creates_mimic_iv_schema() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(r"CREATE SCHEMA IF NOT EXISTS\s+mimic_iv\b", body, re.I)


@pytest.mark.parametrize("tbl", [
    "person", "death", "location", "care_site", "provider",
    "visit_occurrence", "visit_detail", "condition_occurrence",
    "procedure_occurrence", "measurement", "drug_exposure",
    "observation", "note",
])
def test_creates_cdm_table(tbl: str) -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?mimic_iv\.{tbl}\b", body, re.I)
```

- [ ] **Step 2-5: Implementation + tests + gates**

Create `03_bootstrap_cdm_schema.sql` with `CREATE SCHEMA mimic_iv` and the 13 OMOP CDM v5.4 tables (see CDM v5.4 DDL on github.com/OHDSI/CommonDataModel for column shapes). Run gates. **Commit:** `feat(templates): mimic_iv CDM schema bootstrap (Stage 3)`.

---

## Task 5: PERSON + DEATH mapper (Stage 3a)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/04a_map_person_death.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_person_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_mimic_iv_person_mapper.py
"""Person mapper inserts one PERSON per MIMIC-IV subject_id; gender + race mapped."""
from __future__ import annotations

import re
from pathlib import Path

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_mimic_iv_omop" / "sql" / "04a_map_person_death.sql"
)


def test_person_insert_uses_fmt_patients() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(r"INSERT INTO mimic_iv\.person", body, re.I)
    assert "mimic_iv_source.fmt_patients" in body


def test_death_insert_uses_dod() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(r"INSERT INTO mimic_iv\.death", body, re.I)
    assert "dod" in body
```

- [ ] **Step 2-5:** Implement the mapper. PERSON: subject_id → person_id; gender M/F → 8507/8532; race string → SNOMED race concepts via lookup. DEATH: rows where dod IS NOT NULL. Run gates. **Commit:** `feat(templates): MIMIC-IV PERSON + DEATH mapper (Stage 3a)`.

---

## Task 6: LOCATION + CARE_SITE + PROVIDER mapper (Stage 3b)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/04b_map_location_caresite_provider.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_location_mapper.py`

MIMIC-IV has limited location info — synthesize a single CARE_SITE row representing "MIMIC-IV BIDMC ICU/ED" and a single PROVIDER row for unknown ordering staff. Required for FK integrity in downstream tables.

Per-task TDD pattern as above. **Commit:** `feat(templates): MIMIC-IV LOCATION + CARE_SITE + PROVIDER mapper (Stage 3b)`.

---

## Task 7: VISIT_OCCURRENCE + VISIT_DETAIL mapper (Stage 4)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/05_map_visit.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_visit_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_visit_occurrence_inserts_one_per_admission() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.visit_occurrence" in body
    assert "mimic_iv_source.fmt_admissions" in body
    # admission_type drives visit_concept_id
    assert "admission_type" in body


def test_visit_detail_inserts_for_transfers_and_icustays() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.visit_detail" in body
    assert "fmt_transfers" in body or "fmt_icustays" in body
```

- [ ] **Step 2-5:** Implement Stage 4. admissions → VISIT_OCCURRENCE (one row per hadm_id; visit_start_date = admittime, visit_end_date = dischtime; visit_concept_id from admission_type → SNOMED encounter type). transfers + icustays → VISIT_DETAIL. **Commit:** `feat(templates): MIMIC-IV VISIT_OCCURRENCE + VISIT_DETAIL mapper (Stage 4)`.

---

## Task 8: CONDITION_OCCURRENCE mapper (Stage 5a)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/06a_map_condition.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_condition_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_condition_uses_icd_lookup_join() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.condition_occurrence" in body
    assert "fmt_diagnoses_icd" in body
    # Both ICD-9 and ICD-10 paths
    assert "lkp_icd9_to_snomed_condition" in body
    assert "lkp_icd10_to_snomed_condition" in body


def test_unmapped_codes_are_logged() -> None:
    body = SQL.read_text(encoding="utf-8")
    # Per the unmapped_concepts_queue convention from Phase 1 PR-A
    assert "app.unmapped_concepts_queue" in body or "unmapped_concepts_queue" in body
```

- [ ] **Step 2-5:** Implement. JOIN `fmt_diagnoses_icd` with `lkp_icd9/icd10_to_snomed_condition`; rows with no SNOMED match are inserted into `app.unmapped_concepts_queue` (mirrors Phase 1 PR-A's pattern). **Commit:** `feat(templates): MIMIC-IV CONDITION_OCCURRENCE mapper with unmapped queue (Stage 5a)`.

---

## Task 9: PROCEDURE_OCCURRENCE mapper (Stage 5b)

Same pattern as Task 8 but for `fmt_procedures_icd` → `mimic_iv.procedure_occurrence` via the ICD9-PCS / ICD10-PCS lookups. Per-task TDD. **Commit:** `feat(templates): MIMIC-IV PROCEDURE_OCCURRENCE mapper (Stage 5b)`.

---

## Task 10: MEASUREMENT mapper (Stage 6a — labevents)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/07a_map_measurement.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_measurement_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_measurement_inserts_from_labevents() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.measurement" in body
    assert "fmt_labevents" in body
    assert "lkp_loinc_for_lab" in body


def test_measurement_handles_value_and_unit() -> None:
    body = SQL.read_text(encoding="utf-8")
    # labevents.valuenum → value_as_number; valueuom → unit_concept_id via UCUM lookup
    assert "valuenum" in body
    assert "valueuom" in body
```

- [ ] **Step 2-5:** Implement. Each labevents row → MEASUREMENT with `measurement_concept_id` from LOINC, `value_as_number` from valuenum, `unit_concept_id` from UCUM mapping. Rows with no LOINC mapping → `unmapped_concepts_queue`. **Commit:** `feat(templates): MIMIC-IV MEASUREMENT mapper from labevents (Stage 6a)`.

---

## Task 11: DRUG_EXPOSURE mapper (Stage 6b — prescriptions)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/07b_map_drug_exposure.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_drug_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_drug_exposure_inserts_from_prescriptions() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.drug_exposure" in body
    assert "fmt_prescriptions" in body


def test_drug_exposure_uses_rxnorm_or_ndc() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "lkp_rxnorm_for_med" in body or "lkp_ndc_for_drug" in body
```

- [ ] **Step 2-5:** Implement. drug → drug_concept_id via NDC primary, RxNorm fallback; starttime/stoptime → drug_exposure_start_datetime / drug_exposure_end_datetime. **Commit:** `feat(templates): MIMIC-IV DRUG_EXPOSURE mapper (Stage 6b)`.

---

## Task 12: OBSERVATION mapper (Stage 6c — selected chartevents)

MIMIC-IV chartevents is huge (~330M rows in full release; smaller in demo). Map a curated allowlist of itemids that correspond to clinical observations not already covered by labevents (e.g., "GCS Total", "Pain Score", "Code Status"). Anything else → discarded with a count logged. Per-task TDD. **Commit:** `feat(templates): MIMIC-IV OBSERVATION mapper from chartevents allowlist (Stage 6c)`.

---

## Task 13: NOTE mapper (Stage 7 — noteevents)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/08_map_note.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_note_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_note_inserts_from_noteevents() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO mimic_iv.note" in body
    assert "fmt_noteevents" in body


def test_note_carries_category_and_text() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "category" in body
    assert "text" in body
```

- [ ] **Step 2-5:** Implement. Each noteevents row → mimic_iv.note with note_class_concept_id from category, note_text from text, note_event_field_concept_id pointing at the source category. This is Plan 5's input for ARTEMIS chemo regimen extraction (downstream). **Commit:** `feat(templates): MIMIC-IV NOTE mapper from noteevents (Stage 7)`.

---

## Task 14: SUMMARIZE node + ±2% acceptance

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/sql/09_summarize.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_mimic_iv_summary.py`

- [ ] **Step 1: Write the failing test**

```python
def test_summary_emits_row_counts() -> None:
    body = SQL.read_text(encoding="utf-8")
    for tbl in ("person", "visit_occurrence", "condition_occurrence",
                "procedure_occurrence", "measurement", "drug_exposure",
                "observation", "note"):
        assert f"FROM mimic_iv.{tbl}" in body, f"summary missing count for {tbl}"


def test_post_conditions_has_acceptance_ranges() -> None:
    import yaml
    cfg = yaml.safe_load((
        Path(__file__).resolve().parents[2]
        / "manifests" / "load_mimic_iv_omop" / "validation" / "expected" / "post_conditions.yaml"
    ).read_text(encoding="utf-8"))
    assert cfg["acceptance_threshold_pct"] == 2.0
```

- [ ] **Step 2-5:** `09_summarize.sql` produces a single-row result with counts per CDM table. `post_conditions.yaml` carries the OHDSI-published reference counts for the demo subset (100 patients) with `acceptance_threshold_pct: 2.0`. The validator pack from Phase 0 enforces the ±2% gate. **Commit:** `feat(templates): MIMIC-IV summarize + ±2% acceptance gate (Stage 8)`.

---

## Task 15: Synthetic fixture corpus + E2E test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/fixtures/synthetic/build_fixtures.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/fixtures/synthetic/csv/*.csv` (generated)
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_mimic_iv_omop/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_load_mimic_iv_omop.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_load_mimic_iv_omop.py
"""End-to-end: 10-patient synthetic MIMIC-IV → mimic_iv CDM, row count assertions."""
from __future__ import annotations

import pytest


@pytest.mark.integration
def test_load_mimic_iv_omop_runs_to_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    # Bootstrap omop + vocab + mimic_iv_source schemas via testcontainers Postgres.
    # Seed minimal vocabularies (ICD-9/10 for conditions, LOINC for labs, RxNorm for meds).
    # Generate the 10-patient synthetic corpus via build_fixtures.py.
    # Run the 8-stage pipeline.
    # Assert row counts:
    #   PERSON = 10
    #   VISIT_OCCURRENCE = 50 (5 admissions/patient avg)
    #   CONDITION_OCCURRENCE = ~150 (3 dx/admission avg)
    #   PROCEDURE_OCCURRENCE = ~100
    #   MEASUREMENT = ~500 (10 labs/admission avg)
    #   DRUG_EXPOSURE = ~250
    #   OBSERVATION = ~80
    #   NOTE = ~40
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — manifest does not exist.

- [ ] **Step 3: Write minimal implementation**

The manifest stitches Tasks 1-14 into a 9-stage pipeline (`bootstrap_source` → `load_csv` → `vocab_lookup` → `bootstrap_cdm` → `map_person_death` → `map_location_caresite_provider` → `map_visit` → `map_condition` → `map_procedure` → `map_measurement` → `map_drug` → `map_observation` → `map_note` → `summarize`). All stages are `sql_node` invocations.

```yaml
# templates/manifests/load_mimic_iv_omop/manifest.yaml
name: load_mimic_iv_omop
schema_version: "1.0"
description: |
  Port of the OHDSI MIMIC-IV ETL onto the Parthenon template runtime.
  Ingests MIMIC-IV CSVs into a per-source CDM schema (mimic_iv) following
  OHDSI's flow. Acceptance: row counts within ±2% of OHDSI demo reference.
metadata:
  cdm_versions: ["5.3", "5.4"]
  required_vocabularies:
    - SNOMED
    - LOINC
    - RxNorm
    - NDC
    - ICD-10-CM
    - ICD-9-CM
    - ICD-10-PCS
    - ICD-9-Proc
    - CPT4
    - HCPCS
parameters:
  csv_root:
    type: string
    description: Directory containing MIMIC-IV CSVs (hosp/ + icu/ subdirs).
nodes:
  # 14 sequential sql_node stages — see sql/ files
```

The synthetic fixture script generates 10 patients with realistic shapes (admissions, transfers, diagnoses_icd ICD-10 codes, prescriptions with RxCUIs, labevents with LOINC codes). Document in README how to swap for the real demo subset.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run python manifests/load_mimic_iv_omop/fixtures/synthetic/build_fixtures.py
uv run pytest tests/e2e/test_load_mimic_iv_omop.py -v -m integration
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

Expected: all clean. **Commit:** `feat(templates): load_mimic_iv_omop manifest + synthetic E2E (T-019)`.

---

## Task 16: ADR 0010 — MIMIC-IV ETL strategy

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0010-mimic-iv-etl-strategy.md`

- [ ] **Step 1: Draft the ADR**

ADR 0010 covers:
- Context: Phase 2 §1, Q6 ("port-not-wrap" decision), Q7 vocabulary expectations.
- Decision: Port the OHDSI MIMIC-IV ETL SQL into a Parthenon template (`load_mimic_iv_omop`) in 8 SQL-driven stages mirroring OHDSI's flow. Each stage is a `sql_node` invocation against a versioned `.sql` file. We own the upkeep when OHDSI publishes patches.
- Consequences: Phase 2 ships full MIMIC-IV parity for the demo subset. Plan 5 (ARTEMIS) reads from the resulting `mimic_iv.note` and `mimic_iv.drug_exposure` tables. We track upstream OHDSI patches via a quarterly diff; significant changes go to a follow-up task.
- License credit: OHDSI MIMIC-IV ETL (Apache-2.0) is the source of the SQL logic; Parthenon's port is also Apache-2.0; attribution in the manifest README.
- Alternatives considered: wrap-as-external-subprocess (declined for loss of test coverage and template-runtime parity); load via Python pandas (declined — slower than COPY + SQL JOINs at scale).

- [ ] **Step 2: Run gates**

```bash
ls /home/smudoshi/Github/Parthenon/docs/architecture/adr-0010-mimic-iv-etl-strategy.md
```

Expected: file present. **Commit:** `docs(adr): ADR 0010 — MIMIC-IV ETL strategy`.

---

## Done

After Task 16 lands, Plan 4 is complete. The `load_mimic_iv_omop` template is operational and passes the ±2% acceptance gate against the demo subset. Plan 5 (ARTEMIS chemo regimens) can now branch off main; it consumes `mimic_iv.note` for regimen extraction and `mimic_iv.drug_exposure` for cross-validation.
