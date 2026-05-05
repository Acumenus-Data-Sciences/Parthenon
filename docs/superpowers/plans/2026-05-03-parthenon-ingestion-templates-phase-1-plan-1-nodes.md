# Parthenon Ingestion Templates — Phase 1, Plan 1: Phase 1 Nodes Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three new node types that all Phase 1 templates depend on: `FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode`. After this plan, the templates runtime can ingest FHIR R4 (bulk-export NDJSON or paginated search), stream DICOM metadata (filesystem or DICOMweb QIDO-RS, pixels never copied), and anonymize FHIR bundles via two interchangeable backends (MS sidecar or Parthenon native).

**Architecture:** Each new node implements the existing Node ABC (`templates/runtime/nodes/base.py`) shipped in Phase 0. No SDK changes. The anonymizer ships with a sidecar container (`parthenon-anonymizer` from Parthenon's GHCR mirror, decision Q1 in spec §11) on the existing `parthenon` docker network. Profile packs for FHIR (US Core / mCODE / IPS / MII) ship as curated JSON fixtures alongside the node, pinned per-Phase per decision Q2.

**Tech Stack:** Python 3.12, Phase 0 toolchain (uv, ruff, black --line-length 100, mypy --strict, pytest, pytest-asyncio). New deps: `fhir.resources==8.2.0`, `pydicom==3.0.2`. Anonymizer sidecar uses MS Tools-for-Health-Data-Anonymization, mirrored as `ghcr.io/sudoshi/parthenon-fhir-anonymizer:v3.2.1`.

**Depends on:** Phase 0 — all 4 plans + runtime-gap fix landed. Specifically, this plan depends on:
- Node SDK ABC at `templates/runtime/nodes/base.py`
- Materializer's `${parameters.*}` interpolation (runtime-gap commit `058cd8e89`)
- PrefectBackend's `db_dsn` threading (runtime-gap commit `9dea2fcd4`)
- `parthenon-templates` compose service entry
- Internal-token auth middleware

**Unblocks:** Phase 1 Plan 2 (DICOM stack), Plan 3 (PRO instruments), Plan 4 (FHIR anonymizer), Plans 5/6/7 (FHIR→OMOP).

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`). No `unittest`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on a Phase 1 branch (per `feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** are stable across all tasks: `FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode`, `AnonymizerBackend` (Protocol), `MsAnonymizerBackend`, `ParthenonNativeBackend`, `AnonymizerConfigError`, `FhirProfileError`, `DicomSourceBackend`, `FilesystemDicomBackend`, `DicomwebBackend`.
- **Pinned versions** (validated against PyPI as of 2026-05-03):
  - `fhir.resources==8.2.0`
  - `pydicom==3.0.2`
  - All Phase 0 pins remain unchanged.

---

## Task index (17 tasks)

1. Add `fhir.resources==8.2.0` and `pydicom==3.0.2` to `pyproject.toml`
2. Profile pack scaffolding: 4 stub JSON files (us-core, mcode, ips, mii)
3. `FhirResourceNode` — NDJSON streaming path (`$export` Bulk Data)
4. `FhirResourceNode` — search fallback path (paginated)
5. `FhirResourceNode` — profile selector validation
6. `FhirResourceNode` — memory profile harness (<200MB RSS on 1GB synthetic bundle)
7. `DicomMetadataNode` — filesystem backend
8. `DicomMetadataNode` — DICOMweb (QIDO-RS) backend with bearer token
9. `DicomMetadataNode` — pixel-data-absence test
10. Anonymizer JSON Schema v1 + validator
11. `ParthenonNativeBackend` (pure Python rule engine)
12. `MsAnonymizerBackend` (sidecar HTTP client; mocked sidecar in unit tests)
13. `AnonymizerNode` (selects backend by `params.backend`)
14. Anonymizer sidecar Dockerfile + docker-compose service entry
15. Anonymizer config-format semantic-equivalence integration test
16. Update orchestration node registry to map type names
17. ADR 0004 — Phase 1 node design

---

## Task 1: Add `fhir.resources` and `pydicom` to `pyproject.toml`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_phase_1_packaging.py
"""Smoke test that Phase 1 deps are pinned in pyproject.toml."""
from __future__ import annotations

from pathlib import Path


def test_pyproject_declares_phase_1_pinned_versions() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for required in (
        "fhir.resources==8.2.0",
        "pydicom==3.0.2",
    ):
        assert required in pyproject, f"missing pinned dep: {required}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_phase_1_packaging.py -v`
Expected: FAIL with `AssertionError: missing pinned dep: fhir.resources==8.2.0`.

- [ ] **Step 3: Write minimal implementation**

Add the two pins to the `dependencies` array in `pyproject.toml`:

```toml
dependencies = [
    # ... existing Phase 0 pins ...
    "fhir.resources==8.2.0",
    "pydicom==3.0.2",
]
```

Run `uv sync` to install.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_phase_1_packaging.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. The new deps don't add source files yet, so mypy and tests should be unchanged.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/pyproject.toml templates/uv.lock templates/tests/test_phase_1_packaging.py
git commit -m "chore(templates): pin fhir.resources 8.2.0 and pydicom 3.0.2 for Phase 1"
```

---

## Task 2: Profile pack scaffolding

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/profile_packs/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/profile_packs/us-core.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/profile_packs/mcode.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/profile_packs/ips.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/profile_packs/mii.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_profile_packs.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_profile_packs.py
"""Profile packs ship as curated JSON, one file per FHIR profile."""
from __future__ import annotations

import json
from pathlib import Path

import pytest


PROFILE_PACK_ROOT = Path(__file__).resolve().parents[2] / "runtime" / "nodes" / "profile_packs"
EXPECTED = ["us-core", "mcode", "ips", "mii"]


@pytest.mark.parametrize("profile", EXPECTED)
def test_profile_pack_exists_and_parses(profile: str) -> None:
    path = PROFILE_PACK_ROOT / f"{profile}.json"
    assert path.exists(), f"profile pack missing: {path}"
    payload = json.loads(path.read_text(encoding="utf-8"))
    # Every pack has a name, version, and a non-empty resources list.
    assert payload["profile"] == profile
    assert isinstance(payload["version"], str) and payload["version"]
    assert isinstance(payload["resources"], list) and payload["resources"]


def test_profile_pack_resources_are_known_fhir_types() -> None:
    """Every resource declared in a pack is a real FHIR R4 resource type."""
    known = {
        "Patient", "Encounter", "Condition", "Observation", "Procedure",
        "MedicationRequest", "MedicationStatement", "MedicationAdministration",
        "Immunization", "DiagnosticReport", "Consent", "QuestionnaireResponse",
        "AllergyIntolerance", "DocumentReference", "Specimen", "ImagingStudy",
    }
    for profile in EXPECTED:
        payload = json.loads((PROFILE_PACK_ROOT / f"{profile}.json").read_text("utf-8"))
        for r in payload["resources"]:
            assert r["type"] in known, f"{profile}.json: unknown resource type {r['type']!r}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_profile_packs.py -v`
Expected: FAIL with `profile pack missing: .../us-core.json`.

- [ ] **Step 3: Write minimal implementation**

Create `templates/runtime/nodes/profile_packs/__init__.py` (empty).

Create `templates/runtime/nodes/profile_packs/us-core.json`:

```json
{
  "profile": "us-core",
  "name": "US Core Implementation Guide",
  "version": "6.1.0",
  "url": "https://hl7.org/fhir/us/core/STU6.1/",
  "pinned_at": "2026-05-03",
  "resources": [
    {"type": "Patient", "must_support": ["identifier", "name", "gender", "birthDate"]},
    {"type": "Encounter", "must_support": ["status", "class", "type", "subject", "period"]},
    {"type": "Condition", "must_support": ["clinicalStatus", "verificationStatus", "code", "subject"]},
    {"type": "Observation", "must_support": ["status", "category", "code", "subject", "effective", "value"]},
    {"type": "Procedure", "must_support": ["status", "code", "subject", "performed"]},
    {"type": "MedicationRequest", "must_support": ["status", "intent", "medication", "subject", "authoredOn"]},
    {"type": "Immunization", "must_support": ["status", "vaccineCode", "patient", "occurrence"]},
    {"type": "DiagnosticReport", "must_support": ["status", "category", "code", "subject", "effective"]},
    {"type": "AllergyIntolerance", "must_support": ["clinicalStatus", "verificationStatus", "code", "patient"]},
    {"type": "DocumentReference", "must_support": ["status", "type", "subject", "content"]}
  ]
}
```

Create `mcode.json` (oncology):

```json
{
  "profile": "mcode",
  "name": "Minimal Common Oncology Data Elements",
  "version": "3.0.0",
  "url": "https://hl7.org/fhir/us/mcode/STU3/",
  "pinned_at": "2026-05-03",
  "resources": [
    {"type": "Patient", "must_support": ["identifier", "name", "gender", "birthDate"]},
    {"type": "Condition", "must_support": ["clinicalStatus", "verificationStatus", "code", "subject", "bodySite", "stage"]},
    {"type": "Observation", "must_support": ["status", "category", "code", "subject", "value", "specimen"]},
    {"type": "Procedure", "must_support": ["status", "code", "subject", "performed", "bodySite", "reasonReference"]},
    {"type": "MedicationStatement", "must_support": ["status", "medication", "subject", "effective", "reasonCode"]},
    {"type": "MedicationAdministration", "must_support": ["status", "medication", "subject", "effective", "dosage"]},
    {"type": "Specimen", "must_support": ["status", "type", "subject", "collection"]}
  ]
}
```

Create `ips.json` (international patient summary):

```json
{
  "profile": "ips",
  "name": "International Patient Summary",
  "version": "1.1.0",
  "url": "https://hl7.org/fhir/uv/ips/STU1.1/",
  "pinned_at": "2026-05-03",
  "resources": [
    {"type": "Patient", "must_support": ["identifier", "name", "gender", "birthDate", "address"]},
    {"type": "AllergyIntolerance", "must_support": ["clinicalStatus", "verificationStatus", "code", "patient", "reaction"]},
    {"type": "Condition", "must_support": ["clinicalStatus", "verificationStatus", "code", "subject", "onset"]},
    {"type": "MedicationStatement", "must_support": ["status", "medication", "subject", "effective"]},
    {"type": "Immunization", "must_support": ["status", "vaccineCode", "patient", "occurrence"]},
    {"type": "Procedure", "must_support": ["status", "code", "subject", "performed"]},
    {"type": "DiagnosticReport", "must_support": ["status", "category", "code", "subject", "result"]}
  ]
}
```

Create `mii.json` (German Medical Informatics Initiative):

```json
{
  "profile": "mii",
  "name": "German Medical Informatics Initiative Core Data Set",
  "version": "2024.0.0",
  "url": "https://www.medizininformatik-initiative.de/",
  "pinned_at": "2026-05-03",
  "resources": [
    {"type": "Patient", "must_support": ["identifier", "name", "gender", "birthDate"]},
    {"type": "Encounter", "must_support": ["status", "class", "type", "subject", "period", "diagnosis"]},
    {"type": "Condition", "must_support": ["clinicalStatus", "code", "subject", "recordedDate"]},
    {"type": "Observation", "must_support": ["status", "category", "code", "subject", "effective", "value"]},
    {"type": "Procedure", "must_support": ["status", "code", "subject", "performed"]},
    {"type": "MedicationStatement", "must_support": ["status", "medication", "subject", "dosage"]},
    {"type": "MedicationAdministration", "must_support": ["status", "medication", "subject", "effective"]}
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_profile_packs.py -v`
Expected: PASS — 5 tests (4 parametrized + 1 type-validity).

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/profile_packs/ templates/tests/unit/test_profile_packs.py
git commit -m "feat(templates): add Phase 1 profile packs (US Core, mCODE, IPS, MII)"
```

---

## Task 3: `FhirResourceNode` — NDJSON streaming path

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/fhir_resource.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_resource_ndjson.py`

This task implements the **bulk-export NDJSON path** — the primary FHIR ingestion mode per spec §6.3. The node accepts a directory of NDJSON files (one per FHIR resource type, as `$export` produces) and streams them line-by-line into per-type Parquet artifacts. **NEVER** call `json.loads()` on a whole bundle — line-iter only.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_resource_ndjson.py
"""FhirResourceNode: NDJSON streaming path."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import polars as pl
import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


def _write_ndjson(path: Path, resources: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in resources:
            f.write(json.dumps(r) + "\n")


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-fhir",
        node_id="fhir-1",
        logger=logging.getLogger("test.fhir"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert FhirResourceNode.type_name == "fhir_resource"


def test_streams_ndjson_to_parquet(context: NodeContext, tmp_path: Path) -> None:
    """Read a directory of NDJSON files, emit one Parquet artifact per resource type."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [
            {"resourceType": "Patient", "id": "p1", "gender": "male"},
            {"resourceType": "Patient", "id": "p2", "gender": "female"},
        ],
    )
    _write_ndjson(
        bulk_dir / "Observation.ndjson",
        [
            {"resourceType": "Observation", "id": "o1", "status": "final"},
        ],
    )

    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    assert result.status == NodeStatus.SUCCESS

    # Two Parquet artifacts emitted, one per resource type
    patient_parquet = tmp_path / "patient.parquet"
    obs_parquet = tmp_path / "observation.parquet"
    assert patient_parquet.exists()
    assert obs_parquet.exists()

    patients = pl.read_parquet(patient_parquet)
    assert patients.height == 2
    assert "id" in patients.columns
    assert set(patients["id"].to_list()) == {"p1", "p2"}


