"""Plan 5 Task 9: artemis_chemo_regimens manifest shape."""

from __future__ import annotations

from pathlib import Path

import yaml

MANIFEST_DIR = Path(__file__).resolve().parents[2] / "manifests" / "artemis_chemo_regimens"


def _load() -> dict:
    return yaml.safe_load((MANIFEST_DIR / "manifest.yaml").read_text(encoding="utf-8"))


def test_manifest_loads() -> None:
    cfg = _load()
    assert cfg["apiVersion"] == "parthenon.acumenus.net/v1"
    assert cfg["kind"] == "Template"
    assert cfg["metadata"]["id"] == "artemis_chemo_regimens"


def test_manifest_requires_rxnorm_and_atc() -> None:
    cfg = _load()
    required = cfg["spec"]["requires"]["vocabularies"]
    assert "RxNorm" in required
    assert "ATC" in required


def test_manifest_includes_regimen_matcher_node() -> None:
    cfg = _load()
    types = {n["type"] for n in cfg["spec"]["nodes"]}
    assert "regimen_matcher" in types
    assert "sql" in types  # bootstrap step


def test_episode_bootstrap_sql_creates_two_tables() -> None:
    sql = (MANIFEST_DIR / "sql" / "00_bootstrap_episode_tables.sql").read_text(encoding="utf-8")
    assert "${parameters.cdm_schema}.episode" in sql
    assert "${parameters.cdm_schema}.episode_event" in sql


def test_synthetic_cohort_present() -> None:
    cohort = MANIFEST_DIR / "fixtures" / "synthetic" / "cohort.json"
    assert cohort.is_file()


def test_gold_standard_has_20_regimens() -> None:
    gold = MANIFEST_DIR / "validation" / "expected" / "regimens.csv"
    rows = [r for r in gold.read_text(encoding="utf-8").splitlines() if r.strip()]
    # header + 20 regimens
    assert len(rows) == 21


def test_post_conditions_recall_threshold() -> None:
    cfg = yaml.safe_load(
        (MANIFEST_DIR / "validation" / "expected" / "post_conditions.yaml").read_text(
            encoding="utf-8"
        )
    )
    assert cfg["recall_threshold"] == 0.80
