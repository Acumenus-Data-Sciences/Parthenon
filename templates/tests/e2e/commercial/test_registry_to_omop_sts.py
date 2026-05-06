"""Phase 3 Plan 4B Task 7 (T-022B): registry_to_omop_sts validation E2E.

In-process reader against the seed=42 / n_surgeries=50 corpus. Same
gating as Plans 1-3 + 4A — full SQL pipeline against testcontainers
Postgres lands once the runner gains a programmatic ``run_manifest``
driver (Phase 4 follow-up).

Acceptance per plan §7:

1. 100% of CSV rows produce typed STSRecords (50 in / 50 out).
2. Every surgery has a procedure category in the v0.1 enum.
3. Postop complications fan out as expected (AKI on >=7, mortality=5).
4. Episode source value is assembled from procedure_category + CPT only
   (HIGHSEC §7 — verified via the manifest test, complementary here).
5. Reader is idempotent on replay.
"""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

import pytest

from runtime.commercial.registry.sts.reader import STSReader

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = (
    _REPO / "commercial" / "manifests" / "registry_to_omop_sts" / "fixtures" / "synthetic"
)


def _load_builder():  # type: ignore[no-untyped-def]
    builder_path = _FIXTURE_DIR / "build_sts_corpus.py"
    spec = importlib.util.spec_from_file_location("build_sts_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_sts_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.slow
def test_sts_e2e_meets_acceptance_gates() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_surgeries=50)  # type: ignore[attr-defined]
    records = STSReader().read(io.StringIO(csv_payload))

    # Gate 1: 50 in / 50 out
    assert len(records) == 50

    # Gate 2: every record has a known procedure category.
    valid_cats = {"CABG", "Valve", "Aortic", "Combined", "Other"}
    for r in records:
        assert r.procedure_category in valid_cats

    # Gate 3: postop complications + mortality fan out.
    aki = sum(1 for r in records if r.postop_aki)
    mortality = sum(1 for r in records if r.mortality_30day)
    assert aki >= 7
    assert mortality == 5

    # Gate 5 (gate 4 = SQL-side; covered in manifest tests):
    # Idempotency.
    a = STSReader().read(io.StringIO(csv_payload))
    b = STSReader().read(io.StringIO(csv_payload))
    assert a == b


@pytest.mark.slow
def test_sts_e2e_handles_full_complication_matrix() -> None:
    """Edge case: a surgery with all 4 complications + death.

    The fixture's mod-N spread doesn't naturally produce one of these,
    but we can exercise it with custom CSV input to confirm the reader
    handles the worst case correctly.
    """
    csv_payload = (
        "RecordID,PatientID,SurgeryDate,PatientAge,Gender,HospitalID,SurgeonID,"
        "EjectionFraction,NyhaClass,PrimaryDiagnosis,SecondaryDiagnoses,"
        "ProcedureID,ProcedureCode_Primary,ProcedureCode_Secondary,"
        "PostOpComplication_AKI,PostOpComplication_Stroke,"
        "PostOpComplication_Reoperation,PostOpComplication_Sepsis,"
        "LengthOfStay,DischargeDisposition,Mortality_30Day\n"
        "STS-WORST,PAT99999,20240601,72,M,H001,S001,30.0,4,I50.32,"
        "I25.10;E11.9,Combined,33536,33510,yes,yes,yes,yes,21,Death,yes\n"
    )
    records = STSReader().read(io.StringIO(csv_payload))
    r = records[0]
    assert r.postop_aki and r.postop_stroke and r.postop_reoperation and r.postop_sepsis
    assert r.mortality_30day
    assert r.discharge_disposition == "Death"