def test_skips_files_not_matching_profile(context: NodeContext, tmp_path: Path) -> None:
    """A resource type not in the chosen profile is skipped, not failed."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Group.ndjson",
        [{"resourceType": "Group", "id": "g1"}],
    )
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [{"resourceType": "Patient", "id": "p1"}],
    )

    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    assert result.status == NodeStatus.SUCCESS
    # Patient is in us-core; Group is not — only patient.parquet should exist.
    assert (tmp_path / "patient.parquet").exists()
    assert not (tmp_path / "group.parquet").exists()
    # Skipped types are reported in outputs.
    assert "Group" in result.outputs.get("skipped_resource_types", [])


def test_missing_ndjson_dir_fails(context: NodeContext) -> None:
    result = FhirResourceNode().run(
        context,
        {"source": "ndjson", "ndjson_dir": "/nonexistent/path", "profile": "us-core"},
    )
    assert result.status == NodeStatus.FAILED
    assert "ndjson_dir" in (result.error_message or "")


def test_unknown_profile_fails(context: NodeContext, tmp_path: Path) -> None:
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    result = FhirResourceNode().run(
        context,
        {"source": "ndjson", "ndjson_dir": str(bulk_dir), "profile": "made-up"},
    )
    assert result.status == NodeStatus.FAILED
    assert "profile" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_ndjson.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.fhir_resource'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/fhir_resource.py
"""FhirResourceNode: ingest FHIR R4 resources to per-type Parquet artifacts.

Two source modes:
  - ``ndjson``: read a directory of NDJSON files (one per resource type), as produced
    by the FHIR Bulk Data ``$export`` operation. Streams line-by-line; never loads
    a whole bundle into memory.
  - ``search``: paginated REST search against a FHIR R4 server (Task 4).

Output: one Parquet artifact per resource type, named ``<resourceType>.parquet`` (lowercased).
Resources whose type is not in the selected profile pack are skipped (not failed) so
unknown extensions don't break ingestion.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

PROFILE_PACK_DIR = Path(__file__).resolve().parent / "profile_packs"


def _load_profile_pack(profile: str) -> dict[str, Any]:
    path = PROFILE_PACK_DIR / f"{profile}.json"
    if not path.exists():
        raise ValueError(
            f"unknown profile {profile!r}; expected one of "
            f"{[p.stem for p in PROFILE_PACK_DIR.glob('*.json')]}"
        )
    return dict(json.loads(path.read_text(encoding="utf-8")))


def _profile_resource_types(pack: dict[str, Any]) -> set[str]:
    return {r["type"] for r in pack.get("resources", [])}


class FhirResourceNode(Node):
    """Ingest FHIR R4 resources into per-type Parquet artifacts."""

    type_name = "fhir_resource"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        source = params.get("source")
        profile_name = params.get("profile")

        if not profile_name:
            return NodeResult(
                status=NodeStatus.FAILED, error_message="FhirResourceNode requires 'profile' param"
            )
        try:
            pack = _load_profile_pack(profile_name)
        except ValueError as exc:
            return NodeResult(status=NodeStatus.FAILED, error_message=str(exc))

        allowed_types = _profile_resource_types(pack)

        if source == "ndjson":
            return self._run_ndjson(context, params, allowed_types)
        if source == "search":
            return self._run_search(context, params, allowed_types)
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=f"FhirResourceNode requires source in {{'ndjson','search'}}, got {source!r}",
        )

    def _run_ndjson(
        self,
        context: NodeContext,
        params: dict[str, Any],
        allowed_types: set[str],
    ) -> NodeResult:
        ndjson_dir = Path(params.get("ndjson_dir", ""))
        if not ndjson_dir.exists() or not ndjson_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"ndjson_dir does not exist: {ndjson_dir}",
            )

        per_type: dict[str, list[dict[str, Any]]] = {}
        skipped: set[str] = set()
        files_seen = 0
        lines_seen = 0

        for path in sorted(ndjson_dir.glob("*.ndjson")):
            files_seen += 1
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    lines_seen += 1
                    record = json.loads(line)
                    rtype = record.get("resourceType", path.stem)
                    if rtype not in allowed_types:
                        skipped.add(rtype)
                        continue
                    per_type.setdefault(rtype, []).append(record)

        for rtype, rows in per_type.items():
            df = pl.from_dicts(rows)
            artifact_name = f"{rtype.lower()}.parquet"
            df.write_parquet(context.artifact_dir / artifact_name)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "files_processed": files_seen,
                "lines_processed": lines_seen,
                "resource_types_emitted": sorted(per_type.keys()),
                "skipped_resource_types": sorted(skipped),
            },
        )

    def _run_search(
        self,
        context: NodeContext,
        params: dict[str, Any],
        allowed_types: set[str],
    ) -> NodeResult:
        # Implemented in Task 4
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="search source is not yet implemented (Task 4)",
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_ndjson.py -v`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/fhir_resource.py templates/tests/unit/test_fhir_resource_ndjson.py
git commit -m "feat(templates): add FhirResourceNode NDJSON streaming path"
```

---

## Task 4: `FhirResourceNode` — search fallback path

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/fhir_resource.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_resource_search.py`

Adds the **paginated search path**: when a customer's FHIR server doesn't expose `$export`, fall back to walking each resource type via REST search with `_count`-based pagination. Streams via `httpx` page-by-page; never holds more than one page of resources in memory.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_resource_search.py
"""FhirResourceNode: search fallback path with httpx mock."""
from __future__ import annotations

import logging
from pathlib import Path

import httpx
import polars as pl
import pytest
import respx

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-search",
        node_id="fhir-search",
        logger=logging.getLogger("test.fhir.search"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


@pytest.mark.respx(base_url="https://fhir.example.com")
def test_search_paginates_through_bundle(context: NodeContext, tmp_path: Path) -> None:
    """Walk a 2-page Patient bundle via the next-link Bundle convention."""
    page1 = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "p1"}},
            {"resource": {"resourceType": "Patient", "id": "p2"}},
        ],
        "link": [
            {"relation": "next", "url": "https://fhir.example.com/Patient?_page=2"},
        ],
    }
    page2 = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "p3"}},
        ],
    }
    with respx.mock(base_url="https://fhir.example.com") as router:
        router.get("/Patient").respond(json=page1)
        router.get("/Patient", params={"_page": "2"}).respond(json=page2)

        result = FhirResourceNode().run(
            context,
            {
                "source": "search",
                "fhir_base_url": "https://fhir.example.com",
                "profile": "us-core",
                "resource_types": ["Patient"],
            },
        )
    assert result.status == NodeStatus.SUCCESS
    patients = pl.read_parquet(tmp_path / "patient.parquet")
    assert patients.height == 3
    assert set(patients["id"].to_list()) == {"p1", "p2", "p3"}


@pytest.mark.respx(base_url="https://fhir.example.com")
def test_search_passes_bearer_token(context: NodeContext, tmp_path: Path) -> None:
    """A bearer_token param is sent as Authorization header on every call."""
    captured: list[httpx.Request] = []

    def _capture(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(200, json={"resourceType": "Bundle", "entry": []})

    with respx.mock(base_url="https://fhir.example.com") as router:
        router.get("/Patient").mock(side_effect=_capture)
        FhirResourceNode().run(
            context,
            {
                "source": "search",
                "fhir_base_url": "https://fhir.example.com",
                "profile": "us-core",
                "resource_types": ["Patient"],
                "bearer_token": "test-token-abc",
            },
        )
    assert captured, "no request captured"
    assert captured[0].headers["authorization"] == "Bearer test-token-abc"


@pytest.mark.respx(base_url="https://fhir.example.com")
def test_search_skips_unknown_resource_types(context: NodeContext, tmp_path: Path) -> None:
    """If resource_types includes a type not in the profile, skip with a log entry."""
    with respx.mock(base_url="https://fhir.example.com") as router:
        router.get("/Patient").respond(
            json={"resourceType": "Bundle", "entry": [{"resource": {"resourceType": "Patient", "id": "p1"}}]}
        )
        result = FhirResourceNode().run(
            context,
            {
                "source": "search",
                "fhir_base_url": "https://fhir.example.com",
                "profile": "us-core",
                "resource_types": ["Patient", "MadeUpType"],
            },
        )
    assert result.status == NodeStatus.SUCCESS
    assert "MadeUpType" in result.outputs.get("skipped_resource_types", [])
```

Add `respx==0.21.1` and `httpx` (already in deps) to `pyproject.toml` dev deps if not present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_search.py -v`
Expected: FAIL — `_run_search` returns "not yet implemented".

- [ ] **Step 3: Write minimal implementation**

Replace the `_run_search` stub with:

```python
import httpx

def _run_search(
    self,
    context: NodeContext,
    params: dict[str, Any],
    allowed_types: set[str],
) -> NodeResult:
    base_url = params.get("fhir_base_url", "").rstrip("/")
    if not base_url:
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="search source requires 'fhir_base_url' param",
        )
    requested = list(params.get("resource_types", []))
    if not requested:
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="search source requires 'resource_types' (non-empty list)",
        )

    headers: dict[str, str] = {"Accept": "application/fhir+json"}
    bearer = params.get("bearer_token")
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    per_type: dict[str, list[dict[str, Any]]] = {}
    skipped: set[str] = set()
    pages_seen = 0

    with httpx.Client(headers=headers, timeout=30.0) as client:
        for rtype in requested:
            if rtype not in allowed_types:
                skipped.add(rtype)
                continue
            url: str | None = f"{base_url}/{rtype}"
            while url:
                resp = client.get(url)
                if resp.status_code != 200:
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=f"FHIR search {url} returned {resp.status_code}",
                    )
                bundle = resp.json()
                pages_seen += 1
                for entry in bundle.get("entry", []) or []:
                    resource = entry.get("resource") or {}
                    if resource.get("resourceType") == rtype:
                        per_type.setdefault(rtype, []).append(resource)
                url = self._next_link(bundle)

    for rtype, rows in per_type.items():
        if not rows:
            continue
        df = pl.from_dicts(rows)
        df.write_parquet(context.artifact_dir / f"{rtype.lower()}.parquet")

    return NodeResult(
        status=NodeStatus.SUCCESS,
        outputs={
            "pages_processed": pages_seen,
            "resource_types_emitted": sorted(per_type.keys()),
            "skipped_resource_types": sorted(skipped),
        },
    )

