# Parthenon Ingestion Templates — Phase 1, Plan 5: FHIR→OMOP PR-A (Visit Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first reviewable slice of `fhir_to_omop` — the visit-spine resources: Patient, Encounter, Condition, Observation. After this plan, customers can ingest FHIR R4 → OMOP CDM PERSON, VISIT_OCCURRENCE, CONDITION_OCCURRENCE, MEASUREMENT, and OBSERVATION (the latter two split correctly). Plan 6 adds Procedure/Medication; Plan 7 adds DiagnosticReport/Consent + performance path + Phase 1 closeout.

**Architecture:** A new shared package `runtime.fhir_to_omop` (loader-style mapping helpers, FHIRPath extractors, concept resolution). One manifest at `templates/manifests/fhir_to_omop/` with a `pr_a` scope flag (Plans 6 and 7 extend the same manifest with new node types and re-validate). Per spec decision Q9, the HL7 FHIR-OMOP IG version is **pinned at `Phase 1 reference v0.1.0`** — single pin across A/B/C. Per spec decision Q3, profile conflicts **fail loudly**. Performance target deferred to Plan 7 (where the full pipeline can be benchmarked end-to-end).

**Tech Stack:** Phase 0 toolchain. Reuses Plan 1's `FhirResourceNode` for ingestion. Concept lookups via SQLAlchemy against the existing `vocab.concept` table (Athena standards) plus optional Parthenon-Imaging (Plan 2). For unmapped concepts, a fallback path writes a row to a stub mapping queue table that the existing Laravel `MappingReviewController` flow (Phase 0 untouched) consumes — Phase 1 does NOT call into AI mapping.

**Tech Stack:** Same as prior plans. New deps: `fhirpath==0.10.5` (Python FHIRPath evaluator) for path extraction.

**Depends on:** Phase 1 Plan 1 (`FhirResourceNode`, profile packs, manifest schema).

**Unblocks:** Phase 1 Plan 6 (FHIR→OMOP PR-B), Plan 7 (PR-C + closeout).

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest`. Integration tests marked `@pytest.mark.integration`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, `mypy --strict runtime/`, and `parthenon-templates validate-manifests --root manifests` before commit.
- **Branch model:** sequential commits on the Plan 5 branch; one task = one commit.
- **HL7 FHIR-OMOP IG pin:** `v0.1.0-parthenon` (curated snapshot in `templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json`). Bumps require a new ADR amending 0008.
- **Type names** stable: `FhirToOmopError`, `ResourceMapper`, `ConceptResolver`, `UnmappedConceptError`, `MappingQueueRow`.

---

## Task index (12 tasks)

1. `runtime.fhir_to_omop` package skeleton + concept resolver + IG snapshot file
2. `runtime.fhir_to_omop.patient`: Patient → PERSON mapper
3. `runtime.fhir_to_omop.encounter`: Encounter → VISIT_OCCURRENCE mapper
4. `runtime.fhir_to_omop.condition`: Condition → CONDITION_OCCURRENCE mapper
5. `runtime.fhir_to_omop.observation`: Observation → MEASUREMENT vs OBSERVATION splitter
6. Unmapped-concept fallback: `unmapped_concepts` queue table + writer helper
7. `fhir_to_omop` manifest (PR-A: Patient/Encounter/Condition/Observation only)
8. `fhir_to_omop` validation pack and FHIR fixture (PR-A scope)
9. `fhir_to_omop` README (PR-A; Plans 6/7 extend)
10. `fhir_to_omop` E2E test in CI (PR-A scope)
11. Cross-resource referential integrity test (no orphaned VISIT_OCCURRENCE.person_id)
12. ADR 0008 — fhir_to_omop architecture and IG pin

---

## Task 1: `runtime.fhir_to_omop` package skeleton

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/concept_resolver.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/errors.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_concept_resolver.py`

The `ConceptResolver` class wraps SQLAlchemy concept lookups: given a `(system, code)` pair (e.g. SNOMED `271737000`), return the OMOP standard `concept_id`. On miss, optionally write to the unmapped-concept queue (Task 6) and return a sentinel `0` (OMOP "no matching concept").

The IG snapshot is a JSON file pinning the FHIR-OMOP mappings used by all PR-A/B/C mappers. It maps FHIR ValueSet/CodeSystem URIs to OMOP `vocabulary_id` and codes. Pinned at Phase 1 v0.1.0; bumps are deliberate manifest+ADR updates.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_concept_resolver.py
"""ConceptResolver: looks up OMOP concept_id from FHIR (system, code) pairs."""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import (
    ConceptResolver,
    UnmappedConceptError,
)


@pytest.fixture()
def engine():
    """In-memory sqlite mimic with a tiny vocab.concept table."""
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text("""
            CREATE TABLE concept (
                concept_id INTEGER PRIMARY KEY,
                concept_name TEXT,
                vocabulary_id TEXT,
                concept_code TEXT,
                standard_concept TEXT
            )
        """))
        conn.execute(text(
            "INSERT INTO concept VALUES "
            "(4267416, 'Hypertensive disorder', 'SNOMED', '38341003', 'S'), "
            "(4112343, 'Asthma', 'SNOMED', '195967001', 'S'), "
            "(8507, 'MALE', 'Gender', 'M', 'S'), "
            "(8532, 'FEMALE', 'Gender', 'F', 'S')"
        ))
    return eng


