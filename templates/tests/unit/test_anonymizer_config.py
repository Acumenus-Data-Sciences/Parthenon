"""Anonymizer config v1: JSON Schema validation + Python loader."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.nodes.anonymizer_config import (
    AnonymizerConfig,
    AnonymizerConfigError,
    load_config,
)

VALID_MINIMAL: dict = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}},
    ],
}

VALID_FULL: dict = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
        {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 60}},
        {"path": "Patient.gender", "operation": "keep"},
    ],
    "default_action": "redact",
}


def test_load_minimal_config() -> None:
    cfg = load_config(VALID_MINIMAL)
    assert isinstance(cfg, AnonymizerConfig)
    assert cfg.version == "1"
    assert len(cfg.rules) == 2


def test_load_full_config() -> None:
    cfg = load_config(VALID_FULL)
    assert cfg.default_action == "redact"
    assert {r.operation for r in cfg.rules} == {"redact", "cryptoHash", "dateShift", "keep"}


def test_unknown_operation_rejected() -> None:
    bad = {"version": "1", "rules": [{"path": "Patient.x", "operation": "delete"}]}
    with pytest.raises(AnonymizerConfigError, match="operation"):
        load_config(bad)


def test_missing_version_rejected() -> None:
    bad = {"rules": []}
    with pytest.raises(AnonymizerConfigError):
        load_config(bad)


def test_missing_rules_rejected() -> None:
    bad = {"version": "1"}
    with pytest.raises(AnonymizerConfigError):
        load_config(bad)


def test_dateshift_without_max_days_rejected() -> None:
    bad = {
        "version": "1",
        "rules": [{"path": "Patient.birthDate", "operation": "dateShift"}],
    }
    with pytest.raises(AnonymizerConfigError, match="max_days|params"):
        load_config(bad)


def test_cryptohash_unknown_algorithm_rejected() -> None:
    bad = {
        "version": "1",
        "rules": [
            {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "md4"}}
        ],
    }
    with pytest.raises(AnonymizerConfigError, match="algorithm"):
        load_config(bad)


def test_load_config_from_file(tmp_path: Path) -> None:
    cfg_path = tmp_path / "cfg.json"
    cfg_path.write_text(json.dumps(VALID_MINIMAL), encoding="utf-8")
    cfg = load_config(cfg_path)
    assert cfg.version == "1"
