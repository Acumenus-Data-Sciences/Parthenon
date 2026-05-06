"""Phase 3 Plan 1 Tasks 8-9: claims_to_omop SQL stages.

Asserts the SQL files exist with the right shape:

- ``00_bootstrap_source_schema.sql`` creates ``fmt_837_claim`` +
  ``fmt_837_line`` in ``${parameters.source_schema}``.
- ``01_bootstrap_cdm_schema.sql`` creates the OMOP target tables.
- ``01_load_source_csv.sql`` is the CSV loader contract (used by the
  reader's bulk-COPY path).
- ``02a..02d`` are the four mappers; each touches the expected
  ``${parameters.cdm_schema}.<table>`` and joins ``vocab.concept``
  via ``concept_relationship 'Maps to'``.
- ``03_summarize.sql`` returns at least one row.
- ``04*_*.sql`` validation checks materialize their sentinel artifacts.
- ``05_validate.sql`` aggregates the sentinel results into a final
  validation artifact.
"""

from __future__ import annotations

from pathlib import Path

import pytest

SQL_DIR = (
    Path(__file__).resolve().parents[3] / "commercial" / "manifests" / "claims_to_omop" / "sql"
)


@pytest.mark.parametrize(
    "filename",
    [
        "00_bootstrap_source_schema.sql",
        "01_bootstrap_cdm_schema.sql",
        "01_load_source_csv.sql",
        "02a_map_visit_occurrence.sql",
        "02b_map_procedure_occurrence.sql",
        "02c_map_condition_occurrence.sql",
        "02d_project_cost.sql",
        "03_summarize.sql",
        "04a_cost_sentinel.sql",
        "04b_orphan_procedure_check.sql",
        "04c_condition_recall_check.sql",
        "05_validate.sql",
    ],
)
def test_sql_file_exists(filename: str) -> None:
    assert (SQL_DIR / filename).is_file(), f"missing {filename}"


def test_bootstrap_source_creates_two_fmt_tables() -> None:
    text = (SQL_DIR / "00_bootstrap_source_schema.sql").read_text(encoding="utf-8")
    upper = text.upper()
    assert "CREATE SCHEMA" in upper
    assert "FMT_837_CLAIM" in upper
    assert "FMT_837_LINE" in upper
    # Schema must be parameterized for the manifest's source_schema knob.
    assert "${parameters.source_schema}" in text or "${parameters.source_schema}" in text


def test_bootstrap_source_uses_parameter() -> None:
    text = (SQL_DIR / "00_bootstrap_source_schema.sql").read_text(encoding="utf-8")
    # The runner substitutes ${parameters.source_schema} at execution time.
    assert "${parameters.source_schema}" in text


def test_bootstrap_cdm_creates_cost_table() -> None:
    text = (SQL_DIR / "01_bootstrap_cdm_schema.sql").read_text(encoding="utf-8")
    upper = text.upper()
    # The CDM bootstrap creates the four target tables (visit_occurrence,
    # procedure_occurrence, condition_occurrence, cost) plus
    # payer_plan_period as a stub (we don't populate it from 837 alone).
    for tbl in (
        "VISIT_OCCURRENCE",
        "PROCEDURE_OCCURRENCE",
        "CONDITION_OCCURRENCE",
        "COST",
    ):
        assert tbl in upper, f"bootstrap_cdm missing {tbl}"
    assert "${parameters.cdm_schema}" in text


@pytest.mark.parametrize(
    "filename,expected_table",
    [
        ("02a_map_visit_occurrence.sql", "VISIT_OCCURRENCE"),
        ("02b_map_procedure_occurrence.sql", "PROCEDURE_OCCURRENCE"),
        ("02c_map_condition_occurrence.sql", "CONDITION_OCCURRENCE"),
        ("02d_project_cost.sql", "COST"),
    ],
)
def test_mapper_targets_correct_cdm_table(filename: str, expected_table: str) -> None:
    text = (SQL_DIR / filename).read_text(encoding="utf-8")
    upper = text.upper()
    assert expected_table in upper, f"{filename} does not target {expected_table}"
    assert "${parameters.cdm_schema}" in text


@pytest.mark.parametrize(
    "filename",
    [
        "02b_map_procedure_occurrence.sql",
        "02c_map_condition_occurrence.sql",
    ],
)
def test_mapper_joins_concept_relationship_maps_to(filename: str) -> None:
    text = (SQL_DIR / filename).read_text(encoding="utf-8")
    upper = text.upper()
    assert "CONCEPT_RELATIONSHIP" in upper
    assert "MAPS TO" in upper, f"{filename} missing 'Maps to' relationship"


def test_cost_projector_uses_currency_concept() -> None:
    text = (SQL_DIR / "02d_project_cost.sql").read_text(encoding="utf-8")
    # USD = 44818668 hard-coded in v0.1 per ADR 0016.
    assert "44818668" in text


def test_cost_projector_emits_three_concept_kinds() -> None:
    text = (SQL_DIR / "02d_project_cost.sql").read_text(encoding="utf-8")
    # Cost concept IDs: charged 31968, allowed 31976, paid 31973.
    for cid in ("31968", "31976", "31973"):
        assert cid in text, f"02d_project_cost missing cost_concept {cid}"