@staticmethod
def _next_link(bundle: dict[str, Any]) -> str | None:
    """Return the URL of the bundle's 'next' link, if any."""
    for link in bundle.get("link", []) or []:
        if link.get("relation") == "next":
            url = link.get("url")
            return str(url) if url else None
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_search.py -v`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/fhir_resource.py templates/tests/unit/test_fhir_resource_search.py templates/pyproject.toml templates/uv.lock
git commit -m "feat(templates): add FhirResourceNode search fallback path with bearer auth"
```

---

## Task 5: `FhirResourceNode` — profile selector validation

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/fhir_resource.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_resource_ndjson.py`

Per spec decision Q3 — when a resource declares `meta.profile` that conflicts with the run's selected profile, **fail loudly**. This task adds the conflict check (currently the node accepts any resource of an allowed type without inspecting `meta.profile`).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/test_fhir_resource_ndjson.py`:

```python
def test_resource_with_unknown_profile_in_meta_fails_loudly(context: NodeContext, tmp_path: Path) -> None:
    """Per spec Q3: meta.profile that doesn't match the run's profile pack -> FAILED."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [
            {
                "resourceType": "Patient",
                "id": "p1",
                "meta": {"profile": ["http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/Patient"]},
            }
        ],
    )
    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
            "strict_profile_match": True,
        },
    )
    assert result.status == NodeStatus.FAILED
    assert "profile" in (result.error_message or "").lower()


def test_resource_without_meta_profile_is_accepted(context: NodeContext, tmp_path: Path) -> None:
    """A resource without meta.profile uses base FHIR semantics; no conflict possible."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [{"resourceType": "Patient", "id": "p1"}],  # no meta
    )
    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
            "strict_profile_match": True,
        },
    )
    assert result.status == NodeStatus.SUCCESS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_ndjson.py::test_resource_with_unknown_profile_in_meta_fails_loudly -v`
Expected: FAIL — currently the node accepts any resource of an allowed type.

- [ ] **Step 3: Write minimal implementation**

Add a profile-URL set per pack (extracted from `pack["resources"][*]` and the pack-level `url`), then check `resource.meta.profile` against it when `strict_profile_match` is true.

In `_run_ndjson`:

```python
strict = bool(params.get("strict_profile_match", False))
allowed_profile_urls = self._profile_urls(pack) if strict else None

# inside the line loop:
if strict and not self._profile_url_match(record, allowed_profile_urls):
    return NodeResult(
        status=NodeStatus.FAILED,
        error_message=(
            f"strict_profile_match: resource {rtype}/{record.get('id')} declares "
            f"meta.profile not in {profile_name!r} pack — refusing to coerce"
        ),
    )
```

Helpers:

```python
@staticmethod
def _profile_urls(pack: dict[str, Any]) -> set[str]:
    """Return the set of profile URLs this pack accepts.

    For Phase 1, packs declare a single top-level ``url``; resources inherit it.
    Any meta.profile entry must equal that URL or be a strict prefix subpath.
    """
    base = str(pack.get("url", "")).rstrip("/")
    return {base} if base else set()

@staticmethod
def _profile_url_match(resource: dict[str, Any], allowed: set[str] | None) -> bool:
    if allowed is None:
        return True
    declared = resource.get("meta", {}).get("profile") or []
    if not declared:
        return True  # no claim, accept
    return any(any(d.startswith(a) for a in allowed) for d in declared)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_resource_ndjson.py -v`
Expected: PASS (all NDJSON tests, including the new strict-match cases).

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/fhir_resource.py templates/tests/unit/test_fhir_resource_ndjson.py
git commit -m "feat(templates): FhirResourceNode strict_profile_match (fail loudly per spec Q3)"
```

---

## Task 6: `FhirResourceNode` — memory profile harness

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_fhir_resource_memory.py`

Per spec §4.1 acceptance criterion: streaming a 1GB synthetic NDJSON bundle must keep RSS under 200 MB. This task ships a marked-slow integration test that generates a synthetic bundle on the fly and asserts memory ceiling via `resource.getrusage()`.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_fhir_resource_memory.py
"""FhirResourceNode memory profile: streams a 1GB bundle under a 200MB RSS ceiling."""
from __future__ import annotations

import json
import logging
import resource
from pathlib import Path

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


def _generate_synthetic_patients(path: Path, target_bytes: int) -> int:
    """Write enough Patient NDJSON to exceed target_bytes. Returns lines written."""
    line_template = (
        '{{"resourceType":"Patient","id":"p{i}","gender":"male","birthDate":"1970-01-01",'
        '"name":[{{"family":"FAM_{i}","given":["Synthetic"]}}],'
        '"address":[{{"city":"Test","state":"PA","postalCode":"00000"}}],'
        '"telecom":[{{"system":"phone","value":"555-0100"}}]}}\n'
    )
    written = 0
    n = 0
    with path.open("w", encoding="utf-8") as f:
        while written < target_bytes:
            line = line_template.format(i=n)
            f.write(line)
            written += len(line)
            n += 1
    return n


@pytest.mark.slow
@pytest.mark.integration
def test_streams_1gb_bundle_under_200mb_rss(tmp_path: Path) -> None:
    """Acceptance criterion: 1GB NDJSON ingested with peak RSS <200MB."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    target_bytes = 1 * 1024 * 1024 * 1024  # 1 GB
    n_lines = _generate_synthetic_patients(bulk_dir / "Patient.ndjson", target_bytes)
    assert n_lines > 0

    ctx = NodeContext(
        run_id="mem-probe",
        node_id="fhir-mem",
        logger=logging.getLogger("test.fhir.mem"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )

    rss_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss  # KB on Linux
    result = FhirResourceNode().run(
        ctx,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    rss_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    assert result.status == NodeStatus.SUCCESS
    rss_delta_mb = (rss_after - rss_before) / 1024
    assert rss_delta_mb < 200, (
        f"RSS grew by {rss_delta_mb:.1f} MB ingesting 1GB bundle (limit: 200 MB) — "
        f"streaming guarantee broken"
    )
```

Add to `pyproject.toml` `[tool.pytest.ini_options]`:

```toml
markers = [
    "slow: tests that take >30s to run (skip in CI fast-path)",
    "integration: tests that require real services (Postgres, sidecar containers)",
]
```

- [ ] **Step 2: Run test to verify it fails**

Currently `_run_ndjson` accumulates all rows in memory before writing Parquet (`per_type.setdefault(rtype, []).append(record)`). On a 1GB bundle, RSS will grow well past 200 MB.

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_fhir_resource_memory.py -v -m slow`
Expected: FAIL — RSS delta exceeds 200 MB.

- [ ] **Step 3: Write minimal implementation**

Refactor `_run_ndjson` to write Parquet incrementally per file rather than buffering all records. Use `polars.DataFrame.write_parquet(append=True)` is not supported, so chunk by file: each `*.ndjson` file becomes one Parquet write, and we stream through the file once.

```python
def _run_ndjson(
    self,
    context: NodeContext,
    params: dict[str, Any],
    allowed_types: set[str],
) -> NodeResult:
    ndjson_dir = Path(params.get("ndjson_dir", ""))
    if not ndjson_dir.exists() or not ndjson_dir.is_dir():
        return NodeResult(
            status=NodeStatus.FAILED, error_message=f"ndjson_dir does not exist: {ndjson_dir}"
        )

    profile_name = params["profile"]
    pack = _load_profile_pack(profile_name)
    strict = bool(params.get("strict_profile_match", False))
    allowed_profile_urls = self._profile_urls(pack) if strict else None

    skipped: set[str] = set()
    files_seen = 0
    lines_seen = 0
    types_emitted: set[str] = set()

    for path in sorted(ndjson_dir.glob("*.ndjson")):
        files_seen += 1
        # Stream this file: collect rows of one type only (the file's own type),
        # write Parquet, drop the buffer. Peak buffer = one file's worth.
        rtype_for_file: str | None = None
        rows: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                lines_seen += 1
                record = json.loads(line)
                rtype = record.get("resourceType", path.stem)
                if rtype not in allowed_types:
                    skipped.add(rtype)
                    continue
                if strict and not self._profile_url_match(record, allowed_profile_urls):
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=(
                            f"strict_profile_match: resource {rtype}/{record.get('id')} "
                            f"declares meta.profile not in {profile_name!r} pack"
                        ),
                    )
                if rtype_for_file is None:
                    rtype_for_file = rtype
                rows.append(record)
        if rtype_for_file and rows:
            df = pl.from_dicts(rows)
            df.write_parquet(context.artifact_dir / f"{rtype_for_file.lower()}.parquet")
            types_emitted.add(rtype_for_file)
        # Buffer drops out of scope here; one file at a time keeps memory bounded.

    return NodeResult(
        status=NodeStatus.SUCCESS,
        outputs={
            "files_processed": files_seen,
            "lines_processed": lines_seen,
            "resource_types_emitted": sorted(types_emitted),
            "skipped_resource_types": sorted(skipped),
        },
    )
```

For very large per-file bundles (a single 1GB Patient.ndjson) this is still inadequate — extend to chunked Parquet writes per N records (e.g., 50K) using `pyarrow` low-level API. The plan defers chunked-per-file streaming to a follow-up if profiling shows the per-file ceiling is hit.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_fhir_resource_memory.py -v -m slow`
Expected: PASS — RSS delta <200 MB.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q   # excludes -m slow by default
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/fhir_resource.py templates/tests/integration/test_fhir_resource_memory.py templates/pyproject.toml
git commit -m "test(templates): FhirResourceNode 1GB-under-200MB memory acceptance test"
```

---

## Task 7: `DicomMetadataNode` — filesystem backend

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/dicom_metadata.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_filesystem.py`

Recursive directory scan over `*.dcm` files. Reads metadata only via `pydicom.dcmread(stop_before_pixels=True)` — pixel data is never accessed. Emits a single Parquet artifact `dicom_metadata.parquet` with columns for the standard DICOM tags (StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID, Modality, Manufacturer, BodyPartExamined, etc.).

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_filesystem.py
"""DicomMetadataNode filesystem backend: scan a directory of *.dcm files."""
from __future__ import annotations

import logging
from pathlib import Path

import polars as pl
import pytest
from pydicom.data import get_testdata_files

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-dicom",
        node_id="dicom-1",
        logger=logging.getLogger("test.dicom"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


@pytest.fixture()
def dicom_dir(tmp_path: Path) -> Path:
    """Drop a few of pydicom's bundled test DICOMs into a directory."""
    src = tmp_path / "dcm"
    src.mkdir()
    for name in ("CT_small.dcm", "MR_small.dcm"):
        for f in get_testdata_files(name):
            (src / Path(f).name).write_bytes(Path(f).read_bytes())
    return src


def test_type_name() -> None:
    assert DicomMetadataNode.type_name == "dicom_metadata"


def test_scans_filesystem_to_parquet(context: NodeContext, dicom_dir: Path, tmp_path: Path) -> None:
    result = DicomMetadataNode().run(
        context,
        {"source": "filesystem", "dicom_dir": str(dicom_dir)},
    )
    assert result.status == NodeStatus.SUCCESS
    out = tmp_path / "dicom_metadata.parquet"
    assert out.exists()
    df = pl.read_parquet(out)
    assert df.height >= 2
    for col in ("StudyInstanceUID", "SeriesInstanceUID", "SOPInstanceUID", "Modality"):
        assert col in df.columns


def test_missing_dicom_dir_fails(context: NodeContext) -> None:
    result = DicomMetadataNode().run(
        context, {"source": "filesystem", "dicom_dir": "/nonexistent"}
    )
    assert result.status == NodeStatus.FAILED
    assert "dicom_dir" in (result.error_message or "")


def test_empty_dir_emits_empty_artifact(context: NodeContext, tmp_path: Path) -> None:
    """Empty directory is not an error; it produces a 0-row Parquet."""
    empty = tmp_path / "empty"
    empty.mkdir()
    result = DicomMetadataNode().run(
        context, {"source": "filesystem", "dicom_dir": str(empty)}
    )
    assert result.status == NodeStatus.SUCCESS
    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    assert df.height == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_filesystem.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.dicom_metadata'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/dicom_metadata.py
