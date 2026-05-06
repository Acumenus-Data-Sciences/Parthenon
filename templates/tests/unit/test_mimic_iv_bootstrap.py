"""Phase 2 Plan 4 Tasks 1-4: structural assertions on the MIMIC-IV bootstrap SQL.

These tests verify the SQL files declare the expected schemas + tables. The
actual data correctness is exercised by the testcontainers-backed E2E in
Task 15 — we don't run a real Postgres here, just assert the static SQL.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

SQL_DIR = Path(__file__).resolve().parents[2] / "manifests" / "load_mimic_iv_omop" / "sql"


# Task 1 ----------------------------------------------------------------


def test_bootstrap_creates_source_schema() -> None:
    body = (SQL_DIR / "00_bootstrap_source_schema.sql").read_text(encoding="utf-8")
    assert re.search(r"CREATE SCHEMA IF NOT EXISTS\s+mimic_iv_source", body, re.I)


@pytest.mark.parametrize(
    "tbl",
    [
        "fmt_patients",
        "fmt_admissions",
        "fmt_transfers",
        "fmt_diagnoses_icd",
        "fmt_procedures_icd",
        "fmt_labevents",
        "fmt_prescriptions",
        "fmt_chartevents",
        "fmt_noteevents",
        "fmt_drgcodes",
        "fmt_icustays",
    ],
)
def test_bootstrap_creates_fmt_table(tbl: str) -> None:
    body = (SQL_DIR / "00_bootstrap_source_schema.sql").read_text(encoding="utf-8")
    assert re.search(
        rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?mimic_iv_source\.{tbl}\b", body, re.I
    ), f"missing CREATE TABLE for {tbl}"


# Task 2 ----------------------------------------------------------------


@pytest.mark.parametrize(
    "tbl",
    [
        "fmt_patients",
        "fmt_admissions",
        "fmt_diagnoses_icd",
        "fmt_procedures_icd",
        "fmt_labevents",
        "fmt_prescriptions",
        "fmt_chartevents",
        "fmt_noteevents",
        "fmt_drgcodes",
        "fmt_icustays",
        "fmt_transfers",
    ],
)
def test_loader_uses_copy_for_each_fmt_table(tbl: str) -> None:
    body = (SQL_DIR / "01_load_source_csv.sql").read_text(encoding="utf-8")
    assert re.search(rf"COPY mimic_iv_source\.{tbl}\b", body, re.I), f"missing COPY for {tbl}"


def test_loader_parameterizes_csv_root() -> None:
    body = (SQL_DIR / "01_load_source_csv.sql").read_text(encoding="utf-8")
    assert "${parameters.csv_root}" in body


# Task 3 ----------------------------------------------------------------


@pytest.mark.parametrize(
    "lookup",
    [
        "lkp_icd9_to_snomed_condition",
        "lkp_icd10_to_snomed_condition",
        "lkp_icd9_pcs_to_snomed_procedure",
        "lkp_icd10_pcs_to_snomed_procedure",
        "lkp_loinc_for_lab",
        "lkp_rxnorm_for_med",
        "lkp_ndc_for_drug",
    ],
)
def test_lookup_table_created(lookup: str) -> None:
    body = (SQL_DIR / "02_vocab_lookup_tables.sql").read_text(encoding="utf-8")
    assert re.search(rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?mimic_iv_source\.{lookup}\b", body, re.I)


def test_lookups_use_concept_relationship_maps_to() -> None:
    body = (SQL_DIR / "02_vocab_lookup_tables.sql").read_text(encoding="utf-8")
    assert "concept_relationship" in body
    assert "Maps to" in body


def test_lookups_parameterize_vocab_schema() -> None:
    body = (SQL_DIR / "02_vocab_lookup_tables.sql").read_text(encoding="utf-8")
    assert "${parameters.vocab_schema}" in body


# Task 4 ----------------------------------------------------------------


def test_cdm_bootstrap_creates_target_schema() -> None:
    body = (SQL_DIR / "03_bootstrap_cdm_schema.sql").read_text(encoding="utf-8")
    assert re.search(r"CREATE SCHEMA IF NOT EXISTS\s+\$\{parameters\.target_schema\}", body, re.I)


@pytest.mark.parametrize(
    "tbl",
    [
        "person",
        "death",
        "location",
        "care_site",
        "provider",
        "visit_occurrence",
        "visit_detail",
        "condition_occurrence",
        "procedure_occurrence",
        "measurement",
        "drug_exposure",
        "observation",
        "note",
    ],
)
def test_cdm_bootstrap_creates_table(tbl: str) -> None:
    body = (SQL_DIR / "03_bootstrap_cdm_schema.sql").read_text(encoding="utf-8")
    assert re.search(
        rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?\$\{{parameters\.target_schema\}}\.{tbl}\b", body, re.I
    ), f"missing CREATE TABLE for {tbl}"
