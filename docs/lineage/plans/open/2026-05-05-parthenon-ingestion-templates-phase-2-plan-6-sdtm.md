# Parthenon Ingestion Templates — Phase 2, Plan 6: SDTM → OMOP v5.4 Bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `SdtmDomainNode` (SAS XPT reader → typed domain DataFrame; Define-XML reader as v2 stretch) and the `sdtm_to_omop_v54` template that ingests CDISC SDTM v3.4 data into a per-source CDM schema (`sdtm_<study>`). After this plan, customers running CDISC-formatted clinical-trial data (most pharma + CRO sponsors) can ingest into OMOP CDM v5.4. The CDISC LZZT reference dataset is the canonical fixture; the resulting OMOP database must pass Phase 1's data-quality post-conditions.

**Architecture:** A new `SdtmDomainNode` reads SAS XPT files via `pyreadstat`, normalizes column names, and emits a typed `pandas.DataFrame` per SDTM domain (DM, AE, CM, VS, LB in v1; Q9). Each domain has a dedicated mapper that projects the DataFrame to OMOP CDM rows in the per-source CDM schema. The `sdtm_to_omop_v54` manifest stitches the domain readers + mappers together in a 9-stage pipeline; LZZT test fixtures are not in the repo (Q10) but fetched on-demand via a top-level `Makefile` target (`make fetch-fixtures`) that hits the CDISC public download URL. Vocabulary baseline (Q7): SNOMED + LOINC + RxNorm + MedDRA (the latter required for AE → CONDITION_OCCURRENCE coding).

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 toolchain (uv, ruff, black --line-length 100, mypy --strict, pytest, pytest-asyncio). New deps: `pyreadstat>=1.2.7` (SAS XPT reader). For the v2 stretch: `xmlschema>=3.0` (Define-XML validation) — declared optional, not in v1.

