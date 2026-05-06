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


def test_manifest_has_14_stages() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = spec["nodes"]
    assert isinstance(nodes, list)
    # Plan 1 (T-021A) shipped 12 stages: bootstrap source → load 837 →
    # bootstrap CDM → 4 per-domain mappers + COST projection → summarize
    # → 4 validators. Plan 2 (T-021B) adds two:
    #   - bootstrap_835      (creates fmt_835_remit + remit_orphans tables)
    #   - reconcile_remit    (orphan log + UPDATE source + cost-row inserts +
    #                         reversal compensation)
    # Total: 14.
    assert (
        len(nodes) == 14
    ), f"expected 14 stages, got {len(nodes)}: {[n['node_id'] for n in nodes]}"


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
        # Plan 2 (T-021B) additions:
        "bootstrap_835",
        "reconcile_remit",
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


# ---------- Plan 2 (T-021B) — 835 reconciliation stages ------------------


def test_manifest_has_835_sql_files() -> None:
    """Plan 2 ships two new SQL files; both must exist."""
    assert (SQL_DIR / "02e_load_835.sql").is_file()
    assert (SQL_DIR / "02f_reconcile_remit.sql").is_file()


def test_bootstrap_835_creates_fmt_835_remit_and_orphans_table() -> None:
    sql = (SQL_DIR / "02e_load_835.sql").read_text(encoding="utf-8")
    # Source-side: fmt_835_remit
    assert "${parameters.source_schema}.fmt_835_remit" in sql
    # Match-key index — the join target is (payer_id, claim_id, line_number).
    assert "ix_fmt_835_remit_match_key" in sql
    # App-side: remit_orphans log
    assert "${parameters.app_schema}.remit_orphans" in sql


def test_reconcile_remit_writes_to_orphans_and_cost() -> None:
    sql = (SQL_DIR / "02f_reconcile_remit.sql").read_text(encoding="utf-8")
    # Pass 1: orphan insert
    assert "INSERT INTO ${parameters.app_schema}.remit_orphans" in sql
    # Pass 2: backfill source allowed/paid
    assert "UPDATE ${parameters.source_schema}.fmt_837_line" in sql
    # Pass 3+4: COST inserts
    assert "INSERT INTO ${parameters.cdm_schema}.cost" in sql
    # Idempotency: NOT EXISTS guards on the cost inserts
    assert "NOT EXISTS" in sql
    # Reversal compensation marker
    assert "remit_reversal" in sql
    # Reversal predicate
    assert "is_reversal = TRUE" in sql


def test_reconcile_remit_depends_on_bootstrap_835_and_project_cost() -> None:
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = {n["node_id"]: n for n in spec["nodes"]}
    reconcile = nodes["reconcile_remit"]
    deps = set(reconcile.get("depends_on", []))
    assert "bootstrap_835" in deps
    # Must run AFTER project_cost so the original COST rows exist before
    # the reversal compensation INSERT can reference them.
    assert "project_cost" in deps


def test_summarize_depends_on_reconcile_remit() -> None:
    """The summary stage must include reconciled cost rows."""
    cfg = _load()
    spec = cfg["spec"]
    assert isinstance(spec, dict)
    nodes = {n["node_id"]: n for n in spec["nodes"]}
    summarize = nodes["summarize"]
    deps = set(summarize.get("depends_on", []))
    assert "reconcile_remit" in deps