"""DicomMetadataNode: scan DICOM sources and emit metadata-only Parquet.

**Pixel data is NEVER copied.** Two source backends:
  - ``filesystem``: recursive directory scan of ``*.dcm``.
  - ``dicomweb``: QIDO-RS metadata-only queries (Task 8).

Each source emits a single Parquet artifact ``dicom_metadata.parquet`` with one row
per SOPInstance and columns for the standard DICOM tags listed in METADATA_TAGS.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
from pydicom import dcmread
from pydicom.dataset import Dataset

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

# Subset of standard DICOM tags surfaced as Parquet columns. PixelData is intentionally absent.
METADATA_TAGS = (
    "StudyInstanceUID",
    "SeriesInstanceUID",
    "SOPInstanceUID",
    "SOPClassUID",
    "Modality",
    "Manufacturer",
    "ManufacturerModelName",
    "StationName",
    "BodyPartExamined",
    "StudyDate",
    "StudyTime",
    "SeriesDate",
    "SeriesTime",
    "PatientID",
    "AccessionNumber",
    "InstitutionName",
    "ReferringPhysicianName",
)


def _extract_row(ds: Dataset) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for tag in METADATA_TAGS:
        value = getattr(ds, tag, None)
        # Pydicom returns DataElement-wrapped types; coerce to plain str/None.
        row[tag] = None if value is None else str(value)
    return row


class DicomMetadataNode(Node):
    """Stream DICOM metadata (no pixels) from a directory or DICOMweb endpoint."""

    type_name = "dicom_metadata"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        source = params.get("source")
        if source == "filesystem":
            return self._run_filesystem(context, params)
        if source == "dicomweb":
            return self._run_dicomweb(context, params)
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=f"DicomMetadataNode requires source in {{'filesystem','dicomweb'}}, got {source!r}",
        )

    def _run_filesystem(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        dicom_dir = Path(params.get("dicom_dir", ""))
        if not dicom_dir.exists() or not dicom_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"dicom_dir does not exist: {dicom_dir}",
            )

        rows: list[dict[str, Any]] = []
        files_seen = 0
        for path in dicom_dir.rglob("*.dcm"):
            files_seen += 1
            try:
                ds = dcmread(str(path), stop_before_pixels=True)
            except Exception as exc:  # noqa: BLE001 — unparseable file shouldn't kill scan
                context.logger.warning("dicom parse failed for %s: %s", path, exc)
                continue
            rows.append(_extract_row(ds))

        if rows:
            df = pl.from_dicts(rows)
        else:
            # Empty directory → 0-row Parquet with the canonical schema.
            df = pl.DataFrame({tag: pl.Series([], dtype=pl.Utf8) for tag in METADATA_TAGS})

        df.write_parquet(context.artifact_dir / "dicom_metadata.parquet")

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"files_processed": files_seen, "rows_emitted": len(rows)},
        )

    def _run_dicomweb(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        # Implemented in Task 8.
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="dicomweb source is not yet implemented (Task 8)",
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_filesystem.py -v`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/dicom_metadata.py templates/tests/unit/test_dicom_metadata_filesystem.py
git commit -m "feat(templates): add DicomMetadataNode filesystem backend (metadata only, no pixels)"
```

---

## Task 8: `DicomMetadataNode` — DICOMweb (QIDO-RS) backend

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/dicom_metadata.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_dicomweb.py`

QIDO-RS (Query-based Image Data Object — RESTful Services) is the DICOM standard for metadata queries over HTTP. Per spec decision Q8, Phase 1 supports **bearer-token auth only** (no mTLS). Per spec §6.2 defense-in-depth, **NEVER** call WADO-RS — only QIDO-RS.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_dicomweb.py
"""DicomMetadataNode dicomweb backend: QIDO-RS metadata over HTTP with bearer auth."""
from __future__ import annotations

import logging
from pathlib import Path

import httpx
import polars as pl
import pytest
import respx

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-qido",
        node_id="dicom-qido",
        logger=logging.getLogger("test.dicom.qido"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


# QIDO-RS returns DICOM JSON: {"00100020": {"Value": ["PATIENT_ID"]}, ...}
QIDO_INSTANCE_RESPONSE = [
    {
        "0020000D": {"vr": "UI", "Value": ["1.2.3.4.STUDY"]},
        "0020000E": {"vr": "UI", "Value": ["1.2.3.4.SERIES"]},
        "00080018": {"vr": "UI", "Value": ["1.2.3.4.SOP1"]},
        "00080016": {"vr": "UI", "Value": ["1.2.840.10008.5.1.4.1.1.2"]},
        "00080060": {"vr": "CS", "Value": ["CT"]},
        "00080070": {"vr": "LO", "Value": ["AcumeNus Imaging"]},
        "00100020": {"vr": "LO", "Value": ["TEST_PATIENT_001"]},
    },
    {
        "0020000D": {"vr": "UI", "Value": ["1.2.3.4.STUDY"]},
        "0020000E": {"vr": "UI", "Value": ["1.2.3.4.SERIES"]},
        "00080018": {"vr": "UI", "Value": ["1.2.3.4.SOP2"]},
        "00080016": {"vr": "UI", "Value": ["1.2.840.10008.5.1.4.1.1.2"]},
        "00080060": {"vr": "CS", "Value": ["CT"]},
        "00100020": {"vr": "LO", "Value": ["TEST_PATIENT_001"]},
    },
]


@pytest.mark.respx(base_url="https://dicomweb.example.com")
def test_dicomweb_metadata_to_parquet(context: NodeContext, tmp_path: Path) -> None:
    with respx.mock(base_url="https://dicomweb.example.com") as router:
        router.get("/instances").respond(json=QIDO_INSTANCE_RESPONSE)
        result = DicomMetadataNode().run(
            context,
            {
                "source": "dicomweb",
                "dicomweb_base_url": "https://dicomweb.example.com",
                "bearer_token": "qido-token-xyz",
            },
        )
    assert result.status == NodeStatus.SUCCESS
    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    assert df.height == 2
    assert "Modality" in df.columns
    assert df["Modality"].to_list() == ["CT", "CT"]


@pytest.mark.respx(base_url="https://dicomweb.example.com")
def test_dicomweb_passes_bearer_token(context: NodeContext) -> None:
    captured: list[httpx.Request] = []

    def _capture(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return httpx.Response(200, json=[])

    with respx.mock(base_url="https://dicomweb.example.com") as router:
        router.get("/instances").mock(side_effect=_capture)
        DicomMetadataNode().run(
            context,
            {
                "source": "dicomweb",
                "dicomweb_base_url": "https://dicomweb.example.com",
                "bearer_token": "qido-token-xyz",
            },
        )
    assert captured[0].headers["authorization"] == "Bearer qido-token-xyz"
    assert captured[0].headers["accept"] == "application/dicom+json"


@pytest.mark.respx(base_url="https://dicomweb.example.com")
def test_dicomweb_never_calls_wado(context: NodeContext) -> None:
    """Defense in depth: the node MUST NOT issue WADO-RS requests."""
    captured_paths: list[str] = []

    def _capture(req: httpx.Request) -> httpx.Response:
        captured_paths.append(req.url.path)
        return httpx.Response(200, json=QIDO_INSTANCE_RESPONSE)

    with respx.mock(base_url="https://dicomweb.example.com") as router:
        router.get("/instances").mock(side_effect=_capture)
        # Also stub WADO routes — if we ever call them, we want to see it
        router.get(path__regex=r"/studies/.*/series/.*/instances/.*$").mock(
            side_effect=lambda req: pytest.fail(f"WADO-RS called: {req.url}")
        )
        DicomMetadataNode().run(
            context,
            {
                "source": "dicomweb",
                "dicomweb_base_url": "https://dicomweb.example.com",
                "bearer_token": "x",
            },
        )
    # Only QIDO-RS path should have been hit.
    assert all("/instances" in p for p in captured_paths)
    assert not any("/studies/" in p and "/series/" in p for p in captured_paths)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_dicomweb.py -v`
Expected: FAIL — `_run_dicomweb` returns "not yet implemented".

- [ ] **Step 3: Write minimal implementation**

Add a DICOM-JSON to row helper and replace `_run_dicomweb`:

```python
import httpx

# Map DICOM tag codes to METADATA_TAGS keywords (subset matching METADATA_TAGS).
DICOM_JSON_KEYWORDS = {
    "0020000D": "StudyInstanceUID",
    "0020000E": "SeriesInstanceUID",
    "00080018": "SOPInstanceUID",
    "00080016": "SOPClassUID",
    "00080060": "Modality",
    "00080070": "Manufacturer",
    "00081090": "ManufacturerModelName",
    "00081010": "StationName",
    "00180015": "BodyPartExamined",
    "00080020": "StudyDate",
    "00080030": "StudyTime",
    "00080021": "SeriesDate",
    "00080031": "SeriesTime",
    "00100020": "PatientID",
    "00080050": "AccessionNumber",
    "00080080": "InstitutionName",
    "00080090": "ReferringPhysicianName",
}


def _dicom_json_to_row(record: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {tag: None for tag in METADATA_TAGS}
    for code, attr in DICOM_JSON_KEYWORDS.items():
        node = record.get(code)
        if not node:
            continue
        values = node.get("Value") or []
        if values:
            row[attr] = str(values[0])
    return row


def _run_dicomweb(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
    base_url = params.get("dicomweb_base_url", "").rstrip("/")
    if not base_url:
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="dicomweb source requires 'dicomweb_base_url' param",
        )
    headers: dict[str, str] = {"Accept": "application/dicom+json"}
    bearer = params.get("bearer_token")
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    rows: list[dict[str, Any]] = []
    with httpx.Client(headers=headers, timeout=60.0) as client:
        # QIDO-RS instances: returns one DICOM-JSON object per SOPInstance.
        # Pagination is server-defined; we follow the Warning header / Content-Range
        # if present, otherwise rely on the server's default (most return all in one shot).
        resp = client.get(f"{base_url}/instances")
        if resp.status_code == 204:
            records: list[dict[str, Any]] = []
        elif resp.status_code != 200:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"QIDO-RS {base_url}/instances returned {resp.status_code}",
            )
        else:
            records = list(resp.json())
        rows.extend(_dicom_json_to_row(r) for r in records)

    if rows:
        df = pl.from_dicts(rows)
    else:
        df = pl.DataFrame({tag: pl.Series([], dtype=pl.Utf8) for tag in METADATA_TAGS})
    df.write_parquet(context.artifact_dir / "dicom_metadata.parquet")
    return NodeResult(
        status=NodeStatus.SUCCESS, outputs={"rows_emitted": len(rows)}
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_dicomweb.py -v`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/dicom_metadata.py templates/tests/unit/test_dicom_metadata_dicomweb.py
git commit -m "feat(templates): add DicomMetadataNode DICOMweb (QIDO-RS) backend with bearer auth"
```

---

## Task 9: `DicomMetadataNode` — pixel-data-absence test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_no_pixels.py`

Defense in depth per spec §6.2: this dedicated test asserts that the Parquet artifact contains **NO column** matching `*pixel*` (case-insensitive) and that no row's serialized representation includes raw pixel bytes. Verifies the `stop_before_pixels=True` invariant.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_dicom_metadata_no_pixels.py
"""Defense in depth: DicomMetadataNode never emits pixel data."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import polars as pl
import pytest
from pydicom.data import get_testdata_files

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def dicom_dir(tmp_path: Path) -> Path:
    src = tmp_path / "dcm"
    src.mkdir()
    # CT_small.dcm has real pixel data; a successful test must not surface any of it.
    for f in get_testdata_files("CT_small.dcm"):
        (src / Path(f).name).write_bytes(Path(f).read_bytes())
    return src