**Depends on:** Phase 1 — all 7 plans merged (PRs #253–#259) plus Phase 2 spec (PR #263). Specifically:
- Node SDK ABC at `templates/runtime/nodes/base.py`
- Phase 0 `sql_node` for the per-domain mapper bodies (each mapper writes one or two SQL files)
- `vocab.concept` populated with SNOMED + LOINC + RxNorm + MedDRA
- The `unmapped_concepts_queue` table (Phase 1 PR-A) for unmapped MedDRA / LOINC codes

**Unblocks:** Nothing in Phase 2; SDTM is the independent leaf in §8 dependency graph.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **Working directory** for `make` is repo root: `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`). No `unittest`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on the Phase 2 Plan 6 branch (per `feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** (stable across all tasks): `SdtmDomainNode`, `SdtmDomain`, `SdtmDomainError`, `XptReadError`, `DemographicsMapper`, `AeMapper`, `CmMapper`, `VsMapper`, `LbMapper`, `SdtmRunSummary`.
- **Schemas:** raw SDTM XPT data lands in `sdtm_source.*`; CDM output in `sdtm_<study>.*` (default `sdtm_lzzt`); vocabulary in shared `vocab.*`.
- **LZZT test corpus is fetched on demand** — never bundled in the repo (Q10).

---

## Task index (14 tasks)

1. Add `pyreadstat>=1.2.7` to `pyproject.toml`
2. `Makefile` `fetch-fixtures` target (LZZT downloader, Q10)
3. `SdtmDomain` enum + `XptReadError` + `SdtmDomainError` exceptions
4. `SdtmDomainNode` — XPT reader path
5. `sdtm_source` schema + per-domain `fmt_*` tables (DM, AE, CM, VS, LB)
6. CSV/XPT → `fmt_*` loader (Stage 1: bootstrap)
7. `DemographicsMapper` — DM → PERSON + LOCATION
8. `AeMapper` — AE → CONDITION_OCCURRENCE (MedDRA → SNOMED)
9. `CmMapper` — CM → DRUG_EXPOSURE (CMTRT → RxNorm)
10. `VsMapper` — VS → MEASUREMENT (VSTEST → LOINC)
11. `LbMapper` — LB → MEASUREMENT (LBTEST → LOINC)
12. `sdtm_to_omop_v54` manifest + LZZT-anchored E2E
13. Define-XML reader (OPTIONAL stretch — v2 enhancement)
14. ADR 0011 — SDTM → OMOP bridge design

---

## Task 1: Add `pyreadstat>=1.2.7` to `pyproject.toml`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/test_phase_2_plan_6_packaging.py
"""Smoke test that pyreadstat is pinned for the SDTM bridge."""
from __future__ import annotations

from pathlib import Path


def test_pyproject_pins_pyreadstat() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    assert '"pyreadstat>=1.2.7"' in pyproject
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_phase_2_plan_6_packaging.py -v
```

Expected: FAIL — pin missing.

- [ ] **Step 3: Write minimal implementation**

Add `"pyreadstat>=1.2.7"` to the `dependencies` array. Run `uv sync`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_phase_2_plan_6_packaging.py -v
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

Expected: all clean. **Commit:** `chore(templates): pin pyreadstat>=1.2.7 for SDTM XPT reader`.

---

## Task 2: `Makefile` `fetch-fixtures` target (LZZT, Q10)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/Makefile` (or extend existing if present)
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/lzzt/.gitignore`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/lzzt/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/test_lzzt_fetch.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/test_lzzt_fetch.py
"""Makefile fetch-fixtures target produces LZZT XPT files in tests/fixtures/lzzt/."""
from __future__ import annotations

import re
from pathlib import Path

import pytest


def test_makefile_has_fetch_fixtures_target() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    makefile = (repo_root / "Makefile").read_text(encoding="utf-8")
    assert re.search(r"^fetch-fixtures\s*:", makefile, re.M)


def test_makefile_target_documents_cdisc_url() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    makefile = (repo_root / "Makefile").read_text(encoding="utf-8")
    # Reference URL must be documented in a comment so reviewers can audit.
    assert "cdisc.org" in makefile.lower()


def test_lzzt_fixture_dir_gitignored() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    gitignore = (repo_root / "templates" / "tests" / "fixtures" / "lzzt" / ".gitignore")
    body = gitignore.read_text(encoding="utf-8")
    assert "*.xpt" in body
    assert "!README.md" in body
    assert "!.gitignore" in body
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_lzzt_fetch.py -v
```

Expected: FAIL — Makefile or fixtures dir missing.

- [ ] **Step 3: Write minimal implementation**

Repository-root `Makefile` (extend if exists):

```makefile
# CDISC Pilot Project (LZZT) reference dataset for SDTM testing.
# License: CDISC public-domain pilot data; not bundled in the repo (Q10).
# Reference: https://www.cdisc.org/standards/foundational/sdtm/sdtmig-v3-4
LZZT_BASE_URL ?= https://www.cdisc.org/system/files/members/standard/foundational/sdtmig/sdtmigv3.4/sdtmigv3.4-zip-files/cdiscpilot01.zip
LZZT_DEST := templates/tests/fixtures/lzzt

.PHONY: fetch-fixtures
fetch-fixtures: $(LZZT_DEST)/dm.xpt $(LZZT_DEST)/ae.xpt $(LZZT_DEST)/cm.xpt $(LZZT_DEST)/vs.xpt $(LZZT_DEST)/lb.xpt
	@echo "LZZT fixtures present at $(LZZT_DEST)"

$(LZZT_DEST)/dm.xpt $(LZZT_DEST)/ae.xpt $(LZZT_DEST)/cm.xpt $(LZZT_DEST)/vs.xpt $(LZZT_DEST)/lb.xpt: $(LZZT_DEST)/.fetched
$(LZZT_DEST)/.fetched:
	mkdir -p $(LZZT_DEST)
	curl -fsSL "$(LZZT_BASE_URL)" -o $(LZZT_DEST)/cdiscpilot01.zip || \
		(echo "ERROR: CDISC LZZT fetch failed. Set LZZT_BASE_URL or copy a local cdiscpilot01.zip into $(LZZT_DEST)."; exit 1)
	cd $(LZZT_DEST) && unzip -o cdiscpilot01.zip '*.xpt' && rm -f cdiscpilot01.zip
	touch $(LZZT_DEST)/.fetched
```

`templates/tests/fixtures/lzzt/.gitignore`:

```gitignore
# CDISC LZZT reference data — fetched via `make fetch-fixtures`, never committed.
*
!.gitignore
!README.md
```

`templates/tests/fixtures/lzzt/README.md` documents the fetch + an offline fallback (`LZZT_BASE_URL` override pointing at a local mirror).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_lzzt_fetch.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
make -n fetch-fixtures
```

Expected: all clean; `make -n` dry-run shows the target without errors. **Commit:** `feat(repo): Makefile fetch-fixtures target for CDISC LZZT (Q10)`.

---

## Task 3: `SdtmDomain` enum + exceptions

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/sdtm/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/sdtm/types.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/sdtm/exceptions.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_types.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_sdtm_types.py
"""SdtmDomain enum + exception hierarchy."""
from __future__ import annotations

import pytest

from runtime.sdtm.exceptions import SdtmDomainError, XptReadError
from runtime.sdtm.types import SdtmDomain


def test_v1_domains_are_dm_ae_cm_vs_lb() -> None:
    assert {d.value for d in SdtmDomain} == {"DM", "AE", "CM", "VS", "LB"}


def test_xpt_read_error_is_subclass_of_sdtm_domain_error() -> None:
    assert issubclass(XptReadError, SdtmDomainError)
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — modules missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/sdtm/__init__.py
"""Phase 2 SDTM subsystem."""
```

```python
# templates/runtime/sdtm/types.py
"""SDTM domain enum (Q9 — v1 ships DM/AE/CM/VS/LB)."""
from __future__ import annotations

import enum


class SdtmDomain(str, enum.Enum):
    DM = "DM"
    AE = "AE"
    CM = "CM"
    VS = "VS"
    LB = "LB"
```

```python
# templates/runtime/sdtm/exceptions.py
"""SDTM subsystem exceptions."""
from __future__ import annotations


class SdtmDomainError(RuntimeError):
    """Base for all SDTM-related failures."""


class XptReadError(SdtmDomainError):
    """Raised when a SAS XPT file cannot be parsed by pyreadstat."""
```

- [ ] **Step 4-5:** Run tests + gates. **Commit:** `feat(templates): SdtmDomain enum + exceptions (T-016)`.

---

## Task 4: `SdtmDomainNode` — XPT reader

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/sdtm_domain.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_domain_node.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/materializer.py` (register node type)

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_sdtm_domain_node.py
"""SdtmDomainNode reads an XPT file and returns a typed DataFrame."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
import pyreadstat

from runtime.nodes.sdtm_domain import SdtmDomainNode
from runtime.sdtm.exceptions import XptReadError
from runtime.sdtm.types import SdtmDomain


def test_node_reads_dm_xpt(tmp_path: Path) -> None:
    df = pd.DataFrame({
        "STUDYID": ["LZZT"], "USUBJID": ["LZZT-01-001"], "SUBJID": ["001"],
        "AGE": [55], "AGEU": ["YEARS"], "SEX": ["M"], "RACE": ["WHITE"],
    })
    xpt_path = tmp_path / "dm.xpt"
    pyreadstat.write_xport(df, str(xpt_path), table_name="DM")

    node = SdtmDomainNode()
    out = node.run({"domain": "DM", "xpt_path": str(xpt_path)})
    assert out["row_count"] == 1
    assert out["domain"] == "DM"
    assert "USUBJID" in out["columns"]


def test_node_rejects_unknown_domain() -> None:
    with pytest.raises(ValueError):
        SdtmDomainNode.from_config({"domain": "ZZ"})


def test_node_raises_on_unreadable_xpt(tmp_path: Path) -> None:
    bogus = tmp_path / "bogus.xpt"
    bogus.write_bytes(b"not an xpt")
    node = SdtmDomainNode()
    with pytest.raises(XptReadError):
        node.run({"domain": "DM", "xpt_path": str(bogus)})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — node missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nodes/sdtm_domain.py
"""SdtmDomainNode — reads SAS XPT files into typed DataFrames per SDTM domain (T-016)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import pyreadstat

from runtime.nodes.base import Node
from runtime.sdtm.exceptions import XptReadError
from runtime.sdtm.types import SdtmDomain


class SdtmDomainNode(Node):
    type_name = "sdtm_domain"

    @classmethod
    def from_config(cls, params: dict[str, Any]) -> "SdtmDomainNode":
        try:
            SdtmDomain(params["domain"])
        except ValueError as exc:
            raise ValueError(f"unknown SDTM domain: {params['domain']!r}") from exc
        return cls()

    def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        domain = SdtmDomain(inputs["domain"])
        path = Path(inputs["xpt_path"])
        try:
            df, _meta = pyreadstat.read_xport(str(path))
        except Exception as exc:
            raise XptReadError(f"cannot read XPT at {path}: {exc}") from exc
        return {
            "domain": domain.value,
            "row_count": int(len(df)),
            "columns": list(df.columns),
            "dataframe": df,  # consumed by downstream mapper nodes
        }
```

Register `sdtm_domain` in `runtime/registry/materializer.py`'s NODE_TYPES dispatch.

- [ ] **Step 4-5:** Run test + gates. **Commit:** `feat(templates): SdtmDomainNode XPT reader for DM/AE/CM/VS/LB (T-016)`.

---

## Task 5: `sdtm_source` schema + per-domain `fmt_*` tables

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/00_bootstrap_source_schema.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_source_bootstrap.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_sdtm_source_bootstrap.py
"""Bootstrap creates sdtm_source schema with one fmt_<domain> table per SDTM domain."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "sdtm_to_omop_v54" / "sql" / "00_bootstrap_source_schema.sql"
)


def test_creates_sdtm_source_schema() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(r"CREATE SCHEMA IF NOT EXISTS\s+sdtm_source", body, re.I)


@pytest.mark.parametrize("domain,key_cols", [
    ("dm", ["USUBJID", "SEX", "RACE", "AGE"]),
    ("ae", ["USUBJID", "AETERM", "AEDECOD", "AESTDTC", "AEENDTC"]),
    ("cm", ["USUBJID", "CMTRT", "CMDOSE", "CMDOSU", "CMSTDTC", "CMENDTC"]),
    ("vs", ["USUBJID", "VSTESTCD", "VSTEST", "VSORRES", "VSORRESU", "VSDTC"]),
    ("lb", ["USUBJID", "LBTESTCD", "LBTEST", "LBORRES", "LBORRESU", "LBDTC"]),
])
def test_creates_table_with_required_columns(domain: str, key_cols: list[str]) -> None:
    body = SQL.read_text(encoding="utf-8")
    assert re.search(rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?sdtm_source\.fmt_{domain}\b", body, re.I)
    for col in key_cols:
        assert col in body, f"fmt_{domain} missing column {col}"
```

- [ ] **Step 2-5:** Implement `00_bootstrap_source_schema.sql` with `CREATE SCHEMA sdtm_source` and the 5 `fmt_*` tables matching SDTM v3.4 column shapes. Run gates. **Commit:** `feat(templates): sdtm_source schema + 5 per-domain fmt_ tables`.

---

## Task 6: XPT → `fmt_*` loader

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/sdtm/loader.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_sdtm_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_sdtm_loader.py
"""SDTM loader streams an SdtmDomainNode DataFrame into sdtm_source.fmt_<domain>."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine, text
from testcontainers.postgres import PostgresContainer

from runtime.sdtm.loader import load_sdtm_domain_to_source


@pytest.mark.integration
def test_loader_inserts_dm_rows(tmp_path: Path) -> None:
    df = pd.DataFrame([
        {"STUDYID": "LZZT", "USUBJID": "LZZT-01-001", "SUBJID": "001",
         "AGE": 55, "AGEU": "YEARS", "SEX": "M", "RACE": "WHITE"},
        {"STUDYID": "LZZT", "USUBJID": "LZZT-01-002", "SUBJID": "002",
         "AGE": 47, "AGEU": "YEARS", "SEX": "F", "RACE": "BLACK OR AFRICAN AMERICAN"},
    ])
    with PostgresContainer("postgres:16") as ctr:
        dsn = ctr.get_connection_url()
        engine = create_engine(dsn)
        with engine.begin() as conn:
            conn.execute(text(open(
                "manifests/sdtm_to_omop_v54/sql/00_bootstrap_source_schema.sql"
            ).read()))

        load_sdtm_domain_to_source(dsn=dsn, domain="DM", df=df)

        with engine.begin() as conn:
            count = conn.execute(text("SELECT count(*) FROM sdtm_source.fmt_dm")).scalar_one()
        assert count == 2
```

- [ ] **Step 2-5:** Implement `loader.py`. Pure pandas `to_sql` against the bootstrap-schema engine. Run gates. **Commit:** `feat(templates): SDTM XPT → sdtm_source loader`.

---

## Task 7: `DemographicsMapper` — DM → PERSON + LOCATION

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/02a_map_person_location.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_dm_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_sdtm_dm_mapper.py
"""DM mapper inserts one PERSON per USUBJID with mapped sex/race concept_ids."""
from __future__ import annotations

import re
from pathlib import Path

SQL = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "sdtm_to_omop_v54" / "sql" / "02a_map_person_location.sql"
)


def test_person_insert_uses_fmt_dm() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.cdm_schema}.person" in body or "INSERT INTO sdtm_lzzt.person" in body
    assert "sdtm_source.fmt_dm" in body


def test_dm_mapper_handles_sex_codes() -> None:
    body = SQL.read_text(encoding="utf-8")
    # SEX values: M, F, U, UNDIFFERENTIATED → OMOP gender concept_ids
    assert "8507" in body  # M
    assert "8532" in body  # F


def test_dm_mapper_routes_unknown_race_to_unmapped_queue() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "unmapped_concepts_queue" in body
```

- [ ] **Step 2-5:** Implement. SEX → 8507/8532/8551 (UNDIFFERENTIATED) /8570 (UNKNOWN). RACE → SNOMED via `vocab.concept` lookup. ETHNIC → SNOMED. Unmapped values logged to `app.unmapped_concepts_queue` with run_id, source_system='SDTM', source_value. **Commit:** `feat(templates): SDTM DM → PERSON + LOCATION mapper`.

---

## Task 8: `AeMapper` — AE → CONDITION_OCCURRENCE

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/02b_map_condition_from_ae.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_ae_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_ae_mapper_uses_meddra_lookup() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.cdm_schema}.condition_occurrence" in body or "sdtm_lzzt.condition_occurrence" in body
    assert "sdtm_source.fmt_ae" in body
    # MedDRA → SNOMED via concept_relationship 'Maps to'
    assert "MedDRA" in body or "meddra" in body.lower()


