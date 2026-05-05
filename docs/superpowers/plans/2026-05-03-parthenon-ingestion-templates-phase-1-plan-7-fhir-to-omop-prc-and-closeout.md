# Parthenon Ingestion Templates — Phase 1, Plan 7: FHIR→OMOP PR-C + Phase 1 Closeout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 1 with the third FHIR→OMOP slice (DiagnosticReport, Consent), the performance acceptance harness (1M Observations <10 min), the conditional Rust-assisted bulk-export ingestion path (per spec decision Q6, gated on profiling), and the Phase 1 closeout artifacts (security review, DoD verification, devlog, ops runbook update, final sign-off).

**Architecture:** Same `runtime.fhir_to_omop` package, same `fhir_to_omop` manifest. Two new mappers (DiagnosticReport, Consent). The performance harness is a marked-`@pytest.mark.slow` test that runs against a synthetic 1M-Observation NDJSON corpus. The Rust escalation is **conditional** — Plan 7 starts with the profiling pass; only if Python misses the budget does the Rust work get scoped (and that becomes a separate Plan 8 / Phase 2 escalation, not in-scope for Plan 7).

**Tech Stack:** Same as Plans 5/6. New optional dep (only if Rust escalation kicks in): `pyo3==0.23.x` for Rust bindings, declared in a separate `[project.optional-dependencies]` group. Phase 1 ships without it unless escalation triggers.

**Depends on:** Phase 1 Plans 5 + 6 (PR-A + PR-B merged).

**Unblocks:** Phase 2 (NER, MIMIC, ARTEMIS, SDTM) — Phase 1 milestone fully closed after this plan.

---

## Conventions used throughout this plan

- Same as Plans 5/6.
- IG pin remains `v0.1.0-parthenon`.
- Phase 1 closeout artifacts mirror the structure of Phase 0 closeout (see `docs/devlog/modules/ingestion/templates-phase-0-{security,dod,runbook,signoff}.md`).

---

## Task index (12 tasks)

1. `runtime.fhir_to_omop.diagnostic_report`: DiagnosticReport mapper (results split: MEASUREMENT vs OBSERVATION)
2. `runtime.fhir_to_omop.consent`: Consent mapper (audit trail; opt-out filter; never silently drops)
3. Extend `fhir_to_omop` manifest with PR-C nodes
4. Extend validation pack with PR-C fixtures
5. `fhir_to_omop` PR-C E2E test
6. Performance harness: 1M Observations < 10 min
7. Profiling decision point: Rust escalation gate (per spec Q6)
8. Phase 1 security review document
9. Phase 1 Definition-of-Done verification document
10. Phase 1 devlog narrative
11. Phase 1 operations runbook update (Plans 1–7 surfaces)
12. Phase 1 final integration and sign-off

---

## Task 1: DiagnosticReport → MEASUREMENT/OBSERVATION mapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/diagnostic_report.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_diagnostic_report.py`

A FHIR `DiagnosticReport` typically aggregates multiple Observations (lab panel results, imaging study findings). The OMOP CDM doesn't have a 1:1 equivalent; instead, each `result` reference becomes its own MEASUREMENT or OBSERVATION row (already mapped by the Plan 5 Observation mapper if those Observations are in the bundle). The DiagnosticReport mapper:

- Inspects the `category.coding[].code` (e.g. "LAB", "RAD") to classify the report.
- Resolves `code.coding` to a `concept_id` (typically a panel-level LOINC code).
- Emits ONE summary OBSERVATION row per DiagnosticReport (so cohort definitions can find "patient X had LDL panel"), with `value_as_string` set to the conclusion text if present.
- Does NOT re-process the linked `result[]` Observations — those are handled by the Observation mapper independently.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_diagnostic_report.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.diagnostic_report import (
    DiagnosticReportRow,
    map_diagnostic_report,
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
            "(40757491, 'Lipid panel', 'LOINC', '24331-1', 'S')"
        ))
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_lab_diagnostic_report(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport", "id": "dr1", "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "effectiveDateTime": "2026-04-01T08:00:00Z",
        "conclusion": "All values within normal limits.",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert isinstance(row, DiagnosticReportRow)
    assert row.observation_concept_id == 40757491
    assert row.value_as_string == "All values within normal limits."
    assert row.observation_date == "2026-04-01"


def test_map_diagnostic_report_no_conclusion(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport", "id": "dr2", "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert row.value_as_string is None


def test_map_diagnostic_report_unknown_code(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport", "id": "dr3", "status": "final",
        "category": [{"coding": [{"code": "RAD"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "999999"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert row.observation_concept_id == 0


def test_map_diagnostic_report_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport", "id": "dr4", "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "effectiveDateTime": "2026-04-01",
    }
    with pytest.raises(ValueError, match="subject"):
        map_diagnostic_report(fhir, _resolver(engine))
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_diagnostic_report.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/fhir_to_omop/diagnostic_report.py
"""DiagnosticReport → OMOP OBSERVATION (summary row, conclusion as value_as_string)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class DiagnosticReportRow(BaseModel):
    """One OMOP OBSERVATION row summarizing a DiagnosticReport.

    The linked `result[]` Observations are mapped separately by the
    Observation mapper (Plan 5).
    """

    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    value_as_string: str | None
    observation_type_concept_id: int = 32856  # "Diagnostic Report"


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


def map_diagnostic_report(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DiagnosticReportRow:
    if resource.get("resourceType") != "DiagnosticReport":
        raise ValueError(
            f"expected DiagnosticReport, got {resource.get('resourceType')!r}"
        )
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(
            f"DiagnosticReport {resource.get('id')!r} missing subject"
        )
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = ((resource.get("code") or {}).get("coding") or [])
    cid = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            resolved = resolver.resolve(system=sys_, code=code)
            if resolved != 0:
                cid = resolved
                break

    when = resource.get("effectiveDateTime") or (
        resource.get("effectivePeriod") or {}
    ).get("start")
    obs_date = _date_only(when) or "1970-01-01"
    obs_dt = str(when) if when and "T" in str(when) else None
    conclusion = resource.get("conclusion")

    return DiagnosticReportRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        observation_concept_id=cid,
        observation_source_concept_id=cid,
        observation_date=obs_date,
        observation_datetime=obs_dt,
        value_as_string=conclusion,
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_diagnostic_report.py -v`
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
git add templates/runtime/fhir_to_omop/diagnostic_report.py templates/tests/unit/test_fhir_to_omop_diagnostic_report.py
git commit -m "feat(templates): add fhir_to_omop DiagnosticReport -> OBSERVATION mapper"
```

---

## Task 2: Consent mapper (audit trail + opt-out filter)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/fhir_to_omop/consent.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_fhir_to_omop_consent.py`

The Consent resource is sensitive — it captures patient opt-in/opt-out for research. The mapper:

- Records each Consent as an OBSERVATION row with `observation_concept_id` reflecting consent status (a configurable concept_id per `provision.type`).
- Returns a separate `ConsentDecision` namedtuple flagging `(person_source_value, decision: 'permit' | 'deny')` so downstream filters can exclude denied patients from cohort exports.
- **Never silently drops a Consent**. If the resource is malformed, the mapper raises rather than warning — denying a Consent is a clinical/legal decision that demands attention.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_to_omop_consent.py
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.consent import (
    ConsentDecision,
    ConsentRow,
    MalformedConsentError,
    map_consent,
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
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


CONSENT_PERMIT_CONCEPT = 4055893  # OMOP "Patient consent given"
CONSENT_DENY_CONCEPT = 4054745    # OMOP "Patient consent withdrawn"


def test_map_consent_permit(engine) -> None:
    fhir = {
        "resourceType": "Consent", "id": "c1", "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {"type": "permit"},
        "dateTime": "2026-04-01T10:00:00Z",
    }
    row, decision = map_consent(
        fhir,
        _resolver(engine),
        permit_concept_id=CONSENT_PERMIT_CONCEPT,
        deny_concept_id=CONSENT_DENY_CONCEPT,
    )
    assert isinstance(row, ConsentRow)
    assert row.observation_concept_id == CONSENT_PERMIT_CONCEPT
    assert isinstance(decision, ConsentDecision)
    assert decision.decision == "permit"
    assert decision.person_source_value == "p1"


def test_map_consent_deny(engine) -> None:
    fhir = {
        "resourceType": "Consent", "id": "c2", "status": "active",
        "patient": {"reference": "Patient/p2"},
        "provision": {"type": "deny"},
        "dateTime": "2026-04-01",
    }
    row, decision = map_consent(
        fhir,
        _resolver(engine),
        permit_concept_id=CONSENT_PERMIT_CONCEPT,
        deny_concept_id=CONSENT_DENY_CONCEPT,
    )
    assert row.observation_concept_id == CONSENT_DENY_CONCEPT
    assert decision.decision == "deny"


def test_map_consent_missing_provision_type_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent", "id": "c3", "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {},
        "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="provision.type"):
        map_consent(
            fhir, _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )


def test_map_consent_unknown_provision_type_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent", "id": "c4", "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {"type": "neither-permit-nor-deny"},
        "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="provision.type"):
        map_consent(
            fhir, _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )


def test_map_consent_missing_patient_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent", "id": "c5", "status": "active",
        "provision": {"type": "permit"}, "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="patient"):
        map_consent(
            fhir, _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_consent.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/fhir_to_omop/consent.py
"""Consent → OMOP OBSERVATION mapping + ConsentDecision side-channel.

Phase 1 policy: never silently drop a Consent. Malformed resources raise
MalformedConsentError because losing a consent decision in the ETL is a
clinical/legal hazard.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.errors import FhirToOmopError


class MalformedConsentError(FhirToOmopError):
    """Raised when a Consent resource is missing required fields or has invalid provision.type."""


class ConsentRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    observation_type_concept_id: int = 32856  # "Diagnostic Report" — Phase 2 may add a specific Consent type


@dataclass(frozen=True)
class ConsentDecision:
    """Side-channel decision for downstream cohort filtering."""

    person_source_value: str
    decision: str  # "permit" | "deny"
    consent_id: str


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


def map_consent(
    resource: dict[str, Any],
    resolver: ConceptResolver,
    *,
    permit_concept_id: int,
    deny_concept_id: int,
) -> tuple[ConsentRow, ConsentDecision]:
    if resource.get("resourceType") != "Consent":
        raise MalformedConsentError(
            f"expected Consent, got {resource.get('resourceType')!r}"
        )
    person_source_value = _ref_id(resource.get("patient"))
    if not person_source_value:
        raise MalformedConsentError(
            f"Consent {resource.get('id')!r} missing or malformed patient reference"
        )

    provision = resource.get("provision") or {}
    ptype = provision.get("type")
    if ptype == "permit":
        concept_id = permit_concept_id
        decision = "permit"
    elif ptype == "deny":
        concept_id = deny_concept_id
        decision = "deny"
    else:
        raise MalformedConsentError(
            f"Consent {resource.get('id')!r} provision.type must be 'permit' or 'deny', got {ptype!r}"
        )

    when = resource.get("dateTime")
    obs_date = _date_only(when) or "1970-01-01"
    obs_dt = str(when) if when and "T" in str(when) else None

    row = ConsentRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=None,  # Consent is patient-level, not encounter-level
        observation_concept_id=concept_id,
        observation_source_concept_id=concept_id,
        observation_date=obs_date,
        observation_datetime=obs_dt,
    )
    return row, ConsentDecision(
        person_source_value=person_source_value,
        decision=decision,
        consent_id=str(resource.get("id", "")),
    )
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_to_omop_consent.py -v`
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
git add templates/runtime/fhir_to_omop/consent.py templates/tests/unit/test_fhir_to_omop_consent.py
git commit -m "feat(templates): add fhir_to_omop Consent mapper with ConsentDecision side-channel"
```

---

## Task 3: Extend `fhir_to_omop` manifest with PR-C nodes

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_to_omop/manifest.yaml`

Adds:

1. `DiagnosticReport`, `Consent` to `ingest_fhir.params.resource_types`.
2. Two new mapper nodes (`map_diagnostic_reports`, `map_consents`) following the established Plan 5/6 pattern.
3. Two new params (`consent_permit_concept_id`, `consent_deny_concept_id`) for the Consent mapper.
4. The `load_to_cdm` node grows to insert DiagnosticReport summary rows into OBSERVATION and Consent rows into OBSERVATION; it also records ConsentDecision rows in a new `app.consent_decisions` queue table for downstream cohort filtering.

The Laravel migration for `app.consent_decisions` follows the same pattern as Plan 5's `unmapped_concepts_queue` migration (paired devlog).

(Test pattern, implementation, verification, and commit steps follow the now-established structure from Plans 5 and 6. The manifest extension YAML is mechanical; the new Laravel migration creates a small audit table.)

- [ ] **Step 1**: Add tests asserting `DiagnosticReport`, `Consent` in `resource_types`; assert `consent_permit_concept_id` and `consent_deny_concept_id` params present; assert `runtime.fhir_to_omop.diagnostic_report` and `runtime.fhir_to_omop.consent` imported in the manifest.
- [ ] **Step 2**: Verify failure.
- [ ] **Step 3**: Edit `manifest.yaml` to add the two new mapper nodes following the Plan 6 Task 6 pattern; extend `load_to_cdm.depends_on` and code; create the Laravel migration `2026_05_03_130000_create_consent_decisions_table.php`; append the devlog section.
- [ ] **Step 4**: Verify pass.
- [ ] **Step 5**: Quality gates (templates: ruff/black/mypy/pytest; backend: Pint+PHPStan on the migration).
- [ ] **Step 6**: Commit `feat(templates): extend fhir_to_omop manifest with PR-C (DiagnosticReport + Consent)`.

---

## Task 4: Extend validation pack with PR-C fixtures

**Files:**
- Create: `templates/manifests/fhir_to_omop/fixtures/sample/DiagnosticReport.ndjson`
- Create: `templates/manifests/fhir_to_omop/fixtures/sample/Consent.ndjson`
- Modify: `templates/manifests/fhir_to_omop/validation/inputs/parameters.json` (add the two consent concept IDs)
- Modify: `templates/manifests/fhir_to_omop/validation/expected/post_conditions.yaml` (add PR-C assertions)
- Modify: `templates/manifests/fhir_to_omop/validation/dqd_checks.yaml` (add a check for `consent_decisions` integrity)

PR-C fixture content:

`DiagnosticReport.ndjson`:

```json
{"resourceType":"DiagnosticReport","id":"dr1","status":"final","category":[{"coding":[{"code":"LAB"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"24331-1"}]},"subject":{"reference":"Patient/p1"},"encounter":{"reference":"Encounter/e1"},"effectiveDateTime":"2026-04-01T08:00:00Z","conclusion":"All values within normal limits."}
```

`Consent.ndjson`:

```json
{"resourceType":"Consent","id":"co1","status":"active","patient":{"reference":"Patient/p1"},"provision":{"type":"permit"},"dateTime":"2026-04-01T10:00:00Z"}
{"resourceType":"Consent","id":"co2","status":"active","patient":{"reference":"Patient/p2"},"provision":{"type":"deny"},"dateTime":"2026-04-01T10:30:00Z"}
```

Append to `expected/post_conditions.yaml`:

```yaml
  - kind: row_count
    table: omop.observation
    where: "observation_type_concept_id = 32856"
    min: 3
    description: "PR-C: DiagnosticReport (1) + Consent (2) → OBSERVATION rows of type 32856"
  - kind: row_count
    table: app.consent_decisions
    expected: 2
    description: "Both Consent fixtures recorded in the audit table"
  - kind: column_value
    table: app.consent_decisions
    column: decision
    where: "consent_id = 'co2'"
    expected: "deny"
```

Append to `dqd_checks.yaml`:

```yaml
  - check_id: pr_c_consent_decision_links_back_to_observation
    description: "Every consent_decisions row has a matching observation row."
    sql: |
      SELECT COUNT(*) AS violations
      FROM app.consent_decisions cd
      LEFT JOIN omop.observation o
        ON o.observation_source_value = cd.consent_id
      WHERE o.observation_id IS NULL
    expected: 0
```

Pattern: same 6-step TDD as Tasks 7 of Plans 5/6.

---

## Task 5: PR-C E2E test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_fhir_to_omop_prc.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

Same shape as Plan 6 Task 8 but seeded with the full PR-A+B+C fixture corpus. Asserts row counts including OBSERVATION, `app.consent_decisions`, and that the `co2` deny decision is recorded.

Pattern: 6-step TDD. CI step `fhir_to_omop PR-C E2E`.

---

## Task 6: Performance harness — 1M Observations < 10 min

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/performance/test_fhir_to_omop_throughput.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/performance/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/performance/generate_fixture.py` (synthetic 1M-Observation generator)

Per devplan T-015 acceptance criterion: 1M Observation resources processed in <10 minutes on the reference hardware (8 vCPU, 32GB, NVMe-class disk; per spec decision Q5). The harness:

1. Generates a synthetic 1M-Observation NDJSON file (deterministic seed; ~200MB on disk).
2. Spins up Postgres testcontainer.
3. Bootstraps CDM v5.4 + minimal vocab.concept seeding (LOINC codes for the synthetic observations).
4. Runs `fhir_to_omop` against the fixture.
5. Records wall time and asserts < 600 seconds.
6. Records peak RSS and warns (not asserts) if > 4 GB.

Marked `@pytest.mark.slow` and `@pytest.mark.integration` so the default `pytest -q` skips it. CI runs it on a dedicated nightly job, NOT on every PR.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/performance/test_fhir_to_omop_throughput.py
"""Performance acceptance: 1M Observations through fhir_to_omop in < 10 min.

Marked slow + integration. Default pytest skips. Run explicitly:
    uv run pytest tests/performance/ -v -m slow
"""
from __future__ import annotations

import json
import resource as r_mod
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


def _seed_minimal_vocab(engine) -> None:
    """Seed enough LOINC codes for the synthetic generator."""
    with engine.begin() as conn:
        for cid, code in [
            (8507, "M"), (8532, "F"),
            (3004249, "8480-6"), (3025315, "29463-7"),
            (3025460, "8302-2"), (3025456, "39156-5"),
        ]:
            vocab = "LOINC" if "-" in code else "Gender"
            conn.execute(text(
                "INSERT INTO vocab.concept "
                "(concept_id, concept_name, vocabulary_id, concept_code, "
                "standard_concept, concept_class_id, domain_id, "
                "valid_start_date, valid_end_date) "
                "VALUES (:cid, :n, :v, :c, 'S', 'CLASS', 'Measurement', "
                "'1970-01-01', '2099-12-31')"
            ), {"cid": cid, "n": f"concept-{cid}", "v": vocab, "c": code})


@pytest.mark.slow
@pytest.mark.integration
def test_1m_observations_under_10_minutes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    from .generate_fixture import generate_observations

    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    # Generate 1M Observations + 1 Patient + 1 Encounter to satisfy referential
    # integrity. Smaller corpus is gated by env var for fast local iteration.
    n_obs = int(__import__("os").environ.get("PARTHENON_PERF_OBS_COUNT", "1000000"))
    generate_observations(
        fixture_dir,
        n_observations=n_obs,
        seed=42,
    )

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        _seed_minimal_vocab(engine)

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

        rss_before = r_mod.getrusage(r_mod.RUSAGE_SELF).ru_maxrss
        t0 = time.monotonic()

        r = client.post(
            "/runs",
            json={
                "template_id": "fhir_to_omop", "version": "0.1.0",
                "parameters": params, "correlation_id": "perf-1m",
            },
            headers={"X-Parthenon-Internal-Token": "test-internal-token"},
        )
        assert r.status_code == 201, r.text
        run_id = r.json()["run_id"]

        deadline = time.time() + 700  # 10 min budget + 100s buffer for the assertion path
        final = "running"
        while time.time() < deadline:
            resp = client.get(f"/runs/{run_id}", headers={"X-Parthenon-Internal-Token": "test-internal-token"})
            final = resp.json()["status"]
            if final in {"completed", "failed", "cancelled"}:
                break
            time.sleep(2.0)

        elapsed = time.monotonic() - t0
        rss_after = r_mod.getrusage(r_mod.RUSAGE_SELF).ru_maxrss
        rss_delta_mb = (rss_after - rss_before) / 1024

        print(f"perf: {n_obs} observations, status={final}, elapsed={elapsed:.1f}s, RSS delta={rss_delta_mb:.0f}MB")

        assert final == "completed", f"run did not complete: {final}"
        # Hard performance assertion (devplan T-015 acceptance criterion)
        assert elapsed < 600, f"1M observations took {elapsed:.1f}s, budget is 600s"
        # Soft RSS check (warn, don't fail)
        if rss_delta_mb > 4096:
            pytest.warns(UserWarning, match=f"RSS grew by {rss_delta_mb:.0f}MB")
```

`tests/performance/generate_fixture.py`:

```python
"""Synthetic FHIR fixture generator for performance acceptance testing."""

from __future__ import annotations

import json
import random
from pathlib import Path

LOINC_CODES = ["8480-6", "29463-7", "8302-2", "39156-5"]


def generate_observations(out_dir: Path, *, n_observations: int, seed: int = 42) -> int:
    """Write n_observations + 1 Patient + 1 Encounter to NDJSON files. Returns total bytes written."""
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1 Patient
    patient = {"resourceType": "Patient", "id": "p1", "gender": "male", "birthDate": "1970-06-15"}
    (out_dir / "Patient.ndjson").write_text(json.dumps(patient) + "\n", encoding="utf-8")

    # 1 Encounter
    encounter = {
        "resourceType": "Encounter", "id": "e1", "status": "finished",
        "class": {"code": "AMB"}, "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z", "end": "2026-04-01T17:00:00Z"},
    }
    (out_dir / "Encounter.ndjson").write_text(json.dumps(encounter) + "\n", encoding="utf-8")

    # n_observations
    obs_path = out_dir / "Observation.ndjson"
    bytes_written = 0
    with obs_path.open("w", encoding="utf-8") as f:
        for i in range(n_observations):
            code = rng.choice(LOINC_CODES)
            obs = {
                "resourceType": "Observation",
                "id": f"o{i}",
                "status": "final",
                "category": [{"coding": [{"code": "vital-signs"}]}],
                "code": {"coding": [{"system": "http://loinc.org", "code": code}]},
                "subject": {"reference": "Patient/p1"},
                "encounter": {"reference": "Encounter/e1"},
                "effectiveDateTime": "2026-04-01T08:30:00Z",
                "valueQuantity": {"value": rng.uniform(70, 180), "unit": "mmHg"},
            }
            line = json.dumps(obs) + "\n"
            f.write(line)
            bytes_written += len(line)
    return bytes_written
```

- [ ] **Step 2: Run test (with small corpus first to verify it works)**

```bash
cd /home/smudoshi/Github/Parthenon/templates
PARTHENON_PERF_OBS_COUNT=1000 uv run pytest tests/performance/test_fhir_to_omop_throughput.py -v -m slow
```

If 1k observations completes successfully, the harness is correct. Then run the full 1M test (15+ min wall time) on reference hardware:

```bash
uv run pytest tests/performance/test_fhir_to_omop_throughput.py -v -m slow
```

- [ ] **Step 3: Capture profiling results**

The test prints `perf: ... elapsed=...s, RSS delta=...MB`. Capture this output for Task 7's escalation decision.

- [ ] **Step 4: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q   # default suite excludes slow
```

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/performance/
git commit -m "test(templates): add fhir_to_omop 1M-observation performance harness (devplan T-015)"
```

---

## Task 7: Profiling decision point — Rust escalation gate

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1-perf-decision.md`

Per spec decision Q6, the Rust-assisted bulk-export ingestion is **conditional** on profiling. Plan 7 Task 6 produces measured numbers; Task 7 documents the decision based on those numbers.

If 1M Observations < 600s on reference hardware:

- **Decision: SHIP Phase 1 with Python only.**
- Rust escalation deferred (becomes a separate Plan 8 if customer profiling later shows otherwise).
- Document the actual numbers in this devlog so the decision is auditable.

If 1M Observations ≥ 600s on reference hardware:

- **Decision: ESCALATE to a separate Plan 8 (Rust-assisted ingestion).**
- This Plan 7 still ships PR-C and the closeout artifacts; Plan 8 is a follow-up.
- The devlog explicitly says "Phase 1 closes WITHOUT meeting devplan T-015 acceptance for throughput; Plan 8 (Rust ingestion) is required to close the gap."

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_phase_1_perf_decision_doc.py
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DECISION_DOC = REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1-perf-decision.md"


def test_perf_decision_doc_exists() -> None:
    assert DECISION_DOC.exists()


def test_perf_decision_records_actual_numbers() -> None:
    text = DECISION_DOC.read_text(encoding="utf-8")
    # The document must record the actual elapsed time and RSS delta from
    # the Plan 7 Task 6 run.
    assert "elapsed_seconds" in text or "elapsed:" in text
    assert "rss_delta_mb" in text or "RSS delta" in text
    # And explicitly state SHIP or ESCALATE
    assert "SHIP" in text or "ESCALATE" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_phase_1_perf_decision_doc.py -v`
Expected: FAIL.

- [ ] **Step 3: Write the decision document**

`docs/devlog/modules/ingestion/templates-phase-1-perf-decision.md`:

```markdown
# Phase 1 — fhir_to_omop performance decision (Q6)

**Date:** 2026-05-03
**Spec reference:** `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md` §11 Q6
**Devplan reference:** §4 T-015 acceptance criterion (1M Observations < 10 min on 8 vCPU / 32 GB / NVMe)

## Test run

Performance harness (`templates/tests/performance/test_fhir_to_omop_throughput.py`)
executed on the Parthenon CI runner (Darkstar test VM):

- **Hardware:** 8 vCPU, 32 GB RAM, NVMe SSD
- **Test corpus:** 1,000,000 synthetic Observation resources, 1 Patient, 1 Encounter
- **CDM target:** v5.4, fresh Postgres 16 testcontainer (no existing rows)
- **Run command:** `uv run pytest tests/performance/test_fhir_to_omop_throughput.py -v -m slow`

## Measured results

(REPLACE THE PLACEHOLDERS BELOW WITH ACTUAL NUMBERS FROM THE TASK 6 RUN.)

| Metric | Measured | Budget | Status |
|---|---|---|---|
| `elapsed_seconds` | `<TBD>` | 600 s | `<PASS|FAIL>` |
| `rss_delta_mb` | `<TBD>` | 4096 MB (soft) | `<PASS|WARN>` |
| `final_status` | completed | completed | PASS |

## Decision

`<SHIP|ESCALATE>`

### Rationale

- If `elapsed_seconds < 600` and `final_status == completed`:
  - **SHIP Phase 1 with Python-only ingestion.**
  - The Rust-assisted bulk-export ingestion path remains a deferred candidate;
    no scope expansion to Phase 1.
  - Customer profiling on different hardware may surface a need later, in
    which case a follow-up plan (tentatively numbered Plan 8) opens the
    Rust path.
- If `elapsed_seconds ≥ 600`:
  - **ESCALATE.** Phase 1 closes WITHOUT satisfying the devplan T-015
    throughput acceptance criterion. A separate Plan 8 is required to close
    the gap before any production deployment.
  - The DoD verification document (Plan 7 Task 9) will explicitly flag this
    as an open Phase 1 finding.
  - PR-C functionality (DiagnosticReport, Consent) and the closeout
    documentation still ship with Phase 1 — they are independent of
    throughput.

## Rust escalation scope (if triggered)

If the decision is ESCALATE, Plan 8 will:

- Add `pyo3==0.23.x` and a Rust crate at `templates/runtime/fhir_to_omop_rs/`
  housing the NDJSON line iterator + json parser.
- Replace the inner `for line in f` loop in
  `runtime.fhir_to_omop` mappers with a Rust-backed iterator that yields
  `(resource_type, resource_dict)` tuples.
- Re-run the performance harness; expected target: < 200 s on the same hardware.
- Add a CI matrix dimension exercising both Python-only and Rust-accelerated
  paths.
- Update ADR 0008 with an "Amendment 2026-XX-XX (Rust path)" section.

The Plan 8 estimate (if needed) is **L**: ~3 weeks of work for one
platform engineer (Rust dev environment setup + crate build + binding +
benchmark + cross-platform binary distribution). This estimate was
captured at Plan 0 (devplan §4 T-015 PR-C) and is unchanged.

## Audit trail

- Performance harness: `templates/tests/performance/test_fhir_to_omop_throughput.py`
- Synthetic generator: `templates/tests/performance/generate_fixture.py`
- Run logs: attached as a CI artifact when the test runs in the nightly job.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_phase_1_perf_decision_doc.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/templates-phase-1-perf-decision.md \
        templates/tests/unit/test_phase_1_perf_decision_doc.py
git commit -m "docs(devlog): Phase 1 performance decision document (Q6 escalation gate)"
```

---

## Task 8: Phase 1 security review document

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1-security.md`

Mirror Phase 0's security review (`templates-phase-0-security.md`) for the new Phase 1 surfaces:

- **AnonymizerNode + sidecar** (Plan 1): non-root, read-only rootfs, no host port mapping, no network egress. Confirmed by container security tests.
- **Pixel data never copied** (Plan 1, 2): three-layer defense in depth. Regression test enforces.
- **PHI-leak invariant** (Plan 4): HIGHSEC regression test asserts no source PHI string reaches anonymized output.
- **FHIR profile fail-loud** (Plan 1, 5): per spec Q3, profile mismatch is a hard fail.
- **EuroQol licensing** (Plan 3): customer obligation; placeholder value sets clearly marked.
- **Imaging vocabulary namespace** (Plan 2): `[2_000_000_000, 2_099_999_999]` allocation prevents Athena collisions.
- **Consent never silently dropped** (Plan 7): malformed Consent resources raise `MalformedConsentError` rather than silently skip.
- **Materializer secret-key redaction** (Plan 1): inherited from Phase 0; tested in `test_materializer.py`.
- **Three-layer route protection** (Plans 5/6/7 use existing Laravel surfaces): unchanged from Phase 0; new templates inherit the existing `auth:sanctum + permission:ingestion.{view,run,delete}` stack.
- **DICOMweb auth model** (Plan 2): bearer token only; mTLS deferred per spec Q8.
- **Anonymizer config not redacted** (Plan 4 ADR 0007): documented limitation; customers warned in README.

(Pattern: 6-step TDD; the test asserts the file exists and lists each Phase 1 plan number 1–7. Implementation copies the structural shape of `templates-phase-0-security.md` and substitutes Phase 1 content.)

- [ ] Steps 1–6 follow established pattern. Commit message: `docs(security): Phase 1 templates security review`.

---

## Task 9: Phase 1 Definition-of-Done verification document

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1-dod.md`

Mirror Phase 0's DoD verification (`templates-phase-0-dod.md`). Each row in the table cites a specific commit SHA and a test name proving the criterion is met.

Phase 1 DoD criteria (from spec §9):

| Criterion | Evidence | Status |
|---|---|---|
| Three new node types registered | NODE_REGISTRY contains `fhir_resource`, `dicom_metadata`, `anonymizer` | `<commit>` `tests/unit/test_orchestration_factory.py::test_phase_1_nodes_registered` |
| FHIR Bulk Data NDJSON streaming | `test_streams_ndjson_to_parquet` | `<commit>` |
| FHIR search fallback | `test_search_paginates_through_bundle` | `<commit>` |
| FHIR profile fail-loud | `test_resource_with_unknown_profile_in_meta_fails_loudly` | `<commit>` |
| FHIR streaming memory budget | `test_streams_1gb_bundle_under_200mb_rss` | `<commit>` |
| DICOM metadata-only (no pixels) | `test_artifact_has_no_pixel_columns` + 2 layered enforcement tests | `<commit>` |
| DICOMweb QIDO-RS, no WADO | `test_dicomweb_never_calls_wado` | `<commit>` |
| Anonymizer sidecar non-root | `test_anonymizer_runs_non_root` | `<commit>` |
| Anonymizer config v1 schema | `test_load_minimal_config` + 7 more | `<commit>` |
| Anonymizer backend semantic equivalence | `test_semantic_equivalence_on_patient` | `<commit>` |
| HIPAA Safe Harbor PHI-leak guard | `test_no_phi_leaks_through_native_backend` | `<commit>` |
| Imaging vocabulary loads | `test_load_imaging_vocabulary_runs_to_completion` | `<commit>` |
| DICOM ETL produces image_occurrence | `test_etl_dicom_metadata_runs_to_completion` | `<commit>` |
| EQ-5D-5L round-trip + utility | `test_eq5d5l_runs_and_derives_utility` | `<commit>` |
| pro_base reuse (2 instruments) | `tests/unit/test_pro_pattern_reuse.py` (parametrized) | `<commit>` |
| FHIR→OMOP PR-A E2E | `test_fhir_to_omop_pra.py` | `<commit>` |
| FHIR→OMOP PR-B E2E | `test_fhir_to_omop_prb.py` | `<commit>` |
| FHIR→OMOP PR-C E2E | `test_fhir_to_omop_prc.py` | `<commit>` |
| 1M Observations < 10 min | `test_1m_observations_under_10_minutes` (perf decision doc) | `<commit>` |
| Consent never silently dropped | `test_map_consent_missing_provision_type_raises` | `<commit>` |
| All Phase 1 ADRs (0004–0008) present | `tests/test_adrs.py` | `<commit>` |
| All `parthenon-templates validate-manifests` exit 0 | CI workflow | `<commit>` |

(Pattern: 6-step TDD. Test asserts file exists + every row has a commit SHA placeholder filled in.)

Commit message: `docs(verification): Phase 1 DoD verification`.

---

## Task 10: Phase 1 devlog narrative

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1.md`

Tells the Phase 1 story: what shipped, why, what we learned. Mirrors `templates-phase-0.md`. Sections:

1. **Goal recap** — what Phase 1 set out to do (devplan T-010 → T-015).
2. **What shipped** — 7 plans, ~120 commits, ~50 manifests, 3 new node types, 5 new templates (fhir_resource pipeline, etl_dicom_metadata, load_imaging_vocabulary, qr_eq5d5l_to_measurement, qr_eq5d3l_to_measurement scaffold, fhir_anonymizer, fhir_to_omop). New Laravel migrations for `unmapped_concepts_queue` and `consent_decisions`.
3. **What we learned** —
   - Phase 0's runtime gap (parameter interpolation + db_dsn threading) was caught mid-Phase 0 and fixed in 3 commits; Phase 1 inherited a working runtime and didn't hit the same class of issues.
   - The wrapper-pattern for `fhir_anonymizer` (Plan 4) was an interim trade-off; Phase 2 cross-node path resolution will let us simplify.
   - The PRO instrument framework (Plan 3) deliberately didn't add manifest-level inheritance; sharing happens at the Python module layer. Worked well; PHQ-9/GAD-7 in Phase 2 will validate.
   - Performance: 1M Observations measured at `<TBD>s`; decision: `<SHIP|ESCALATE>`.
   - HIGHSEC posture: pixel-absence + PHI-leak regression guards both held throughout Phase 1; treat any future failure as a blocker.
4. **What's deferred** —
   - PHQ-9, GAD-7, PROMIS, KCCQ-12 (Phase 2)
   - DIMSE C-FIND DICOM source (Phase 3+ if asked)
   - WADO-RS pixel retrieval template (Phase 3+ image-feature extraction)
   - mTLS for DICOMweb / Laravel↔Python (deferred until customer ask)
   - `medicationReference` resolution (Phase 2 if needed)
   - Cross-node path resolution in the Materializer (Phase 2)
   - `prepared/` auto-cleanup post-anonymization (Phase 2)
   - Auto-track upstream IG releases (Phase 2)
5. **Acknowledgments** — devplan author, Phase 0 contributors, the orchestrator (claude-flow).

(Pattern: 6-step TDD. Test asserts file exists + has the 5 section headings.)

Commit message: `docs(devlog): Phase 1 templates narrative`.

---

## Task 11: Phase 1 operations runbook update

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-0-runbook.md` (extend with Phase 1 surfaces)
- OR
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1-runbook.md` (new file referenced from Phase 0 runbook)

Decision: **extend the Phase 0 runbook** with new sections rather than creating a separate Phase 1 runbook. Operators want one document, not two.

New sections to add:

1. **Anonymizer sidecar operations** —
   - `docker compose up -d parthenon-anonymizer` to start.
   - `/health` endpoint for liveness.
   - When the sidecar is unreachable: `MsAnonymizerBackend` raises `SidecarUnavailable`; the `fhir_anonymizer` template surfaces this as a run failure with status `failed`. Recovery: restart the sidecar, re-submit the run.
   - Log volume: the sidecar writes per-request logs to stdout; rotate via Docker's logging driver (already configured).

2. **DICOM ETL operations** —
   - `dicom_dir` parameter: ensure the directory is mounted into the templates container (typically a Docker volume).
   - DICOMweb auth: bearer token via secret. If token expires mid-run, the run fails; rotate token and re-submit.
   - Pixel-absence sanity: after a DICOM ETL run, `SELECT column_name FROM information_schema.columns WHERE table_name='dicom_metadata' AND column_name ILIKE '%pixel%'` should return 0 rows.

3. **PRO instrument operations** —
   - EuroQol value set must be customer-supplied; check the `eq5d_value_set_path` parameter points to a real file with non-placeholder data before any clinical use.
   - The placeholder file at `runtime/instruments/value_sets/eq5d5l_placeholder.csv` is a safety net — runs against it succeed but produce dimensional placeholder utility values.

4. **fhir_to_omop operations** —
   - Concept resolution misses: query `app.unmapped_concepts_queue` for the run's missing concepts. The Laravel `MappingReviewController` flow surfaces them to a human reviewer.
   - Consent decisions: query `app.consent_decisions` for `decision = 'deny'` rows; downstream cohort exports must filter out those `person_source_value`s.
   - IG version pin (`v0.1.0-parthenon`): bumping is a deliberate ADR amendment, not a hot-config change.

5. **Performance characteristics** —
   - Reference benchmark from Plan 7 Task 6: 1M Observations in `<TBD>s` on 8 vCPU / 32 GB / NVMe.
   - Memory budget: `<200 MB` RSS on a 1GB FHIR Bulk Data bundle (FhirResourceNode invariant).
   - When a run takes longer than 2× the benchmark, suspect: (a) cold vocabulary cache (first run after deploy), (b) IG snapshot drift (pinned version stale), (c) source FHIR server pagination defaults too small.

6. **Phase 1 runbook checklist** — copy from Phase 0 runbook + add Phase 1 entries:
   - `parthenon-templates` container healthy
   - `parthenon-anonymizer` sidecar healthy (when in use)
   - `parthenon-postgres` reachable from templates
   - `vocab.concept` populated with required vocabularies for the run's templates
   - For imaging templates: `Parthenon-Imaging` rows present
   - For PRO templates: customer-supplied EuroQol value set in place
   - For FHIR ETL: source FHIR server reachable; bearer token valid

(Pattern: 6-step TDD. Test asserts the new sections are present in the runbook.)

Commit message: `docs(runbook): extend templates ops runbook with Phase 1 surfaces`.

---

## Task 12: Phase 1 final integration and sign-off

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-1-signoff.md`

Mirror Phase 0's signoff (`templates-phase-0-signoff.md`). Concrete content:

1. **Final gate run output** — paste the actual results of:
   ```bash
   cd /home/smudoshi/Github/Parthenon/templates
   uv run parthenon-templates validate-manifests --root manifests
   uv run parthenon-templates lint-secret-keys --root manifests
   uv run pytest -q
   uv run ruff check .
   uv run black --check --line-length 100 .
   uv run mypy --strict runtime/
   ```

2. **Manifest count** — Phase 0 shipped 4 manifests; Phase 1 adds 5 (etl_dicom_metadata, load_imaging_vocabulary, qr_eq5d5l_to_measurement, qr_eq5d3l_to_measurement, fhir_anonymizer, fhir_to_omop). Total: 9 manifests.

3. **ADR count** — Phase 0 shipped 3; Phase 1 adds 4 (0004 Phase 1 nodes, 0005 imaging vocabulary, 0006 PRO framework, 0007 fhir_anonymizer, 0008 fhir_to_omop) — wait, that's 5. **Total: 8 ADRs.**

4. **Test count** — full pytest output line count.

5. **Open issues across Phase 1** — consolidated from each plan's "Open issues" (e.g., wrapper-pattern in fhir_anonymizer, medicationReference deferred, prepared/ cleanup deferred, Rust escalation status).

6. **Sign-off statement** — "Phase 1 is engineering-complete and ready for human review and merge to main. The orchestrator handles push and PR opening."

(Pattern: 6-step TDD. Test asserts file exists + lists Phase 1 plans 1–7 + final manifests count + final ADRs count.)

Commit message: `docs(milestone): Phase 1 templates final sign-off`.

---

## Definition of Done — Plan 7 (and Phase 1)

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; lists 9 manifests (Phase 0 + Plans 2/3/4 + 1 fhir_to_omop manifest spanning PR-A/B/C).
- [ ] `parthenon-templates lint-secret-keys --root manifests` clean.
- [ ] `pytest -q` (full suite) green; new tests for diagnostic_report, consent, perf decision doc, and PR-C E2E all pass.
- [ ] `pytest -m slow tests/performance/` PASS within 600 s for 1M Observations on reference hardware.
- [ ] `pytest -m integration` includes `test_fhir_to_omop_prc.py`, passes.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow runs PR-A, PR-B, AND PR-C E2E (the PR-C step is added in Task 5).
- [ ] All 8 ADRs (0001–0008) pass `tests/test_adrs.py`.
- [ ] All 6 Phase 1 closeout documents present:
  - `templates-phase-1-perf-decision.md`
  - `templates-phase-1-security.md`
  - `templates-phase-1-dod.md`
  - `templates-phase-1.md` (devlog narrative)
  - `templates-phase-0-runbook.md` (extended with Phase 1 sections, OR a new `templates-phase-1-runbook.md`)
  - `templates-phase-1-signoff.md`
- [ ] Performance decision (SHIP vs ESCALATE) is documented and consistent across the perf-decision doc, DoD verification, and devlog narrative.
- [ ] Phase 1 final commit count: ~70-90 across all 7 plans.

## Branch model

- Branch off Plan 6 branch tip into `feature/phase-1-templates-fhir-to-omop-prc-and-closeout`.
- 12 commits expected.
- DO NOT push from a subagent.

## What unblocks Phase 2

Phase 1 closes when this plan ships. Phase 2 (NER, MIMIC, ARTEMIS, SDTM) starts immediately after with `runtime.fhir_to_omop` and the AnonymizerNode/sidecar already in place. Phase 2 plans will mirror the Phase 0 / Phase 1 structure — design spec → per-task plans → execution → closeout.

## Out of scope (handled by Phase 2 or later)

- Phase 2 source-format breadth (NER, MIMIC, ARTEMIS, SDTM).
- Phase 3 differentiators (Claims X12, Registries, LIS LOINC harmonizer, AI-assisted mapping).
- Rust-assisted ingestion (Plan 8 if escalated; otherwise deferred).
- Cross-node path resolution in the Materializer (Phase 2; lets `fhir_anonymizer` drop its wrapper pattern).
- `prepared/` auto-cleanup after `summarize` succeeds (Phase 2).
- mTLS for DICOMweb and Laravel↔Python (deferred until customer ask).
- `medicationReference` resolution (Phase 2 if customer-driven).
- IG version auto-tracking from upstream HL7 releases (Phase 2 follow-up).
- PHQ-9 / GAD-7 / PROMIS / KCCQ-12 PRO templates (Phase 2; pro_base framework already validated by EQ-5D-5L + EQ-5D-3L).