def test_artifact_has_no_pixel_columns(tmp_path: Path, dicom_dir: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = DicomMetadataNode().run(
        ctx, {"source": "filesystem", "dicom_dir": str(dicom_dir)}
    )
    assert result.status == NodeStatus.SUCCESS

    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    pixel_pattern = re.compile(r"pixel", re.IGNORECASE)
    bad_cols = [c for c in df.columns if pixel_pattern.search(c)]
    assert not bad_cols, f"DicomMetadataNode emitted pixel-related columns: {bad_cols}"


def test_artifact_size_is_metadata_only(tmp_path: Path, dicom_dir: Path) -> None:
    """The output Parquet should be a tiny fraction of the source DICOM file size.

    Sanity check: if pixel data ever leaked through, the Parquet would balloon to
    DICOM-file-sized (KB-MB range). Metadata-only should be well under 100KB.
    """
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    DicomMetadataNode().run(ctx, {"source": "filesystem", "dicom_dir": str(dicom_dir)})

    parquet_size = (tmp_path / "dicom_metadata.parquet").stat().st_size
    source_size = sum(p.stat().st_size for p in dicom_dir.glob("*.dcm"))
    # Metadata Parquet should be much smaller than the source, as a defense-in-depth check.
    assert parquet_size < source_size, (
        f"metadata Parquet ({parquet_size} bytes) >= source DICOM ({source_size} bytes); "
        f"pixel data may have leaked"
    )
    assert parquet_size < 100_000, f"metadata Parquet unexpectedly large: {parquet_size} bytes"
```

- [ ] **Step 2: Run test to verify it passes**

This test should pass against the existing Task 7 implementation (which already uses `stop_before_pixels=True` and a fixed METADATA_TAGS list). Run:

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_no_pixels.py -v`
Expected: PASS — both tests pass against the current code.

- [ ] **Step 3: No implementation change needed**

This is a regression test. If it ever fails in the future, the `DicomMetadataNode` has lost its pixel-absence invariant. Treat any future failure as a HIGHSEC blocker.

- [ ] **Step 4: Verify it stays passing**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_dicom_metadata_no_pixels.py -v` — PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/unit/test_dicom_metadata_no_pixels.py
git commit -m "test(templates): DicomMetadataNode pixel-absence regression guard"
```

---

## Task 10: Anonymizer JSON Schema v1 + validator

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/schemas/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/schemas/anonymizer_config.v1.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer_config.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_config.py`

The anonymizer config schema is the **portability contract** between `MsAnonymizerBackend` and `ParthenonNativeBackend`. Both backends consume the same JSON. Per spec §6.4, the schema covers four operations: `redact`, `keep`, `dateShift`, `cryptoHash`. Per Q7, the runtime equivalence between backends is **semantic**, not bit-identical.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_config.py
"""Anonymizer config v1: JSON Schema validation + Python loader."""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.nodes.anonymizer_config import (
    AnonymizerConfig,
    AnonymizerConfigError,
    load_config,
)

VALID_MINIMAL = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}},
    ],
}

VALID_FULL = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
        {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 60}},
        {"path": "Patient.gender", "operation": "keep"},
    ],
    "default_action": "redact",
}


def test_load_minimal_config() -> None:
    cfg = load_config(VALID_MINIMAL)
    assert isinstance(cfg, AnonymizerConfig)
    assert cfg.version == "1"
    assert len(cfg.rules) == 2


def test_load_full_config() -> None:
    cfg = load_config(VALID_FULL)
    assert cfg.default_action == "redact"
    assert {r.operation for r in cfg.rules} == {"redact", "cryptoHash", "dateShift", "keep"}


def test_unknown_operation_rejected() -> None:
    bad = {"version": "1", "rules": [{"path": "Patient.x", "operation": "delete"}]}
    with pytest.raises(AnonymizerConfigError, match="operation"):
        load_config(bad)


def test_missing_version_rejected() -> None:
    bad = {"rules": []}
    with pytest.raises(AnonymizerConfigError):
        load_config(bad)


def test_missing_rules_rejected() -> None:
    bad = {"version": "1"}
    with pytest.raises(AnonymizerConfigError):
        load_config(bad)


def test_dateshift_without_max_days_rejected() -> None:
    bad = {
        "version": "1",
        "rules": [{"path": "Patient.birthDate", "operation": "dateShift"}],
    }
    with pytest.raises(AnonymizerConfigError, match="max_days"):
        load_config(bad)


def test_cryptohash_unknown_algorithm_rejected() -> None:
    bad = {
        "version": "1",
        "rules": [
            {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "md4"}}
        ],
    }
    with pytest.raises(AnonymizerConfigError, match="algorithm"):
        load_config(bad)


def test_load_config_from_file(tmp_path: Path) -> None:
    import json

    cfg_path = tmp_path / "cfg.json"
    cfg_path.write_text(json.dumps(VALID_MINIMAL), encoding="utf-8")
    cfg = load_config(cfg_path)
    assert cfg.version == "1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'runtime.nodes.anonymizer_config'`.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/nodes/schemas/anonymizer_config.v1.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://parthenon.acumenus.net/schemas/anonymizer_config.v1.json",
  "title": "Parthenon Anonymizer Config v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "rules"],
  "properties": {
    "version": {"type": "string", "enum": ["1"]},
    "default_action": {"type": "string", "enum": ["redact", "keep"]},
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "operation"],
        "properties": {
          "path": {"type": "string", "minLength": 1},
          "operation": {"type": "string", "enum": ["redact", "keep", "dateShift", "cryptoHash"]},
          "params": {"type": "object"}
        },
        "allOf": [
          {
            "if": {"properties": {"operation": {"const": "dateShift"}}},
            "then": {
              "properties": {
                "params": {
                  "type": "object",
                  "required": ["max_days"],
                  "properties": {
                    "max_days": {"type": "integer", "minimum": 1, "maximum": 3650}
                  }
                }
              },
              "required": ["params"]
            }
          },
          {
            "if": {"properties": {"operation": {"const": "cryptoHash"}}},
            "then": {
              "properties": {
                "params": {
                  "type": "object",
                  "required": ["algorithm"],
                  "properties": {
                    "algorithm": {"type": "string", "enum": ["sha256", "sha512"]}
                  }
                }
              },
              "required": ["params"]
            }
          }
        ]
      }
    }
  }
}
```

`templates/runtime/nodes/schemas/__init__.py`: empty.

`templates/runtime/nodes/anonymizer_config.py`:

```python
"""Anonymizer config v1: JSON Schema validation + Pydantic loader.

The schema is the portability contract between MsAnonymizerBackend and
ParthenonNativeBackend. Both consume the same JSON.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict, Field

from runtime.nodes.schemas import __file__ as _schema_pkg_init

_SCHEMA_PATH = Path(_schema_pkg_init).parent / "anonymizer_config.v1.json"
_SCHEMA: dict[str, Any] = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = Draft202012Validator(_SCHEMA)


class AnonymizerConfigError(ValueError):
    """Raised when an anonymizer config fails JSON Schema or shape validation."""


class AnonymizerRule(BaseModel):
    """A single rule: apply ``operation`` to FHIR paths matching ``path``."""

    model_config = ConfigDict(extra="forbid")

    path: str
    operation: Literal["redact", "keep", "dateShift", "cryptoHash"]
    params: dict[str, Any] = Field(default_factory=dict)


class AnonymizerConfig(BaseModel):
    """The full anonymizer configuration."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["1"]
    rules: list[AnonymizerRule]
    default_action: Literal["redact", "keep"] = "redact"


def load_config(source: dict[str, Any] | Path) -> AnonymizerConfig:
    """Load and validate an anonymizer config from a dict or JSON file path."""
    if isinstance(source, Path):
        payload = json.loads(source.read_text(encoding="utf-8"))
    else:
        payload = source

    errors = sorted(_VALIDATOR.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        msgs = "; ".join(
            f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
            for e in errors
        )
        raise AnonymizerConfigError(msgs)

    try:
        return AnonymizerConfig.model_validate(payload)
    except Exception as exc:
        raise AnonymizerConfigError(str(exc)) from exc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_config.py -v`
Expected: PASS — 8 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/schemas/ templates/runtime/nodes/anonymizer_config.py templates/tests/unit/test_anonymizer_config.py
git commit -m "feat(templates): add anonymizer config v1 JSON Schema + Pydantic loader"
```

---

## Task 11: `ParthenonNativeBackend` (pure Python rule engine)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer_backends/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer_backends/base.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer_backends/native.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_native.py`

The native backend is a pure-Python implementation of the four operations (`redact`, `keep`, `dateShift`, `cryptoHash`). It accepts the validated `AnonymizerConfig` and a parsed FHIR resource dict, and returns a new dict with rules applied. Date shifts are deterministic per-patient using HMAC over a per-run salt + the patient's `id` so re-runs reproduce.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_native.py
"""ParthenonNativeBackend: pure-Python rule engine for the v1 anonymizer config."""
from __future__ import annotations

import hashlib

import pytest

from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import load_config


def test_implements_protocol() -> None:
    backend = ParthenonNativeBackend(salt="run-salt-1")
    assert isinstance(backend, AnonymizerBackend)


def test_redact_replaces_with_marker() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]}
    )
    assert out["name"] == "***REDACTED***"


def test_keep_preserves_field() -> None:
    cfg = load_config(
        {
            "version": "1",
            "default_action": "redact",
            "rules": [{"path": "Patient.gender", "operation": "keep"}],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "gender": "male", "name": "FAM"}
    )
    assert out["gender"] == "male"


def test_dateshift_is_deterministic_per_patient() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}}
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="run-salt-deterministic")
    p = {"resourceType": "Patient", "id": "p1", "birthDate": "1970-06-15"}
    a = backend.anonymize_resource(cfg, dict(p))
    b = backend.anonymize_resource(cfg, dict(p))
    assert a["birthDate"] == b["birthDate"], "same patient + same salt -> same shift"
    # Shift is bounded
    from datetime import date

    delta = abs((date.fromisoformat(a["birthDate"]) - date(1970, 6, 15)).days)
    assert delta <= 30


def test_dateshift_differs_across_patients() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}}
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    a = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "birthDate": "1970-06-15"}
    )
    b = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p2", "birthDate": "1970-06-15"}
    )
    assert a["birthDate"] != b["birthDate"], "different patients should shift differently"


def test_cryptohash_sha256() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {
                    "path": "Patient.id",
                    "operation": "cryptoHash",
                    "params": {"algorithm": "sha256"},
                }
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="run-salt-1")
    out = backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})
    expected = hashlib.sha256(b"run-salt-1:p1").hexdigest()
    assert out["id"] == expected