def test_ae_mapper_uses_clinical_trial_type_concept() -> None:
    body = SQL.read_text(encoding="utf-8")
    # type_concept_id for clinical-trial AE — use SNOMED 'Clinical trial' adverse event
    # Common choice: 32839 (EHR encounter diagnosis) is wrong here; use 32856 if appropriate.
    # Plan documents the exact concept_id selection in implementation.
    assert "type_concept_id" in body
```

- [ ] **Step 2-5:** Implement. AEDECOD (MedDRA Preferred Term) → JOIN vocab.concept (vocabulary_id='MedDRA') → JOIN vocab.concept_relationship (relationship_id='Maps to') → SNOMED concept_id. Severity (AESEV) → flag in observation if needed. Date range from AESTDTC + AEENDTC. Unmapped MedDRA codes → unmapped_concepts_queue. **Commit:** `feat(templates): SDTM AE → CONDITION_OCCURRENCE mapper via MedDRA→SNOMED`.

---

## Task 9: `CmMapper` — CM → DRUG_EXPOSURE

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/02c_map_drug_from_cm.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_cm_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_cm_mapper_uses_rxnorm_lookup() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.cdm_schema}.drug_exposure" in body or "sdtm_lzzt.drug_exposure" in body
    assert "sdtm_source.fmt_cm" in body
    assert "RxNorm" in body or "rxnorm" in body.lower()


def test_cm_mapper_carries_dose_and_unit() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "CMDOSE" in body
    assert "CMDOSU" in body
```

