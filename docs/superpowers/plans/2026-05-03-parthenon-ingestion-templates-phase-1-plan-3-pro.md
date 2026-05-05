# Parthenon Ingestion Templates — Phase 1, Plan 3: PRO Instrument Framework

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `qr_eq5d5l_to_measurement` (the EQ-5D-5L PRO instrument template) plus a reusable `runtime.instruments.pro_base` module that future PRO templates (EQ-5D-3L, PHQ-9, GAD-7, PROMIS, KCCQ-12) inherit. Per spec decision Q4 and devplan T-011 acceptance criterion, an EQ-5D-3L scaffold also ships in this plan as the second consumer that proves the pattern.

**Architecture:** Shared logic lives in Python (`templates/runtime/instruments/pro_base.py`) — small, testable, importable from any PythonNode `code:` block. Each instrument template's manifest is a thin wrapper that supplies an instrument-specific `(item_code → measurement_concept_id, value_normalizer)` mapping. The reuse is at the **authoring layer** (Python imports), not at the manifest layer (no YAML anchors / `extends:` syntax).

**Tech Stack:** Phase 0 toolchain. New runtime deps: none. Existing deps used: `polars`, `sqlalchemy`, `fhir.resources` (Plan 1 pin), Pydantic v2.

**Depends on:** Phase 1 Plan 1 (specifically `FhirResourceNode` for upstream `QuestionnaireResponse` ingestion).

**Unblocks:** Phase 2 PRO templates (PHQ-9, GAD-7, PROMIS, KCCQ-12) — they import `pro_base` directly.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest`. Integration tests marked `@pytest.mark.integration`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, `mypy --strict runtime/`, and `parthenon-templates validate-manifests --root manifests` before commit.
- **Container exec** uses `docker compose exec -T`.
- **Branch model:** sequential commits on the Plan 3 branch; one task = one commit.
- **Type names** stable across tasks: `ProInstrumentDefinition`, `ItemMapping`, `ProBaseError`, `Eq5d5lValueSet`, `Eq5d3lValueSet`.

---

## Task index (10 tasks)

1. `runtime.instruments.pro_base` module: parse, normalize, project helpers
2. EQ-5D-5L placeholder value-set CSV + lookup helper
3. `qr_eq5d5l_to_measurement` manifest
4. `qr_eq5d5l_to_measurement` validation pack and FHIR fixture
5. `qr_eq5d5l_to_measurement` README
6. EQ-5D-3L scaffold manifest + value-set placeholder
7. EQ-5D-3L scaffold README (clearly marked as scaffold)
8. `qr_eq5d5l_to_measurement` E2E test in CI
9. Cross-instrument test: assert both manifests use `pro_base` and follow the same structural pattern
10. ADR 0006 — PRO instrument framework design

---

## Task 1: `runtime.instruments.pro_base` module

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/pro_base.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_pro_base.py`

The shared module exposes:

- `ItemMapping` — Pydantic dataclass for `(item_code, measurement_concept_id, value_extractor)` triples.
- `ProInstrumentDefinition` — Pydantic dataclass holding the full instrument config (item mappings + optional VAS/utility lookups).
- `parse_questionnaire_response(qr_dict, definition)` — yields `MeasurementRow` namedtuples for each item.
- `project_to_measurement(rows, target_schema, db_dsn)` — INSERTs each row into `omop.measurement`, returns inserted count.
- `compute_eq5d_utility(profile_string, lookup_table)` — utility-index calculator stub (real per-country tables ship as CSV in Tasks 2/6; the function is value-set-agnostic).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_pro_base.py
"""runtime.instruments.pro_base: shared logic for PRO instrument templates."""
from __future__ import annotations

from runtime.instruments.pro_base import (
    ItemMapping,
    MeasurementRow,
    ProInstrumentDefinition,
    parse_questionnaire_response,
)


def test_item_mapping_validates() -> None:
    m = ItemMapping(
        item_code="MO",
        measurement_concept_id=2000123456,
        value_unit_concept_id=8512,  # "score"
    )
    assert m.item_code == "MO"


def test_parse_questionnaire_response_yields_one_row_per_item() -> None:
    """A QuestionnaireResponse with 5 EQ-5D-5L items yields 5 rows + 1 VAS row."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[
            ItemMapping(item_code=code, measurement_concept_id=2000_000_000 + i)
            for i, code in enumerate(["MO", "SC", "UA", "PD", "AD"])
        ],
        vas_item_code="VAS",
        vas_measurement_concept_id=2000_000_999,
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [
            {"linkId": "MO", "answer": [{"valueInteger": 1}]},
            {"linkId": "SC", "answer": [{"valueInteger": 2}]},
            {"linkId": "UA", "answer": [{"valueInteger": 1}]},
            {"linkId": "PD", "answer": [{"valueInteger": 3}]},
            {"linkId": "AD", "answer": [{"valueInteger": 2}]},
            {"linkId": "VAS", "answer": [{"valueInteger": 75}]},
        ],
    }

    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 6  # 5 items + 1 VAS
    assert all(isinstance(r, MeasurementRow) for r in rows)
    # Patient ref normalized
    assert all(r.person_source_value == "p1" for r in rows)
    # Date pulled from authored
    assert all(r.measurement_date == "2026-05-03" for r in rows)
    # Item codes preserved
    assert {r.item_code for r in rows} == {"MO", "SC", "UA", "PD", "AD", "VAS"}


def test_parse_skips_unknown_item_codes() -> None:
    """An item not in the instrument definition is skipped (logged, not failed)."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[ItemMapping(item_code="MO", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [
            {"linkId": "MO", "answer": [{"valueInteger": 1}]},
            {"linkId": "MADE_UP", "answer": [{"valueInteger": 99}]},
        ],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].item_code == "MO"


def test_parse_handles_missing_subject_gracefully() -> None:
    """A QR with no subject reference yields rows with person_source_value=None."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[ItemMapping(item_code="MO", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "authored": "2026-05-03T10:00:00Z",
        "item": [{"linkId": "MO", "answer": [{"valueInteger": 1}]}],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].person_source_value is None


def test_parse_handles_decimal_answers() -> None:
    """valueDecimal answers are passed through unchanged."""
    definition = ProInstrumentDefinition(
        instrument_id="custom",
        items=[ItemMapping(item_code="X", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [{"linkId": "X", "answer": [{"valueDecimal": 0.875}]}],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].value_as_number == 0.875
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_pro_base.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'runtime.instruments'`.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/instruments/__init__.py`: empty.

`templates/runtime/instruments/pro_base.py`:

```python
"""Shared logic for PRO instrument templates.

Each instrument-specific manifest (EQ-5D-5L, EQ-5D-3L, PHQ-9, ...) defines
an ``ProInstrumentDefinition`` and uses ``parse_questionnaire_response`` to
project each FHIR ``QuestionnaireResponse.item`` to one OMOP MEASUREMENT row.

Devplan T-011 calls this the ``_shared/pro_base.yaml`` partial; in
implementation we keep the shared logic as a Python module (more testable,
no manifest-loader changes needed). Each PRO template's manifest invokes
this module from a PythonNode ``code:`` block.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

from pydantic import BaseModel, ConfigDict, Field


class ProBaseError(ValueError):
    """Raised when an instrument definition or QR shape is malformed."""


class ItemMapping(BaseModel):
    """One item in a PRO instrument: maps a FHIR linkId to an OMOP concept."""

    model_config = ConfigDict(extra="forbid")

    item_code: str = Field(min_length=1)
    measurement_concept_id: int = Field(ge=0)
    value_unit_concept_id: int = Field(default=8512)  # "score" by default
    value_as_concept_id: int | None = None
    description: str = ""


class ProInstrumentDefinition(BaseModel):
    """Per-instrument config: item mappings + optional VAS + optional utility lookup name."""

    model_config = ConfigDict(extra="forbid")

    instrument_id: str = Field(min_length=1)
    items: list[ItemMapping]
    vas_item_code: str | None = None
    vas_measurement_concept_id: int | None = None
    vas_unit_concept_id: int = 8595  # "millimeter" — typical for VAS scales
    utility_index_lookup: str | None = None  # name of value-set CSV (Task 2/6 ships these)


@dataclass(frozen=True)
class MeasurementRow:
    """One row destined for omop.measurement.

    person_source_value is a string identifier carried from the FHIR
    Patient reference; downstream cross-mapping resolves it to person_id
    (Phase 2 link template). For Phase 1 we leave person_id NULL.
    """

    person_source_value: str | None
    measurement_date: str  # ISO date, e.g. "2026-05-03"
    measurement_concept_id: int
    value_as_number: float | None
    value_as_concept_id: int | None
    unit_concept_id: int
    item_code: str
    measurement_source_value: str  # the FHIR linkId