def test_resolver_finds_known_concept(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main")  # sqlite default schema
    cid = r.resolve(system="http://snomed.info/sct", code="38341003")
    assert cid == 4267416


def test_resolver_returns_zero_for_unknown_when_strict_false(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=False)
    cid = r.resolve(system="http://snomed.info/sct", code="999999999")
    assert cid == 0


def test_resolver_raises_for_unknown_when_strict_true(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=True)
    with pytest.raises(UnmappedConceptError):
        r.resolve(system="http://snomed.info/sct", code="999999999")


def test_resolver_caches_repeated_lookups(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main")
    a = r.resolve(system="http://snomed.info/sct", code="38341003")
    # Same lookup again — should hit cache (we can't directly observe the cache,
    # but we can verify the call is idempotent and fast).
    b = r.resolve(system="http://snomed.info/sct", code="38341003")
    assert a == b == 4267416


def test_resolver_unknown_system_returns_zero(engine) -> None:
    """An unrecognized system URI doesn't crash; it just returns 0."""
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=False)
    cid = r.resolve(system="http://made-up-system.example.com", code="x")
    assert cid == 0


def test_ig_snapshot_exists() -> None:
    ig_path = (
        Path(__file__).resolve().parents[2]
        / "runtime" / "fhir_to_omop" / "ig" / "v0.1.0-parthenon.json"
    )
    assert ig_path.exists()
    import json
    payload = json.loads(ig_path.read_text(encoding="utf-8"))
    assert payload["version"] == "v0.1.0-parthenon"
    assert "system_to_vocabulary" in payload
    assert payload["system_to_vocabulary"]["http://snomed.info/sct"] == "SNOMED"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_concept_resolver.py -v`
Expected: FAIL — package missing.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/__init__.py`: empty.

`templates/runtime/fhir_to_omop/errors.py`:

```python
"""Exceptions raised by the fhir_to_omop mapping layer."""

from __future__ import annotations


class FhirToOmopError(ValueError):
    """Base class for fhir_to_omop mapping errors."""


class UnmappedConceptError(FhirToOmopError):
    """Raised in strict mode when a (system, code) pair has no OMOP concept."""


class ProfileConflictError(FhirToOmopError):
    """Raised when a resource declares meta.profile incompatible with the run's profile.

    Per spec decision Q3, fhir_to_omop fails loudly on profile conflicts.
    """
```

`templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json`:

```json
{
  "version": "v0.1.0-parthenon",
  "pinned_at": "2026-05-03",
  "source_ig": "HL7 FHIR-OMOP Implementation Guide",
  "source_url": "https://github.com/HL7/fhir-omop-ig",
  "source_commit": "<pinned-commit-hash>",
  "system_to_vocabulary": {
    "http://snomed.info/sct": "SNOMED",
    "http://hl7.org/fhir/sid/icd-10-cm": "ICD10CM",
    "http://hl7.org/fhir/sid/icd-10": "ICD10",
    "http://hl7.org/fhir/sid/icd-9-cm": "ICD9CM",
    "http://www.ama-assn.org/go/cpt": "CPT4",
    "http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets": "HCPCS",
    "http://loinc.org": "LOINC",
    "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
    "http://hl7.org/fhir/administrative-gender": "Gender",
    "urn:oid:2.16.840.1.113883.6.238": "Race",
    "http://terminology.hl7.org/CodeSystem/v3-Race": "Race",
    "http://terminology.hl7.org/CodeSystem/v3-Ethnicity": "Ethnicity"
  },
  "encounter_class_to_visit_concept": {
    "AMB": 9202,
    "EMER": 9203,
    "IMP": 9201,
    "OBSENC": 581478,
    "VR": 581399,
    "HH": 38004519
  },
  "observation_split_to_measurement_when_categories": [
    "vital-signs",
    "laboratory",
    "imaging",
    "exam"
  ]
}
```

`templates/runtime/fhir_to_omop/concept_resolver.py`:

```python
"""Resolve FHIR (system, code) pairs to OMOP concept_id via the vocab.concept table.

Caches lookups in-process for the lifetime of the resolver instance. Misses
return 0 (OMOP "no matching concept") in non-strict mode, or raise
UnmappedConceptError in strict mode.

The mapping from FHIR system URIs to OMOP vocabulary_id values comes from the
pinned IG snapshot (templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from runtime.fhir_to_omop.errors import UnmappedConceptError

_IG_PATH = Path(__file__).resolve().parent / "ig" / "v0.1.0-parthenon.json"


@lru_cache(maxsize=1)
def _ig_snapshot() -> dict[str, Any]:
    return dict(json.loads(_IG_PATH.read_text(encoding="utf-8")))


class ConceptResolver:
    """OMOP concept_id resolver for FHIR (system, code) pairs."""

    def __init__(
        self,
        *,
        engine: Engine,
        vocab_schema: str,
        strict: bool = False,
    ) -> None:
        self.engine = engine
        self.vocab_schema = vocab_schema
        self.strict = strict
        self._cache: dict[tuple[str, str], int] = {}
        self._system_to_vocab: dict[str, str] = dict(
            _ig_snapshot().get("system_to_vocabulary", {})
        )

    def resolve(self, *, system: str, code: str) -> int:
        """Return the OMOP standard concept_id, 0 on miss (non-strict)."""
        key = (system, code)
        if key in self._cache:
            return self._cache[key]

        vocab = self._system_to_vocab.get(system)
        if vocab is None:
            if self.strict:
                raise UnmappedConceptError(
                    f"system {system!r} not in pinned IG snapshot"
                )
            self._cache[key] = 0
            return 0

        # The schema-qualified table is "{schema}.concept" except when running
        # against sqlite where there's no schema; the test uses 'main'.
        if self.vocab_schema in {"main", ""}:
            qual = "concept"
        else:
            qual = f"{self.vocab_schema}.concept"
        with self.engine.connect() as conn:
            row = conn.execute(
                text(
                    f"SELECT concept_id FROM {qual} "
                    "WHERE vocabulary_id = :vocab AND concept_code = :code "
                    "  AND (standard_concept = 'S' OR standard_concept IS NULL) "
                    "LIMIT 1"
                ),
                {"vocab": vocab, "code": code},
            ).fetchone()

        if row is None:
            if self.strict:
                raise UnmappedConceptError(
                    f"no OMOP concept for ({system}, {code}) in vocabulary {vocab!r}"
                )
            self._cache[key] = 0
            return 0

        cid = int(row[0])
        self._cache[key] = cid
        return cid

    def vocabulary_for_system(self, system: str) -> str | None:
        """Return the OMOP vocabulary_id for a FHIR system URI, or None."""
        return self._system_to_vocab.get(system)
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_concept_resolver.py -v`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/ templates/tests/unit/test_concept_resolver.py
git commit -m "feat(templates): add fhir_to_omop package skeleton + ConceptResolver + IG snapshot"
```

---

## Task 2: Patient → PERSON mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/patient.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_patient.py`

`map_patient(fhir_patient, resolver) -> PersonRow` projects a FHIR Patient resource to OMOP PERSON. Mappings:

- `Patient.gender` → `gender_concept_id` (via Gender vocabulary)
- `Patient.birthDate` → `year_of_birth`, `month_of_birth`, `day_of_birth`, `birth_datetime`
- `Patient.extension[us-core-race]` → `race_concept_id` (via Race vocabulary)
- `Patient.extension[us-core-ethnicity]` → `ethnicity_concept_id` (via Ethnicity vocabulary)
- `Patient.id` → `person_source_value` (string identifier)

Returns a `PersonRow` Pydantic model that the manifest's INSERT step uses.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_patient.py
"""Patient → PERSON mapper."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.patient import map_patient, PersonRow


@pytest.fixture()
def engine_with_vocab():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE concept ("
            "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
            "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
        ))
        conn.execute(text(
            "INSERT INTO concept VALUES "
            "(8507, 'MALE', 'Gender', 'M', 'S'), "
            "(8532, 'FEMALE', 'Gender', 'F', 'S'), "
            "(38003563, 'White', 'Race', '2106-3', 'S'), "
            "(38003564, 'Black or African American', 'Race', '2054-5', 'S'), "
            "(38003564, 'Black or African American', 'Race', '2054-5', 'S'), "
            "(38003566, 'Hispanic or Latino', 'Ethnicity', '2135-2', 'S'), "
            "(38003567, 'Not Hispanic or Latino', 'Ethnicity', '2186-5', 'S')"
        ))
    return eng


def _resolver(engine_with_vocab):
    return ConceptResolver(engine=engine_with_vocab, vocab_schema="main")


def test_map_minimal_patient(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p1",
        "gender": "male",
        "birthDate": "1970-06-15",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert isinstance(person, PersonRow)
    assert person.person_source_value == "p1"
    assert person.gender_concept_id == 8507
    assert person.year_of_birth == 1970
    assert person.month_of_birth == 6
    assert person.day_of_birth == 15
    assert person.birth_datetime == "1970-06-15T00:00:00"


def test_map_patient_with_race_and_ethnicity_extensions(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p2",
        "gender": "female",
        "birthDate": "1985-03-22",
        "extension": [
            {
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": "2106-3",
                            "display": "White"
                        }
                    }
                ]
            },
            {
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": "2186-5",
                            "display": "Not Hispanic or Latino"
                        }
                    }
                ]
            }
        ]
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.gender_concept_id == 8532
    assert person.race_concept_id == 38003563
    assert person.ethnicity_concept_id == 38003567


def test_map_patient_unknown_gender_uses_zero(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p3",
        "gender": "unknown",
        "birthDate": "1990-01-01",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.gender_concept_id == 0


def test_map_patient_partial_birthdate_year_only(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p4",
        "gender": "male",
        "birthDate": "1970",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.year_of_birth == 1970
    assert person.month_of_birth is None
    assert person.day_of_birth is None


def test_map_patient_missing_birthdate_returns_none_year(engine_with_vocab) -> None:
    fhir_patient = {"resourceType": "Patient", "id": "p5", "gender": "male"}
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.year_of_birth is None
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_patient.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/patient.py`:

```python
"""Patient → OMOP PERSON mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver

GENDER_CODE_MAP = {"male": "M", "female": "F", "other": "O", "unknown": "U"}

US_CORE_RACE_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
US_CORE_ETH_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"


class PersonRow(BaseModel):
    """One OMOP PERSON row, ready to INSERT."""

    model_config = ConfigDict(extra="forbid")

    person_source_value: str
    gender_concept_id: int
    year_of_birth: int | None
    month_of_birth: int | None
    day_of_birth: int | None
    birth_datetime: str | None
    race_concept_id: int = 0
    ethnicity_concept_id: int = 0


def _parse_birth_date(value: str | None) -> tuple[int | None, int | None, int | None, str | None]:
    """Return (year, month, day, ISO datetime) from a FHIR birthDate."""
    if not value:
        return None, None, None, None
    parts = str(value).split("-")
    year = int(parts[0]) if len(parts) >= 1 and parts[0] else None
    month = int(parts[1]) if len(parts) >= 2 and parts[1] else None
    day = int(parts[2]) if len(parts) >= 3 and parts[2] else None
    if year and month and day:
        dt = f"{year:04d}-{month:02d}-{day:02d}T00:00:00"
    else:
        dt = None
    return year, month, day, dt


def _extract_omb_code(ext_block: dict[str, Any]) -> tuple[str | None, str | None]:
    """Extract (system, code) from a US Core race/ethnicity extension."""
    for sub in ext_block.get("extension", []) or []:
        if sub.get("url") == "ombCategory":
            coding = sub.get("valueCoding") or {}
            return coding.get("system"), coding.get("code")
    return None, None


def map_patient(resource: dict[str, Any], resolver: ConceptResolver) -> PersonRow:
    """Project a FHIR Patient to a PersonRow."""
    if resource.get("resourceType") != "Patient":
        raise ValueError(f"expected Patient, got {resource.get('resourceType')!r}")

    gender_fhir = (resource.get("gender") or "").lower()
    gender_code = GENDER_CODE_MAP.get(gender_fhir)
    gender_concept_id = (
        resolver.resolve(system="http://hl7.org/fhir/administrative-gender", code=gender_code)
        if gender_code
        else 0
    )

    year, month, day, birth_dt = _parse_birth_date(resource.get("birthDate"))

    race_concept_id = 0
    ethnicity_concept_id = 0
    for ext in resource.get("extension", []) or []:
        if ext.get("url") == US_CORE_RACE_URL:
            sys_, code = _extract_omb_code(ext)
            if sys_ and code:
                race_concept_id = resolver.resolve(system=sys_, code=code)
        elif ext.get("url") == US_CORE_ETH_URL:
            sys_, code = _extract_omb_code(ext)
            if sys_ and code:
                ethnicity_concept_id = resolver.resolve(system=sys_, code=code)

    return PersonRow(
        person_source_value=str(resource.get("id", "")),
        gender_concept_id=gender_concept_id,
        year_of_birth=year,
        month_of_birth=month,
        day_of_birth=day,
        birth_datetime=birth_dt,
        race_concept_id=race_concept_id,
        ethnicity_concept_id=ethnicity_concept_id,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_patient.py -v`
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
git add templates/runtime/fhir_to_omop/patient.py templates/tests/unit/test_fhir_to_omop_patient.py
git commit -m "feat(templates): add fhir_to_omop Patient -> PERSON mapper"
```

---

## Task 3: Encounter → VISIT_OCCURRENCE mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/encounter.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_encounter.py`

Mappings:

- `Encounter.subject.reference` → `person_source_value` (resolved to `person_id` at INSERT time via the staging map from Task 2)
- `Encounter.class.code` → `visit_concept_id` via the IG's `encounter_class_to_visit_concept` table
- `Encounter.period.start` / `period.end` → `visit_start_date(time)`, `visit_end_date(time)`
- `Encounter.id` → `visit_source_value`
- `Encounter.type[0].coding[0]` → `visit_source_concept_id` (via concept resolver)

The mapper does NOT resolve `person_id` directly — the manifest's INSERT step joins on `person_source_value` after Patient mapping completes. Returns a `VisitRow` Pydantic model.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_encounter.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.encounter import map_encounter, VisitRow


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
            "(38004247, 'New patient encounter', 'SNOMED', '185463005', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_minimal_encounter(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e1",
        "status": "finished",
        "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z", "end": "2026-04-01T09:30:00Z"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert isinstance(visit, VisitRow)
    assert visit.visit_source_value == "e1"
    assert visit.person_source_value == "p1"
    assert visit.visit_concept_id == 9202  # AMB → ambulatory
    assert visit.visit_start_date == "2026-04-01"
    assert visit.visit_end_date == "2026-04-01"


def test_map_inpatient_class(engine) -> None:
    fhir = {
        "resourceType": "Encounter", "id": "e2", "status": "finished",
        "class": {"code": "IMP"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_concept_id == 9201  # IMP → inpatient


def test_map_unknown_class_uses_zero(engine) -> None:
    fhir = {
        "resourceType": "Encounter", "id": "e3", "status": "finished",
        "class": {"code": "MADE_UP"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_concept_id == 0


def test_map_encounter_with_type_resolves_source_concept(engine) -> None:
    fhir = {
        "resourceType": "Encounter", "id": "e4", "status": "finished",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
        "type": [{"coding": [{"system": "http://snomed.info/sct", "code": "185463005"}]}],
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_source_concept_id == 38004247


def test_map_encounter_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "Encounter", "id": "e5", "status": "finished",
        "class": {"code": "AMB"},
        "period": {"start": "2026-04-01"},
    }
    with pytest.raises(ValueError, match="subject"):
        map_encounter(fhir, _resolver(engine))


def test_map_encounter_no_period_end_uses_start(engine) -> None:
    """When period.end is absent, visit_end_date defaults to visit_start_date."""
    fhir = {
        "resourceType": "Encounter", "id": "e6", "status": "in-progress",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_start_date == "2026-04-01"
    assert visit.visit_end_date == "2026-04-01"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_encounter.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/encounter.py`:

```python
"""Encounter → OMOP VISIT_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver, _ig_snapshot


class VisitRow(BaseModel):
    """One OMOP VISIT_OCCURRENCE row, ready to INSERT (after person_id resolution)."""

    model_config = ConfigDict(extra="forbid")

    visit_source_value: str
    person_source_value: str
    visit_concept_id: int
    visit_start_date: str
    visit_start_datetime: str | None
    visit_end_date: str
    visit_end_datetime: str | None
    visit_source_concept_id: int = 0
    visit_type_concept_id: int = 32035  # "Visit derived from EHR" (OMOP standard)


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def map_encounter(resource: dict[str, Any], resolver: ConceptResolver) -> VisitRow:
    """Project a FHIR Encounter to a VisitRow."""
    if resource.get("resourceType") != "Encounter":
        raise ValueError(f"expected Encounter, got {resource.get('resourceType')!r}")

    subject = resource.get("subject") or {}
    ref = subject.get("reference") or ""
    if "/" not in ref:
        raise ValueError(f"Encounter {resource.get('id')!r} missing or malformed subject reference")
    person_source_value = ref.rsplit("/", 1)[-1]

    cls = resource.get("class") or {}
    cls_code = str(cls.get("code", ""))
    class_map = _ig_snapshot().get("encounter_class_to_visit_concept", {}) or {}
    visit_concept_id = int(class_map.get(cls_code, 0))

    period = resource.get("period") or {}
    start = period.get("start")
    end = period.get("end") or start
    visit_start_date = _date_only(start) or "1970-01-01"
    visit_end_date = _date_only(end) or visit_start_date

    visit_source_concept_id = 0
    types = resource.get("type") or []
    if types:
        codings = (types[0].get("coding") or [])
        if codings:
            sys_ = codings[0].get("system")
            code = codings[0].get("code")
            if sys_ and code:
                visit_source_concept_id = resolver.resolve(system=sys_, code=code)

    return VisitRow(
        visit_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_concept_id=visit_concept_id,
        visit_start_date=visit_start_date,
        visit_start_datetime=str(start) if start and "T" in str(start) else None,
        visit_end_date=visit_end_date,
        visit_end_datetime=str(end) if end and "T" in str(end) else None,
        visit_source_concept_id=visit_source_concept_id,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_encounter.py -v`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/encounter.py templates/tests/unit/test_fhir_to_omop_encounter.py
git commit -m "feat(templates): add fhir_to_omop Encounter -> VISIT_OCCURRENCE mapper"
```

---

## Task 4: Condition → CONDITION_OCCURRENCE mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/condition.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_condition.py`

Mappings:

- `Condition.subject.reference` → `person_source_value`
- `Condition.encounter.reference` → `visit_source_value` (joined to visit_occurrence_id at INSERT)
- `Condition.code.coding` → `condition_concept_id` (try each coding, pick first that resolves; fallback to 0 + queue)
- `Condition.onsetDateTime` / `recordedDate` → `condition_start_date(time)`
- `Condition.abatementDateTime` → `condition_end_date(time)` (optional)
- `Condition.id` → `condition_source_value`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_condition.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.condition import map_condition, ConditionRow


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
            "(4267416, 'Hypertension', 'SNOMED', '38341003', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_condition_with_snomed_code(engine) -> None:
    fhir = {
        "resourceType": "Condition", "id": "c1",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "onsetDateTime": "2026-03-15T00:00:00Z",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert isinstance(cond, ConditionRow)
    assert cond.condition_source_value == "c1"
    assert cond.person_source_value == "p1"
    assert cond.visit_source_value == "e1"
    assert cond.condition_concept_id == 4267416
    assert cond.condition_start_date == "2026-03-15"


def test_map_condition_no_encounter(engine) -> None:
    fhir = {
        "resourceType": "Condition", "id": "c2",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.visit_source_value is None


def test_map_condition_unmapped_code_returns_zero(engine) -> None:
    fhir = {
        "resourceType": "Condition", "id": "c3",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "999999"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_concept_id == 0


def test_map_condition_falls_back_to_recorded_date(engine) -> None:
    fhir = {
        "resourceType": "Condition", "id": "c4",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_start_date == "2026-03-15"


def test_map_condition_with_abatement(engine) -> None:
    fhir = {
        "resourceType": "Condition", "id": "c5",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "onsetDateTime": "2026-03-15",
        "abatementDateTime": "2026-04-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_end_date == "2026-04-15"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_condition.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/condition.py`:

```python
"""Condition → OMOP CONDITION_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class ConditionRow(BaseModel):
    """One OMOP CONDITION_OCCURRENCE row."""

    model_config = ConfigDict(extra="forbid")

    condition_source_value: str
    person_source_value: str
    visit_source_value: str | None
    condition_concept_id: int
    condition_source_concept_id: int = 0
    condition_start_date: str
    condition_start_datetime: str | None
    condition_end_date: str | None
    condition_end_datetime: str | None
    condition_type_concept_id: int = 32817  # "EHR Condition" (OMOP standard)


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


def map_condition(resource: dict[str, Any], resolver: ConceptResolver) -> ConditionRow:
    if resource.get("resourceType") != "Condition":
        raise ValueError(f"expected Condition, got {resource.get('resourceType')!r}")

    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Condition {resource.get('id')!r} missing subject reference")
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = ((resource.get("code") or {}).get("coding") or [])
    condition_concept_id = 0
    condition_source_concept_id = 0
    for coding in coding_list:
        sys_ = coding.get("system")
        code = coding.get("code")
        if not (sys_ and code):
            continue
        cid = resolver.resolve(system=sys_, code=code)
        if cid != 0:
            condition_concept_id = cid
            condition_source_concept_id = cid
            break

    onset = resource.get("onsetDateTime")
    recorded = resource.get("recordedDate")
    start_iso = onset or recorded or "1970-01-01"
    abatement = resource.get("abatementDateTime")

    return ConditionRow(
        condition_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        condition_concept_id=condition_concept_id,
        condition_source_concept_id=condition_source_concept_id,
        condition_start_date=_date_only(start_iso) or "1970-01-01",
        condition_start_datetime=str(start_iso) if start_iso and "T" in str(start_iso) else None,
        condition_end_date=_date_only(abatement),
        condition_end_datetime=str(abatement) if abatement and "T" in str(abatement) else None,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_condition.py -v`
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
git add templates/runtime/fhir_to_omop/condition.py templates/tests/unit/test_fhir_to_omop_condition.py
git commit -m "feat(templates): add fhir_to_omop Condition -> CONDITION_OCCURRENCE mapper"
```

---

## Task 5: Observation → MEASUREMENT vs OBSERVATION splitter

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/observation.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_observation.py`

The OMOP CDM splits FHIR Observations into two tables based on what the observation **measures**:

- **MEASUREMENT**: vital signs, lab results, imaging metrics, exam findings (anything with a quantitative value).
- **OBSERVATION**: social history, family history, surveys, narrative notes (qualitative).

Per the IG snapshot's `observation_split_to_measurement_when_categories`, FHIR Observations with `category` in `{vital-signs, laboratory, imaging, exam}` go to MEASUREMENT; everything else goes to OBSERVATION.

The splitter returns `MeasurementRow | ObservationRow`. The manifest's INSERT step routes accordingly.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_observation.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.observation import (
    MeasurementRow,
    ObservationRow,
    map_observation,
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
            "(3004249, 'Systolic blood pressure', 'LOINC', '8480-6', 'S'), "
            "(3025315, 'Body weight', 'LOINC', '29463-7', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_vital_sign_routes_to_measurement(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o1", "status": "final",
        "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01T08:30:00Z",
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, MeasurementRow)
    assert row.measurement_concept_id == 3004249
    assert row.value_as_number == 120.0


def test_laboratory_routes_to_measurement(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o2", "status": "final",
        "category": [{"coding": [{"code": "laboratory"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "29463-7"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueQuantity": {"value": 75, "unit": "kg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, MeasurementRow)


def test_social_history_routes_to_observation(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o3", "status": "final",
        "category": [{"coding": [{"code": "social-history"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "72166-2"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueCodeableConcept": {"coding": [{"system": "http://loinc.org", "code": "LA15920-4", "display": "Never smoker"}]},
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)


def test_no_category_defaults_to_observation(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o4", "status": "final",
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)


def test_value_string_lands_in_observation_value_as_string(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o5", "status": "final",
        "category": [{"coding": [{"code": "social-history"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueString": "Patient declined to answer",
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)
    assert row.value_as_string == "Patient declined to answer"


def test_observation_with_encounter_carries_visit_source_value(engine) -> None:
    fhir = {
        "resourceType": "Observation", "id": "o6", "status": "final",
        "category": [{"coding": [{"code": "vital-signs"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "effectiveDateTime": "2026-04-01",
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert row.visit_source_value == "e1"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_observation.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/observation.py`:

```python
"""Observation → OMOP MEASUREMENT or OBSERVATION (split by FHIR category)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver, _ig_snapshot


class MeasurementRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    measurement_source_value: str
    person_source_value: str
    visit_source_value: str | None
    measurement_concept_id: int
    measurement_source_concept_id: int = 0
    measurement_date: str
    measurement_datetime: str | None
    value_as_number: float | None
    unit_concept_id: int = 0
    measurement_type_concept_id: int = 32817


class ObservationRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    value_as_number: float | None
    value_as_string: str | None
    value_as_concept_id: int = 0
    observation_type_concept_id: int = 32817


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


def _routes_to_measurement(resource: dict[str, Any]) -> bool:
    measurement_categories = set(
        _ig_snapshot().get("observation_split_to_measurement_when_categories", []) or []
    )
    for cat in resource.get("category", []) or []:
        for coding in cat.get("coding", []) or []:
            if coding.get("code") in measurement_categories:
                return True
    return False


def map_observation(
    resource: dict[str, Any], resolver: ConceptResolver
) -> MeasurementRow | ObservationRow:
    if resource.get("resourceType") != "Observation":
        raise ValueError(f"expected Observation, got {resource.get('resourceType')!r}")

    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Observation {resource.get('id')!r} missing subject reference")
    visit_source_value = _ref_id(resource.get("encounter"))

    code_coding_list = ((resource.get("code") or {}).get("coding") or [])
    concept_id = 0
    for coding in code_coding_list:
        sys_ = coding.get("system")
        code = coding.get("code")
        if not (sys_ and code):
            continue
        cid = resolver.resolve(system=sys_, code=code)
        if cid != 0:
            concept_id = cid
            break

    eff = resource.get("effectiveDateTime") or (resource.get("effectivePeriod") or {}).get("start")
    obs_date = _date_only(eff) or "1970-01-01"
    obs_dt = str(eff) if eff and "T" in str(eff) else None

    val_qty = resource.get("valueQuantity") or {}
    value_as_number = (
        float(val_qty["value"])
        if val_qty and "value" in val_qty
        else None
    )
    value_as_string = resource.get("valueString")

    if _routes_to_measurement(resource):
        return MeasurementRow(
            measurement_source_value=str(resource.get("id", "")),
            person_source_value=person_source_value,
            visit_source_value=visit_source_value,
            measurement_concept_id=concept_id,
            measurement_source_concept_id=concept_id,
            measurement_date=obs_date,
            measurement_datetime=obs_dt,
            value_as_number=value_as_number,
        )
    return ObservationRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        observation_concept_id=concept_id,
        observation_source_concept_id=concept_id,
        observation_date=obs_date,
        observation_datetime=obs_dt,
        value_as_number=value_as_number,
        value_as_string=value_as_string,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_observation.py -v`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/observation.py templates/tests/unit/test_fhir_to_omop_observation.py
git commit -m "feat(templates): add fhir_to_omop Observation -> MEASUREMENT/OBSERVATION splitter"
```

---

## Task 6: Unmapped-concept fallback queue

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/unmapped_queue.py`
- Create: `/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_05_03_120000_create_unmapped_concepts_queue_table.php`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_unmapped_queue.py`

When a `(system, code)` pair fails to resolve and the run is in non-strict mode, the mapper writes a row to `app.unmapped_concepts_queue` for the existing Laravel `MappingReviewController` to surface to a human reviewer. Phase 1 does NOT call any AI mapping pathway (per spec §6.7).

The migration is small (a new table). Adheres to Plan 2's Laravel migration discipline (paired devlog).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_unmapped_queue.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.unmapped_queue import write_unmapped, MappingQueueRow


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(text("""
            CREATE TABLE unmapped_concepts_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                source_system TEXT NOT NULL,
                source_code TEXT NOT NULL,
                source_display TEXT,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
                occurrence_count INTEGER DEFAULT 1,
                UNIQUE(run_id, source_system, source_code)
            )
        """))
    return eng


def test_writes_new_row(engine) -> None:
    row = MappingQueueRow(
        run_id="r1",
        source_system="http://snomed.info/sct",
        source_code="999999999",
        source_display="Unknown thing",
        resource_type="Condition",
        resource_id="c1",
    )
    write_unmapped(row, engine, schema="main")
    with engine.connect() as conn:
        n = conn.execute(text("SELECT COUNT(*) FROM unmapped_concepts_queue")).scalar()
    assert n == 1


def test_increments_occurrence_count_on_repeat(engine) -> None:
    row = MappingQueueRow(
        run_id="r1",
        source_system="http://snomed.info/sct",
        source_code="999999999",
        source_display="Unknown thing",
        resource_type="Condition",
        resource_id="c1",
    )
    write_unmapped(row, engine, schema="main")
    write_unmapped(row, engine, schema="main")
    write_unmapped(row, engine, schema="main")
    with engine.connect() as conn:
        cnt = conn.execute(
            text(
                "SELECT occurrence_count FROM unmapped_concepts_queue "
                "WHERE source_code = '999999999'"
            )
        ).scalar()
    assert cnt == 3
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_unmapped_queue.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/fhir_to_omop/unmapped_queue.py`:

```python
"""Write unmapped (system, code) pairs to the app.unmapped_concepts_queue table.

The existing Laravel `MappingReviewController` flow surfaces queued rows to a
human reviewer. Phase 1 does NOT call any AI mapping pathway.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Engine


class MappingQueueRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str
    source_system: str
    source_code: str
    source_display: str | None = None
    resource_type: str
    resource_id: str


def write_unmapped(row: MappingQueueRow, engine: Engine, *, schema: str) -> None:
    """INSERT-or-increment-occurrence into the queue table."""
    qual = "unmapped_concepts_queue" if schema in {"main", ""} else f"{schema}.unmapped_concepts_queue"
    with engine.begin() as conn:
        existing = conn.execute(
            text(
                f"SELECT id FROM {qual} "
                "WHERE run_id = :run_id AND source_system = :sys AND source_code = :code"
            ),
            {"run_id": row.run_id, "sys": row.source_system, "code": row.source_code},
        ).fetchone()
        if existing:
            conn.execute(
                text(
                    f"UPDATE {qual} SET occurrence_count = occurrence_count + 1 "
                    f"WHERE id = :id"
                ),
                {"id": existing[0]},
            )
        else:
            conn.execute(
                text(
                    f"INSERT INTO {qual} "
                    "(run_id, source_system, source_code, source_display, "
                    "resource_type, resource_id, occurrence_count) "
                    "VALUES (:run_id, :sys, :code, :display, :rtype, :rid, 1)"
                ),
                {
                    "run_id": row.run_id,
                    "sys": row.source_system,
                    "code": row.source_code,
                    "display": row.source_display,
                    "rtype": row.resource_type,
                    "rid": row.resource_id,
                },
            )
```

`backend/database/migrations/2026_05_03_120000_create_unmapped_concepts_queue_table.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.unmapped_concepts_queue (
                id              BIGSERIAL PRIMARY KEY,
                run_id          UUID NOT NULL,
                source_system   TEXT NOT NULL,
                source_code     TEXT NOT NULL,
                source_display  TEXT,
                resource_type   VARCHAR(64) NOT NULL,
                resource_id     VARCHAR(128) NOT NULL,
                first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                reviewer_user_id BIGINT REFERENCES app.users(id),
                resolved_concept_id BIGINT,
                resolved_at     TIMESTAMPTZ,
                UNIQUE(run_id, source_system, source_code)
            )
        SQL);

        DB::statement('CREATE INDEX idx_unmapped_concepts_run_id ON app.unmapped_concepts_queue (run_id)');
        DB::statement('CREATE INDEX idx_unmapped_concepts_unresolved ON app.unmapped_concepts_queue (resolved_at) WHERE resolved_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.unmapped_concepts_queue');
    }
};
```

Append a section to the templates devlog (`docs/devlog/modules/templates-laravel-integration-2026-05-02.md`) documenting the new migration:

```markdown
## 2026-05-03 — Phase 1 Plan 5 addition

- `2026_05_03_120000_create_unmapped_concepts_queue_table.php` — creates
  `app.unmapped_concepts_queue` for the FHIR→OMOP mapper to surface
  unmapped (system, code) pairs to the existing MappingReviewController flow.
  Phase 1 does NOT call any AI mapping pathway (devplan §6.7).
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_unmapped_queue.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

Also run Pint+PHPStan on the new PHP migration:

```bash
cd /home/smudoshi/Github/Parthenon
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test database/migrations/2026_05_03_120000_create_unmapped_concepts_queue_table.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse database/migrations/2026_05_03_120000_create_unmapped_concepts_queue_table.php"
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/fhir_to_omop/unmapped_queue.py \
        templates/tests/unit/test_unmapped_queue.py \
        backend/database/migrations/2026_05_03_120000_create_unmapped_concepts_queue_table.php \
        docs/devlog/modules/templates-laravel-integration-2026-05-02.md
git commit -m "feat(templates): add unmapped_concepts_queue + writer for FHIR→OMOP review flow"
```

---

## Task 7: `fhir_to_omop` manifest (PR-A scope)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_to_omop/manifest.yaml`

The manifest's nodes:

1. `ingest_fhir` (FhirResourceNode): pulls Patient/Encounter/Condition/Observation per the configured profile. Other resource types are ignored in PR-A (PR-B/C extend).
2. `map_patients` (PythonNode): reads `patient.parquet`, projects each via `runtime.fhir_to_omop.patient.map_patient`, writes `patients.json` artifact.
3. `map_encounters` (PythonNode): same pattern for Encounter.
4. `map_conditions` (PythonNode): same pattern for Condition.
5. `map_observations` (PythonNode): same pattern for Observation, splits to two artifacts (`measurements.json`, `observations.json`).
6. `load_to_cdm` (PythonNode): reads the four mapping artifacts, INSERTs into `omop.person`, `visit_occurrence`, `condition_occurrence`, `measurement`, `observation`. Resolves `person_id` and `visit_occurrence_id` via JOINs on `person_source_value` / `visit_source_value`.
7. `summarize` (SqlNode + result_artifact): row counts per table.

Length-wise: this manifest is the largest of any in Phase 1 (~250 lines). I'll inline the structure here; the per-node `code:` blocks reuse the imports established in Tasks 2-5.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_manifest.py
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "fhir_to_omop" / "manifest.yaml"
)


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "fhir_to_omop"
    assert manifest.metadata.category == "ingestion"


def test_manifest_imports_pra_mappers() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.patient",
        "runtime.fhir_to_omop.encounter",
        "runtime.fhir_to_omop.condition",
        "runtime.fhir_to_omop.observation",
    ):
        assert module in text


def test_manifest_uses_fhir_resource_for_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_supports_strict_profile_match_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "strict_profile_match" in props


def test_manifest_targets_pr_a_resources() -> None:
    """PR-A scope: Patient, Encounter, Condition, Observation only."""
    text = MANIFEST.read_text(encoding="utf-8")
    for resource in ("Patient", "Encounter", "Condition", "Observation"):
        assert resource in text
    # PR-B/C resources are NOT yet referenced in the manifest
    # (they'll be added by Plans 6 and 7).
    for resource in ("MedicationRequest", "Procedure", "Immunization"):
        # Allow them in a comment but not in active node code
        # (a soft check; refined when PR-B/C ships)
        pass  # placeholder; not asserting absence to allow forward extensibility
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

The manifest is large; the full text is shipped in this plan as a single YAML file. Key structural points:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: fhir_to_omop
  name: FHIR R4 to OMOP CDM (PR-A — Visit Spine)
  version: "0.1.0"
  category: ingestion
  cdm_versions: ["5.3", "5.4"]
  tags: ["fhir", "omop", "etl", "pr-a", "visit-spine"]
  author: "Acumenus Data Sciences"
spec:
  parameters:
    type: object
    properties:
      source: {type: string, enum: ["ndjson", "search"]}
      ndjson_dir: {type: string}
      fhir_base_url: {type: string}
      bearer_token: {type: string, secret: true}
      profile: {type: string, enum: ["us-core", "mcode", "ips", "mii"], default: "us-core"}
      strict_profile_match: {type: boolean, default: false}
      target_schema: {type: string}
      vocab_schema: {type: string, default: "vocab"}
      app_schema: {type: string, default: "app"}
      strict_concept_resolution: {type: boolean, default: false}
    required: ["source", "target_schema"]
  requires:
    cdm_initialized: true
    vocabularies: []
  nodes:
    - node_id: ingest_fhir
      type: fhir_resource
      params:
        source: "${parameters.source}"
        ndjson_dir: "${parameters.ndjson_dir}"
        fhir_base_url: "${parameters.fhir_base_url}"
        bearer_token: "${parameters.bearer_token}"
        profile: "${parameters.profile}"
        strict_profile_match: "${parameters.strict_profile_match}"
        resource_types: ["Patient", "Encounter", "Condition", "Observation"]

    - node_id: map_patients
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from pathlib import Path
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.patient import map_patient

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "patient.parquet"
              if not upstream.exists():
                  return {"persons_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  person = map_patient(dict(raw), resolver)
                  rows.append(person.model_dump())
              (context.artifact_dir / "patients.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"persons_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: map_encounters
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.encounter import map_encounter

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "encounter.parquet"
              if not upstream.exists():
                  return {"visits_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  visit = map_encounter(dict(raw), resolver)
                  rows.append(visit.model_dump())
              (context.artifact_dir / "visits.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"visits_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: map_conditions
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.condition import map_condition

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "condition.parquet"
              if not upstream.exists():
                  return {"conditions_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              rows = []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  cond = map_condition(dict(raw), resolver)
                  rows.append(cond.model_dump())
              (context.artifact_dir / "conditions.json").write_text(json.dumps(rows), encoding="utf-8")
              return {"conditions_mapped": len(rows)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: map_observations
      type: python
      depends_on: [ingest_fhir]
      params:
        code: |
          import json
          from sqlalchemy import create_engine
          import polars as pl
          from runtime.fhir_to_omop.concept_resolver import ConceptResolver
          from runtime.fhir_to_omop.observation import (
              map_observation, MeasurementRow, ObservationRow,
          )

          def main(context, params):
              upstream = context.artifact_dir.parent / "ingest_fhir" / "observation.parquet"
              if not upstream.exists():
                  return {"measurements_mapped": 0, "observations_mapped": 0}
              engine = create_engine(context.db_dsn, future=True)
              resolver = ConceptResolver(engine=engine, vocab_schema=params["vocab_schema"])
              measurements, observations = [], []
              for raw in pl.read_parquet(upstream).iter_rows(named=True):
                  row = map_observation(dict(raw), resolver)
                  if isinstance(row, MeasurementRow):
                      measurements.append(row.model_dump())
                  else:
                      observations.append(row.model_dump())
              (context.artifact_dir / "measurements.json").write_text(json.dumps(measurements), encoding="utf-8")
              (context.artifact_dir / "observations.json").write_text(json.dumps(observations), encoding="utf-8")
              return {"measurements_mapped": len(measurements), "observations_mapped": len(observations)}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: load_to_cdm
      type: python
      depends_on: [map_patients, map_encounters, map_conditions, map_observations]
      params:
        code: |
          import json
          from sqlalchemy import create_engine, text

          def main(context, params):
              engine = create_engine(context.db_dsn, future=True)
              schema = params["target_schema"]
              base = context.artifact_dir.parent
              persons = json.loads((base / "map_patients" / "patients.json").read_text(encoding="utf-8"))
              visits = json.loads((base / "map_encounters" / "visits.json").read_text(encoding="utf-8"))
              conditions = json.loads((base / "map_conditions" / "conditions.json").read_text(encoding="utf-8"))
              measurements = json.loads((base / "map_observations" / "measurements.json").read_text(encoding="utf-8"))
              observations = json.loads((base / "map_observations" / "observations.json").read_text(encoding="utf-8"))

              n_persons = n_visits = n_conds = n_meas = n_obs = 0
              with engine.begin() as conn:
                  # PERSON: assign person_id sequentially.
                  pid_map: dict[str, int] = {}
                  for i, p in enumerate(persons, start=1):
                      conn.execute(text(
                          f"INSERT INTO {schema}.person "
                          f"(person_id, gender_concept_id, year_of_birth, month_of_birth, day_of_birth, "
                          f"birth_datetime, race_concept_id, ethnicity_concept_id, person_source_value) "
                          f"VALUES (:pid, :g, :y, :m, :d, :bdt, :r, :e, :psv)"
                      ), {
                          "pid": i, "g": p["gender_concept_id"], "y": p["year_of_birth"],
                          "m": p["month_of_birth"], "d": p["day_of_birth"], "bdt": p["birth_datetime"],
                          "r": p["race_concept_id"], "e": p["ethnicity_concept_id"],
                          "psv": p["person_source_value"],
                      })
                      pid_map[p["person_source_value"]] = i
                      n_persons += 1

                  # VISIT_OCCURRENCE: resolve person_id from staging map.
                  vid_map: dict[str, int] = {}
                  for i, v in enumerate(visits, start=1):
                      pid = pid_map.get(v["person_source_value"])
                      if pid is None:
                          continue  # orphan; tracked by Task 11 referential-integrity test
                      conn.execute(text(
                          f"INSERT INTO {schema}.visit_occurrence "
                          f"(visit_occurrence_id, person_id, visit_concept_id, visit_start_date, "
                          f"visit_start_datetime, visit_end_date, visit_end_datetime, "
                          f"visit_type_concept_id, visit_source_value, visit_source_concept_id) "
                          f"VALUES (:vid, :pid, :vc, :vsd, :vsdt, :ved, :vedt, :vtc, :vsv, :vsc)"
                      ), {
                          "vid": i, "pid": pid, "vc": v["visit_concept_id"],
                          "vsd": v["visit_start_date"], "vsdt": v["visit_start_datetime"],
                          "ved": v["visit_end_date"], "vedt": v["visit_end_datetime"],
                          "vtc": v["visit_type_concept_id"], "vsv": v["visit_source_value"],
                          "vsc": v["visit_source_concept_id"],
                      })
                      vid_map[v["visit_source_value"]] = i
                      n_visits += 1

                  for c in conditions:
                      pid = pid_map.get(c["person_source_value"])
                      if pid is None:
                          continue
                      vid = vid_map.get(c["visit_source_value"]) if c["visit_source_value"] else None
                      conn.execute(text(
                          f"INSERT INTO {schema}.condition_occurrence "
                          f"(condition_occurrence_id, person_id, condition_concept_id, condition_start_date, "
                          f"condition_start_datetime, condition_end_date, condition_type_concept_id, "
                          f"condition_source_value, condition_source_concept_id, visit_occurrence_id) "
                          f"VALUES (DEFAULT, :pid, :cc, :csd, :csdt, :ced, :ctc, :csv, :csc, :vid)"
                      ), {
                          "pid": pid, "cc": c["condition_concept_id"],
                          "csd": c["condition_start_date"], "csdt": c["condition_start_datetime"],
                          "ced": c["condition_end_date"], "ctc": c["condition_type_concept_id"],
                          "csv": c["condition_source_value"],
                          "csc": c["condition_source_concept_id"], "vid": vid,
                      })
                      n_conds += 1

                  for m in measurements:
                      pid = pid_map.get(m["person_source_value"])
                      if pid is None:
                          continue
                      vid = vid_map.get(m["visit_source_value"]) if m["visit_source_value"] else None
                      conn.execute(text(
                          f"INSERT INTO {schema}.measurement "
                          f"(measurement_id, person_id, measurement_concept_id, measurement_date, "
                          f"measurement_datetime, measurement_type_concept_id, value_as_number, "
                          f"unit_concept_id, measurement_source_value, measurement_source_concept_id, "
                          f"visit_occurrence_id) "
                          f"VALUES (DEFAULT, :pid, :mc, :md, :mdt, :mtc, :van, :uc, :msv, :msc, :vid)"
                      ), {
                          "pid": pid, "mc": m["measurement_concept_id"],
                          "md": m["measurement_date"], "mdt": m["measurement_datetime"],
                          "mtc": m["measurement_type_concept_id"], "van": m["value_as_number"],
                          "uc": m["unit_concept_id"], "msv": m["measurement_source_value"],
                          "msc": m["measurement_source_concept_id"], "vid": vid,
                      })
                      n_meas += 1

                  for o in observations:
                      pid = pid_map.get(o["person_source_value"])
                      if pid is None:
                          continue
                      vid = vid_map.get(o["visit_source_value"]) if o["visit_source_value"] else None
                      conn.execute(text(
                          f"INSERT INTO {schema}.observation "
                          f"(observation_id, person_id, observation_concept_id, observation_date, "
                          f"observation_datetime, observation_type_concept_id, value_as_number, "
                          f"value_as_string, value_as_concept_id, observation_source_value, "
                          f"observation_source_concept_id, visit_occurrence_id) "
                          f"VALUES (DEFAULT, :pid, :oc, :od, :odt, :otc, :van, :vas, :vac, :osv, :osc, :vid)"
                      ), {
                          "pid": pid, "oc": o["observation_concept_id"],
                          "od": o["observation_date"], "odt": o["observation_datetime"],
                          "otc": o["observation_type_concept_id"], "van": o["value_as_number"],
                          "vas": o["value_as_string"], "vac": o["value_as_concept_id"],
                          "osv": o["observation_source_value"],
                          "osc": o["observation_source_concept_id"], "vid": vid,
                      })
                      n_obs += 1

              return {
                  "persons": n_persons, "visits": n_visits, "conditions": n_conds,
                  "measurements": n_meas, "observations": n_obs,
              }
        inputs:
          target_schema: "${parameters.target_schema}"

    - node_id: summarize
      type: sql
      depends_on: [load_to_cdm]
      params:
        statements:
          - "SELECT 1"
        fetch_query: |
          SELECT
            (SELECT COUNT(*) FROM ${parameters.target_schema}.person) AS persons,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.visit_occurrence) AS visits,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.condition_occurrence) AS conditions,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.measurement) AS measurements,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.observation) AS observations
        result_artifact: fhir_to_omop_summary
  post_conditions:
    - kind: row_count
      params:
        table: "${parameters.target_schema}.person"
        min: 1
    - kind: artifact_present
      params:
        artifact: fhir_to_omop_summary.json
        min_rows: 1
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
git commit -m "feat(templates): add fhir_to_omop manifest (PR-A: Patient/Encounter/Condition/Observation)"
```

---

## Tasks 8–12: validation pack, README, E2E test, referential integrity, ADR

The remaining tasks follow the same patterns established in Plans 2/3/4. Each is a 6-step TDD cycle (failing test → implementation → gates → commit). The full content for these tasks would extend this plan by another ~1500 lines; for brevity in the planning artifact itself, the structural pattern is captured here:

### Task 8: `fhir_to_omop` validation pack and FHIR fixture

- Files: `validation/{README.md, inputs/parameters.json, expected/post_conditions.yaml, dqd_checks.yaml}`, `fixtures/sample/{Patient,Encounter,Condition,Observation}.ndjson`
- Fixture: 2 synthetic patients with US Core race/ethnicity extensions, 2 encounters, 2 conditions, 4 observations (mix of vital-signs and social-history to exercise the splitter)
- Post-conditions: PERSON count = 2, VISIT_OCCURRENCE count = 2, CONDITION_OCCURRENCE count = 2, MEASUREMENT count = 2 (vital-signs), OBSERVATION count = 2 (social-history)
- Pattern from Plan 4 Task 3 (FHIR fixtures with SYNTHETIC tag).

### Task 9: `fhir_to_omop` README (PR-A scope)

- Sections: What it does / When to use it / Parameters / Prerequisites / Examples / Limitations / License / attribution / Security notes
- Limitations: explicitly note that PR-A scope is Patient/Encounter/Condition/Observation only; Procedure/Medication/Immunization land in PR-B (Plan 6); DiagnosticReport/Consent in PR-C (Plan 7)
- Performance note: target 1M Observations < 10 minutes is benchmarked in PR-C (Plan 7)
- Pattern from Plan 4 Task 4.

### Task 10: `fhir_to_omop` E2E test in CI (PR-A)

- File: `templates/tests/e2e/test_fhir_to_omop_pra.py`
- Spins up Postgres testcontainer, bootstraps CDM v5.4, seeds vocab.concept with the IG-required entries, points the manifest at the fixture FHIR corpus, asserts target table row counts match the validation pack
- Pattern from Plan 4 Task 5; depends on `parthenon-cdm.bootstrap()` (Phase 0)

### Task 11: Cross-resource referential integrity test

- File: `templates/tests/unit/test_fhir_to_omop_referential_integrity.py`
- Asserts: zero rows in CONDITION_OCCURRENCE / MEASUREMENT / OBSERVATION reference a non-existent `person_id`. Zero rows reference a non-existent `visit_occurrence_id`. Tests run after the E2E test seeds data.

### Task 12: ADR 0008 — fhir_to_omop architecture and IG pin

- File: `docs/adr/0008-fhir-to-omop-architecture.md`
- Decisions: per-resource mapper module (testable in isolation); IG snapshot file as the only authority for system→vocabulary mappings; person_id resolution via staging map (avoids subquery joins on every INSERT); strict_profile_match defaults false (PR-A; PR-C may flip this); unmapped_concepts_queue feeds existing review flow (no AI mapping); single Phase 1 IG pin (per spec Q9); IG bumps require ADR amendment.
- Pattern from Plans 2/4 ADRs; add to `tests/test_adrs.py` parametrize list.

---

## Definition of Done — Plan 5 (PR-A)

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; lists 10 manifests (Phase 0 + Plans 2/3/4 + Plan 5).
- [ ] `pytest -q` (full suite) green; new tests for ConceptResolver, all four mappers, unmapped queue, manifest, validation pack, referential integrity all pass.
- [ ] `pytest -m integration tests/e2e/test_fhir_to_omop_pra.py` passes against Postgres testcontainer.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow runs the PR-A E2E.
- [ ] All 8 ADRs (0001–0008) pass `tests/test_adrs.py`.
- [ ] PR-A E2E populates PERSON, VISIT_OCCURRENCE, CONDITION_OCCURRENCE, MEASUREMENT, OBSERVATION with the expected fixture-derived counts.
- [ ] Pint+PHPStan green for the new Laravel migration.
- [ ] Devlog updated with the new migration entry.

## Branch model

- Branch off Plan 1 branch tip into `feature/phase-1-templates-fhir-to-omop-pra`.
- 12 commits expected.
- DO NOT push from a subagent.

## Out of scope (handled by Plans 6/7)

- Procedure → PROCEDURE_OCCURRENCE mapping (Plan 6)
- MedicationRequest/MedicationStatement/MedicationAdministration → DRUG_EXPOSURE (Plan 6)
- Immunization → DRUG_EXPOSURE (Plan 6)
- DiagnosticReport, Consent (Plan 7)
- Performance benchmarking (1M Observations < 10 min) (Plan 7)
- Optional Rust-assisted bulk-export ingestion (Plan 7, conditional)
- Phase 1 closeout docs (Plan 7)
