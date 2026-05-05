"""Phase 2 Plan 4 Tasks 5-13: structural assertions on the per-domain mapper SQL.

Verify each mapper INSERTs into the right OMOP table, JOINs against the
right source table, and uses the expected vocab lookups. The runtime
correctness is exercised by the testcontainers E2E in Task 15.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL_DIR = Path(__file__).resolve().parents[2] / "manifests" / "load_mimic_iv_omop" / "sql"


# Task 5 -----------------------------------------------------------------


def test_person_mapper_inserts_from_fmt_patients() -> None:
    body = (SQL_DIR / "04a_map_person_death.sql").read_text(encoding="utf-8")
    assert re.search(r"INSERT INTO\s+\$\{parameters\.target_schema\}\.person", body, re.I)
    assert "mimic_iv_source.fmt_patients" in body


def test_person_mapper_handles_gender_codes() -> None:
    body = (SQL_DIR / "04a_map_person_death.sql").read_text(encoding="utf-8")
    assert "8507" in body  # Male
    assert "8532" in body  # Female


def test_death_mapper_inserts_when_dod_present() -> None:
    body = (SQL_DIR / "04a_map_person_death.sql").read_text(encoding="utf-8")
    assert re.search(r"INSERT INTO\s+\$\{parameters\.target_schema\}\.death", body, re.I)
    assert "dod IS NOT NULL" in body


# Task 6 -----------------------------------------------------------------


@pytest.mark.parametrize("tbl", ["location", "care_site", "provider"])
def test_location_caresite_provider_synthesizes_row(tbl: str) -> None:
    body = (SQL_DIR / "04b_map_location_caresite_provider.sql").read_text(encoding="utf-8")
    assert re.search(rf"INSERT INTO\s+\$\{{parameters\.target_schema\}}\.{tbl}", body, re.I)


# Task 7 -----------------------------------------------------------------


def test_visit_occurrence_inserts_from_admissions() -> None:
    body = (SQL_DIR / "05_map_visit.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.visit_occurrence" in body
    assert "mimic_iv_source.fmt_admissions" in body


def test_visit_concept_id_uses_admission_type() -> None:
    body = (SQL_DIR / "05_map_visit.sql").read_text(encoding="utf-8")
    assert "admission_type" in body
    assert "9201" in body  # Inpatient
    assert "9203" in body  # ER


def test_visit_detail_inserts_from_icustays() -> None:
    body = (SQL_DIR / "05_map_visit.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.visit_detail" in body
    assert "fmt_icustays" in body


# Task 8 -----------------------------------------------------------------


def test_condition_uses_icd_lookup_join() -> None:
    body = (SQL_DIR / "06a_map_condition.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.condition_occurrence" in body
    assert "fmt_diagnoses_icd" in body
    assert "lkp_icd9_to_snomed_condition" in body
    assert "lkp_icd10_to_snomed_condition" in body


def test_unmapped_codes_logged_to_queue() -> None:
    body = (SQL_DIR / "06a_map_condition.sql").read_text(encoding="utf-8")
    assert "unmapped_concepts_queue" in body


# Task 9 -----------------------------------------------------------------


def test_procedure_uses_pcs_lookup_join() -> None:
    body = (SQL_DIR / "06b_map_procedure.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.procedure_occurrence" in body
    assert "fmt_procedures_icd" in body
    assert "lkp_icd9_pcs_to_snomed_procedure" in body
    assert "lkp_icd10_pcs_to_snomed_procedure" in body


# Task 10 ----------------------------------------------------------------


def test_measurement_inserts_from_labevents() -> None:
    body = (SQL_DIR / "07a_map_measurement.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.measurement" in body
    assert "fmt_labevents" in body
    assert "lkp_loinc_for_lab" in body


def test_measurement_handles_value_and_unit() -> None:
    body = (SQL_DIR / "07a_map_measurement.sql").read_text(encoding="utf-8")
    assert "valuenum" in body
    assert "valueuom" in body


# Task 11 ----------------------------------------------------------------


def test_drug_exposure_inserts_from_prescriptions() -> None:
    body = (SQL_DIR / "07b_map_drug_exposure.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.drug_exposure" in body
    assert "fmt_prescriptions" in body


def test_drug_exposure_uses_ndc_or_rxnorm() -> None:
    body = (SQL_DIR / "07b_map_drug_exposure.sql").read_text(encoding="utf-8")
    assert "lkp_ndc_for_drug" in body
    assert "lkp_rxnorm_for_med" in body


# Task 12 ----------------------------------------------------------------


def test_observation_uses_chartevent_allowlist() -> None:
    body = (SQL_DIR / "07c_map_observation.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.observation" in body
    assert "fmt_chartevents" in body
    assert "lkp_chartevent_allowlist" in body


# Task 13 ----------------------------------------------------------------


def test_note_inserts_from_noteevents() -> None:
    body = (SQL_DIR / "08_map_note.sql").read_text(encoding="utf-8")
    assert "INSERT INTO ${parameters.target_schema}.note" in body
    assert "fmt_noteevents" in body


def test_note_carries_category_and_text() -> None:
    body = (SQL_DIR / "08_map_note.sql").read_text(encoding="utf-8")
    assert "category" in body
    assert "n.text" in body or "note_text" in body
