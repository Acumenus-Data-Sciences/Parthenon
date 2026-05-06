"""Phase 3 Plan 5 Task 10 (T-023): lis_lab_to_omop manifest."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

MANIFEST_DIR = Path(__file__).resolve().parents[3] / "manifests" / "lis_lab_to_omop"


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
    assert metadata["id"] == "lis_lab_to_omop"


def test_manifest_marks_community_tier() -> None:
    cfg = _load()
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    tags = metadata.get("tags", [])
    for tag in ("hl7-v2", "oru", "lab", "loinc", "community"):
        assert tag in tags


def test_manifest_requires_loinc_only() -> None:
    """LOINC is the only HARD vocab requirement; everything else is optional."""
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    required = spec["requires"]["vocabularies"]
    assert "LOINC" in required


def test_manifest_has_four_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    # bootstrap + load + map_measurement + queue_unmapped_local_codes = 4
    assert len(nodes) == 4


@pytest.mark.parametrize(
    "node_id",
    ["bootstrap_source", "load_oru", "map_measurement", "queue_unmapped_local_codes"],
)
def test_manifest_declares_required_node(node_id: str) -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    ids = {n["node_id"] for n in spec["nodes"]}
    assert node_id in ids


def test_manifest_dag_is_strictly_linear() -> None:
    """Bootstrap -> load -> map -> queue. Each depends on the previous one."""
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    by_id = {n["node_id"]: n for n in nodes}
    assert by_id["load_oru"]["depends_on"] == ["bootstrap_source"]
    assert by_id["map_measurement"]["depends_on"] == ["load_oru"]
    assert by_id["queue_unmapped_local_codes"]["depends_on"] == ["map_measurement"]


def test_manifest_uses_file_uri_for_sql() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    for n in spec["nodes"]:
        sql_file = n["params"]["sql_file"]
        assert isinstance(sql_file, str)
        assert sql_file.startswith("file://sql/")


def test_manifest_default_schemas() -> None:
    """Best-effort decision: source schema 'lis_lab_source', NOT 'app'."""
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    props = spec["parameters"]["properties"]
    assert props["source_schema"]["default"] == "lis_lab_source"
    assert props["cdm_schema"]["default"] == "omop"
    assert props["vocab_schema"]["default"] == "vocab"


def test_readme_exists_and_documents_decisions() -> None:
    readme = MANIFEST_DIR / "README.md"
    assert readme.is_file()
    text = readme.read_text(encoding="utf-8")
    assert "Best-effort decisions" in text
    assert "ADR 0018" in text
    assert "PyPI distribution is `hl7`" in text


def test_required_sql_files_exist() -> None:
    sql_dir = MANIFEST_DIR / "sql"
    for filename in (
        "00_bootstrap_source_schema.sql",
        "01_load_oru.sql",
        "02_map_measurement.sql",
        "03_queue_unmapped_local_codes.sql",
    ):
        assert (sql_dir / filename).is_file()


def test_manifest_has_post_conditions() -> None:
    """Manifest validator requires spec.post_conditions; assert key tables."""
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    pcs = spec["post_conditions"]
    assert isinstance(pcs, list) and len(pcs) >= 1
    tables = [pc["params"]["table"] for pc in pcs if pc["kind"] == "row_count"]
    assert "${parameters.source_schema}.fmt_oru_message" in tables
    assert "${parameters.source_schema}.fmt_oru_observation" in tables
    assert "${parameters.cdm_schema}.measurement" in tables
    assert "${parameters.source_schema}.unmapped_local_lab_code" in tables