- [ ] **Step 2-5:** Implement. CMTRT (preferred name) → RxNorm Ingredient via vocab.concept lookup. CMSTDTC/CMENDTC → drug_exposure_start_datetime/end_datetime. CMDOSE+CMDOSU into quantity (via UCUM unit lookup). Route unmapped trade names through the unmapped_concepts_queue. **Commit:** `feat(templates): SDTM CM → DRUG_EXPOSURE mapper via RxNorm`.

---

## Task 10: `VsMapper` — VS → MEASUREMENT

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/02d_map_measurement_from_vs.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_vs_mapper.py`

- [ ] **Step 1: Write the failing test**

```python
def test_vs_mapper_uses_loinc_lookup() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.cdm_schema}.measurement" in body or "sdtm_lzzt.measurement" in body
    assert "sdtm_source.fmt_vs" in body
    assert "LOINC" in body or "loinc" in body.lower()


def test_vs_mapper_carries_value_and_unit() -> None:
    body = SQL.read_text(encoding="utf-8")
    assert "VSORRES" in body
    assert "VSORRESU" in body
```

- [ ] **Step 2-5:** Implement. VSTESTCD (e.g., 'SYSBP', 'DIABP', 'PULSE', 'TEMP') → LOINC via static SDTM-controlled-terms-to-LOINC mapping table OR direct concept lookup. VSORRES → value_as_number; VSORRESU → unit_concept_id via UCUM lookup. **Commit:** `feat(templates): SDTM VS → MEASUREMENT mapper via LOINC`.

---

## Task 11: `LbMapper` — LB → MEASUREMENT

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/02e_map_measurement_from_lb.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sdtm_lb_mapper.py`