def _extract_patient_ref(qr: dict[str, Any]) -> str | None:
    subject = qr.get("subject") or {}
    ref = subject.get("reference")
    if not ref:
        return None
    # FHIR convention: "Patient/<id>"
    if "/" in ref:
        return str(ref.rsplit("/", 1)[-1])
    return str(ref)


def _extract_authored_date(qr: dict[str, Any]) -> str:
    authored = qr.get("authored") or qr.get("authoredOn") or ""
    # ISO datetime → ISO date
    return str(authored).split("T", 1)[0] if authored else "1970-01-01"


def _extract_value(answer_obj: dict[str, Any]) -> float | None:
    if "valueInteger" in answer_obj:
        return float(answer_obj["valueInteger"])
    if "valueDecimal" in answer_obj:
        return float(answer_obj["valueDecimal"])
    if "valueQuantity" in answer_obj:
        q = answer_obj["valueQuantity"]
        if "value" in q:
            return float(q["value"])
    return None


def parse_questionnaire_response(
    qr: dict[str, Any], definition: ProInstrumentDefinition
) -> Iterator[MeasurementRow]:
    """Yield one MeasurementRow per (item_code, answer) pair in the QR.

    Items not in the instrument definition are silently skipped.
    QRs without a subject reference yield rows with ``person_source_value=None``.
    """
    if qr.get("resourceType") != "QuestionnaireResponse":
        raise ProBaseError(
            f"expected resourceType=QuestionnaireResponse, got {qr.get('resourceType')!r}"
        )

    by_code = {item.item_code: item for item in definition.items}
    patient_ref = _extract_patient_ref(qr)
    measurement_date = _extract_authored_date(qr)

    for fhir_item in qr.get("item", []) or []:
        link_id = fhir_item.get("linkId")
        if not link_id:
            continue
        # VAS handled separately
        if (
            definition.vas_item_code
            and link_id == definition.vas_item_code
            and definition.vas_measurement_concept_id is not None
        ):
            for answer in fhir_item.get("answer", []) or []:
                value = _extract_value(answer)
                yield MeasurementRow(
                    person_source_value=patient_ref,
                    measurement_date=measurement_date,
                    measurement_concept_id=definition.vas_measurement_concept_id,
                    value_as_number=value,
                    value_as_concept_id=None,
                    unit_concept_id=definition.vas_unit_concept_id,
                    item_code=link_id,
                    measurement_source_value=link_id,
                )
            continue

        mapping = by_code.get(link_id)
        if mapping is None:
            continue  # skip unknown items
        for answer in fhir_item.get("answer", []) or []:
            value = _extract_value(answer)
            yield MeasurementRow(
                person_source_value=patient_ref,
                measurement_date=measurement_date,
                measurement_concept_id=mapping.measurement_concept_id,
                value_as_number=value,
                value_as_concept_id=mapping.value_as_concept_id,
                unit_concept_id=mapping.value_unit_concept_id,
                item_code=link_id,
                measurement_source_value=link_id,
            )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_pro_base.py -v`
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
git add templates/runtime/instruments/ templates/tests/unit/test_pro_base.py
git commit -m "feat(templates): add runtime.instruments.pro_base shared PRO logic"
```

---

## Task 2: EQ-5D-5L placeholder value-set + lookup helper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/value_sets/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/value_sets/eq5d5l_placeholder.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/value_sets/eq5d.py` (lookup helper)
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_eq5d_value_set.py`

Per spec decision Q4 / §4.5: Parthenon ships the **mapping logic + a placeholder value-set table**. The placeholder has the right shape (5-character profile string → utility index) but rows are **dimensionally placeholder data with explicit "Replace with your EuroQol-licensed value set" header rows** and clearly invalid utility values. The customer obtains their EuroQol-licensed value set and drops it in via a parameter.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_eq5d_value_set.py
"""EQ-5D placeholder value-set + lookup helper."""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.instruments.value_sets.eq5d import (
    Eq5dValueSetError,
    load_value_set,
    lookup_utility,
)

PLACEHOLDER = (
    Path(__file__).resolve().parents[2]
    / "runtime" / "instruments" / "value_sets" / "eq5d5l_placeholder.csv"
)


def test_placeholder_csv_exists_and_is_clearly_marked() -> None:
    text = PLACEHOLDER.read_text(encoding="utf-8")
    # Customer obligation must be obvious from the CSV contents
    assert "PLACEHOLDER" in text.upper()
    assert "EUROQOL" in text.upper()
    assert "REPLACE" in text.upper()


def test_placeholder_has_at_least_one_row() -> None:
    table = load_value_set(PLACEHOLDER)
    assert len(table) >= 1


def test_lookup_returns_utility_for_valid_profile() -> None:
    table = load_value_set(PLACEHOLDER)
    # The placeholder ships at least the all-1's profile ("11111")
    util = lookup_utility("11111", table)
    assert isinstance(util, float)


def test_lookup_unknown_profile_raises() -> None:
    table = load_value_set(PLACEHOLDER)
    with pytest.raises(Eq5dValueSetError, match="profile"):
        lookup_utility("99999", table)


def test_lookup_invalid_profile_format_raises() -> None:
    table = load_value_set(PLACEHOLDER)
    with pytest.raises(Eq5dValueSetError, match="profile"):
        lookup_utility("not-a-profile", table)


def test_load_value_set_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(Eq5dValueSetError, match="not found"):
        load_value_set(tmp_path / "missing.csv")


def test_load_value_set_rejects_malformed_csv(tmp_path: Path) -> None:
    bad = tmp_path / "bad.csv"
    bad.write_text("no,header,we,recognize\n1,2,3,4\n", encoding="utf-8")
    with pytest.raises(Eq5dValueSetError):
        load_value_set(bad)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_eq5d_value_set.py -v`
Expected: FAIL — module + CSV missing.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/instruments/value_sets/__init__.py`: empty.

`templates/runtime/instruments/value_sets/eq5d5l_placeholder.csv`:

```csv
# PLACEHOLDER VALUE SET — REPLACE WITH YOUR EUROQOL-LICENSED EQ-5D-5L VALUE SET
# This file ships with Parthenon as DIMENSIONAL PLACEHOLDER DATA only.
# The utility-index values below are NOT clinically valid. They satisfy
# the structural shape (5-character profile string -> utility index) so
# the qr_eq5d5l_to_measurement template runs end-to-end against fixture
# data. DO NOT use these values for real clinical analysis.
#
# To obtain a real EQ-5D-5L value set, register with EuroQol:
#   https://euroqol.org/eq-5d-instruments/
# Then drop your country-specific CSV (same shape as this file) at the
# path you pass via the manifest parameter eq5d_value_set_path.
profile,utility_index
11111,1.000
11112,0.900
11211,0.890
12111,0.880
21111,0.870
22222,0.500
33333,0.300
44444,0.100
55555,-0.100
54321,0.450
12345,0.420
13579,0.380
```

`templates/runtime/instruments/value_sets/eq5d.py`:

```python
"""EQ-5D value-set lookup helper.

The shape of an EQ-5D value set is a CSV with two columns:
  profile (string) — 5-character digit string, e.g. "11111", "22222"
  utility_index (float) — country-specific utility weight

Parthenon ships dimensional PLACEHOLDER data only (see eq5d5l_placeholder.csv).
Customers replace it with their EuroQol-licensed value set at runtime by
passing a path via the manifest parameter ``eq5d_value_set_path``.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

PROFILE_PATTERN = re.compile(r"^[1-5]{5}$")


class Eq5dValueSetError(ValueError):
    """Raised when value-set load or lookup fails."""


def load_value_set(path: Path) -> dict[str, float]:
    """Load an EQ-5D value set from a CSV file.

    Lines beginning with '#' are ignored. The CSV must have a header row
    with at least 'profile' and 'utility_index' columns.
    """
    if not path.exists():
        raise Eq5dValueSetError(f"value set not found: {path}")

    table: dict[str, float] = {}
    with path.open("r", encoding="utf-8") as f:
        # Strip comment lines so DictReader sees only data + header.
        non_comment_lines = [line for line in f if not line.lstrip().startswith("#")]
    if not non_comment_lines:
        raise Eq5dValueSetError(f"value set has no data rows: {path}")
    reader = csv.DictReader(non_comment_lines)
    if reader.fieldnames is None or "profile" not in reader.fieldnames or "utility_index" not in reader.fieldnames:
        raise Eq5dValueSetError(
            f"value set must have 'profile' and 'utility_index' columns; got {reader.fieldnames}"
        )
    for row in reader:
        profile = (row.get("profile") or "").strip()
        if not profile:
            continue
        try:
            table[profile] = float(row["utility_index"])
        except (TypeError, ValueError) as exc:
            raise Eq5dValueSetError(
                f"non-numeric utility_index for profile {profile!r}: {row.get('utility_index')!r}"
            ) from exc
    if not table:
        raise Eq5dValueSetError(f"value set has no usable rows: {path}")
    return table


def lookup_utility(profile: str, table: dict[str, float]) -> float:
    """Return the utility index for a 5-character EQ-5D profile string.

    Raises Eq5dValueSetError if the profile is malformed or absent from the table.
    """
    if not PROFILE_PATTERN.match(profile):
        raise Eq5dValueSetError(
            f"profile must be a 5-character digit string with each digit 1-5; got {profile!r}"
        )
    if profile not in table:
        raise Eq5dValueSetError(
            f"profile {profile!r} not in value set; replace placeholder with full EuroQol set"
        )
    return table[profile]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_eq5d_value_set.py -v`
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
git add templates/runtime/instruments/value_sets/ templates/tests/unit/test_eq5d_value_set.py
git commit -m "feat(templates): add EQ-5D-5L placeholder value set + lookup helper"
```

---

## Task 3: `qr_eq5d5l_to_measurement` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/manifest.yaml`

The manifest:

1. `ingest_responses` (FhirResourceNode): pulls `QuestionnaireResponse` from a FHIR source (NDJSON or search).
2. `project_to_measurement` (PythonNode): reads the QR Parquet, calls `runtime.instruments.pro_base.parse_questionnaire_response` with the EQ-5D-5L `ProInstrumentDefinition`, INSERTs each row into `omop.measurement`.
3. `derive_utility_index` (PythonNode): for each unique `(person_source_value, measurement_date)` group, computes the EQ-5D-5L profile string, looks up the utility index, INSERTs a derived MEASUREMENT row.
4. `emit_summary` (SqlNode + result_artifact): one-row summary `{questionnaire_responses_processed, items_inserted, utility_indices_derived}`.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_qr_eq5d5l_manifest.py
"""qr_eq5d5l_to_measurement manifest validates against template.v1.json."""
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "qr_eq5d5l_to_measurement" / "manifest.yaml"
)


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "qr_eq5d5l_to_measurement"
    assert manifest.metadata.category == "ingestion"


def test_manifest_uses_fhir_resource_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_imports_pro_base() -> None:
    """The python nodes must reference runtime.instruments.pro_base for the reuse contract."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


