"""Cross-instrument check: both EQ-5D variants follow the pro_base pattern.

Asserts the spec decision Q4 / devplan T-011 acceptance criterion that
runtime.instruments.pro_base is exercised by at least 2 instruments. If a
future PRO instrument is added (PHQ-9, GAD-7, KCCQ-12, ...), extend
INSTRUMENTS to include it and the test will gate the new addition against
the same shared-pattern invariants.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
INSTRUMENTS = ["qr_eq5d5l_to_measurement", "qr_eq5d3l_to_measurement"]


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_imports_pro_base(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    text = manifest.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_uses_fhir_resource_for_ingestion(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    payload = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_declares_eq5d_value_set_path(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    payload = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "eq5d_value_set_path" in props


@pytest.mark.parametrize("instrument", INSTRUMENTS)
def test_manifest_filters_by_questionnaire_url(instrument: str) -> None:
    manifest = REPO / "manifests" / instrument / "manifest.yaml"
    text = manifest.read_text(encoding="utf-8")
    assert "questionnaire_url" in text


def test_pro_base_module_importable() -> None:
    """The shared module is real and exports the expected symbols."""
    from runtime.instruments.pro_base import (
        ItemMapping,
        MeasurementRow,
        ProInstrumentDefinition,
        parse_questionnaire_response,
    )

    assert ItemMapping is not None
    assert ProInstrumentDefinition is not None
    assert parse_questionnaire_response is not None
    assert MeasurementRow is not None
