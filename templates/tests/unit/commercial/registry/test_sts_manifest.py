"""Phase 3 Plan 4B Tasks 4 + 5 (T-022B): registry_to_omop_sts manifest."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

MANIFEST_DIR = (
    Path(__file__).resolve().parents[4] / "commercial" / "manifests" / "registry_to_omop_sts"
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
    assert cfg["kind"] == "Template"
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    assert metadata["id"] == "registry_to_omop_sts"


def test_manifest_marks_commercial_tier() -> None:
    cfg = _load()
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    tags = metadata.get("tags", [])
    assert "commercial" in tags
    assert "sts" in tags
    assert "cardiac-surgery" in tags


def test_manifest_requires_cardiac_vocabularies() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    required = spec["requires"]["vocabularies"]
    for vocab in ("ICD10CM", "CPT4", "HCPCS", "SNOMED"):
        assert vocab in required


def test_manifest_has_six_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    assert len(nodes) == 6


@pytest.mark.parametrize(
    "node_id",
    [
        "bootstrap_source",
        "load_sts",
        "map_procedure_occurrence",
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
        "00_bootstrap_sts_source.sql",
        "01_load_sts_csv.sql",
        "02a_map_procedure_occurrence.sql",
        "02b_map_condition_occurrence.sql",
        "02c_map_episode.sql",
        "03_summarize.sql",
    ):
        assert (SQL_DIR / filename).is_file()


def test_episode_sql_assembles_source_value_from_canonical_codes() -> None:
    """HIGHSEC §7: episode_source_value uses procedure category + CPT, no patient ids."""
    sql = (SQL_DIR / "02c_map_episode.sql").read_text(encoding="utf-8")
    assert "procedure_category || ':' || s.primary_procedure_code" in sql
    assert "patient_id" not in sql.replace("hashtext(s.patient_id)", "")  # only inside hashtext


def test_procedure_sql_handles_primary_and_secondary() -> None:
    sql = (SQL_DIR / "02a_map_procedure_occurrence.sql").read_text(encoding="utf-8")
    assert "primary_procedure_code" in sql
    assert "secondary_procedure_codes" in sql
    assert "UNION ALL" in sql


def test_condition_sql_includes_postop_complications() -> None:
    sql = (SQL_DIR / "02b_map_condition_occurrence.sql").read_text(encoding="utf-8")
    for col in ("postop_aki", "postop_stroke", "postop_reoperation", "postop_sepsis"):
        assert col in sql


def test_readme_exists_and_documents_license() -> None:
    readme = MANIFEST_DIR / "README.md"
    assert readme.is_file()
    text = readme.read_text(encoding="utf-8")
    assert "STS Participant Agreement" in text
    assert "v4.20.2" in text
