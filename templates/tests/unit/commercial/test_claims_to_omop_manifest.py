"""Phase 3 Plan 1 Task 7: claims_to_omop manifest scaffold.

Asserts the 12-stage manifest at
``templates/commercial/manifests/claims_to_omop/manifest.yaml``:

- Conforms to the templates apiVersion and kind.
- Declares the four mappers and the COST projection node.
- All SQL stages reference ``file://sql/<filename>.sql`` (Plan 0 reader).
- ``vocab_schema`` parameter defaults to ``vocab``.
- post_conditions point at the validation pack.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

# Manifest lives under the COMMERCIAL tree, not the community tree.
MANIFEST_DIR = Path(__file__).resolve().parents[3] / "commercial" / "manifests" / "claims_to_omop"
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
    assert metadata["id"] == "claims_to_omop"
    assert "5.4" in metadata["cdm_versions"]


def test_manifest_metadata_marks_commercial_tier() -> None:
    cfg = _load()
    metadata = cfg["metadata"]
    assert isinstance(metadata, dict)
    tags = metadata.get("tags", [])
    # Must announce its tier so Atlas / Aurora UIs can hide the template
    # for community-only deployments.
    assert "commercial" in tags
    assert "claims" in tags


def test_manifest_parameters_define_schemas() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    params = spec["parameters"]["properties"]
    for key in ("source_schema", "cdm_schema", "vocab_schema"):
        assert key in params, f"missing parameter {key}"
    assert params["source_schema"]["default"] == "claims_source"
    assert params["vocab_schema"]["default"] == "vocab"


def test_manifest_declares_required_vocabularies() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    required = spec["requires"]["vocabularies"]
    # ICD-10 (diagnoses) + CPT/HCPCS + RxNorm + revenue codes (HCPCS) +
    # CDT (dental) — all standardized in the OMOP vocab.
    for v in ("ICD10CM", "CPT4", "HCPCS"):
        assert v in required


def test_manifest_has_12_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    # Bootstrap source + load 837 + bootstrap CDM + 4 mappers (visit /
    # procedure / condition / cost) + summarize + validate = 9 minimum.
    # The full plan calls 12 stages: bootstrap source → load 837 →
    # bootstrap CDM → 4 per-domain mappers + COST projection → summarize
    # → validate. Some pipelines collapse summarize+validate; we keep
    # them split.
    assert (
        len(nodes) == 12
    ), f"expected 12 stages, got {len(nodes)}: {[n['node_id'] for n in nodes]}"


def test_manifest_sql_stages_use_sql_file_url() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    sql_nodes = [n for n in spec["nodes"] if n["type"] == "sql"]
    for node in sql_nodes:
        params = node["params"]
        # Each SQL stage references either a transformation script
        # (``sql_file``) or a query that materializes an artifact
        # (``fetch_query_file``). Both must use the file:// protocol
        # introduced by Plan 0.
        ref = params.get("sql_file") or params.get("fetch_query_file")
        assert ref is not None, f"sql node {node['node_id']} has no sql_file/fetch_query_file"
        assert ref.startswith("file://sql/"), f"unexpected ref: {ref}"


def test_manifest_post_condition_points_at_summary_artifact() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    pcs = spec["post_conditions"]
    assert isinstance(pcs, list)
    assert any(
        pc["kind"] == "artifact_present"
        and pc["params"]["artifact"] == "claims_to_omop_summary.json"
        for pc in pcs
    )


@pytest.mark.parametrize(
    "node_id",
    [
        "bootstrap_source",
        "load_837",
        "bootstrap_cdm",
        "map_visit_occurrence",
        "map_procedure_occurrence",
        "map_condition_occurrence",
        "project_cost",
        "summarize",
        "validate",
    ],
)
def test_manifest_declares_required_node(node_id: str) -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    ids = {n["node_id"] for n in spec["nodes"]}
    assert node_id in ids, f"missing node {node_id}: {ids}"


def test_manifest_readme_exists() -> None:
    readme = MANIFEST_DIR / "README.md"
    assert readme.exists(), "claims_to_omop README is required"
    text = readme.read_text(encoding="utf-8")
    assert "commercial" in text.lower()
    assert "837" in text