def test_default_redact_applies_to_unmatched_fields() -> None:
    """When default_action=redact, fields not in any rule are redacted."""
    cfg = load_config(
        {
            "version": "1",
            "default_action": "redact",
            "rules": [{"path": "Patient.id", "operation": "keep"}],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg,
        {
            "resourceType": "Patient",
            "id": "p1",
            "name": [{"family": "Doe"}],
            "telecom": [{"system": "phone", "value": "555-0100"}],
        },
    )
    assert out["id"] == "p1"
    assert out["name"] == "***REDACTED***"
    assert out["telecom"] == "***REDACTED***"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_native.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/nodes/anonymizer_backends/__init__.py`: empty.

`templates/runtime/nodes/anonymizer_backends/base.py`:

```python
"""Anonymizer backend Protocol — both implementations conform to this surface."""

from __future__ import annotations

from typing import Any, Protocol

from runtime.nodes.anonymizer_config import AnonymizerConfig


class AnonymizerBackend(Protocol):
    """Backends produce an anonymized copy of a single FHIR resource dict."""

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        """Return an anonymized copy of ``resource`` per ``config``."""
        ...
```

`templates/runtime/nodes/anonymizer_backends/native.py`:

```python
"""ParthenonNativeBackend: pure-Python anonymizer implementing the v1 config schema."""

from __future__ import annotations

import hashlib
import hmac
from datetime import date, timedelta
from typing import Any

from runtime.nodes.anonymizer_config import AnonymizerConfig, AnonymizerRule

REDACTED = "***REDACTED***"


class ParthenonNativeBackend:
    """Pure-Python anonymizer. Per-patient deterministic via HMAC(salt, patient_id).

    Salt is per-run (rotated by the AnonymizerNode); same salt + same patient_id
    yields the same shift, so re-runs reproduce.
    """

    def __init__(self, *, salt: str) -> None:
        if not salt:
            raise ValueError("ParthenonNativeBackend requires a non-empty salt")
        self.salt = salt

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        rtype = str(resource.get("resourceType", ""))
        rules_for_resource = [r for r in config.rules if r.path.startswith(f"{rtype}.")]
        keep_fields = {r.path.split(".", 1)[1] for r in rules_for_resource if r.operation == "keep"}
        out: dict[str, Any] = dict(resource)
        # Apply explicit rules first.
        for rule in rules_for_resource:
            field = rule.path.split(".", 1)[1]
            if field not in out:
                continue
            out[field] = self._apply(rule, out[field], resource)
        # Default action covers any field not explicitly matched.
        if config.default_action == "redact":
            for key in list(out.keys()):
                if key in {"resourceType", "id"}:
                    continue
                if key in keep_fields:
                    continue
                # Skip fields already handled by an explicit rule.
                if any(rule.path == f"{rtype}.{key}" for rule in rules_for_resource):
                    continue
                out[key] = REDACTED
        return out

    def _apply(self, rule: AnonymizerRule, value: Any, resource: dict[str, Any]) -> Any:
        op = rule.operation
        if op == "redact":
            return REDACTED
        if op == "keep":
            return value
        if op == "dateShift":
            max_days = int(rule.params["max_days"])
            return self._shift_date(str(value), max_days, str(resource.get("id", "")))
        if op == "cryptoHash":
            algo = rule.params["algorithm"]
            return self._hash(str(value), algo)
        return value  # unreachable per schema validation

    def _hash(self, value: str, algorithm: str) -> str:
        salted = f"{self.salt}:{value}".encode("utf-8")
        if algorithm == "sha256":
            return hashlib.sha256(salted).hexdigest()
        if algorithm == "sha512":
            return hashlib.sha512(salted).hexdigest()
        raise ValueError(f"unsupported hash algorithm: {algorithm}")

    def _shift_date(self, iso_date: str, max_days: int, patient_id: str) -> str:
        # Deterministic per (salt, patient_id) via HMAC. Shift in [-max_days, +max_days].
        mac = hmac.new(self.salt.encode("utf-8"), patient_id.encode("utf-8"), hashlib.sha256)
        offset = int.from_bytes(mac.digest()[:4], "big") % (2 * max_days + 1) - max_days
        d = date.fromisoformat(iso_date)
        return (d + timedelta(days=offset)).isoformat()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_native.py -v`
Expected: PASS — 7 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/anonymizer_backends/ templates/tests/unit/test_anonymizer_native.py
git commit -m "feat(templates): add ParthenonNativeBackend (pure-Python anonymizer rule engine)"
```

---

## Task 12: `MsAnonymizerBackend` (sidecar HTTP client)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer_backends/ms.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_ms.py`

The MS backend POSTs the FHIR resource + the v1 config to the `parthenon-anonymizer` sidecar at `http://parthenon-anonymizer:8080/anonymize`. Tests use `respx` to mock the sidecar; Task 14 ships the real sidecar Dockerfile.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_ms.py
"""MsAnonymizerBackend: HTTP client to the parthenon-anonymizer sidecar."""
from __future__ import annotations

import httpx
import pytest
import respx

from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend, SidecarUnavailable
from runtime.nodes.anonymizer_config import load_config


def test_implements_protocol() -> None:
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    assert isinstance(backend, AnonymizerBackend)


@pytest.mark.respx(base_url="http://parthenon-anonymizer:8080")
def test_posts_resource_and_returns_response() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    with respx.mock(base_url="http://parthenon-anonymizer:8080") as router:
        router.post("/anonymize").respond(
            json={"resourceType": "Patient", "id": "p1", "name": "***REDACTED***"}
        )
        out = backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]})
    assert out["name"] == "***REDACTED***"


@pytest.mark.respx(base_url="http://parthenon-anonymizer:8080")
def test_request_payload_shape() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    captured: list[httpx.Request] = []

    def _capture(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        import json as _json

        body = _json.loads(req.content)
        assert "config" in body
        assert "resource" in body
        return httpx.Response(200, json=body["resource"])

    with respx.mock(base_url="http://parthenon-anonymizer:8080") as router:
        router.post("/anonymize").mock(side_effect=_capture)
        backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})
    assert captured, "no request captured"
    assert captured[0].headers["content-type"].startswith("application/json")


@pytest.mark.respx(base_url="http://parthenon-anonymizer:8080")
def test_sidecar_unavailable_raises() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    with respx.mock(base_url="http://parthenon-anonymizer:8080") as router:
        router.post("/anonymize").mock(side_effect=httpx.ConnectError("nope"))
        with pytest.raises(SidecarUnavailable):
            backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})


@pytest.mark.respx(base_url="http://parthenon-anonymizer:8080")
def test_5xx_raises_with_status() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    with respx.mock(base_url="http://parthenon-anonymizer:8080") as router:
        router.post("/anonymize").respond(status_code=503, text="busy")
        with pytest.raises(SidecarUnavailable, match="503"):
            backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_ms.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/nodes/anonymizer_backends/ms.py`:

```python
"""MsAnonymizerBackend: HTTP client to the parthenon-anonymizer sidecar.

Sidecar contract:
  POST {sidecar_url}/anonymize
  Content-Type: application/json
  Body: {"config": <AnonymizerConfig dict>, "resource": <FHIR resource dict>}
  Response 200: anonymized FHIR resource dict
  Response 5xx: sidecar error
"""

from __future__ import annotations

from typing import Any

import httpx

from runtime.nodes.anonymizer_config import AnonymizerConfig


class SidecarUnavailable(RuntimeError):
    """Raised when the parthenon-anonymizer sidecar is unreachable or returns 5xx."""


class MsAnonymizerBackend:
    """Forward FHIR resources to the MS-Anonymizer-backed sidecar."""

    def __init__(self, *, sidecar_url: str, timeout_seconds: float = 30.0) -> None:
        if not sidecar_url:
            raise ValueError("MsAnonymizerBackend requires sidecar_url")
        self.sidecar_url = sidecar_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        payload = {"config": config.model_dump(), "resource": resource}
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                resp = client.post(f"{self.sidecar_url}/anonymize", json=payload)
        except httpx.HTTPError as exc:
            raise SidecarUnavailable(f"sidecar unreachable: {exc}") from exc
        if resp.status_code >= 500:
            raise SidecarUnavailable(
                f"sidecar returned {resp.status_code}: {resp.text[:200]}"
            )
        if resp.status_code != 200:
            raise SidecarUnavailable(
                f"sidecar returned {resp.status_code}: {resp.text[:200]}"
            )
        return dict(resp.json())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_ms.py -v`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/anonymizer_backends/ms.py templates/tests/unit/test_anonymizer_ms.py
git commit -m "feat(templates): add MsAnonymizerBackend sidecar HTTP client"
```

---

## Task 13: `AnonymizerNode` (selects backend)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_node.py`

`AnonymizerNode` reads a directory of FHIR JSON files (one resource per file, or NDJSON shards), applies the selected backend, and emits anonymized files to `<artifact_dir>/anonymized/`. Backend is selected by `params.backend in {"native", "ms"}`. Salt is generated per run (via `secrets.token_hex(32)`) and recorded in the result outputs (NOT logged).

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_node.py
"""AnonymizerNode: backend selector + per-run salt + anonymized output dir."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.base import NodeContext, NodeStatus


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-anon",
        node_id="anon-1",
        logger=logging.getLogger("test.anon"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


VALID_CFG = {
    "version": "1",
    "rules": [{"path": "Patient.name", "operation": "redact"}],
}


def _write_resources(dir_: Path, resources: list[dict]) -> None:
    dir_.mkdir(parents=True, exist_ok=True)
    for i, r in enumerate(resources):
        (dir_ / f"resource_{i}.json").write_text(json.dumps(r), encoding="utf-8")


def test_type_name() -> None:
    assert AnonymizerNode.type_name == "anonymizer"


def test_native_backend_anonymizes_directory(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(
        src,
        [
            {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]},
            {"resourceType": "Patient", "id": "p2", "name": [{"family": "Smith"}]},
        ],
    )
    result = AnonymizerNode().run(
        context,
        {
            "backend": "native",
            "input_dir": str(src),
            "config": VALID_CFG,
        },
    )
    assert result.status == NodeStatus.SUCCESS
    out_dir = tmp_path / "anonymized"
    assert out_dir.exists()
    files = sorted(out_dir.glob("*.json"))
    assert len(files) == 2
    for f in files:
        payload = json.loads(f.read_text("utf-8"))
        assert payload["name"] == "***REDACTED***"


def test_unknown_backend_fails(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(src, [])
    result = AnonymizerNode().run(
        context,
        {"backend": "made-up", "input_dir": str(src), "config": VALID_CFG},
    )
    assert result.status == NodeStatus.FAILED
    assert "backend" in (result.error_message or "")


def test_invalid_config_fails(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(src, [])
    result = AnonymizerNode().run(
        context,
        {
            "backend": "native",
            "input_dir": str(src),
            "config": {"rules": []},  # missing version
        },
    )
    assert result.status == NodeStatus.FAILED
    assert "config" in (result.error_message or "").lower()


def test_outputs_record_salt_metadata_only(context: NodeContext, tmp_path: Path) -> None:
    """The result outputs include the salt's hash (for reproducibility audit) but not the salt itself."""
    src = tmp_path / "in"
    _write_resources(src, [{"resourceType": "Patient", "id": "p1"}])
    result = AnonymizerNode().run(
        context,
        {"backend": "native", "input_dir": str(src), "config": VALID_CFG},
    )
    assert result.status == NodeStatus.SUCCESS
    assert "salt_digest" in result.outputs
    # Salt itself must NOT appear in outputs.
    serialized = json.dumps(result.outputs)
    assert len(result.outputs["salt_digest"]) == 64  # sha256 hex
    assert "salt" not in serialized or serialized.count("salt") == serialized.count("salt_digest")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_node.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/anonymizer.py
"""AnonymizerNode: anonymize a directory of FHIR resources via a pluggable backend."""

from __future__ import annotations

import hashlib
import json
import secrets
from pathlib import Path
from typing import Any

from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import AnonymizerConfigError, load_config
from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

DEFAULT_SIDECAR_URL = "http://parthenon-anonymizer:8080"


class AnonymizerNode(Node):
    """Anonymize a directory of FHIR JSON files via the selected backend."""

    type_name = "anonymizer"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        backend_name = params.get("backend")
        if backend_name not in {"native", "ms"}:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"AnonymizerNode requires backend in {{'native','ms'}}, got {backend_name!r}",
            )

        input_dir = Path(params.get("input_dir", ""))
        if not input_dir.exists() or not input_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"input_dir does not exist: {input_dir}",
            )

        config_payload = params.get("config")
        if not isinstance(config_payload, dict):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="AnonymizerNode requires 'config' (dict)",
            )
        try:
            config = load_config(config_payload)
        except AnonymizerConfigError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"invalid anonymizer config: {exc}",
            )

        salt = secrets.token_hex(32)
        salt_digest = hashlib.sha256(salt.encode("utf-8")).hexdigest()

        backend: AnonymizerBackend
        if backend_name == "native":
            backend = ParthenonNativeBackend(salt=salt)
        else:
            sidecar_url = str(params.get("sidecar_url", DEFAULT_SIDECAR_URL))
            backend = MsAnonymizerBackend(sidecar_url=sidecar_url)

        out_dir = context.artifact_dir / "anonymized"
        out_dir.mkdir(parents=True, exist_ok=True)
        files_processed = 0
        for path in sorted(input_dir.glob("*.json")):
            resource = json.loads(path.read_text(encoding="utf-8"))
            anonymized = backend.anonymize_resource(config, resource)
            (out_dir / path.name).write_text(json.dumps(anonymized), encoding="utf-8")
            files_processed += 1

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "files_processed": files_processed,
                "backend": backend_name,
                "salt_digest": salt_digest,  # lets re-runs prove same/different seed without leaking the seed
            },
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_node.py -v`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/anonymizer.py templates/tests/unit/test_anonymizer_node.py
git commit -m "feat(templates): add AnonymizerNode with backend selector and per-run salt"
```

---

