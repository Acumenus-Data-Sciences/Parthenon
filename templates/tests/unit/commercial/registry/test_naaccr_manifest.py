"""Phase 3 Plan 4A Tasks 5 + 6 (T-022A): registry_to_omop_naaccr manifest."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

MANIFEST_DIR = (
    Path(__file__).resolve().parents[4] / "commercial" / "manifests" / "registry_to_omop_naaccr"
)
SQL_DIR = MANIFEST_DIR / "sql"
PARTIALS_DIR = Path(__file__).resolve().parents[4] / "commercial" / "manifests" / "_partials"


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
    assert metadata["id"] == "registry_to_omop_naaccr"
    assert "5.4" in metadata["cdm_versions"]


def test_manifest_marks_commercial_tier() -> None:
    cfg = _load()
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    tags = metadata.get("tags", [])
    assert "commercial" in tags
    assert "naaccr" in tags
    assert "oncology" in tags


def test_manifest_requires_oncology_vocabularies() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    required = spec["requires"]["vocabularies"]
    for vocab in ("ICDO3", "SNOMED", "NAACCR"):
        assert vocab in required


def test_manifest_has_six_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    # bootstrap_source + load_naaccr + 3 mappers (condition/episode/event) + summarize = 6
    assert len(nodes) == 6


@pytest.mark.parametrize(
    "node_id",
    [
        "bootstrap_source",
        "load_naaccr",
        "map_condition_occurrence",
        "map_episode",
        "map_episode_event",
        "summarize",
    ],
)
def test_manifest_declares_required_node(node_id: str) -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    ids = {n["node_id"] for n in spec["nodes"]}
    assert node_id in ids


def test_manifest_sql_stages_use_file_url() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    sql_nodes = [n for n in spec["nodes"] if n["type"] == "sql"]
    for node in sql_nodes:
        params = node["params"]
        ref = params.get("sql_file") or params.get("fetch_query_file")
        assert ref is not None
        assert ref.startswith("file://sql/")


def test_required_sql_files_exist() -> None:
    for filename in [
        "00_bootstrap_naaccr_source.sql",
        "01_load_naaccr_csv.sql",
        "02a_map_condition_occurrence.sql",
        "02b_map_episode.sql",
        "02c_map_episode_event.sql",
        "03_summarize.sql",
    ]:
        assert (SQL_DIR / filename).is_file(), f"missing {filename}"


def test_episode_sql_assembles_source_value_from_canonical_codes() -> None:
    """HIGHSEC §7: episode_source_value must be ICD-O-3 codes only,
    never patient_id or name."""
    sql = (SQL_DIR / "02b_map_episode.sql").read_text(encoding="utf-8")
    assert "primary_site || '/' || r.histologic_type_icdo3" in sql
    # Sanity: no patient identifier in the assembly
    assert "patient_id_number ||" not in sql
    assert "name_last ||" not in sql


def test_condition_sql_filters_to_malignant_behavior() -> None:
    """OMOP CONDITION_OCCURRENCE projection includes only behavior 3
    (malignant primary) + 6 (malignant metastatic). In-situ / benign
    flow elsewhere (out of scope for v0.1)."""
    sql = (SQL_DIR / "02a_map_condition_occurrence.sql").read_text(encoding="utf-8")
    assert "behavior_code_icdo3 IN ('3', '6')" in sql


def test_registry_base_partial_exists() -> None:
    """Plans 4B/4C will reference the same partial."""
    assert (PARTIALS_DIR / "registry_base.yaml").is_file()
