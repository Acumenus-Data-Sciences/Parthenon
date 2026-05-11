# Parthenon Ingestion Templates — Phase 1, Plan 6: FHIR→OMOP PR-B (Procedures + Medications)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `fhir_to_omop` (Plan 5 PR-A) with the second slice of resources: Procedure → PROCEDURE_OCCURRENCE; MedicationRequest/MedicationStatement/MedicationAdministration/Immunization → DRUG_EXPOSURE. After this plan, customers can ingest the procedural and pharmacological dimensions of FHIR R4 alongside the visit spine.

**Architecture:** Same `runtime.fhir_to_omop` package, same `fhir_to_omop` manifest. New mapper modules per resource type. The manifest grows to ~10 nodes (Plan 5's 7 + 3 new mappers + extended `load_to_cdm`). The IG pin (`v0.1.0-parthenon`) is unchanged from Plan 5 per spec decision Q9.

**Tech Stack:** Same as Plan 5. No new deps.

**Depends on:** Phase 1 Plan 5 (PR-A merged).

**Unblocks:** Phase 1 Plan 7 (PR-C + closeout).

---

## Conventions used throughout this plan

- Same as Plan 5. See its preamble for the full convention list.
- IG pin remains `v0.1.0-parthenon`.
- Per spec Q9, no per-PR pin bump in Phase 1.

---

## Task index (9 tasks)

1. `runtime.fhir_to_omop.procedure`: Procedure → PROCEDURE_OCCURRENCE mapper
2. `runtime.fhir_to_omop.medication`: MedicationRequest → DRUG_EXPOSURE mapper
3. `runtime.fhir_to_omop.medication`: MedicationStatement → DRUG_EXPOSURE mapper (same module, different function)
4. `runtime.fhir_to_omop.medication`: MedicationAdministration → DRUG_EXPOSURE mapper
5. `runtime.fhir_to_omop.immunization`: Immunization → DRUG_EXPOSURE mapper
6. Extend `fhir_to_omop` manifest with PR-B nodes
7. Extend validation pack with PR-B fixtures (Procedure, MedicationRequest, Immunization NDJSON files)
8. `fhir_to_omop` PR-B E2E test
9. Update `fhir_to_omop` README to reflect PR-B scope; ADR 0008 amendment for medication-source-discrimination policy

---

## Task 1: Procedure → PROCEDURE_OCCURRENCE mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/procedure.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_procedure.py`

Mappings:

- `Procedure.subject.reference` → `person_source_value`
- `Procedure.encounter.reference` → `visit_source_value`
- `Procedure.code.coding` → `procedure_concept_id` (try each coding; SNOMED, CPT, ICD-10-PCS likely)
- `Procedure.performedDateTime` / `performedPeriod.start` → `procedure_date(time)`
- `Procedure.id` → `procedure_source_value`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_procedure.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.procedure import map_procedure, ProcedureRow


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE concept ("
            "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
            "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
        ))
        conn.execute(text(
            "INSERT INTO concept VALUES "
            "(2002608, 'Appendectomy', 'CPT4', '44950', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_procedure_with_cpt_code(engine) -> None:
    fhir = {
        "resourceType": "Procedure", "id": "pr1", "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "44950"}]},
        "performedDateTime": "2026-04-01T10:00:00Z",
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert isinstance(proc, ProcedureRow)
    assert proc.procedure_source_value == "pr1"
    assert proc.person_source_value == "p1"
    assert proc.visit_source_value == "e1"
    assert proc.procedure_concept_id == 2002608
    assert proc.procedure_date == "2026-04-01"


def test_map_procedure_with_period(engine) -> None:
    fhir = {
        "resourceType": "Procedure", "id": "pr2", "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "44950"}]},
        "performedPeriod": {"start": "2026-04-01T10:00:00Z", "end": "2026-04-01T12:00:00Z"},
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert proc.procedure_date == "2026-04-01"


def test_map_procedure_missing_subject_raises(engine) -> None:
    fhir = {"resourceType": "Procedure", "id": "pr3", "status": "completed",
            "code": {"coding": [{"code": "x"}]}, "performedDateTime": "2026-04-01"}
    with pytest.raises(ValueError, match="subject"):
        map_procedure(fhir, _resolver(engine))


def test_map_procedure_unmapped_code(engine) -> None:
    fhir = {
        "resourceType": "Procedure", "id": "pr4", "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "99999"}]},
        "performedDateTime": "2026-04-01",
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert proc.procedure_concept_id == 0
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_procedure.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/fhir_to_omop/procedure.py
"""Procedure → OMOP PROCEDURE_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class ProcedureRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    procedure_source_value: str
    person_source_value: str
    visit_source_value: str | None
    procedure_concept_id: int
    procedure_source_concept_id: int = 0
    procedure_date: str
    procedure_datetime: str | None
    procedure_type_concept_id: int = 32817  # "EHR Procedure"


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def _ref_id(ref: dict[str, Any] | None) -> str | None:
    if not ref:
        return None
    s = ref.get("reference") or ""
    if "/" in s:
        return s.rsplit("/", 1)[-1]
    return s or None


def map_procedure(resource: dict[str, Any], resolver: ConceptResolver) -> ProcedureRow:
    if resource.get("resourceType") != "Procedure":
        raise ValueError(f"expected Procedure, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Procedure {resource.get('id')!r} missing subject")
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = ((resource.get("code") or {}).get("coding") or [])
    proc_concept_id = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            cid = resolver.resolve(system=sys_, code=code)
            if cid != 0:
                proc_concept_id = cid
                break

    when = resource.get("performedDateTime") or (resource.get("performedPeriod") or {}).get("start")
    proc_date = _date_only(when) or "1970-01-01"
    proc_dt = str(when) if when and "T" in str(when) else None

    return ProcedureRow(
        procedure_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        procedure_concept_id=proc_concept_id,
        procedure_source_concept_id=proc_concept_id,
        procedure_date=proc_date,
        procedure_datetime=proc_dt,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_procedure.py -v`
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
git add templates/runtime/fhir_to_omop/procedure.py templates/tests/unit/test_fhir_to_omop_procedure.py
git commit -m "feat(templates): add fhir_to_omop Procedure -> PROCEDURE_OCCURRENCE mapper"
```

---

## Tasks 2–4: Medication mappers

The three FHIR Medication-* resources all map to OMOP DRUG_EXPOSURE but with different timing semantics:

- **MedicationRequest** — a prescription. `authoredOn` → `drug_exposure_start_date`. `dispenseRequest.expectedSupplyDuration` → `drug_exposure_end_date` if available.
- **MedicationStatement** — patient-reported medication use. `effectivePeriod.start/end` → `drug_exposure_start_date/end_date`.
- **MedicationAdministration** — actual drug administration event. `effectiveDateTime` or `effectivePeriod.start` → `drug_exposure_start_date`.

All three share a common helper `_resolve_medication_concept` that handles either a `medicationCodeableConcept` (inline coding) or a `medicationReference` to a separate Medication resource.

**Files (Tasks 2/3/4 collectively):**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/medication.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_medication.py`

- [ ] **Step 1: Write the failing test (covers all three mappers)**

```python
# templates/tests/unit/test_fhir_to_omop_medication.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.medication import (
    DrugExposureRow,
    map_medication_administration,
    map_medication_request,
    map_medication_statement,
)


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE concept ("
            "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
            "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
        ))
        conn.execute(text(
            "INSERT INTO concept VALUES "
            "(1503297, 'metformin', 'RxNorm', '6809', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_medication_request(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest", "id": "mr1", "status": "active",
        "intent": "order",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "authoredOn": "2026-04-01T10:00:00Z",
    }
    row = map_medication_request(fhir, _resolver(engine))
    assert isinstance(row, DrugExposureRow)
    assert row.drug_concept_id == 1503297
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 32839  # OMOP "EHR prescription"


def test_map_medication_statement(engine) -> None:
    fhir = {
        "resourceType": "MedicationStatement", "id": "ms1", "status": "active",
        "subject": {"reference": "Patient/p1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "effectivePeriod": {"start": "2026-03-01", "end": "2026-04-01"},
    }
    row = map_medication_statement(fhir, _resolver(engine))
    assert row.drug_exposure_start_date == "2026-03-01"
    assert row.drug_exposure_end_date == "2026-04-01"
    assert row.drug_type_concept_id == 38000179  # OMOP "Patient self-reported medication"


def test_map_medication_administration(engine) -> None:
    fhir = {
        "resourceType": "MedicationAdministration", "id": "ma1", "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "context": {"reference": "Encounter/e1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "effectiveDateTime": "2026-04-01T08:00:00Z",
    }
    row = map_medication_administration(fhir, _resolver(engine))
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 38000180  # OMOP "Inpatient administration"


def test_unknown_medication_returns_zero(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest", "id": "mr2", "status": "active", "intent": "order",
        "subject": {"reference": "Patient/p1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "999999"}],
        },
        "authoredOn": "2026-04-01",
    }
    row = map_medication_request(fhir, _resolver(engine))
    assert row.drug_concept_id == 0


def test_medication_request_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest", "id": "mr3", "status": "active", "intent": "order",
        "medicationCodeableConcept": {"coding": [{"system": "x", "code": "y"}]},
        "authoredOn": "2026-04-01",
    }
    with pytest.raises(ValueError, match="subject"):
        map_medication_request(fhir, _resolver(engine))
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_medication.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/fhir_to_omop/medication.py
"""MedicationRequest/Statement/Administration → OMOP DRUG_EXPOSURE mapping.

The three FHIR resources differ in timing semantics and source-of-truth:
- Request: prescription (intent to dispense), authoredOn -> start
- Statement: patient-reported use, effectivePeriod -> start/end
- Administration: actual administration event, effectiveDateTime -> start

All three map to OMOP's DRUG_EXPOSURE table with different drug_type_concept_id:
- Request:        32839       — "EHR prescription"
- Statement:      38000179    — "Patient self-reported medication"
- Administration: 38000180    — "Inpatient administration"
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


DRUG_TYPE_REQUEST = 32839
DRUG_TYPE_STATEMENT = 38000179
DRUG_TYPE_ADMIN = 38000180


class DrugExposureRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    drug_source_value: str
    person_source_value: str
    visit_source_value: str | None
    drug_concept_id: int
    drug_source_concept_id: int = 0
    drug_exposure_start_date: str
    drug_exposure_start_datetime: str | None
    drug_exposure_end_date: str | None
    drug_exposure_end_datetime: str | None
    drug_type_concept_id: int


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def _ref_id(ref: dict[str, Any] | None) -> str | None:
    if not ref:
        return None
    s = ref.get("reference") or ""
    if "/" in s:
        return s.rsplit("/", 1)[-1]
    return s or None


def _resolve_medication_concept(
    resource: dict[str, Any], resolver: ConceptResolver
) -> int:
    """Resolve a medication concept from medicationCodeableConcept.

    medicationReference (pointing at a separate Medication resource) is not
    supported in Phase 1 — surface as 0 + a queue row in PR-C if customers
    need it.
    """
    cc = resource.get("medicationCodeableConcept") or {}
    for coding in cc.get("coding", []) or []:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            cid = resolver.resolve(system=sys_, code=code)
            if cid != 0:
                return cid
    return 0


def _build_row(
    resource: dict[str, Any],
    resolver: ConceptResolver,
    *,
    encounter_field: str,
    drug_type_concept_id: int,
    start_value: str | None,
    end_value: str | None,
) -> DrugExposureRow:
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"{resource.get('resourceType')} {resource.get('id')!r} missing subject")
    visit_source_value = _ref_id(resource.get(encounter_field))
    drug_cid = _resolve_medication_concept(resource, resolver)
    return DrugExposureRow(
        drug_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        drug_concept_id=drug_cid,
        drug_source_concept_id=drug_cid,
        drug_exposure_start_date=_date_only(start_value) or "1970-01-01",
        drug_exposure_start_datetime=str(start_value) if start_value and "T" in str(start_value) else None,
        drug_exposure_end_date=_date_only(end_value),
        drug_exposure_end_datetime=str(end_value) if end_value and "T" in str(end_value) else None,
        drug_type_concept_id=drug_type_concept_id,
    )


def map_medication_request(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationRequest":
        raise ValueError(f"expected MedicationRequest, got {resource.get('resourceType')!r}")
    return _build_row(
        resource,
        resolver,
        encounter_field="encounter",
        drug_type_concept_id=DRUG_TYPE_REQUEST,
        start_value=resource.get("authoredOn"),
        end_value=None,
    )


def map_medication_statement(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationStatement":
        raise ValueError(f"expected MedicationStatement, got {resource.get('resourceType')!r}")
    period = resource.get("effectivePeriod") or {}
    start = period.get("start") or resource.get("effectiveDateTime")
    end = period.get("end")
    return _build_row(
        resource,
        resolver,
        encounter_field="context",
        drug_type_concept_id=DRUG_TYPE_STATEMENT,
        start_value=start,
        end_value=end,
    )


def map_medication_administration(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationAdministration":
        raise ValueError(f"expected MedicationAdministration, got {resource.get('resourceType')!r}")
    period = resource.get("effectivePeriod") or {}
    start = resource.get("effectiveDateTime") or period.get("start")
    end = period.get("end")
    return _build_row(
        resource,
        resolver,
        encounter_field="context",
        drug_type_concept_id=DRUG_TYPE_ADMIN,
        start_value=start,
        end_value=end,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_medication.py -v`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit (one commit covers Tasks 2/3/4 since they share a module)**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/medication.py templates/tests/unit/test_fhir_to_omop_medication.py
git commit -m "feat(templates): add fhir_to_omop Medication{Request,Statement,Administration} mappers"
```

---

## Task 5: Immunization → DRUG_EXPOSURE mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/immunization.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_immunization.py`

Mappings:

- `Immunization.patient.reference` → `person_source_value`
- `Immunization.encounter.reference` → `visit_source_value`
- `Immunization.vaccineCode.coding` → `drug_concept_id` (CVX preferred; fallback RxNorm)
- `Immunization.occurrenceDateTime` → `drug_exposure_start_date(time)`
- `Immunization.id` → `drug_source_value`
- `drug_type_concept_id`: `581452` ("Immunization")

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_immunization.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.immunization import map_immunization


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE concept ("
            "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
            "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
        ))
        conn.execute(text(
            "INSERT INTO concept VALUES "
            "(45769446, 'Influenza vaccine', 'CVX', '141', 'S')"
        ))
    return eng


def _resolver(engine):
    # CVX system is in the IG snapshot; ensure the test resolver knows it.
    # For this test we hardcode an override since the IG snapshot doesn't yet
    # include CVX. (PR-C may add CVX to the snapshot — for now we rely on
    # the resolver's strict=False behavior to allow custom overrides.)
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_immunization_with_cvx(engine, monkeypatch) -> None:
    """Add CVX to the IG snapshot for this test."""
    from runtime.fhir_to_omop import concept_resolver as cr_mod
    cr_mod._ig_snapshot.cache_clear()
    snapshot = cr_mod._ig_snapshot()
    snapshot["system_to_vocabulary"]["http://hl7.org/fhir/sid/cvx"] = "CVX"
    monkeypatch.setattr(cr_mod, "_ig_snapshot", lambda: snapshot)

    fhir = {
        "resourceType": "Immunization", "id": "i1", "status": "completed",
        "patient": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "vaccineCode": {"coding": [{"system": "http://hl7.org/fhir/sid/cvx", "code": "141"}]},
        "occurrenceDateTime": "2026-04-01T08:00:00Z",
    }
    row = map_immunization(fhir, ConceptResolver(engine=engine, vocab_schema="main"))
    assert row.drug_source_value == "i1"
    assert row.drug_concept_id == 45769446
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 581452


def test_map_immunization_missing_patient_raises(engine) -> None:
    fhir = {
        "resourceType": "Immunization", "id": "i2", "status": "completed",
        "vaccineCode": {"coding": [{"system": "x", "code": "y"}]},
        "occurrenceDateTime": "2026-04-01",
    }
    with pytest.raises(ValueError, match="patient"):
        map_immunization(fhir, ConceptResolver(engine=engine, vocab_schema="main"))
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_immunization.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Add CVX to `runtime/fhir_to_omop/ig/v0.1.0-parthenon.json` permanently:

```json
"system_to_vocabulary": {
    ...,
    "http://hl7.org/fhir/sid/cvx": "CVX",
    ...
}
```

(Apply this edit to the IG file. The test currently monkeypatches it; updating the file removes that need.)

`templates/runtime/fhir_to_omop/immunization.py`:

```python
"""Immunization → OMOP DRUG_EXPOSURE mapping."""

from __future__ import annotations

from typing import Any

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.medication import DrugExposureRow

DRUG_TYPE_IMMUNIZATION = 581452


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def _ref_id(ref: dict[str, Any] | None) -> str | None:
    if not ref:
        return None
    s = ref.get("reference") or ""
    if "/" in s:
        return s.rsplit("/", 1)[-1]
    return s or None


def map_immunization(resource: dict[str, Any], resolver: ConceptResolver) -> DrugExposureRow:
    if resource.get("resourceType") != "Immunization":
        raise ValueError(f"expected Immunization, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("patient"))
    if not person_source_value:
        raise ValueError(f"Immunization {resource.get('id')!r} missing patient")
    visit_source_value = _ref_id(resource.get("encounter"))
    coding_list = ((resource.get("vaccineCode") or {}).get("coding") or [])
    cid = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            resolved = resolver.resolve(system=sys_, code=code)
            if resolved != 0:
                cid = resolved
                break
    when = resource.get("occurrenceDateTime")
    return DrugExposureRow(
        drug_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        drug_concept_id=cid,
        drug_source_concept_id=cid,
        drug_exposure_start_date=_date_only(when) or "1970-01-01",
        drug_exposure_start_datetime=str(when) if when and "T" in str(when) else None,
        drug_exposure_end_date=None,
        drug_exposure_end_datetime=None,
        drug_type_concept_id=DRUG_TYPE_IMMUNIZATION,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_immunization.py -v`
Expected: PASS — 2 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/immunization.py \
        templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json \
        templates/tests/unit/test_fhir_to_omop_immunization.py
git commit -m "feat(templates): add fhir_to_omop Immunization -> DRUG_EXPOSURE mapper + CVX in IG"
```

---

## Task 6: Extend `fhir_to_omop` manifest with PR-B nodes

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_to_omop/manifest.yaml`

Adds three new mapping nodes (`map_procedures`, `map_medications`, `map_immunizations`) and extends `load_to_cdm` to also INSERT into `procedure_occurrence` and `drug_exposure`. The `ingest_fhir` node's `resource_types` array grows.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_fhir_to_omop_manifest.py

def test_manifest_pr_b_imports() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.procedure",
        "runtime.fhir_to_omop.medication",
        "runtime.fhir_to_omop.immunization",
    ):
        assert module in text


def test_manifest_pr_b_resource_types_in_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    ingest = next(n for n in payload["spec"]["nodes"] if n["node_id"] == "ingest_fhir")
    rt = ingest["params"]["resource_types"]
    for resource in (
        "Patient", "Encounter", "Condition", "Observation",
        "Procedure", "MedicationRequest", "MedicationStatement",
        "MedicationAdministration", "Immunization",
    ):
        assert resource in rt


def test_manifest_pr_b_load_targets_drug_exposure_and_procedure() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "procedure_occurrence" in text
    assert "drug_exposure" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Modify the manifest:

1. In `ingest_fhir.params.resource_types`, append `Procedure`, `MedicationRequest`, `MedicationStatement`, `MedicationAdministration`, `Immunization`.
2. After `map_observations`, add three new nodes (each follows the Plan 5 mapper-node pattern):

```yaml
    - node_id: map_procedures
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.procedure import map_procedure

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "procedure.parquet"
              if not upstream.exists():
                  return {"procedures_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  rows.append(map_procedure(dict(raw), resolver).model_dump())
              (context.artifact_dir / "procedures.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"procedures_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: map_medications
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.medication import (
              map_medication_administration, map_medication_request, map_medication_statement,
          )

          def main(context, params):
              base = context.artifact_dir.parent / "ingest_fhir"
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for fname, mapper in [
                  ("medicationrequest.parquet", map_medication_request),
                  ("medicationstatement.parquet", map_medication_statement),
                  ("medicationadministration.parquet", map_medication_administration),
              ]:
                  pq = base / fname
                  if not pq.exists():
                      continue
                  for raw in pl.read_parquet(pq).iter_rows(named=True):
                      rows.append(mapper(dict(raw), resolver).model_dump())
              (context.artifact_dir / "drug_exposures_meds.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"drug_exposures_meds_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: map_immunizations
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.immunization import map_immunization

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "immunization.parquet"
              if not upstream.exists():
                  return {"drug_exposures_imm_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  rows.append(map_immunization(dict(raw), resolver).model_dump())
              (context.artifact_dir / "drug_exposures_imm.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"drug_exposures_imm_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"
```

3. Update `load_to_cdm.depends_on` to include the three new nodes, and append PR-B INSERT logic:

```yaml
    - node_id: load_to_cdm
      type: python
      depends_on:
        - map_patients
        - map_encounters
        - map_conditions
        - map_observations
        - map_procedures
        - map_medications
        - map_immunizations
      params:
        code: |
          # ... existing PR-A code ...
          procedures = json.loads((base / "map_procedures" / "procedures.json").read_text(encoding="utf-8")) if (base / "map_procedures" / "procedures.json").exists() else []
          drug_meds = json.loads((base / "map_medications" / "drug_exposures_meds.json").read_text(encoding="utf-8")) if (base / "map_medications" / "drug_exposures_meds.json").exists() else []
          drug_imm = json.loads((base / "map_immunizations" / "drug_exposures_imm.json").read_text(encoding="utf-8")) if (base / "map_immunizations" / "drug_exposures_imm.json").exists() else []

          # ... existing inserts for person/visit/condition/measurement/observation ...

          n_proc = n_drug = 0
          with engine.begin() as conn:
              # PROCEDURE_OCCURRENCE
              for p in procedures:
                  pid = pid_map.get(p["person_source_value"])
                  if pid is None:
                      continue
                  vid = vid_map.get(p["visit_source_value"]) if p["visit_source_value"] else None
                  conn.execute(text(
                      f"INSERT INTO {schema}.procedure_occurrence "
                      f"(procedure_occurrence_id, person_id, procedure_concept_id, "
                      f"procedure_date, procedure_datetime, procedure_type_concept_id, "
                      f"procedure_source_value, procedure_source_concept_id, visit_occurrence_id) "
                      f"VALUES (DEFAULT, :pid, :pc, :pd, :pdt, :ptc, :psv, :psc, :vid)"
                  ), {
                      "pid": pid, "pc": p["procedure_concept_id"], "pd": p["procedure_date"],
                      "pdt": p["procedure_datetime"], "ptc": p["procedure_type_concept_id"],
                      "psv": p["procedure_source_value"], "psc": p["procedure_source_concept_id"],
                      "vid": vid,
                  })
                  n_proc += 1

              # DRUG_EXPOSURE — meds + immunizations
              for d in drug_meds + drug_imm:
                  pid = pid_map.get(d["person_source_value"])
                  if pid is None:
                      continue
                  vid = vid_map.get(d["visit_source_value"]) if d["visit_source_value"] else None
                  conn.execute(text(
                      f"INSERT INTO {schema}.drug_exposure "
                      f"(drug_exposure_id, person_id, drug_concept_id, "
                      f"drug_exposure_start_date, drug_exposure_start_datetime, "
                      f"drug_exposure_end_date, drug_exposure_end_datetime, "
                      f"drug_type_concept_id, drug_source_value, drug_source_concept_id, "
                      f"visit_occurrence_id) "
                      f"VALUES (DEFAULT, :pid, :dc, :dsd, :dsdt, :ded, :dedt, :dtc, :dsv, :dsc, :vid)"
                  ), {
                      "pid": pid, "dc": d["drug_concept_id"],
                      "dsd": d["drug_exposure_start_date"],
                      "dsdt": d["drug_exposure_start_datetime"],
                      "ded": d["drug_exposure_end_date"], "dedt": d["drug_exposure_end_datetime"],
                      "dtc": d["drug_type_concept_id"], "dsv": d["drug_source_value"],
                      "dsc": d["drug_source_concept_id"], "vid": vid,
                  })
                  n_drug += 1

          return {
              "persons": n_persons, "visits": n_visits, "conditions": n_conds,
              "measurements": n_meas, "observations": n_obs,
              "procedures": n_proc, "drug_exposures": n_drug,
          }
```

4. Update `summarize.fetch_query` to include the new tables:

```sql
SELECT
  (SELECT COUNT(*) FROM ${parameters.target_schema}.person) AS persons,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.visit_occurrence) AS visits,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.condition_occurrence) AS conditions,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.measurement) AS measurements,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.observation) AS observations,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.procedure_occurrence) AS procedures,
  (SELECT COUNT(*) FROM ${parameters.target_schema}.drug_exposure) AS drug_exposures
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v && uv run parthenon-templates validate-manifests --root manifests`

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/fhir_to_omop/manifest.yaml templates/tests/unit/test_fhir_to_omop_manifest.py
git commit -m "feat(templates): extend fhir_to_omop manifest with PR-B (Procedure/Medication/Immunization)"
```

---

## Task 7: Extend validation pack with PR-B fixtures

**Files:**
- Create: `templates/manifests/fhir_to_omop/fixtures/sample/Procedure.ndjson`
- Create: `templates/manifests/fhir_to_omop/fixtures/sample/MedicationRequest.ndjson`
- Create: `templates/manifests/fhir_to_omop/fixtures/sample/Immunization.ndjson`
- Modify: `templates/manifests/fhir_to_omop/validation/expected/post_conditions.yaml`
- Modify: `templates/manifests/fhir_to_omop/validation/dqd_checks.yaml`

Pattern: small NDJSON files (1-2 resources each) referencing the existing patient/encounter fixtures from PR-A. Update `expected/post_conditions.yaml` to assert non-zero `procedure_occurrence` and `drug_exposure` row counts.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_fhir_to_omop_manifest.py

def test_pr_b_fixtures_present() -> None:
    fixtures = MANIFEST.parent / "fixtures" / "sample"
    for f in ("Procedure.ndjson", "MedicationRequest.ndjson", "Immunization.ndjson"):
        assert (fixtures / f).exists(), f"missing PR-B fixture: {f}"


def test_pr_b_post_conditions_added() -> None:
    pc = _yaml.safe_load((MANIFEST.parent / "validation" / "expected" / "post_conditions.yaml").read_text("utf-8"))
    tables = {p.get("table") for p in pc["post_conditions"]}
    assert any("procedure_occurrence" in str(t) for t in tables)
    assert any("drug_exposure" in str(t) for t in tables)
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`fixtures/sample/Procedure.ndjson`:

```json
{"resourceType":"Procedure","id":"pr1","status":"completed","subject":{"reference":"Patient/p1"},"encounter":{"reference":"Encounter/e1"},"code":{"coding":[{"system":"http://www.ama-assn.org/go/cpt","code":"44950"}]},"performedDateTime":"2026-04-01T10:00:00Z"}
```

`fixtures/sample/MedicationRequest.ndjson`:

```json
{"resourceType":"MedicationRequest","id":"mr1","status":"active","intent":"order","subject":{"reference":"Patient/p1"},"encounter":{"reference":"Encounter/e1"},"medicationCodeableConcept":{"coding":[{"system":"http://www.nlm.nih.gov/research/umls/rxnorm","code":"6809"}]},"authoredOn":"2026-04-01T09:00:00Z"}
```

`fixtures/sample/Immunization.ndjson`:

```json
{"resourceType":"Immunization","id":"i1","status":"completed","patient":{"reference":"Patient/p1"},"encounter":{"reference":"Encounter/e1"},"vaccineCode":{"coding":[{"system":"http://hl7.org/fhir/sid/cvx","code":"141"}]},"occurrenceDateTime":"2026-04-01T08:00:00Z"}
```

Append to `validation/expected/post_conditions.yaml`:

```yaml
  - kind: row_count
    table: omop.procedure_occurrence
    min: 1
    description: "PR-B: Procedure → PROCEDURE_OCCURRENCE"
  - kind: row_count
    table: omop.drug_exposure
    min: 2
    description: "PR-B: MedicationRequest + Immunization → DRUG_EXPOSURE (≥2)"
```

Append to `validation/dqd_checks.yaml`:

```yaml
  - check_id: pr_b_drug_type_concepts_known
    description: "Every drug_exposure row has a recognized drug_type_concept_id."
    sql: |
      SELECT COUNT(*) AS violations
      FROM omop.drug_exposure
      WHERE drug_type_concept_id NOT IN (32839, 38000179, 38000180, 581452)
    expected: 0
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v`
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
git add templates/manifests/fhir_to_omop/fixtures/sample/Procedure.ndjson \
        templates/manifests/fhir_to_omop/fixtures/sample/MedicationRequest.ndjson \
        templates/manifests/fhir_to_omop/fixtures/sample/Immunization.ndjson \
        templates/manifests/fhir_to_omop/validation/expected/post_conditions.yaml \
        templates/manifests/fhir_to_omop/validation/dqd_checks.yaml
git commit -m "feat(templates): extend fhir_to_omop validation pack with PR-B fixtures"
```

---

## Task 8: PR-B E2E test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_fhir_to_omop_prb.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

Same pattern as Plan 5 Task 10 but seeded with the larger fixture corpus and asserting non-zero PROCEDURE_OCCURRENCE / DRUG_EXPOSURE counts.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_fhir_to_omop_prb.py
"""E2E: fhir_to_omop with PR-A + PR-B resources."""
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
MANIFEST_DIR = REPO / "manifests" / "fhir_to_omop"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _seed_vocab(engine) -> None:
    """Seed the minimum vocab.concept rows the PR-A + PR-B fixture needs."""
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO vocab.concept (
                concept_id, concept_name, vocabulary_id, concept_code, standard_concept,
                concept_class_id, domain_id, valid_start_date, valid_end_date
            ) VALUES
              (8507, 'MALE', 'Gender', 'M', 'S', 'Gender', 'Gender', '1970-01-01', '2099-12-31'),
              (8532, 'FEMALE', 'Gender', 'F', 'S', 'Gender', 'Gender', '1970-01-01', '2099-12-31'),
              (4267416, 'Hypertension', 'SNOMED', '38341003', 'S', 'Clinical Finding', 'Condition', '1970-01-01', '2099-12-31'),
              (3004249, 'Systolic blood pressure', 'LOINC', '8480-6', 'S', 'Clinical Observation', 'Measurement', '1970-01-01', '2099-12-31'),
              (2002608, 'Appendectomy', 'CPT4', '44950', 'S', 'CPT4', 'Procedure', '1970-01-01', '2099-12-31'),
              (1503297, 'metformin', 'RxNorm', '6809', 'S', 'Ingredient', 'Drug', '1970-01-01', '2099-12-31'),
              (45769446, 'Influenza vaccine', 'CVX', '141', 'S', 'CVX', 'Drug', '1970-01-01', '2099-12-31')
        """))


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.3)
    return "timeout"


@pytest.mark.integration
def test_fhir_to_omop_pr_b_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    src_fixtures = MANIFEST_DIR / "fixtures" / "sample"
    for f in src_fixtures.glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        _seed_vocab(engine)

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

        r = client.post(
            "/runs",
            json={
                "template_id": "fhir_to_omop",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "fhir-to-omop-pr-b",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            persons = conn.execute(text("SELECT COUNT(*) FROM omop.person")).scalar()
            visits = conn.execute(text("SELECT COUNT(*) FROM omop.visit_occurrence")).scalar()
            procedures = conn.execute(text("SELECT COUNT(*) FROM omop.procedure_occurrence")).scalar()
            drugs = conn.execute(text("SELECT COUNT(*) FROM omop.drug_exposure")).scalar()
        assert persons == 2
        assert visits == 2
        assert procedures == 1  # 1 Procedure fixture
        assert drugs == 2       # 1 MedicationRequest + 1 Immunization
```

- [ ] **Step 2: Run test to verify it fails or works**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_fhir_to_omop_prb.py -v`

Iterate against any manifest issues.

- [ ] **Step 3: Update CI workflow**

```yaml
      - name: fhir_to_omop PR-B E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_fhir_to_omop_prb.py -v -m integration
```

- [ ] **Step 4: Verify**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_fhir_to_omop_prb.py -v
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
git add templates/tests/e2e/test_fhir_to_omop_prb.py .github/workflows/templates.yml
git commit -m "test(templates): add fhir_to_omop PR-B E2E test in CI"
```

---

## Task 9: Update README + ADR 0008 amendment

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_to_omop/README.md`
- Modify: `/home/smudoshi/Github/Parthenon/docs/adr/0008-fhir-to-omop-architecture.md`

Updates:

1. README — drop the "PR-A only" note from Limitations; add a new section listing the PR-B-supported resource types and their target tables; document the medication-source-discrimination policy (different drug_type_concept_id per source).
2. ADR 0008 — add an "Amendment 2026-05-03 (PR-B)" section documenting:
   - The decision to use distinct `drug_type_concept_id` values for Request/Statement/Administration/Immunization (not collapsing them).
   - The decision NOT to support `medicationReference` (pointing at a separate Medication resource) in Phase 1 — out-of-scope for PR-B. Surface as queue row in PR-C if customers need it.
   - Confirmation that the IG pin (`v0.1.0-parthenon`) holds across PR-A and PR-B.

Test: `tests/test_adrs.py` already includes 0008 from Plan 5; no new ADR file. Just verify the file exists.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_fhir_to_omop_manifest.py

def test_readme_documents_pr_b_resources() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for resource in ("Procedure", "MedicationRequest", "Immunization"):
        assert resource in text


def test_adr_0008_has_pr_b_amendment() -> None:
    adr = REPO / "docs" / "adr" / "0008-fhir-to-omop-architecture.md"
    text = adr.read_text(encoding="utf-8")
    assert "PR-B" in text or "Procedure" in text
    assert "drug_type_concept_id" in text
```

(Note: REPO is defined at top of the test file.)

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Edit the README's "Limitations" section to remove the "PR-A only" note. Add a new "Supported FHIR resources (Phase 1)" section listing:

```markdown
## Supported FHIR resources (Phase 1)

| FHIR Resource | OMOP Target Table | drug_type_concept_id | Notes |
|---|---|---|---|
| Patient | PERSON | n/a | US Core race/ethnicity extensions resolved if present |
| Encounter | VISIT_OCCURRENCE | n/a | class.code → visit_concept_id via IG snapshot |
| Condition | CONDITION_OCCURRENCE | n/a | First resolvable coding wins |
| Observation | MEASUREMENT or OBSERVATION | n/a | Split by FHIR category |
| Procedure | PROCEDURE_OCCURRENCE | n/a | Performed via dateTime or Period |
| MedicationRequest | DRUG_EXPOSURE | 32839 (EHR prescription) | authoredOn → start |
| MedicationStatement | DRUG_EXPOSURE | 38000179 (Patient self-reported) | effectivePeriod → start/end |
| MedicationAdministration | DRUG_EXPOSURE | 38000180 (Inpatient administration) | effectiveDateTime → start |
| Immunization | DRUG_EXPOSURE | 581452 (Immunization) | vaccineCode (CVX) → drug_concept_id |
| DiagnosticReport | (PR-C, Plan 7) | — | — |
| Consent | (PR-C, Plan 7) | — | — |
```

Append to `docs/adr/0008-fhir-to-omop-architecture.md`:

```markdown
## Amendment — 2026-05-03 (PR-B: Procedure + Medication + Immunization)

### New decisions

- **Distinct `drug_type_concept_id` per FHIR Medication source**. The four
  FHIR resources (MedicationRequest, MedicationStatement,
  MedicationAdministration, Immunization) all map to OMOP DRUG_EXPOSURE,
  but they describe different pharmacological events. We preserve that
  distinction by using distinct OMOP standard `drug_type_concept_id`
  values:
  - 32839 — EHR prescription (Request)
  - 38000179 — Patient self-reported medication (Statement)
  - 38000180 — Inpatient administration (Administration)
  - 581452 — Immunization (Immunization)

  Rationale: collapsing these would lose the request-vs-administration
  distinction that downstream cohort definitions need.

- **`medicationReference` is NOT supported in Phase 1**. FHIR allows a
  Medication-* resource to reference a separate `Medication` resource via
  `medicationReference`. PR-B only handles `medicationCodeableConcept`
  (inline coding). When a resource uses `medicationReference`, the mapper
  returns `drug_concept_id = 0` and surfaces the unmapped concept via the
  `unmapped_concepts_queue`. PR-C may add `medicationReference`
  resolution if customers need it.

- **CVX added to the IG snapshot.** The pinned `v0.1.0-parthenon` IG
  snapshot was extended with the CVX system → vocabulary mapping during
  Plan 6 Task 5. This is a content-only addition (no schema change) and
  not considered an IG version bump.

- **IG pin unchanged across PR-A and PR-B**. Per spec decision Q9,
  the `v0.1.0-parthenon` pin holds for the entire Phase 1
  fhir_to_omop work. No bump in PR-B.

### Implementation notes

- All four medication mappers share `_resolve_medication_concept` and
  `_build_row` helpers in `runtime.fhir_to_omop.medication`. The
  Immunization mapper imports `DrugExposureRow` from this module to
  avoid a parallel type.

- The manifest's `map_medications` node concatenates output from all
  three Medication-* upstreams into a single `drug_exposures_meds.json`
  artifact. The `load_to_cdm` node treats meds and immunizations
  uniformly when INSERTing into DRUG_EXPOSURE.

### Testing

- Per-resource unit tests (Plan 6 Tasks 1, 2-4, 5) cover the mapping
  semantics in isolation against in-memory SQLite.
- The PR-B E2E test (Plan 6 Task 8) covers the manifest end-to-end
  against a Postgres testcontainer with seeded vocab.concept rows.
- The IG-snapshot CVX addition is verified by the immunization unit
  test resolving the CVX `141` code.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py tests/test_adrs.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/fhir_to_omop/README.md docs/adr/0008-fhir-to-omop-architecture.md
git commit -m "docs(templates): update fhir_to_omop README + ADR 0008 amendment for PR-B"
```

---

## Definition of Done — Plan 6 (PR-B)

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; manifest count unchanged from Plan 5 (the `fhir_to_omop` manifest grew rather than a new manifest being added).
- [ ] `pytest -q` (full suite) green; new tests for procedure/medication/immunization mappers and PR-B fixture additions all pass.
- [ ] `pytest -m integration tests/e2e/test_fhir_to_omop_prb.py` passes against Postgres testcontainer.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow runs both PR-A and PR-B E2E.
- [ ] All 8 ADRs (0001–0008) pass `tests/test_adrs.py`; ADR 0008 has the PR-B amendment section.
- [ ] PR-B E2E populates PROCEDURE_OCCURRENCE (≥1) and DRUG_EXPOSURE (≥2) alongside the PR-A tables.
- [ ] CVX in IG snapshot is committed.

## Branch model

- Branch off Plan 5 branch tip into `feature/phase-1-templates-fhir-to-omop-prb`.
- 9 commits expected (one per task; Tasks 2-4 share a single commit because they share a module).
- DO NOT push from a subagent.

## Out of scope (handled by Plan 7)

- DiagnosticReport, Consent (PR-C)
- `medicationReference` resolution (PR-C if needed)
- Performance harness (1M Observations < 10 min, Plan 7)
- Optional Rust-assisted bulk export (Plan 7, conditional)
- Phase 1 closeout docs (security review, DoD verification, devlog, runbook, sign-off — Plan 7)