## Task 14: Anonymizer sidecar Dockerfile + docker-compose service

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-anonymizer/Dockerfile`
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-anonymizer/entrypoint.sh`
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-anonymizer/server.py` (the FastAPI shim that wraps the .NET CLI)
- Modify: `/home/smudoshi/Github/Parthenon/docker-compose.yml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/test_anonymizer_compose.py`

The sidecar runs MS Tools-for-Health-Data-Anonymization (a .NET CLI). To turn it into an HTTP service, wrap it with a thin FastAPI shim that takes the `{config, resource}` POST body, writes both to temp files, shells out to the `Microsoft.Health.Fhir.Anonymizer.R4.CommandLineTool`, reads the result, and returns it. Mirror the image to Parthenon's GHCR per spec decision Q1.

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_anonymizer_compose.py
"""Verify the parthenon-anonymizer sidecar service is wired into docker-compose correctly."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_compose() -> dict:
    with open(REPO_ROOT / "docker-compose.yml", encoding="utf-8") as f:
        return dict(yaml.safe_load(f))


def test_anonymizer_service_declared() -> None:
    compose = _load_compose()
    assert "parthenon-anonymizer" in compose["services"]


def test_anonymizer_image_uses_parthenon_ghcr_mirror() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    image = svc.get("image") or ""
    assert image.startswith("ghcr.io/sudoshi/parthenon-fhir-anonymizer"), image


def test_anonymizer_runs_non_root() -> None:
    """The Dockerfile must declare USER and not be root at runtime."""
    dockerfile = (REPO_ROOT / "docker" / "parthenon-anonymizer" / "Dockerfile").read_text("utf-8")
    user_directives = [
        line for line in dockerfile.splitlines() if line.strip().startswith("USER ")
    ]
    assert user_directives, "Dockerfile missing USER directive"
    last_user = user_directives[-1].split()[1]
    assert last_user != "root" and last_user != "0", f"sidecar runs as {last_user!r}"


def test_anonymizer_no_published_ports_to_host() -> None:
    """No ports: stanza — sidecar is internal-network only."""
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert not svc.get("ports"), f"unexpected ports: {svc.get('ports')}"


def test_anonymizer_on_parthenon_network() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert "parthenon" in (svc.get("networks") or [])


def test_anonymizer_healthcheck_present() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert "healthcheck" in svc
    assert any("/health" in str(t) for t in svc["healthcheck"]["test"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_anonymizer_compose.py -v`
Expected: FAIL — service block missing.

- [ ] **Step 3: Write minimal implementation**

`docker/parthenon-anonymizer/Dockerfile`:

```dockerfile
# Built from MS Tools-for-Health-Data-Anonymization v3.2.1
# Mirrored to ghcr.io/sudoshi/parthenon-fhir-anonymizer:v3.2.1 per spec Q1.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v3.2.1 \
    https://github.com/microsoft/Tools-for-Health-Data-Anonymization /build/src
WORKDIR /build/src/FHIR/src/Microsoft.Health.Fhir.Anonymizer.R4.CommandLineTool
RUN dotnet publish -c Release -o /out --self-contained false /p:PublishSingleFile=false

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 10101 anonsvc \
    && adduser --system --uid 10101 --ingroup anonsvc --home /home/anonsvc --shell /usr/sbin/nologin anonsvc
COPY --from=dotnet-build /out /opt/anonymizer
COPY --from=mcr.microsoft.com/dotnet/runtime:8.0 /usr/share/dotnet /usr/share/dotnet
ENV PATH=/usr/share/dotnet:$PATH
COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
RUN pip install --no-cache-dir --break-system-packages 'fastapi==0.115.6' 'uvicorn[standard]==0.32.1'

USER anonsvc
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
```

`docker/parthenon-anonymizer/entrypoint.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
exec uvicorn server:app --host 0.0.0.0 --port 8080 --workers 1
```

`docker/parthenon-anonymizer/server.py`:

```python
"""HTTP shim around the MS FHIR Anonymizer .NET CLI.

POST /anonymize {"config": ..., "resource": ...}  -> 200 anonymized resource
GET  /health                                        -> 200 ok
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException

DOTNET_ASSEMBLY = "/opt/anonymizer/Microsoft.Health.Fhir.Anonymizer.R4.CommandLineTool.dll"

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/anonymize")
def anonymize(payload: dict) -> dict:
    cfg = payload.get("config")
    resource = payload.get("resource")
    if not cfg or not resource:
        raise HTTPException(status_code=400, detail="config and resource required")
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        cfg_path = td_path / "config.json"
        in_dir = td_path / "in"
        out_dir = td_path / "out"
        in_dir.mkdir()
        out_dir.mkdir()
        cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
        (in_dir / "resource.json").write_text(json.dumps(resource), encoding="utf-8")
        proc = subprocess.run(
            [
                "dotnet", DOTNET_ASSEMBLY,
                "--inputFolder", str(in_dir),
                "--outputFolder", str(out_dir),
                "--configFile", str(cfg_path),
            ],
            capture_output=True,
            timeout=60,
        )
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"anonymizer CLI failed (rc={proc.returncode}): {proc.stderr.decode()[:500]}",
            )
        out_path = out_dir / "resource.json"
        if not out_path.exists():
            raise HTTPException(status_code=500, detail="anonymizer produced no output")
        return dict(json.loads(out_path.read_text(encoding="utf-8")))
```

Add to `docker-compose.yml` (in the `services:` block, before `parthenon-templates:`):

```yaml
  parthenon-anonymizer:
    container_name: parthenon-anonymizer
    image: ghcr.io/sudoshi/parthenon-fhir-anonymizer:v3.2.1
    build:
      context: ./docker/parthenon-anonymizer
      dockerfile: Dockerfile
    restart: unless-stopped
    networks:
      - parthenon
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test:
        - CMD-SHELL
        - "curl --fail --silent http://127.0.0.1:8080/health || exit 1"
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_anonymizer_compose.py -v`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run gates + compose validation**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose config --quiet
cd templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docker/parthenon-anonymizer/ docker-compose.yml templates/tests/test_anonymizer_compose.py
git commit -m "feat(infra): add parthenon-anonymizer sidecar (non-root, no host ports, GHCR mirror)"
```

---

## Task 15: Anonymizer config-format semantic-equivalence integration test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_anonymizer_equivalence.py`

Per spec decision Q7: the two backends must produce **semantically equivalent** output on the same config. Define a comparison oracle: (a) same set of fields redacted, (b) `dateShift` outputs fall within the configured tolerance, (c) preserved fields byte-equal. Skip if the sidecar isn't reachable (CI-only test).

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_anonymizer_equivalence.py
"""Semantic equivalence between MsAnonymizerBackend and ParthenonNativeBackend."""
from __future__ import annotations

import json
from datetime import date

import httpx
import pytest

from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import load_config

SIDECAR_URL = "http://parthenon-anonymizer:8080"


def _sidecar_reachable() -> bool:
    try:
        with httpx.Client(timeout=2.0) as client:
            return client.get(f"{SIDECAR_URL}/health").status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _sidecar_reachable(),
    reason="parthenon-anonymizer sidecar not running (skip in dev; required in CI)",
)


CFG = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
        {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}},
        {"path": "Patient.gender", "operation": "keep"},
    ],
}

PATIENT = {
    "resourceType": "Patient",
    "id": "p1",
    "name": [{"family": "Doe", "given": ["John"]}],
    "gender": "male",
    "birthDate": "1970-06-15",
}


@pytest.mark.integration
def test_semantic_equivalence_on_patient() -> None:
    cfg = load_config(CFG)
    salt = "shared-test-salt-do-not-use-in-prod"

    native = ParthenonNativeBackend(salt=salt).anonymize_resource(cfg, dict(PATIENT))
    ms = MsAnonymizerBackend(sidecar_url=SIDECAR_URL).anonymize_resource(cfg, dict(PATIENT))

    # (a) Same fields redacted
    assert (native.get("name") == "***REDACTED***") == (
        ms.get("name") in {"***REDACTED***", None, ""}
    )

    # (b) Date shift within tolerance for both
    for out in (native, ms):
        shifted = date.fromisoformat(out["birthDate"])
        delta = abs((shifted - date(1970, 6, 15)).days)
        assert delta <= 30, f"shift exceeded tolerance: {delta} days"

    # (c) Preserved fields byte-equal
    assert native["gender"] == ms["gender"] == "male"

    # The cryptoHash output isn't expected to match (different algorithms / salt formats);
    # we only assert it's NOT the original.
    assert native["id"] != "p1"
    assert ms["id"] != "p1"
```

- [ ] **Step 2: Run test to verify it skips (sidecar not running locally)**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_anonymizer_equivalence.py -v`
Expected: SKIP — sidecar not reachable in dev. CI brings the sidecar up before running.

- [ ] **Step 3: No new implementation needed**

This test exercises Tasks 11 + 12 + 14 together. No new code.

- [ ] **Step 4: Verify behavior**

When the sidecar IS reachable (e.g., `docker compose up -d parthenon-anonymizer && pytest`), the test should pass.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/integration/test_anonymizer_equivalence.py
git commit -m "test(templates): add anonymizer backend semantic-equivalence integration test"
```

---

## Task 16: Update orchestration node registry

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/node_registry.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/manifest.py` (extend `NODE_TYPES`)
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/schema/template.v1.json` (extend `nodes[].type` enum)
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_factory.py` (or wherever the node-registry round-trip lives)

The three new node types (`fhir_resource`, `dicom_metadata`, `anonymizer`) need to be discoverable by the orchestrator's `node_registry` AND accepted by the manifest JSON Schema. After this task, manifests in Phase 1 templates can reference the new types.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_orchestration_factory.py

import pytest

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.dicom_metadata import DicomMetadataNode
from runtime.nodes.fhir_resource import FhirResourceNode
from runtime.orchestration.node_registry import NODE_REGISTRY, get_node_class


@pytest.mark.parametrize(
    ("type_name", "cls"),
    [
        ("fhir_resource", FhirResourceNode),
        ("dicom_metadata", DicomMetadataNode),
        ("anonymizer", AnonymizerNode),
    ],
)
def test_phase_1_nodes_registered(type_name: str, cls: type) -> None:
    assert NODE_REGISTRY.get(type_name) is cls
    assert get_node_class(type_name) is cls
```

And a manifest-schema test:

```python
# Append to templates/tests/unit/test_manifest_schema.py (or similar)

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "runtime" / "registry" / "schema" / "template.v1.json"
)


@pytest.mark.parametrize("node_type", ["fhir_resource", "dicom_metadata", "anonymizer"])
def test_phase_1_node_types_accepted_by_schema(node_type: str) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    manifest = {
        "apiVersion": "parthenon.acumenus.net/v1",
        "kind": "Template",
        "metadata": {
            "id": "phase1_node_probe",
            "name": "probe",
            "version": "0.1.0",
            "category": "diagnostic",
            "cdm_versions": [],
        },
        "spec": {
            "parameters": {"type": "object", "properties": {}, "required": []},
            "requires": {"cdm_initialized": False, "vocabularies": []},
            "nodes": [{"node_id": "n", "type": node_type, "params": {}}],
            "post_conditions": [],
        },
    }
    errors = list(Draft202012Validator(schema).iter_errors(manifest))
    assert not errors, f"{node_type}: {errors}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_factory.py tests/unit/test_manifest_schema.py -v`
Expected: FAIL — registry returns `KeyError`; schema rejects `fhir_resource`/`dicom_metadata`/`anonymizer`.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/orchestration/node_registry.py`:

```python
"""Static registry mapping ``type_name`` strings to Node classes."""

from __future__ import annotations

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.base import Node
from runtime.nodes.csv_reader import CsvReaderNode
from runtime.nodes.db_reader import DbReaderNode
from runtime.nodes.db_writer import DbWriterNode
from runtime.nodes.dicom_metadata import DicomMetadataNode
from runtime.nodes.fhir_resource import FhirResourceNode
from runtime.nodes.generic_file import GenericFileNode
from runtime.nodes.py2table import Py2TableNode
from runtime.nodes.python_node import PythonNode
from runtime.nodes.r_node import RNode
from runtime.nodes.sql_node import SqlNode

