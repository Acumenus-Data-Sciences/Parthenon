"""Tests for installer.diagnostics module — KB matcher + entry fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from installer import diagnostics


KB_PATH = Path(__file__).resolve().parents[1] / "diagnostics-kb.json"


def test_kb_loads_and_validates_schema():
    entries = diagnostics.load_kb()
    assert len(entries) >= 10
    required_keys = {"id", "fingerprint", "category", "severity", "user_message", "platforms"}
    for entry in entries:
        missing = required_keys - set(entry)
        assert not missing, f"entry {entry.get('id')} missing keys: {missing}"
        assert entry["severity"] in {"error", "warn"}, entry["id"]
        assert isinstance(entry["platforms"], list)
        for plat in entry["platforms"]:
            assert plat in {"all", "darwin", "linux", "windows"}


def test_match_returns_matching_entry():
    log = "OSError: [Errno 98] Address already in use: ('0.0.0.0', 8082)"
    matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="bootstrap", platform="linux"
    )
    assert matches
    top = matches[0]
    assert top["id"] == "port-conflict-generic"
    assert top["fix_action"] == "port-holder"
    assert top["fix_args"] == {"port": 8082}


def test_match_returns_empty_when_no_fingerprint_hits():
    matches = diagnostics.match(
        stdout="completely benign success message",
        stderr="",
        exit_code=0,
        phase="solr",
        platform="linux",
    )
    assert matches == []


def test_match_filters_by_platform():
    log = "WSL is not installed"
    linux_matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="preflight", platform="linux"
    )
    win_matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="preflight", platform="windows"
    )
    assert linux_matches == []  # WSL fingerprint is windows-only
    assert win_matches  # at least one match


def test_kb_fingerprints_compile():
    """Every fingerprint must be a valid regex."""
    import re
    for entry in diagnostics.load_kb():
        try:
            re.compile(entry["fingerprint"])
        except re.error as exc:
            pytest.fail(f"entry {entry['id']} has invalid regex: {exc}")
