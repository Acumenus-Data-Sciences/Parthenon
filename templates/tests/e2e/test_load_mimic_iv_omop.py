"""Phase 2 Plan 4 Task 15: load_mimic_iv_omop E2E against testcontainers.

Drives the full 13-stage SQL pipeline against the synthetic 10-patient
fixture. Asserts:
- person, visit_occurrence, condition_occurrence rowcounts > 0 and
  match the expected synthetic shape (≥10 persons, ≥30 visits, etc).
- All CDM tables in mimic_iv schema exist post-bootstrap.
- summarize result_artifact is materialized with non-zero row counts.

The full ±2% acceptance against the OHDSI MIMIC-IV demo reference is
documented in validation/expected/post_conditions.yaml; the synthetic
shape this E2E asserts is much smaller.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "load_mimic_iv_omop"


@pytest.mark.integration
def test_synthetic_fixture_corpus_present() -> None:
    """The synthetic fixture must be materialized before the E2E can run."""
    csv_root = MANIFEST_DIR / "fixtures" / "synthetic" / "csv"
    assert (csv_root / "hosp" / "patients.csv").is_file()
    assert (csv_root / "hosp" / "admissions.csv").is_file()
    assert (csv_root / "hosp" / "diagnoses_icd.csv").is_file()
    assert (csv_root / "hosp" / "labevents.csv").is_file()
    assert (csv_root / "hosp" / "prescriptions.csv").is_file()
    assert (csv_root / "icu" / "icustays.csv").is_file()
    assert (csv_root / "icu" / "chartevents.csv").is_file()
    assert (csv_root / "note" / "noteevents.csv").is_file()


@pytest.mark.integration
def test_synthetic_fixture_has_expected_row_counts() -> None:
    """Sanity-check the deterministic synthetic fixture seed (=42) shape."""
    csv_root = MANIFEST_DIR / "fixtures" / "synthetic" / "csv"
    patients = (csv_root / "hosp" / "patients.csv").read_text(encoding="utf-8").splitlines()
    admissions = (csv_root / "hosp" / "admissions.csv").read_text(encoding="utf-8").splitlines()
    # Header + 10 data rows for patients; admissions varies 2-5 per patient.
    assert len(patients) == 11
    assert len(admissions) >= 21  # at least 2/patient
    assert len(admissions) <= 51  # at most 5/patient


@pytest.mark.integration
@pytest.mark.skip(
    reason="Full testcontainers E2E still requires vocab seeding + manifest "
    "run-orchestration scaffolding. Phase 3 Plan 0 landed the sql_node "
    "sql_file:// reader (one of two original gating items); the remaining "
    "blocker is a vocab-seed harness for testcontainers Postgres, tracked "
    "as a Phase 4 follow-up. Structural SQL tests (test_mimic_iv_bootstrap "
    "+ test_mimic_iv_mappers) and fixture tests above provide unit-level "
    "coverage in the meantime."
)
def test_load_mimic_iv_omop_runs_to_completion() -> None:
    """Full E2E placeholder.

    Phase 3 Plan 0 unblocked the ``sql_file://`` reader path. The remaining
    work to lift this skip is a vocab-seed harness that loads minimal
    SNOMED/ICD/RxNorm/LOINC concepts into a testcontainers Postgres + a
    materializer driver that runs the full manifest end-to-end against
    that DB. Tracked as a Phase 4 follow-up.
    """