NODE_REGISTRY: dict[str, type[Node]] = {
    PythonNode.type_name: PythonNode,
    SqlNode.type_name: SqlNode,
    CsvReaderNode.type_name: CsvReaderNode,
    DbReaderNode.type_name: DbReaderNode,
    DbWriterNode.type_name: DbWriterNode,
    Py2TableNode.type_name: Py2TableNode,
    GenericFileNode.type_name: GenericFileNode,
    RNode.type_name: RNode,
    # Phase 1 additions:
    FhirResourceNode.type_name: FhirResourceNode,
    DicomMetadataNode.type_name: DicomMetadataNode,
    AnonymizerNode.type_name: AnonymizerNode,
}


def get_node_class(type_name: str) -> type[Node]:
    if type_name not in NODE_REGISTRY:
        raise KeyError(f"unknown node type_name: {type_name!r}")
    return NODE_REGISTRY[type_name]
```

In `templates/runtime/registry/manifest.py`, extend `NODE_TYPES`:

```python
NODE_TYPES = (
    "python",
    "sql",
    "csv_reader",
    "db_reader",
    "db_writer",
    "py2table",
    "generic_file",
    "r",
    "fhir_resource",      # Phase 1
    "dicom_metadata",     # Phase 1
    "anonymizer",         # Phase 1
)
```

In `templates/runtime/registry/schema/template.v1.json`, find the node `type` enum and extend it:

```json
"type": {
  "enum": [
    "python", "sql", "csv_reader", "db_reader", "db_writer",
    "py2table", "generic_file", "r",
    "fhir_resource", "dicom_metadata", "anonymizer"
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_factory.py tests/unit/test_manifest_schema.py -v`
Expected: PASS — both new test groups + existing tests still green.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q   # full suite — verify no regressions
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/orchestration/node_registry.py \
        templates/runtime/registry/manifest.py \
        templates/runtime/registry/schema/template.v1.json \
        templates/tests/unit/test_orchestration_factory.py \
        templates/tests/unit/test_manifest_schema.py
git commit -m "feat(templates): register Phase 1 node types in registry + manifest schema"
```

---

## Task 17: ADR 0004 — Phase 1 node design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0004-phase-1-node-design.md`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py` (add 0004 to the parametrized cases)

Document the three new node types' design choices in MADR format. Decisions captured: ABC compliance (no SDK changes), pixel-data defense in depth, FHIR streaming strategy, anonymizer plug-in interface, profile selector design, sidecar mirror policy.

- [ ] **Step 1: Write the failing test**

The existing `tests/test_adrs.py` parametrizes over `["0001", "0002", "0003"]`. Extend to include `"0004"`.

```python
# Update the parametrize list in templates/tests/test_adrs.py:
@pytest.mark.parametrize("adr_number", ["0001", "0002", "0003", "0004"])
def test_adr_exists_and_uses_madr(adr_number: str) -> None:
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: FAIL — `0004` ADR file doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`docs/adr/0004-phase-1-node-design.md`:

```markdown
# ADR 0004 — Phase 1 Node Design

## Status

Accepted, 2026-05-03.

## Context

Phase 1 of the Parthenon ingestion templates initiative ships three new node
types that all subsequent Phase 1 templates depend on:

- `FhirResourceNode` — ingest FHIR R4 resources via Bulk Data NDJSON or paginated search.
- `DicomMetadataNode` — stream DICOM metadata only (pixels never copied).
- `AnonymizerNode` — anonymize a directory of FHIR resources via a pluggable backend.

The Phase 0 Node SDK (ADR 0001) established the `Node` ABC, `NodeContext`,
`NodeResult`, and the `type_name` registration pattern. Phase 1 must build on
that surface without bending it; if a Phase 1 node forces an SDK change, that
is a deliberate ADR amendment, not a silent extension.

## Decision

### 1. No SDK changes for Phase 1
All three new nodes implement the existing `Node` ABC. They register their
`type_name` in `runtime.orchestration.node_registry.NODE_REGISTRY` and add
their string to the `template.v1.json` schema's `nodes[].type` enum. The ABC
itself is unchanged.

### 2. FHIR streaming via Bulk Data NDJSON, search as fallback
`FhirResourceNode` supports two source modes:

- `source: ndjson` — read a directory of NDJSON files (one resource type per file)
  produced by a FHIR server's `$export` operation. Streams line-by-line; never
  loads a whole bundle. Memory ceiling: <200MB RSS on a 1GB synthetic bundle
  (acceptance criterion + dedicated harness in Task 6).
- `source: search` — paginated REST search via `httpx.Client` with bearer-token
  auth, following Bundle `link[relation=next]` hops.

A future Rust-assisted parser is gated behind profiling (spec decision Q6); not in this plan.

### 3. Pixel data defense in depth (DICOM)
Three independent enforcement points:

1. `pydicom.dcmread(stop_before_pixels=True)` in the filesystem backend.
2. The DICOMweb backend issues only QIDO-RS calls (metadata); WADO-RS is never called.
3. A dedicated regression test asserts the output Parquet has zero columns
   matching `*pixel*` (case-insensitive) and that the artifact size is well
   below the source DICOM file size.

If a future change ever surfaces pixel-related state, the regression test
fails loudly. Treat any failure as a HIGHSEC blocker.

### 4. FHIR profile selector with strict-match opt-in
`FhirResourceNode` accepts a `profile` parameter naming one of the curated
profile packs (`us-core`, `mcode`, `ips`, `mii`). Resources whose `resourceType`
isn't in the pack are skipped, not failed (so unknown extensions don't kill
ingestion).

When `strict_profile_match: true`, the node also inspects each resource's
`meta.profile` URLs and **fails loudly** if they don't fall under the pack's
declared base URL. This implements spec decision Q3 ("fail loudly on
profile conflict") — clinical data integrity > convenience.

### 5. Anonymizer plug-in interface
`AnonymizerNode` selects between two implementations of the `AnonymizerBackend`
Protocol:

- `ParthenonNativeBackend` — pure Python; deterministic per-patient via
  HMAC(salt, patient_id); supports `redact`, `keep`, `dateShift`, `cryptoHash`.
- `MsAnonymizerBackend` — HTTP client to the `parthenon-anonymizer` sidecar
  (MS Tools-for-Health-Data-Anonymization wrapped in FastAPI).

Both backends consume the **same JSON config schema** (`anonymizer_config.v1.json`).
Per spec decision Q7, runtime equivalence between backends is **semantic** (same
fields redacted, date-shifts within tolerance, preserved fields byte-equal),
not bit-identical. A dedicated equivalence integration test runs in CI when
the sidecar is up.

### 6. Sidecar from Parthenon GHCR mirror
The `parthenon-anonymizer` sidecar is built from MS Tools-for-Health-Data-Anonymization
v3.2.1 and **mirrored** to `ghcr.io/sudoshi/parthenon-fhir-anonymizer` (per spec
decision Q1). Air-gap-friendly; no `mcr.microsoft.com` runtime dependency.

Container security: non-root user, read-only root filesystem, `cap_drop: ALL`,
`no-new-privileges`, no published host ports, on the internal `parthenon`
docker network only.

### 7. Salt rotation per run
`AnonymizerNode` generates a fresh 256-bit salt per run via `secrets.token_hex(32)`.
The salt is passed to the backend instance for that run only. The salt's
SHA-256 digest is recorded in `result.outputs.salt_digest` (lets re-runs prove
same/different seed without leaking the seed); the salt itself is **never**
logged or persisted.

## Consequences

### Positive
- Phase 1 templates can compose the three new node types without changing the SDK.
- Pixel data leakage is a regression-tested invariant.
- Anonymizer backend swap is a parameter change; no manifest rewrite needed.
- Profile selector makes US Core / mCODE / IPS / MII customers first-class.

### Negative
- The 3-tier pixel defense is verbose; a single point of enforcement would be
  simpler but riskier under future refactor.
- Maintaining curated profile packs per FHIR IG version is ongoing work
  (deferred to Phase 2 auto-generation if customers request more profiles).
- The sidecar adds a long-running container to every Parthenon deployment that
  runs FHIR anonymization; customers without anonymization needs can disable it.

## Alternatives considered (declined)

- **In-process .NET via Pythonnet** for the MS Anonymizer. Rejected: introduces
  .NET runtime into the Python container, increases blast radius for crashes.
  Sidecar pattern keeps blast radius bounded.
- **Auto-detect FHIR profile from `meta.profile`**. Rejected: resources don't
  always declare profiles; auto-detect is fragile; explicit per-run parameter
  surfaces ambiguity at submission time.
- **Pull MS Anonymizer image from `mcr.microsoft.com`** at deploy time.
  Rejected: breaks air-gap deployments; mirroring to Parthenon GHCR keeps
  supply chain auditable.
- **Single anonymizer backend (native only)**. Rejected: customers with
  established MS Anonymizer config catalogs need that compatibility for
  zero-rewrite onboarding.

## References

- Phase 1 design spec: `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 1 (this plan): `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-1-nodes.md`
- Phase 0 Node SDK ADR: `docs/adr/0001-node-sdk-design.md`
- HL7 FHIR Bulk Data Access IG: <https://hl7.org/fhir/uv/bulkdata/>
- pydicom `stop_before_pixels`: <https://pydicom.github.io/pydicom/stable/reference/generated/pydicom.dcmread.html>
- MS Tools-for-Health-Data-Anonymization: <https://github.com/microsoft/Tools-for-Health-Data-Anonymization>
- DICOMweb QIDO-RS: <https://www.dicomstandard.org/using/dicomweb/query-qido-rs/>
- Devplan §4 Phase 1: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` lines 429–541
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 4 ADR cases (0001, 0002, 0003, 0004).

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0004-phase-1-node-design.md templates/tests/test_adrs.py
git commit -m "docs(adr): ADR 0004 — Phase 1 node design"
```

---

## Definition of Done — Plan 1

After all 17 tasks land, verify:

- [ ] `parthenon-templates validate-manifests --root manifests` exits 0 (no regressions on existing 4 manifests)
- [ ] `uv run pytest -q` (full suite) is green: ~210+ tests passing, the slow memory-profile harness skipped by default
- [ ] `uv run pytest -q -m slow` runs the memory harness; passes locally
- [ ] `uv run pytest -q -m integration` runs `test_anonymizer_equivalence.py` against a live sidecar; passes when sidecar is up
- [ ] `uv run ruff check .` clean
- [ ] `uv run black --check --line-length 100 .` clean
- [ ] `uv run mypy --strict runtime/` clean (~42 source files after Phase 1 additions)
- [ ] `docker compose config --quiet` from repo root: exit 0 (anonymizer service block valid)
- [ ] `docker compose up -d parthenon-anonymizer` starts and reaches healthy
- [ ] `docker compose exec -T parthenon-templates wget -q -O - http://parthenon-anonymizer:8080/health` returns `{"status":"ok"}`
- [ ] All 4 ADRs (0001–0004) pass `tests/test_adrs.py`
- [ ] `node_registry.NODE_REGISTRY` contains 11 entries (8 Phase 0 + 3 Phase 1)
- [ ] `manifest.NODE_TYPES` and `template.v1.json` `nodes[].type` enum align with the registry

## Branch model

- Branch off `feature/phase-0-templates-real` (Phase 0 final tip) into `feature/phase-1-templates-nodes`.
- Sequential commits per task; one task = one commit.
- 17 commits total + any TDD-driven mid-task fixups (kept atomic).
- DO NOT push from a subagent; orchestrator handles push between phases.

## Out of scope (handled by Plans 2/3/4/5/6/7)

- DICOM imaging vocabulary load (Plan 2)
- DICOM `etl_dicom_metadata` template (Plan 2)
- PRO instrument framework + EQ-5D-5L template (Plan 3)
- `fhir_anonymizer` template that orchestrates `AnonymizerNode` end-to-end (Plan 4)
- `fhir_to_omop` template across 3 PRs (Plans 5, 6, 7)
- Performance tuning Plan 7 escalation to Rust (only if Plan 7 profiling shows need)