Same pattern as Task 10 but for `fmt_lb`. LBTESTCD → LOINC; range_low/range_high from LBORNRLO/LBORNRHI when present. **Commit:** `feat(templates): SDTM LB → MEASUREMENT mapper via LOINC`.

---

## Task 12: `sdtm_to_omop_v54` manifest + LZZT-anchored E2E

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_sdtm_to_omop_v54.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/01_bootstrap_cdm_schema.sql` (CDM v5.4 bootstrap, scoped to the 8 tables this template writes)
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/sdtm_to_omop_v54/sql/03_summarize.sql`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_sdtm_to_omop_v54.py
"""End-to-end: LZZT XPTs → sdtm_lzzt CDM, row counts pass Phase 1 DQ post-conditions."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest


LZZT_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "lzzt"


def _have_lzzt() -> bool:
    return all((LZZT_DIR / f"{d}.xpt").is_file() for d in ("dm", "ae", "cm", "vs", "lb"))


@pytest.mark.integration
@pytest.mark.skipif(not _have_lzzt(), reason="LZZT fixtures not fetched (run `make fetch-fixtures`)")
def test_sdtm_to_omop_v54_runs_to_completion() -> None:
    # Bootstrap vocab + sdtm_source + sdtm_lzzt schemas via testcontainers Postgres.
    # Seed minimal SNOMED+LOINC+RxNorm+MedDRA concepts for the LZZT-used codes.
    # Run the 9-stage pipeline against fixtures/lzzt/{dm,ae,cm,vs,lb}.xpt.
    # Assert PERSON > 0, CONDITION_OCCURRENCE > 0, DRUG_EXPOSURE > 0,
    # MEASUREMENT > 0; ratio of unmapped/mapped within thresholds in
    # validation/expected/post_conditions.yaml.
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Expected: SKIPPED if LZZT not fetched, otherwise FAIL — manifest does not exist.

- [ ] **Step 3: Write minimal implementation**

Manifest stitches the 9-stage pipeline:

```yaml
# templates/manifests/sdtm_to_omop_v54/manifest.yaml
name: sdtm_to_omop_v54
schema_version: "1.0"
description: |
  CDISC SDTM v3.4 → OMOP CDM v5.4 bridge. v1 covers DM/AE/CM/VS/LB
  (decision Q9 — ~80% of safety-trial data). LZZT is the canonical
  test fixture, fetched via `make fetch-fixtures` (Q10).
metadata:
  cdm_versions: ["5.4"]
  required_vocabularies:
    - SNOMED
    - LOINC
    - RxNorm
    - MedDRA
parameters:
  xpt_root:
    type: string
    description: Directory containing the SDTM XPT files (e.g., /data/lzzt).
  cdm_schema:
    type: string
    default: sdtm_lzzt
    description: Per-source CDM schema name.
nodes:
  - id: bootstrap_source
    type: sql
    params:
      sql: file://sql/00_bootstrap_source_schema.sql
  - id: bootstrap_cdm
    type: sql
    params:
      sql: file://sql/01_bootstrap_cdm_schema.sql
  - id: read_dm
    type: sdtm_domain
    depends_on: [bootstrap_source, bootstrap_cdm]
    params:
      domain: DM
      xpt_path: ${parameters.xpt_root}/dm.xpt
  - id: read_ae
    type: sdtm_domain
    depends_on: [bootstrap_source, bootstrap_cdm]
    params:
      domain: AE
      xpt_path: ${parameters.xpt_root}/ae.xpt
  - id: read_cm
    type: sdtm_domain
    depends_on: [bootstrap_source, bootstrap_cdm]
    params:
      domain: CM
      xpt_path: ${parameters.xpt_root}/cm.xpt
  - id: read_vs
    type: sdtm_domain
    depends_on: [bootstrap_source, bootstrap_cdm]
    params:
      domain: VS
      xpt_path: ${parameters.xpt_root}/vs.xpt
  - id: read_lb
    type: sdtm_domain
    depends_on: [bootstrap_source, bootstrap_cdm]
    params:
      domain: LB
      xpt_path: ${parameters.xpt_root}/lb.xpt
  - id: map_person_location
    type: sql
    depends_on: [read_dm]
    params:
      sql: file://sql/02a_map_person_location.sql
  - id: map_condition_from_ae
    type: sql
    depends_on: [read_ae, map_person_location]
    params:
      sql: file://sql/02b_map_condition_from_ae.sql
  - id: map_drug_from_cm
    type: sql
    depends_on: [read_cm, map_person_location]
    params:
      sql: file://sql/02c_map_drug_from_cm.sql
  - id: map_measurement_from_vs
    type: sql
    depends_on: [read_vs, map_person_location]
    params:
      sql: file://sql/02d_map_measurement_from_vs.sql
  - id: map_measurement_from_lb
    type: sql
    depends_on: [read_lb, map_person_location]
    params:
      sql: file://sql/02e_map_measurement_from_lb.sql
  - id: summarize
    type: sql
    depends_on:
      - map_person_location
      - map_condition_from_ae
      - map_drug_from_cm
      - map_measurement_from_vs
      - map_measurement_from_lb
    params:
      sql: file://sql/03_summarize.sql
```

`01_bootstrap_cdm_schema.sql` creates the per-source CDM schema (default `sdtm_lzzt`) with the 8 tables we write (PERSON, LOCATION, CONDITION_OCCURRENCE, DRUG_EXPOSURE, MEASUREMENT, OBSERVATION_PERIOD, VISIT_OCCURRENCE if needed for FK, NOTE — likely just the 5 we map plus PERSON+LOCATION).

`03_summarize.sql` produces row counts; `validation/expected/post_conditions.yaml` carries threshold bounds.

- [ ] **Step 4-5:** Run E2E + gates. **Commit:** `feat(templates): sdtm_to_omop_v54 manifest + LZZT E2E (T-020)`.

---

## Task 13: Define-XML reader (OPTIONAL stretch)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/sdtm/define_xml.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_define_xml_reader.py`

- [ ] **Note:** This task is OPTIONAL. v1 ships XPT-only; Define-XML is a v2 enhancement that lets `SdtmDomainNode` validate column types and value-list constraints against a study's metadata definitions before mapping. Skip if blocked on time; add a follow-up task to a Phase 3 backlog.

- [ ] **Step 1-5:** Add `xmlschema>=3.0` as an optional dep. Implement a `DefineXmlReader` that parses define.xml v2.0/v2.1 and exposes per-domain column metadata (variable codelists, units, decimal precision). Add an `enable_define_xml: bool = False` parameter to `SdtmDomainNode`; when set, validate the XPT DataFrame against the Define-XML before emitting. **Commit:** `feat(templates): Define-XML reader for SdtmDomainNode (v2 stretch)`.

---

## Task 14: ADR 0011 — SDTM → OMOP bridge design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0011-sdtm-to-omop-bridge.md`

- [ ] **Step 1: Draft the ADR**

ADR 0011 covers:
- Context: Phase 2 §1, Q7 (vocab baseline includes MedDRA), Q9 (v1 domains DM/AE/CM/VS/LB), Q10 (LZZT fixture not bundled — fetched via Makefile).
- Decision: Single template (`sdtm_to_omop_v54`) with one SAS XPT reader node (`SdtmDomainNode`) and 5 domain mappers. v1 hits ~80% of safety-trial data; later phases extend to TR (tumor results), TU (tumor identification), TM (trial summary), and the Disposition cluster (DS, DV, EX) when customers ask.
- Consequences: Customers running CDISC-formatted clinical-trial data can now feed the Parthenon stack directly. The MedDRA vocabulary becomes a hard requirement; if a customer doesn't have it, the AE mapper will route every code to the unmapped queue. Define-XML support is a v2 enhancement.
- Alternatives considered: Per-domain templates (declined — multiplies manifest count without benefit). Bundle LZZT in repo (declined — license review burden + ~50 MB bloat). Map AE through ICD-10 instead of MedDRA→SNOMED (declined — clinical trials are MedDRA-coded by regulation; round-trip via ICD-10 loses specificity).

- [ ] **Step 2: Run gates**

```bash
ls /home/smudoshi/Github/Parthenon/docs/architecture/adr-0011-sdtm-to-omop-bridge.md
```

Expected: file present. **Commit:** `docs(adr): ADR 0011 — SDTM → OMOP bridge design`.

---

## Done

After Task 14 lands, Plan 6 is complete. The `sdtm_to_omop_v54` template is operational against the LZZT reference dataset; customers with their own SDTM corpus can run it after providing `xpt_root`. Plans 1, 4, 6 collectively give Phase 2 its foundations for the NER, MIMIC, and SDTM lanes; Plans 2, 3, 5 build incrementally on these.
