"""Phase 3 Plan 7 Section B Task 15 (T-024-carryover): v0.2.0 ARTEMIS shape."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from runtime.oncology.matcher import load_pattern_library
from runtime.oncology.types import RegimenPattern

_REPO_TEMPLATES = Path(__file__).resolve().parents[2]
_REPO_ROOT = _REPO_TEMPLATES.parent
_EXTRACTOR = _REPO_TEMPLATES / "tools" / "extract_artemis_regimens.R"
_OHDSI_PIN = _REPO_TEMPLATES / "runtime" / "oncology" / "artemis" / "ohdsi_pin.txt"
_WORKFLOW = _REPO_ROOT / ".github" / "workflows" / "artemis-pattern-update.yml"
_V0_1_0 = _REPO_TEMPLATES / "runtime" / "oncology" / "artemis" / "v0.1.0" / "patterns.json"
_V0_2_0 = _REPO_TEMPLATES / "runtime" / "oncology" / "artemis" / "v0.2.0" / "patterns.json"


# ---------- Workflow structural tests (always run) ----------


def test_artemis_pattern_update_workflow_exists() -> None:
    assert _WORKFLOW.is_file()


def test_workflow_has_cron_and_dispatch_triggers() -> None:
    cfg = yaml.safe_load(_WORKFLOW.read_text(encoding="utf-8"))
    # PyYAML parses the bare ``on:`` key as Python True (a YAML-1.1 bool).
    triggers = cfg.get("on") if "on" in cfg else cfg.get(True)
    assert isinstance(triggers, dict)
    assert "schedule" in triggers
    assert "workflow_dispatch" in triggers


def test_workflow_uses_r_base_4_4_container() -> None:
    """Heavy R install must run on a Darkstar-class container, not the
    customer-facing build path."""
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert "image: r-base:4.4" in text


def test_workflow_installs_hemonc_from_pinned_ref() -> None:
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert "remotes::install_github('HemOnc-org/HemOnc@" in text
    # The workflow reads the SHA from ohdsi_pin.txt.
    assert "ohdsi_pin.txt" in text


def test_workflow_runs_extractor_to_v0_2_0_path() -> None:
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert "Rscript templates/tools/extract_artemis_regimens.R" in text
    assert "templates/runtime/oncology/artemis/v0.2.0/patterns.json" in text


def test_workflow_validates_generated_json_shape() -> None:
    """The workflow must self-check before committing — fail-closed if HemOnc
    produced a degenerate library."""
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert '.version == "v0.2.0"' in text
    assert ".regimens | length >= 100" in text
    # Spot-checks all 5 v0.1.0 regimens are still present.
    for name in ("FOLFIRINOX", "FOLFOX", "R-CHOP", "AC-T", "Carboplatin+Paclitaxel"):
        assert name in text


def test_workflow_auto_commits_to_main() -> None:
    """User decision: auto-commit to main, not PR."""
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert "git push origin HEAD:main" in text
    assert "permissions" in text
    assert "contents: write" in text


def test_workflow_no_op_when_no_diff() -> None:
    """A run that produces an unchanged JSON must NOT spam git history."""
    text = _WORKFLOW.read_text(encoding="utf-8")
    assert "git diff --quiet" in text
    assert "nothing to commit" in text.lower()


# ---------- Extractor R script tests ----------


def test_extractor_script_exists() -> None:
    assert _EXTRACTOR.is_file()


def test_extractor_script_uses_jsonlite_and_hemonc() -> None:
    text = _EXTRACTOR.read_text(encoding="utf-8")
    assert "library(jsonlite)" in text
    assert "library(HemOnc)" in text


def test_extractor_script_writes_v0_2_0_envelope() -> None:
    """Output must declare ``version: 'v0.2.0'`` so matcher's version
    check matches the directory name."""
    text = _EXTRACTOR.read_text(encoding="utf-8")
    assert 'version = "v0.2.0"' in text


def test_extractor_script_has_minimum_record_floor() -> None:
    """Sanity-floor abort if HemOnc returns <100 regimens."""
    text = _EXTRACTOR.read_text(encoding="utf-8")
    assert "length(records) < 100" in text


def test_extractor_script_emits_v0_1_0_compatible_record_shape() -> None:
    """regimen_name + indication + phase + drugs[name, rxnorm_concept_id]."""
    text = _EXTRACTOR.read_text(encoding="utf-8")
    for field in ("regimen_name", "indication", "phase", "drugs"):
        assert field in text
    assert "rxnorm_concept_id" in text


# ---------- ohdsi_pin tests ----------


def test_ohdsi_pin_exists() -> None:
    assert _OHDSI_PIN.is_file()


def test_ohdsi_pin_is_single_line() -> None:
    text = _OHDSI_PIN.read_text(encoding="utf-8").strip()
    assert "\n" not in text
    assert len(text) > 0


# ---------- Schema-equivalence tests ----------


def test_v0_1_0_has_canonical_5_regimens() -> None:
    """v0.1.0 is the regression backstop for v0.2.0 — must keep these 5."""
    data = json.loads(_V0_1_0.read_text(encoding="utf-8"))
    names = {r["regimen_name"] for r in data["regimens"]}
    assert names == {
        "FOLFIRINOX",
        "FOLFOX",
        "R-CHOP",
        "AC-T",
        "Carboplatin+Paclitaxel",
    }


@pytest.mark.skipif(
    not _V0_2_0.is_file(),
    reason="v0.2.0/patterns.json absent — Darkstar workflow hasn't run yet",
)
def test_v0_2_0_parses_against_v0_1_0_pydantic_schema() -> None:
    """If Darkstar has materialized v0.2.0, every regimen must parse
    against the SAME ``RegimenPattern`` Pydantic schema as v0.1.0."""
    data = json.loads(_V0_2_0.read_text(encoding="utf-8"))
    for entry in data["regimens"]:
        RegimenPattern(**entry)


@pytest.mark.skipif(
    not _V0_2_0.is_file(),
    reason="v0.2.0/patterns.json absent — Darkstar workflow hasn't run yet",
)
def test_v0_2_0_has_at_least_500_regimens() -> None:
    """Sanity floor — full library is ~600; <500 means truncated extraction."""
    data = json.loads(_V0_2_0.read_text(encoding="utf-8"))
    assert len(data["regimens"]) >= 500


@pytest.mark.skipif(
    not _V0_2_0.is_file(),
    reason="v0.2.0/patterns.json absent — Darkstar workflow hasn't run yet",
)
def test_v0_2_0_carries_all_v0_1_0_regimens() -> None:
    """Backwards-compat: v0.2.0 must be a strict superset of v0.1.0."""
    v01 = json.loads(_V0_1_0.read_text(encoding="utf-8"))
    v02 = json.loads(_V0_2_0.read_text(encoding="utf-8"))
    v01_names = {r["regimen_name"] for r in v01["regimens"]}
    v02_names = {r["regimen_name"] for r in v02["regimens"]}
    assert v01_names <= v02_names, f"v0.2.0 missing v0.1.0 regimens: {v01_names - v02_names}"


# ---------- Loader behavior tests ----------


def test_load_v0_1_0_explicitly_works() -> None:
    """Backwards-compat path — passing version='v0.1.0' must still work."""
    patterns = load_pattern_library(version="v0.1.0")
    assert any(p.regimen_name == "FOLFIRINOX" for p in patterns)


def test_load_default_falls_back_when_v0_2_0_absent() -> None:
    """When v0.2.0/patterns.json doesn't exist (before first Darkstar run),
    the loader falls back to v0.1.0 silently. The unit suite must stay
    runnable on a fresh checkout without R installed."""
    if _V0_2_0.is_file():
        pytest.skip("v0.2.0 present — fallback path doesn't trigger here")
    patterns = load_pattern_library()
    assert any(p.regimen_name == "FOLFIRINOX" for p in patterns)
