"""Phase 3 Plan 4C Tasks 4 + 5 (T-022C): registry_to_omop_ncdr manifest."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

MANIFEST_DIR = (
    Path(__file__).resolve().parents[4] / "commercial" / "manifests" / "registry_to_omop_ncdr"
)
SQL_DIR = MANIFEST_DIR / "sql"


def _load() -> dict[str, object]:
    raw = (MANIFEST_DIR / "manifest.yaml").read_text(encoding="utf-8")
    parsed = yaml.safe_load(raw)
    assert isinstance(parsed, dict)
    return parsed


def test_manifest_loads() -> None:
    cfg = _load()
    assert cfg["apiVersion"] == "parthenon.acumenus.net/v1"
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    assert metadata["id"] == "registry_to_omop_ncdr"


def test_manifest_marks_commercial_tier() -> None:
    cfg = _load()
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    tags = metadata.get("tags", [])
    for tag in ("commercial", "ncdr", "cardiology", "pci"):
        assert tag in tags


def test_manifest_requires_pci_vocabularies() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    required = spec["requires"]["vocabularies"]
    for vocab in ("ICD10CM", "CPT4", "HCPCS", "SNOMED", "LOINC", "FDA_UDI"):
        assert vocab in required


def test_manifest_has_eight_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    # bootstrap + load + 5 mappers (procedure / measurement / device /
    # condition / episode) + summarize = 8
    assert len(nodes) == 8


@pytest.mark.parametrize(
    "node_id",
    [
        "bootstrap_source",
        "load_ncdr",
        "map_procedure_occurrence",
        "map_measurement",
        "map_device_exposure",
        "map_condition_occurrence",
        "map_episode",
        "summarize",
    ],
)
def test_manifest_declares_required_node(node_id: str) -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    ids = {n["node_id"] for n in spec["nodes"]}
    assert node_id in ids


def test_required_sql_files_exist() -> None:
    for filename in (
        "00_bootstrap_ncdr_source.sql",
        "01_load_ncdr_csv.sql",
        "02a_map_procedure_occurrence.sql",
        "02b_map_measurement.sql",
        "02c_map_device_exposure.sql",
        "02d_map_condition_occurrence.sql",
        "02e_map_episode.sql",
        "03_summarize.sql",
    ):
        assert (SQL_DIR / filename).is_file()


def test_device_exposure_sql_uses_fda_udi_vocabulary() -> None:
    """Plan 4C is the first commercial template to populate DEVICE_EXPOSURE.
    The mapping joins on FDA_UDI vocabulary."""
    sql = (SQL_DIR / "02c_map_device_exposure.sql").read_text(encoding="utf-8")
    assert "vocabulary_id = 'FDA_UDI'" in sql
    assert "INSERT INTO ${parameters.cdm_schema}.device_exposure" in sql
    assert "unnest(COALESCE(p.stent_udis" in sql


def test_bootstrap_sql_enforces_parallel_lists() -> None:
    """fmt_ncdr_pci must enforce cardinality(stent_udis) = cardinality(stent_types)."""
    sql = (SQL_DIR / "00_bootstrap_ncdr_source.sql").read_text(encoding="utf-8")
    assert "cardinality(stent_udis) = cardinality(stent_types)" in sql


def test_episode_sql_uses_canonical_source_value() -> None:
    """HIGHSEC §7: episode_source_value uses procedure code, not patient_id."""
    sql = (SQL_DIR / "02e_map_episode.sql").read_text(encoding="utf-8")
    assert "'PCI:' || p.primary_procedure_code" in sql


def test_readme_exists_and_documents_license() -> None:
    readme = MANIFEST_DIR / "README.md"
    assert readme.is_file()
    text = readme.read_text(encoding="utf-8")
    assert "ACC NCDR Participant Agreement" in text
    assert "FDA UDI" in text