def test_manifest_declares_eq5d_value_set_path_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "eq5d_value_set_path" in props
    # Default is the placeholder
    assert "placeholder" in props["eq5d_value_set_path"]["default"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v`
Expected: FAIL — manifest missing.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/qr_eq5d5l_to_measurement/manifest.yaml`:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: qr_eq5d5l_to_measurement
  name: EQ-5D-5L QuestionnaireResponse to OMOP Measurement
  version: "0.1.0"
  category: ingestion
  cdm_versions: ["5.3", "5.4"]
  tags: ["pro", "eq5d", "fhir", "questionnaire"]
  author: "Acumenus Data Sciences"
spec:
  parameters:
    type: object
    properties:
      source:
        type: string
        enum: ["ndjson", "search"]
      ndjson_dir:
        type: string
        description: "Directory of NDJSON files (when source=ndjson)."
      fhir_base_url:
        type: string
        description: "FHIR server base URL (when source=search)."
      bearer_token:
        type: string
        description: "FHIR server bearer token (when source=search)."
        secret: true
      profile:
        type: string
        enum: ["us-core", "mcode", "ips", "mii"]
        default: "us-core"
      target_schema:
        type: string
        description: "OMOP CDM target schema."
      vocab_schema:
        type: string
        default: "vocab"
      eq5d_value_set_path:
        type: string
        description: |
          Filesystem path to the EuroQol-licensed EQ-5D-5L value-set CSV.
          The default points to a placeholder shipped with Parthenon — DO NOT
          use the placeholder for clinical analysis. Replace with your
          country-specific value set obtained from EuroQol.
        default: "/app/runtime/instruments/value_sets/eq5d5l_placeholder.csv"
      questionnaire_url:
        type: string
        description: "FHIR Questionnaire.url to filter QR by (selects EQ-5D-5L instances only)."
        default: "https://www.euroqol.org/instruments/eq-5d-5l"
      mo_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for Mobility item."
      sc_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for Self-care item."
      ua_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for Usual Activities item."
      pd_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for Pain/Discomfort item."
      ad_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for Anxiety/Depression item."
      vas_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for VAS score."
      utility_concept_id:
        type: integer
        description: "OMOP measurement_concept_id for derived utility index."
    required:
      - source
      - target_schema
      - mo_concept_id
      - sc_concept_id
      - ua_concept_id
      - pd_concept_id
      - ad_concept_id
      - vas_concept_id
      - utility_concept_id
  requires:
    cdm_initialized: true
    vocabularies: []
  nodes:
    - node_id: ingest_responses
      type: fhir_resource
      params:
        source: "${parameters.source}"
        ndjson_dir: "${parameters.ndjson_dir}"
        fhir_base_url: "${parameters.fhir_base_url}"
        bearer_token: "${parameters.bearer_token}"
        profile: "${parameters.profile}"
        resource_types: ["QuestionnaireResponse"]

    - node_id: project_to_measurement
      type: python
      depends_on: [ingest_responses]
      params:
        code: |
          import json
          from pathlib import Path
          from sqlalchemy import create_engine, text

          import polars as pl

          from runtime.instruments.pro_base import (
              ItemMapping,
              ProInstrumentDefinition,
              parse_questionnaire_response,
          )

          def _build_definition(p):
              return ProInstrumentDefinition(
                  instrument_id="eq5d5l",
                  items=[
                      ItemMapping(item_code="MO", measurement_concept_id=int(p["mo_concept_id"])),
                      ItemMapping(item_code="SC", measurement_concept_id=int(p["sc_concept_id"])),
                      ItemMapping(item_code="UA", measurement_concept_id=int(p["ua_concept_id"])),
                      ItemMapping(item_code="PD", measurement_concept_id=int(p["pd_concept_id"])),
                      ItemMapping(item_code="AD", measurement_concept_id=int(p["ad_concept_id"])),
                  ],
                  vas_item_code="VAS",
                  vas_measurement_concept_id=int(p["vas_concept_id"]),
              )

          def main(context, params):
              if not context.db_dsn:
                  raise RuntimeError("project_to_measurement requires context.db_dsn")
              # FhirResourceNode wrote one Parquet per resource type to the upstream artifact dir.
              upstream = context.artifact_dir.parent / "ingest_responses" / "questionnaireresponse.parquet"
              if not upstream.exists():
                  return {"questionnaire_responses_processed": 0, "items_inserted": 0}

              df = pl.read_parquet(upstream)
              questionnaire_url = params["questionnaire_url"]
              definition = _build_definition(params)
              schema = params["target_schema"]

              engine = create_engine(context.db_dsn, future=True)
              qr_count = 0
              row_count = 0
              with engine.begin() as conn:
                  for raw in df.iter_rows(named=True):
                      # The Parquet preserves nested structures as Python objects.
                      qr = dict(raw) if not isinstance(raw, dict) else raw
                      # Filter to EQ-5D-5L only
                      qid = qr.get("questionnaire") or qr.get("questionnaireCanonical") or ""
                      if questionnaire_url and questionnaire_url not in str(qid):
                          continue
                      qr_count += 1
                      for r in parse_questionnaire_response(qr, definition):
                          conn.execute(text(
                              f"INSERT INTO {schema}.measurement "
                              f"(measurement_id, person_id, measurement_concept_id, measurement_date, "
                              f"measurement_type_concept_id, value_as_number, value_as_concept_id, "
                              f"unit_concept_id, measurement_source_value) "
                              f"VALUES (DEFAULT, NULL, :mcid, CAST(:mdate AS DATE), "
                              f"32817, :vnum, :vcid, :ucid, :msv)"
                          ), {
                              "mcid": r.measurement_concept_id,
                              "mdate": r.measurement_date,
                              "vnum": r.value_as_number,
                              "vcid": r.value_as_concept_id,
                              "ucid": r.unit_concept_id,
                              "msv": r.measurement_source_value,
                          })
                          row_count += 1
              return {"questionnaire_responses_processed": qr_count, "items_inserted": row_count}
        inputs:
          target_schema: "${parameters.target_schema}"
          questionnaire_url: "${parameters.questionnaire_url}"
          mo_concept_id: "${parameters.mo_concept_id}"
          sc_concept_id: "${parameters.sc_concept_id}"
          ua_concept_id: "${parameters.ua_concept_id}"
          pd_concept_id: "${parameters.pd_concept_id}"
          ad_concept_id: "${parameters.ad_concept_id}"
          vas_concept_id: "${parameters.vas_concept_id}"

    - node_id: derive_utility_index
      type: python
      depends_on: [project_to_measurement]
      params:
        code: |
          from pathlib import Path
          from sqlalchemy import create_engine, text

          from runtime.instruments.value_sets.eq5d import load_value_set, lookup_utility

          ITEM_ORDER = ["MO", "SC", "UA", "PD", "AD"]

          def main(context, params):
              if not context.db_dsn:
                  raise RuntimeError("derive_utility_index requires context.db_dsn")
              schema = params["target_schema"]
              utility_concept_id = int(params["utility_concept_id"])
              value_set_path = Path(params["eq5d_value_set_path"])
              table = load_value_set(value_set_path)

              engine = create_engine(context.db_dsn, future=True)
              derived = 0
              skipped = 0
              with engine.begin() as conn:
                  rows = conn.execute(text(
                      f"SELECT measurement_source_value, measurement_date, value_as_number "
                      f"FROM {schema}.measurement "
                      f"WHERE measurement_source_value IN ('MO','SC','UA','PD','AD') "
                      f"ORDER BY measurement_date, measurement_source_value"
                  )).fetchall()
                  by_date = {}
                  for source, mdate, val in rows:
                      key = mdate
                      by_date.setdefault(key, {})[source] = int(val) if val is not None else None
                  for mdate, items in by_date.items():
                      if not all(c in items for c in ITEM_ORDER):
                          skipped += 1
                          continue
                      try:
                          profile = "".join(str(items[c]) for c in ITEM_ORDER)
                          util = lookup_utility(profile, table)
                      except Exception:
                          skipped += 1
                          continue
                      conn.execute(text(
                          f"INSERT INTO {schema}.measurement "
                          f"(measurement_id, person_id, measurement_concept_id, measurement_date, "
                          f"measurement_type_concept_id, value_as_number, unit_concept_id, "
                          f"measurement_source_value) "
                          f"VALUES (DEFAULT, NULL, :mcid, CAST(:mdate AS DATE), "
                          f"32893, :vnum, 8512, 'EQ5D5L_UTILITY')"
                      ), {"mcid": utility_concept_id, "mdate": str(mdate), "vnum": util})
                      derived += 1
              return {"utility_indices_derived": derived, "utility_dates_skipped": skipped}
        inputs:
          target_schema: "${parameters.target_schema}"
          utility_concept_id: "${parameters.utility_concept_id}"
          eq5d_value_set_path: "${parameters.eq5d_value_set_path}"

    - node_id: emit_summary
      type: sql
      depends_on: [derive_utility_index]
      params:
        statements:
          - "SELECT 1"
        fetch_query: |
          SELECT
            COUNT(*) FILTER (WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')) AS items,
            COUNT(*) FILTER (WHERE measurement_source_value = 'VAS') AS vas_records,
            COUNT(*) FILTER (WHERE measurement_source_value = 'EQ5D5L_UTILITY') AS utilities
          FROM ${parameters.target_schema}.measurement
        result_artifact: eq5d5l_summary
  post_conditions:
    - kind: row_count
      params:
        table: "${parameters.target_schema}.measurement"
        where: "measurement_source_value IN ('MO','SC','UA','PD','AD')"
        min: 1
    - kind: artifact_present
      params:
        artifact: eq5d5l_summary.json
        min_rows: 1
```

- [ ] **Step 4: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v && uv run parthenon-templates validate-manifests --root manifests`
Expected: PASS — 4 tests + manifest validates.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
uv run parthenon-templates lint-secret-keys --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/qr_eq5d5l_to_measurement/manifest.yaml templates/tests/unit/test_qr_eq5d5l_manifest.py
git commit -m "feat(templates): add qr_eq5d5l_to_measurement manifest"
```

---

## Task 4: `qr_eq5d5l_to_measurement` validation pack and FHIR fixture

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/validation/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/fixtures/sample/QuestionnaireResponse.ndjson`

The fixture is a tiny NDJSON file with 2 EQ-5D-5L QuestionnaireResponses for 2 different patients on 2 different dates — enough to exercise both per-item insertion and utility-index derivation.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_qr_eq5d5l_manifest.py

import json as _json
import yaml as _yaml

VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample"


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixture_ndjson_present_and_parseable() -> None:
    fixture = FIXTURES / "QuestionnaireResponse.ndjson"
    assert fixture.exists()
    lines = [line for line in fixture.read_text("utf-8").splitlines() if line.strip()]
    assert len(lines) >= 2  # at least 2 QRs for the utility test
    for line in lines:
        qr = _json.loads(line)
        assert qr["resourceType"] == "QuestionnaireResponse"


def test_inputs_parameters_satisfy_required() -> None:
    inputs = _json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text("utf-8"))
    for required in (
        "source", "target_schema",
        "mo_concept_id", "sc_concept_id", "ua_concept_id",
        "pd_concept_id", "ad_concept_id",
        "vas_concept_id", "utility_concept_id",
    ):
        assert required in inputs, f"missing: {required}"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v`
Expected: FAIL — pack files missing.

- [ ] **Step 3: Write minimal implementation**

`fixtures/sample/QuestionnaireResponse.ndjson`:

```json
{"resourceType":"QuestionnaireResponse","id":"qr-001","status":"completed","subject":{"reference":"Patient/p1"},"authored":"2026-04-15T10:00:00Z","questionnaire":"https://www.euroqol.org/instruments/eq-5d-5l","item":[{"linkId":"MO","answer":[{"valueInteger":1}]},{"linkId":"SC","answer":[{"valueInteger":1}]},{"linkId":"UA","answer":[{"valueInteger":1}]},{"linkId":"PD","answer":[{"valueInteger":1}]},{"linkId":"AD","answer":[{"valueInteger":1}]},{"linkId":"VAS","answer":[{"valueInteger":85}]}]}
{"resourceType":"QuestionnaireResponse","id":"qr-002","status":"completed","subject":{"reference":"Patient/p2"},"authored":"2026-04-20T11:30:00Z","questionnaire":"https://www.euroqol.org/instruments/eq-5d-5l","item":[{"linkId":"MO","answer":[{"valueInteger":2}]},{"linkId":"SC","answer":[{"valueInteger":2}]},{"linkId":"UA","answer":[{"valueInteger":2}]},{"linkId":"PD","answer":[{"valueInteger":2}]},{"linkId":"AD","answer":[{"valueInteger":2}]},{"linkId":"VAS","answer":[{"valueInteger":50}]}]}
```

`validation/README.md`:

```markdown
# qr_eq5d5l_to_measurement — validation pack

End-to-end validation inputs and expected post-conditions for the
`qr_eq5d5l_to_measurement` template.

## Fixture FHIR corpus

`fixtures/sample/QuestionnaireResponse.ndjson` ships 2 EQ-5D-5L responses for
2 synthetic patients (`Patient/p1`, `Patient/p2`) on different dates. No PHI.

## How to validate

1. Bring up Parthenon CDM v5.4.
2. Submit the template via the API or Aqueduct UI.
3. Run the staging validation runner against `expected/post_conditions.yaml`.
4. (Optional) Run `dqd_checks.yaml` for deeper integrity checks.

## EuroQol licensing reminder

The template's default `eq5d_value_set_path` points to a placeholder file with
dimensional placeholder data only. **Replace with your country-specific
EuroQol-licensed value set before any clinical analysis** — see the template
README for instructions.
```

`validation/inputs/parameters.json`:

```json
{
  "source": "ndjson",
  "ndjson_dir": "/var/parthenon/manifests/qr_eq5d5l_to_measurement/fixtures/sample",
  "profile": "us-core",
  "target_schema": "omop",
  "vocab_schema": "vocab",
  "eq5d_value_set_path": "/app/runtime/instruments/value_sets/eq5d5l_placeholder.csv",
  "questionnaire_url": "https://www.euroqol.org/instruments/eq-5d-5l",
  "mo_concept_id": 4231411,
  "sc_concept_id": 4231412,
  "ua_concept_id": 4231413,
  "pd_concept_id": 4231414,
  "ad_concept_id": 4231415,
  "vas_concept_id": 4231416,
  "utility_concept_id": 4231417
}
```

(Concept IDs above are illustrative placeholders. In a real deployment the customer maps these to standard OMOP concept IDs for EQ-5D items, or uses Parthenon-namespaced IDs if no Athena standards apply.)

`validation/expected/post_conditions.yaml`:

```yaml
post_conditions:
  - kind: row_count
    table: omop.measurement
    where: "measurement_source_value IN ('MO','SC','UA','PD','AD')"
    expected: 10  # 2 QRs × 5 items
    description: "Each QR's 5 items inserted as MEASUREMENT rows"

  - kind: row_count
    table: omop.measurement
    where: "measurement_source_value = 'VAS'"
    expected: 2
    description: "Each QR's VAS score inserted"

  - kind: row_count
    table: omop.measurement
    where: "measurement_source_value = 'EQ5D5L_UTILITY'"
    expected: 2
    description: "One utility-index row per (patient, date) combination"

  - kind: column_value_range
    table: omop.measurement
    column: value_as_number
    where: "measurement_source_value = 'EQ5D5L_UTILITY'"
    min: -1.0
    max: 1.0
    description: "Utility index falls in conventional EQ-5D range"

  - kind: artifact_present
    artifact_name: eq5d5l_summary.json
    min_rows: 1
```

`validation/dqd_checks.yaml`:

```yaml
checks:
  - check_id: eq5d5l_items_have_value
    description: "Every EQ-5D item row has a value_as_number in [1, 5]."
    sql: |
      SELECT COUNT(*) AS violations
      FROM omop.measurement
      WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')
        AND (value_as_number IS NULL OR value_as_number < 1 OR value_as_number > 5)
    expected: 0

  - check_id: eq5d5l_vas_in_range
    description: "VAS scores are in [0, 100]."
    sql: |
      SELECT COUNT(*) AS violations
      FROM omop.measurement
      WHERE measurement_source_value = 'VAS'
        AND (value_as_number IS NULL OR value_as_number < 0 OR value_as_number > 100)
    expected: 0

  - check_id: eq5d5l_utility_per_completed_set
    description: "A utility row exists for every (date) where all 5 items are present."
    sql: |
      WITH per_date AS (
        SELECT measurement_date, COUNT(DISTINCT measurement_source_value) AS items
        FROM omop.measurement
        WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')
        GROUP BY measurement_date
      ),
      utilities AS (
        SELECT measurement_date FROM omop.measurement
        WHERE measurement_source_value = 'EQ5D5L_UTILITY'
      )
      SELECT COUNT(*) AS violations
      FROM per_date pd
      LEFT JOIN utilities u USING (measurement_date)
      WHERE pd.items = 5 AND u.measurement_date IS NULL
    expected: 0
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/qr_eq5d5l_to_measurement/validation/ templates/manifests/qr_eq5d5l_to_measurement/fixtures/
git commit -m "feat(templates): add qr_eq5d5l_to_measurement validation pack and FHIR fixture"
```

---

## Task 5: `qr_eq5d5l_to_measurement` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d5l_to_measurement/README.md`

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_qr_eq5d5l_manifest.py

REQUIRED_HEADINGS = [
    "## What it does", "## When to use it", "## Parameters",
    "## Prerequisites", "## Examples", "## Limitations",
    "## License / attribution", "## Security notes",
]


def test_readme_has_required_sections() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for h in REQUIRED_HEADINGS:
        assert h in text


def test_readme_calls_out_euroqol_obligation() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8").lower()
    assert "euroqol" in text
    assert "register" in text or "license" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v`
Expected: FAIL — README missing.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/qr_eq5d5l_to_measurement/README.md`:

```markdown
# `qr_eq5d5l_to_measurement` — Phase 1 template

Projects FHIR `QuestionnaireResponse` resources for EQ-5D-5L into OMOP
`MEASUREMENT` rows. Each completed QR yields:

- **5 item rows** (MO, SC, UA, PD, AD) — one per dimension, value 1–5.
- **1 VAS row** — the visual analog scale score, 0–100.
- **1 utility-index row** — derived from the 5-character profile string via
  the configured EuroQol value set.

## What it does

1. `ingest_responses` (FhirResourceNode): pulls `QuestionnaireResponse`
   resources from a FHIR source (NDJSON bulk export OR REST search). Filters
   to the configured `questionnaire_url`.
2. `project_to_measurement` (PythonNode): for each filtered QR, calls
   `runtime.instruments.pro_base.parse_questionnaire_response` and INSERTs
   one MEASUREMENT row per item answer.
3. `derive_utility_index` (PythonNode): groups item rows by
   `(person_source_value, measurement_date)`, builds the 5-character profile
   string, looks up the utility weight in the configured EuroQol value set,
   and INSERTs a derived MEASUREMENT row.
4. `emit_summary` (SqlNode + result_artifact): writes a one-row
   `eq5d5l_summary.json` artifact with `(items, vas_records, utilities)` counts.

## When to use it

Run whenever you need to ingest a batch of EQ-5D-5L responses. The template
is **not** singleton — multiple runs append to `omop.measurement` (use the
`measurement_source_value` and `measurement_date` columns to dedupe if you
re-process).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | yes | — | `ndjson` or `search` (FhirResourceNode mode). |
| `ndjson_dir` | string | when `source=ndjson` | — | Directory of QR NDJSON files. |
| `fhir_base_url` | string | when `source=search` | — | FHIR R4 server base URL. |
| `bearer_token` | string (secret) | when `source=search` | — | OAuth2 bearer token for the FHIR server. |
| `profile` | string | no | `us-core` | FHIR profile to apply (one of: `us-core`, `mcode`, `ips`, `mii`). |
| `target_schema` | string | yes | — | OMOP CDM target schema (e.g. `omop`). |
| `vocab_schema` | string | no | `vocab` | OMOP vocabulary schema. |
| `eq5d_value_set_path` | string | no | placeholder | Path to the EuroQol-licensed value-set CSV (see Limitations). |
| `questionnaire_url` | string | no | EuroQol canonical | FHIR Questionnaire URL to filter QRs by. |
| `mo_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Mobility item. |
| `sc_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Self-care item. |
| `ua_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Usual Activities item. |
| `pd_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Pain/Discomfort item. |
| `ad_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Anxiety/Depression item. |
| `vas_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for VAS score. |
| `utility_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for derived utility index. |

## Prerequisites

- Parthenon CDM v5.3 or v5.4 initialized (the imaging/oncology extensions
  are not required).
- FHIR source reachable from the templates service container.
- (For real clinical analysis only) a EuroQol-licensed EQ-5D-5L value-set CSV.

## Examples

NDJSON source (offline / batch):

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/qr_eq5d5l_to_measurement/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/qr_eq5d5l_to_measurement/runs
```

FHIR search source (online):

```json
{
  "source": "search",
  "fhir_base_url": "https://fhir.example.com",
  "bearer_token": "${SECRET_FHIR_TOKEN}",
  "profile": "us-core",
  "target_schema": "omop",
  "vocab_schema": "vocab",
  "questionnaire_url": "https://www.euroqol.org/instruments/eq-5d-5l",
  "mo_concept_id": 4231411,
  "sc_concept_id": 4231412,
  "ua_concept_id": 4231413,
  "pd_concept_id": 4231414,
  "ad_concept_id": 4231415,
  "vas_concept_id": 4231416,
  "utility_concept_id": 4231417,
  "eq5d_value_set_path": "/srv/euroqol/eq5d5l_us.csv"
}
```

## Limitations

- The shipped `eq5d5l_value_set_path` default is a **PLACEHOLDER**. The values
  in `eq5d5l_placeholder.csv` are dimensional placeholder data and NOT
  clinically valid. **You must replace it with your country-specific
  EuroQol-licensed value set before any clinical analysis.** See the
  Licensing section.
- `person_id` is left NULL on inserted rows (Phase 1 scope; cross-mapping to
  OMOP Person is the Phase 2 `link_person` template's job).
- The template assumes one QR per (subject, authoredDate). Multiple QRs for
  the same patient on the same day will produce duplicate rows; downstream
  cohort definitions must dedupe.
- Only EQ-5D-5L is implemented in this Plan. EQ-5D-3L scaffolding ships
  alongside (Plan 3 Task 6); other PRO instruments (PHQ-9, GAD-7, PROMIS,
  KCCQ-12) are Phase 2.

## License / attribution

The EQ-5D-5L instrument and its value sets are owned by **EuroQol Research
Foundation**. Use of EQ-5D requires registration with EuroQol:

- Visit <https://euroqol.org/eq-5d-instruments/>
- Register your study; obtain the country-specific value set CSV.
- Drop the CSV at the path you pass via `eq5d_value_set_path`.

Parthenon ships:

- The mapping logic (Apache 2.0, no EuroQol IP).
- A clearly-marked PLACEHOLDER value-set CSV (dimensional placeholder data
  only — NOT EuroQol-derived).

Parthenon does not relicense EQ-5D content.

## Security notes

- `bearer_token` (when `source=search`) is declared `secret: true`. The
  Materializer redacts it from the run's `parameters` echo so it never
  appears in run logs or the API response.
- `eq5d_value_set_path` points to a host filesystem path mounted into the
  templates container. Confirm the file is readable by the container's
  non-root `templates` user.
- The template never logs raw QR contents. The summary artifact contains
  only counts.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d5l_manifest.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/qr_eq5d5l_to_measurement/README.md
git commit -m "docs(templates): add qr_eq5d5l_to_measurement README"
```

---

## Task 6: EQ-5D-3L scaffold manifest + value-set placeholder

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d3l_to_measurement/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/value_sets/eq5d3l_placeholder.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_qr_eq5d3l_scaffold.py`

Per spec Q4 / devplan T-011 acceptance criterion: a second consumer of `pro_base` proves the framework is genuinely reusable. The EQ-5D-3L scaffold is **structurally identical** to EQ-5D-5L except:

- Item answer values are 1–3 instead of 1–5.
- Profile string is digits 1–3 in 5 positions.
- Different value-set CSV (`eq5d3l_placeholder.csv`).
- Different `questionnaire_url` default.

The scaffold is **fully functional** but flagged in its README as a scaffold awaiting field validation.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_qr_eq5d3l_scaffold.py
"""EQ-5D-3L scaffold: proves _shared/pro_base is reused by a second instrument."""
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "qr_eq5d3l_to_measurement" / "manifest.yaml"
)
PLACEHOLDER = (
    Path(__file__).resolve().parents[2]
    / "runtime" / "instruments" / "value_sets" / "eq5d3l_placeholder.csv"
)


def test_eq5d3l_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "qr_eq5d3l_to_measurement"


def test_eq5d3l_manifest_imports_pro_base() -> None:
    """Same shared module as EQ-5D-5L — proves the framework is reused."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


def test_eq5d3l_uses_3l_value_set_default() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    default = payload["spec"]["parameters"]["properties"]["eq5d_value_set_path"]["default"]
    assert "eq5d3l" in default.lower()


def test_eq5d3l_placeholder_value_set_exists() -> None:
    assert PLACEHOLDER.exists()
    text = PLACEHOLDER.read_text(encoding="utf-8")
    assert "PLACEHOLDER" in text.upper()
    assert "EUROQOL" in text.upper()
    # 3L uses digits 1-3, profile length 5 → at most 243 entries.
    # Just verify the all-1's profile is present.
    assert "11111" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d3l_scaffold.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/instruments/value_sets/eq5d3l_placeholder.csv`:

```csv
# PLACEHOLDER VALUE SET — REPLACE WITH YOUR EUROQOL-LICENSED EQ-5D-3L VALUE SET
# This file ships with Parthenon as DIMENSIONAL PLACEHOLDER DATA only.
# DO NOT use these values for real clinical analysis.
# To obtain a real EQ-5D-3L value set, register with EuroQol.
profile,utility_index
11111,1.000
11112,0.900
11211,0.880
12111,0.870
21111,0.860
22222,0.500
33333,0.150
13333,0.300
12321,0.480
11221,0.700
```

`templates/manifests/qr_eq5d3l_to_measurement/manifest.yaml`:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: qr_eq5d3l_to_measurement
  name: EQ-5D-3L QuestionnaireResponse to OMOP Measurement (Scaffold)
  version: "0.1.0-scaffold"
  category: ingestion
  cdm_versions: ["5.3", "5.4"]
  tags: ["pro", "eq5d", "fhir", "scaffold", "phase-1-proof"]
  author: "Acumenus Data Sciences"
spec:
  parameters:
    type: object
    properties:
      source:
        type: string
        enum: ["ndjson", "search"]
      ndjson_dir: {type: string}
      fhir_base_url: {type: string}
      bearer_token: {type: string, secret: true}
      profile:
        type: string
        enum: ["us-core", "mcode", "ips", "mii"]
        default: "us-core"
      target_schema: {type: string}
      vocab_schema: {type: string, default: "vocab"}
      eq5d_value_set_path:
        type: string
        default: "/app/runtime/instruments/value_sets/eq5d3l_placeholder.csv"
      questionnaire_url:
        type: string
        default: "https://www.euroqol.org/instruments/eq-5d-3l"
      mo_concept_id: {type: integer}
      sc_concept_id: {type: integer}
      ua_concept_id: {type: integer}
      pd_concept_id: {type: integer}
      ad_concept_id: {type: integer}
      vas_concept_id: {type: integer}
      utility_concept_id: {type: integer}
    required:
      - source
      - target_schema
      - mo_concept_id
      - sc_concept_id
      - ua_concept_id
      - pd_concept_id
      - ad_concept_id
      - vas_concept_id
      - utility_concept_id
  requires:
    cdm_initialized: true
    vocabularies: []
  nodes:
    - node_id: ingest_responses
      type: fhir_resource
      params:
        source: "${parameters.source}"
        ndjson_dir: "${parameters.ndjson_dir}"
        fhir_base_url: "${parameters.fhir_base_url}"
        bearer_token: "${parameters.bearer_token}"
        profile: "${parameters.profile}"
        resource_types: ["QuestionnaireResponse"]

    - node_id: project_to_measurement
      type: python
      depends_on: [ingest_responses]
      params:
        code: |
          # Same logic as qr_eq5d5l_to_measurement: imports runtime.instruments.pro_base.
          # The reuse is the proof point for spec decision Q4.
          from sqlalchemy import create_engine, text
          import polars as pl
          from runtime.instruments.pro_base import (
              ItemMapping, ProInstrumentDefinition, parse_questionnaire_response,
          )

          def main(context, params):
              if not context.db_dsn:
                  raise RuntimeError("project_to_measurement requires context.db_dsn")
              upstream = context.artifact_dir.parent / "ingest_responses" / "questionnaireresponse.parquet"
              if not upstream.exists():
                  return {"questionnaire_responses_processed": 0, "items_inserted": 0}
              df = pl.read_parquet(upstream)
              definition = ProInstrumentDefinition(
                  instrument_id="eq5d3l",
                  items=[
                      ItemMapping(item_code=c, measurement_concept_id=int(params[f"{c.lower()}_concept_id"]))
                      for c in ("MO","SC","UA","PD","AD")
                  ],
                  vas_item_code="VAS",
                  vas_measurement_concept_id=int(params["vas_concept_id"]),
              )
              schema = params["target_schema"]
              questionnaire_url = params["questionnaire_url"]
              engine = create_engine(context.db_dsn, future=True)
              qr_count = 0
              row_count = 0
              with engine.begin() as conn:
                  for raw in df.iter_rows(named=True):
                      qr = dict(raw) if not isinstance(raw, dict) else raw
                      if questionnaire_url not in str(qr.get("questionnaire") or qr.get("questionnaireCanonical") or ""):
                          continue
                      qr_count += 1
                      for r in parse_questionnaire_response(qr, definition):
                          conn.execute(text(
                              f"INSERT INTO {schema}.measurement "
                              f"(measurement_id, person_id, measurement_concept_id, measurement_date, "
                              f"measurement_type_concept_id, value_as_number, unit_concept_id, "
                              f"measurement_source_value) "
                              f"VALUES (DEFAULT, NULL, :mcid, CAST(:mdate AS DATE), 32817, "
                              f":vnum, :ucid, :msv)"
                          ), {
                              "mcid": r.measurement_concept_id, "mdate": r.measurement_date,
                              "vnum": r.value_as_number, "ucid": r.unit_concept_id,
                              "msv": r.measurement_source_value,
                          })
                          row_count += 1
              return {"questionnaire_responses_processed": qr_count, "items_inserted": row_count}
        inputs:
          target_schema: "${parameters.target_schema}"
          questionnaire_url: "${parameters.questionnaire_url}"
          mo_concept_id: "${parameters.mo_concept_id}"
          sc_concept_id: "${parameters.sc_concept_id}"
          ua_concept_id: "${parameters.ua_concept_id}"
          pd_concept_id: "${parameters.pd_concept_id}"
          ad_concept_id: "${parameters.ad_concept_id}"
          vas_concept_id: "${parameters.vas_concept_id}"

    - node_id: emit_summary
      type: sql
      depends_on: [project_to_measurement]
      params:
        statements: ["SELECT 1"]
        fetch_query: |
          SELECT COUNT(*) AS items
          FROM ${parameters.target_schema}.measurement
          WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')
        result_artifact: eq5d3l_summary
  post_conditions:
    - kind: artifact_present
      params:
        artifact: eq5d3l_summary.json
        min_rows: 0   # scaffold; if no QRs match, still considered run-complete
```

Note: the EQ-5D-3L scaffold deliberately omits the `derive_utility_index` node — the proof point is the **shared parse/project layer**, not the full clinical computation. The README (Task 7) flags this explicitly. Filling in utility derivation for EQ-5D-3L is a Phase 2 follow-up once the EuroQol value-set licensing is confirmed for both instruments.

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d3l_scaffold.py -v && uv run parthenon-templates validate-manifests --root manifests`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/qr_eq5d3l_to_measurement/manifest.yaml \
        templates/runtime/instruments/value_sets/eq5d3l_placeholder.csv \
        templates/tests/unit/test_qr_eq5d3l_scaffold.py
git commit -m "feat(templates): add EQ-5D-3L scaffold proving pro_base reuse (spec Q4)"
```

---

## Task 7: EQ-5D-3L scaffold README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/qr_eq5d3l_to_measurement/README.md`

Minimal README for the scaffold. Explicitly marks it as a scaffold and points readers at `qr_eq5d5l_to_measurement` for the full functionality.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_qr_eq5d3l_scaffold.py

def test_readme_marks_template_as_scaffold() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8").lower()
    assert "scaffold" in text
    assert "phase 2" in text or "phase-2" in text


def test_readme_references_eq5d5l_for_full_functionality() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    assert "qr_eq5d5l_to_measurement" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d3l_scaffold.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/qr_eq5d3l_to_measurement/README.md`:

```markdown
# `qr_eq5d3l_to_measurement` — Phase 1 SCAFFOLD

> **This template is a scaffold.** It exists to prove that the
> `runtime.instruments.pro_base` module is reusable across PRO instruments
> (acceptance criterion for Phase 1 T-011). It ingests EQ-5D-3L
> QuestionnaireResponses and projects items + VAS into `omop.measurement`,
> but it does NOT yet derive a utility index. Utility derivation is deferred
> to Phase 2 once the EQ-5D-3L EuroQol value-set licensing posture is
> confirmed alongside the EQ-5D-5L flow.

## What it does

1. Pulls `QuestionnaireResponse` resources via `FhirResourceNode`.
2. Filters to the configured `questionnaire_url` (default: EuroQol
   EQ-5D-3L canonical).
3. Calls `runtime.instruments.pro_base.parse_questionnaire_response` to yield
   one row per item answer + one VAS row per QR. **Same shared logic as
   `qr_eq5d5l_to_measurement`** — the reuse is the proof point.
4. INSERTs each row into `omop.measurement`.
5. Emits a `eq5d3l_summary.json` artifact.

## When to use it

For now: **don't run this template in production.** Use it as a reference for
how to build a new PRO instrument template by wiring `pro_base` to a different
`questionnaire_url` + concept_id mapping.

For full EQ-5D-5L functionality (with utility-index derivation), see
[`qr_eq5d5l_to_measurement`](../qr_eq5d5l_to_measurement/README.md).

## Parameters

Identical to `qr_eq5d5l_to_measurement` (see that template's README) except:

- `eq5d_value_set_path` defaults to `eq5d3l_placeholder.csv` (also a placeholder).
- `questionnaire_url` defaults to the EQ-5D-3L canonical URL.
- No `utility_concept_id` is required (utility derivation is not implemented
  in the scaffold).

## Prerequisites

Same as EQ-5D-5L — see that template's README.

## Examples

The scaffold accepts the same input shape as EQ-5D-5L; reuse that template's
example with `qr_eq5d3l_to_measurement` substituted as the `template_id`.

## Limitations

- **No utility-index derivation.** Phase 2 work.
- **No CI E2E test.** The EQ-5D-5L test in CI exercises the shared `pro_base`
  module path; the scaffold is not separately gated.
- **Placeholder value-set table.** Same EuroQol licensing reminder as the
  EQ-5D-5L flow — ship a placeholder, customer obtains the real value set.

## License / attribution

EQ-5D-3L is owned by EuroQol Research Foundation. See
`qr_eq5d5l_to_measurement/README.md` for the licensing posture (identical
for the 3L variant).

## Security notes

Same as EQ-5D-5L. The scaffold imports the same `pro_base` module and the
same `eq5d` value-set helper; no new attack surface.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_qr_eq5d3l_scaffold.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/qr_eq5d3l_to_measurement/README.md
git commit -m "docs(templates): add qr_eq5d3l_to_measurement scaffold README"
```

---

## Task 8: `qr_eq5d5l_to_measurement` E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_qr_eq5d5l_to_measurement.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml` (add E2E step)

Spin up Postgres testcontainer, bootstrap CDM, point the manifest's `ndjson_dir` at the fixture corpus, submit, assert post-conditions and utility-index derivation worked.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_qr_eq5d5l_to_measurement.py
"""E2E: qr_eq5d5l_to_measurement against a Postgres testcontainer + fixture FHIR corpus."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "qr_eq5d5l_to_measurement"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.5)
    return "timeout"


@pytest.mark.integration
def test_eq5d5l_runs_and_derives_utility(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    # Stage the fixture corpus into a directory the templates container can read.
    fixture_dir = tmp_path / "qr_fixtures"
    fixture_dir.mkdir()
    src_fixture = MANIFEST_DIR / "fixtures" / "sample" / "QuestionnaireResponse.ndjson"
    shutil.copy(src_fixture, fixture_dir / "QuestionnaireResponse.ndjson")

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)

        monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
        monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
        monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
        monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
        monkeypatch.setenv("DATABASE_URL", db_url)

        from runtime.api import app
        from runtime.dependencies import get_backend, get_registry, get_settings, get_storage

        for c in (get_settings, get_registry, get_storage, get_backend):
            c.cache_clear()

        client = TestClient(app)
        params = json.loads(
            (MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        params["ndjson_dir"] = str(fixture_dir)
        # Use the local placeholder value set
        params["eq5d_value_set_path"] = str(
            REPO / "runtime" / "instruments" / "value_sets" / "eq5d5l_placeholder.csv"
        )

        r = client.post(
            "/runs",
            json={
                "template_id": "qr_eq5d5l_to_measurement",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "eq5d5l-e2e",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            items = conn.execute(text(
                "SELECT COUNT(*) FROM omop.measurement "
                "WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')"
            )).scalar()
            vas = conn.execute(text(
                "SELECT COUNT(*) FROM omop.measurement WHERE measurement_source_value = 'VAS'"
            )).scalar()
            utilities = conn.execute(text(
                "SELECT COUNT(*) FROM omop.measurement "
                "WHERE measurement_source_value = 'EQ5D5L_UTILITY'"
            )).scalar()
        # 2 QRs × 5 items = 10
        assert items == 10
        # 2 QRs × 1 VAS = 2
        assert vas == 2
        # 2 unique (date) groups → 2 utility rows
        assert utilities == 2
```

- [ ] **Step 2: Run test to verify it fails or works**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_qr_eq5d5l_to_measurement.py -v`

Iterate against the manifest if anything misbehaves.

- [ ] **Step 3: Update CI workflow**

Add to `.github/workflows/templates.yml`:

```yaml
      - name: qr_eq5d5l_to_measurement E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_qr_eq5d5l_to_measurement.py -v -m integration
```

- [ ] **Step 4: Verify**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_qr_eq5d5l_to_measurement.py -v
```

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/e2e/test_qr_eq5d5l_to_measurement.py .github/workflows/templates.yml
git commit -m "test(templates): add qr_eq5d5l_to_measurement E2E test in CI"
```

---

## Task 9: Cross-instrument structural-pattern test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_pro_pattern_reuse.py`

The acceptance criterion for `pro_base` is "exercised by at least 2 instruments." This test asserts that the EQ-5D-5L and EQ-5D-3L manifests both follow the same structural pattern AND both import `runtime.instruments.pro_base`.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_pro_pattern_reuse.py
"""Cross-instrument check: both EQ-5D variants follow the pro_base pattern."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
INSTRUMENTS = ["qr_eq5d5l_to_measurement", "qr_eq5d3l_to_measurement"]


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_imports_pro_base(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    text = manifest.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_uses_fhir_resource_for_ingestion(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    payload = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_declares_eq5d_value_set_path(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    payload = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "eq5d_value_set_path" in props


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_filters_by_questionnaire_url(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    text = manifest.read_text(encoding="utf-8")
    assert "questionnaire_url" in text


def test_pro_base_module_importable() -> None:
    """The shared module is real and exports the expected symbols."""
    from runtime.instruments.pro_base import (
        ItemMapping,
        MeasurementRow,
        ProInstrumentDefinition,
        parse_questionnaire_response,
    )

    assert ItemMapping is not None
    assert ProInstrumentDefinition is not None
    assert parse_questionnaire_response is not None
    assert MeasurementRow is not None
```

- [ ] **Step 2: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_pro_pattern_reuse.py -v`
Expected: PASS — 9 tests (4 parametrized × 2 instruments + 1 module import).

- [ ] **Step 3: No new implementation needed**

This is a regression test asserting the shared-pattern invariant. If a future PRO instrument is added, extend `INSTRUMENTS` to include it and the test will gate the new addition.

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_pro_pattern_reuse.py -v`

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/unit/test_pro_pattern_reuse.py
git commit -m "test(templates): assert EQ-5D-5L and EQ-5D-3L both reuse pro_base"
```

---

## Task 10: ADR 0006 — PRO instrument framework design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0006-pro-instrument-framework.md`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py` (add `0006`)

- [ ] **Step 1: Write the failing test**

```python
# Update parametrize in templates/tests/test_adrs.py:
@pytest.mark.parametrize("adr_number", ["0001", "0002", "0003", "0004", "0005", "0006"])
def test_adr_exists_and_uses_madr(adr_number: str) -> None:
    ...
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: FAIL — `0006` ADR doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`docs/adr/0006-pro-instrument-framework.md`:

```markdown
# ADR 0006 — PRO Instrument Framework Design

## Status

Accepted, 2026-05-03.

## Context

Devplan T-011 calls for a `_shared/pro_base.yaml` partial that future PRO
instrument templates (PHQ-9, GAD-7, PROMIS, KCCQ-12) inherit, with the
acceptance criterion "exercised by at least 2 instruments." Phase 1 ships
EQ-5D-5L (full) and EQ-5D-3L (scaffold) as the two instruments.

The implementation choice — whether the "shared partial" is YAML-with-anchors,
a manifest-loader `extends:` feature, or a Python module — has long-term
implications for who maintains the framework and how new instruments are added.

## Decision

### 1. The shared layer is a Python module, not a YAML partial

`runtime.instruments.pro_base` exposes:

- `ItemMapping`, `ProInstrumentDefinition` Pydantic models.
- `MeasurementRow` frozen dataclass.
- `parse_questionnaire_response(qr, definition) -> Iterator[MeasurementRow]`.

Each instrument template's `python` node imports this module from its
`code:` block and calls `parse_questionnaire_response`. The instrument-specific
data (item codes, concept_ids, VAS handling) is constructed locally in the
node's code from manifest parameters.

**Rejected alternatives:**

- **YAML anchors / merge keys.** The manifest JSON Schema (`template.v1.json`)
  doesn't support YAML's anchor expansion — anchors are resolved by the YAML
  loader before the schema sees them, but that introduces hidden coupling
  between manifest authors and YAML library behavior. Hard to reason about.
- **Manifest-loader `extends:` feature.** Would require new schema fields,
  new loader logic, and a recursive resolution step. Significant architectural
  change for a feature that boils down to "DRY a few node configs."
- **A dedicated PR templating language.** Over-engineered for v1.

The Python-module approach is testable in isolation, has zero schema
implications, and lets each instrument template's code be self-contained
and reviewable.

### 2. Each instrument is a separate manifest

Even though both EQ-5D-5L and EQ-5D-3L share most of their structure, they
ship as **two distinct manifest files** rather than one parameterized
manifest. Reasons:

- Manifest IDs are user-visible (in the Aqueduct UI, in run history). Customers
  selecting "EQ-5D-3L" should see EQ-5D-3L, not "EQ-5D (variant=3L)."
- Per-instrument validation packs differ (item value range 1–5 vs 1–3, value
  set CSV path, expected post-condition counts).
- Each instrument has its own README — separately discoverable and citable.

The duplication cost is low (~50 lines per manifest), and the shared
`pro_base` module ensures the projection logic is single-sourced.

### 3. EuroQol value set is customer-supplied

Per spec decision Q4 / §4.5: Parthenon ships the **mapping logic + a
clearly-marked placeholder value set** but never the real EuroQol-licensed
value set. The placeholder file headers explicitly say:

- "PLACEHOLDER VALUE SET — REPLACE WITH YOUR EUROQOL-LICENSED EQ-5D-5L VALUE SET"
- "DIMENSIONAL PLACEHOLDER DATA only"
- "DO NOT use these values for real clinical analysis"

The customer obtains their licensed value set from EuroQol and drops it at the
path passed via `eq5d_value_set_path`. Parthenon never calls EuroQol APIs and
never relicenses EuroQol IP.

### 4. Utility-index derivation is per-instrument

`pro_base.parse_questionnaire_response` produces item-level rows only.
Computing the utility index (the country-specific weight applied to a
profile string) is instrument-specific and lives in the instrument's
`derive_utility_index` PythonNode. EQ-5D-5L ships full derivation; EQ-5D-3L
ships the parse path and defers utility derivation to Phase 2 (the scaffold's
README is explicit about this).

This split keeps `pro_base` small and instrument-agnostic. Adding PHQ-9 or
PROMIS later means adding a new manifest that imports `pro_base` and supplies
its own scoring function — the shared code doesn't grow per-instrument.

### 5. `person_id` is left NULL on inserted rows

Same posture as ADR 0005 (`etl_dicom_metadata`): cross-mapping the FHIR
`Patient.id` to OMOP `person_id` is a Phase 2 `link_person` template's
responsibility. Inserted rows carry the FHIR patient reference in
`measurement_source_value`-adjacent metadata; downstream linking is an
UPDATE step.

### 6. Cross-instrument regression test

`tests/unit/test_pro_pattern_reuse.py` parametrizes over the list of PRO
instrument manifests and asserts each one:

- Imports `runtime.instruments.pro_base` in at least one PythonNode.
- Uses `fhir_resource` for ingestion.
- Declares `eq5d_value_set_path` (or instrument-specific equivalent).
- Filters by `questionnaire_url`.

Adding a new PRO instrument means appending its manifest_id to the test's
`INSTRUMENTS` list — the structural conformance is automatically gated.

## Consequences

### Positive

- New PRO instruments are a manifest + (optionally) a small scoring function;
  no framework change required.
- `pro_base` is testable as plain Python code, unit-tested in isolation.
- Customer-supplied value sets keep Parthenon out of EuroQol licensing.
- Two-instrument acceptance criterion is met today; cross-instrument test
  guards future regressions.

### Negative

- Some duplication across instrument manifests (~50 lines each). Acceptable.
- Customers see two files per instrument (manifest + README) instead of one
  parameterized template. Acceptable: discoverability > minimization.
- The EQ-5D-3L scaffold's deferred utility derivation is technical debt for
  Phase 2. Tracked in the scaffold's README explicitly.

## Alternatives considered (declined)

- **Manifest-level `extends:` feature.** Rejected: too much architectural
  surface for a small DRY win; revisit if 5+ PRO instruments materialize.
- **Single `qr_eq5d_to_measurement` parameterized by `variant: 3L|5L`.**
  Rejected: hides which instrument the user selected; complicates
  validation packs; conflates two licensing surfaces (3L and 5L are
  separate EuroQol value sets).
- **`pro_base` ships ready-made instrument definitions for all four PROs.**
  Rejected: forces a single Python module to evolve every time an instrument
  is added; per-instrument manifests are a cleaner extension point.

## References

- Phase 1 design spec: `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 3 (this plan): `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-3-pro.md`
- Devplan T-011: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` lines 450–467
- EQ-5D instruments & value sets: <https://euroqol.org/eq-5d-instruments/>
- FHIR `QuestionnaireResponse`: <https://hl7.org/fhir/R4/questionnaireresponse.html>
- Phase 0 Materializer (parameter interpolation): `templates/runtime/registry/materializer.py`
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 6 ADR cases.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0006-pro-instrument-framework.md templates/tests/test_adrs.py
git commit -m "docs(adr): ADR 0006 — PRO instrument framework design"
```

---

## Definition of Done — Plan 3

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; lists 8 manifests now (4 from Phase 0 + 2 from Plan 2 + 2 from Plan 3).
- [ ] `parthenon-templates lint-secret-keys --root manifests` clean.
- [ ] `pytest -q` (full suite) green; new tests for `pro_base`, value-set helper, both manifests, validation pack, and cross-instrument pattern all pass.
- [ ] `pytest -m integration tests/e2e/test_qr_eq5d5l_to_measurement.py` passes against Postgres testcontainer.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow runs the EQ-5D-5L E2E.
- [ ] All 6 ADRs (0001–0006) pass `tests/test_adrs.py`.
- [ ] `runtime.instruments.pro_base` is imported by both `qr_eq5d5l_to_measurement` and `qr_eq5d3l_to_measurement` manifests.
- [ ] Placeholder value-set CSVs are clearly marked as placeholder data and reference the EuroQol obligation.

## Branch model

- Branch off the Plan 1 branch tip into `feature/phase-1-templates-pro`.
- Sequential commits per task; one task = one commit.
- 10 commits expected.
- DO NOT push; orchestrator handles push.

## Out of scope (handled by other Plans)

- FhirResourceNode itself (Plan 1)
- EQ-5D-3L utility-index derivation (Phase 2 follow-up; tracked in scaffold README)
- PHQ-9, GAD-7, PROMIS, KCCQ-12 templates (Phase 2 PRO breadth)
- person_id linking via MPI (Phase 2 `link_person` template)
- Real EuroQol-licensed value sets (customer obligation; Parthenon ships placeholders only)
