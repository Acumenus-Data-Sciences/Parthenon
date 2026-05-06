"""Plan 6 Task 12: sdtm_to_omop_v54 manifest + SQL shape."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

MANIFEST_DIR = Path(__file__).resolve().parents[2] / "manifests" / "sdtm_to_omop_v54"
SQL_DIR = MANIFEST_DIR / "sql"


def _load() -> dict:
    return yaml.safe_load((MANIFEST_DIR / "manifest.yaml").read_text(encoding="utf-8"))


def test_manifest_loads() -> None:
    cfg = _load()
    assert cfg["apiVersion"] == "parthenon.acumenus.net/v1"
    assert cfg["kind"] == "Template"
    assert cfg["metadata"]["id"] == "sdtm_to_omop_v54"


def test_manifest_requires_meddra() -> None:
    cfg = _load()
    required = cfg["spec"]["requires"]["vocabularies"]
    for v in ("SNOMED", "LOINC", "RxNorm", "MedDRA"):
        assert v in required


def test_manifest_declares_5_sdtm_domain_nodes() -> None:
    cfg = _load()
    domain_nodes = [n for n in cfg["spec"]["nodes"] if n["type"] == "sdtm_domain"]
    domains = {n["params"]["domain"] for n in domain_nodes}
    assert domains == {"DM", "AE", "CM", "VS", "LB"}


@pytest.mark.parametrize(
    "sql_file,target,source",
    [
        ("00_bootstrap_source_schema.sql", "sdtm_source.fmt_dm", None),
        ("01_bootstrap_cdm_schema.sql", "${parameters.cdm_schema}.person", None),
        ("02a_map_person_location.sql", "${parameters.cdm_schema}.person", "sdtm_source.fmt_dm"),
        (
            "02b_map_condition_from_ae.sql",
            "${parameters.cdm_schema}.condition_occurrence",
            "sdtm_source.fmt_ae",
        ),
        (
            "02c_map_drug_from_cm.sql",
            "${parameters.cdm_schema}.drug_exposure",
            "sdtm_source.fmt_cm",
        ),
        (
            "02d_map_measurement_from_vs.sql",
            "${parameters.cdm_schema}.measurement",
            "sdtm_source.fmt_vs",
        ),
        (
            "02e_map_measurement_from_lb.sql",
            "${parameters.cdm_schema}.measurement",
            "sdtm_source.fmt_lb",
        ),
    ],
)
def test_mapper_targets_and_sources(sql_file: str, target: str, source: str | None) -> None:
    body = (SQL_DIR / sql_file).read_text(encoding="utf-8")
    assert target in body, f"{sql_file} should reference {target}"
    if source:
        assert source in body, f"{sql_file} should JOIN {source}"


def test_ae_mapper_uses_meddra_to_snomed_path() -> None:
    body = (SQL_DIR / "02b_map_condition_from_ae.sql").read_text(encoding="utf-8")
    assert "MedDRA" in body
    assert "concept_relationship" in body
    assert "Maps to" in body


def test_cm_mapper_uses_rxnorm_lookup() -> None:
    body = (SQL_DIR / "02c_map_drug_from_cm.sql").read_text(encoding="utf-8")
    assert "RxNorm" in body
    assert "CMTRT" in body


def test_vs_lb_mappers_use_loinc_lookup() -> None:
    for f in ("02d_map_measurement_from_vs.sql", "02e_map_measurement_from_lb.sql"):
        body = (SQL_DIR / f).read_text(encoding="utf-8")
        assert "LOINC" in body


def test_lb_mapper_carries_range_low_high() -> None:
    body = (SQL_DIR / "02e_map_measurement_from_lb.sql").read_text(encoding="utf-8")
    assert "range_low" in body
    assert "range_high" in body
    assert "LBORNRLO" in body
    assert "LBORNRHI" in body


def test_unmapped_codes_logged_to_queue() -> None:
    body = (SQL_DIR / "02a_map_person_location.sql").read_text(encoding="utf-8")
    assert "unmapped_concepts_queue" in body


def test_readme_documents_v1_scope() -> None:
    body = (MANIFEST_DIR / "README.md").read_text(encoding="utf-8")
    assert "DM" in body and "AE" in body and "CM" in body and "VS" in body and "LB" in body
    assert "MedDRA" in body
