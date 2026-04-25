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


@pytest.fixture(scope="module")
def kb_entries():
    return diagnostics.load_kb()


# Map id -> (input log, expected platform)
KB_FIXTURES = {
    "docker-compose-v1-only": ("docker-compose: error: argument COMMAND: invalid choice: 'compose'", "linux"),
    "docker-not-installed": ("docker: command not found", "linux"),
    "image-pull-unauthorized": ("unauthorized: authentication required", "linux"),
    "image-not-found": ("manifest for ghcr.io/foo/bar:latest not found", "linux"),
    "dns-resolution-failure": ("Temporary failure in name resolution", "linux"),
    "https-cert-error": ("SSL certificate problem: unable to get local issuer", "linux"),
    "compose-port-already-allocated": ("Bind for 0.0.0.0:8082 failed: port is already allocated", "linux"),
    "out-of-memory-compose-up": ("Killed: OOM in container", "linux"),
    "postgres-password-mismatch": ("FATAL:  password authentication failed for user \"parthenon\"", "linux"),
    "postgres-not-ready": ("could not connect to server: Connection refused", "linux"),
    "redis-connection-refused": ("Could not connect to Redis at 127.0.0.1:6379: Connection refused", "linux"),
    "solr-startup-oom": ("Solr: java.lang.OutOfMemoryError: Java heap space", "linux"),
    "vite-build-oom": ("FATAL ERROR: Reached heap limit Allocation failed", "linux"),
    "composer-network-failure": ("Could not authenticate against packagist.org", "linux"),
    "selinux-denial": ("avc: denied { read } for path=...", "linux"),
    "wsl-version-1": ("Please update to WSL 2 with `wsl --set-version <distro> 2`", "windows"),
    "git-not-installed": ("git: command not found", "linux"),
    "pip-install-permission-denied": (
        "Could not install packages due to an OSError: [Errno 13] Permission denied",
        "linux",
    ),
    "vocabulary-zip-not-found": ("Athena vocabulary ZIP /tmp/vocab.zip not found", "linux"),
    "hecate-bootstrap-missing": ("hecate concept search bootstrap missing", "linux"),
    "compose-yaml-parse-error": ("yaml: line 42: did not find expected '-' indicator", "linux"),
    "free-port-5432-postgres": ("port 5432 is already in use", "linux"),
    "ollama-unreachable": ("connection refused dialing 127.0.0.1:11434", "linux"),
    "wsl-distro-missing-curl": ("curl: command not found", "windows"),
    "tar-not-found-windows": ("tar: command not found", "windows"),
    "node-version-too-old": ("npm WARN engine package@1.0.0: wanted: {node>=20.0.0}", "linux"),
    "docker-context-pointing-elsewhere": ("Cannot connect to the Docker daemon at tcp://1.2.3.4:2376", "linux"),
    "rosetta-needed-on-arm": ("exec format error", "darwin"),
    "appimage-fuse-missing": ("AppImage requires FUSE to run", "linux"),
    "deb-signature-failed": ("gpg: BAD signature from \"Acumenus\"", "linux"),
    "frontend-build-missing": ("frontend/dist not found", "linux"),
    "subprocess-killed-by-user": ("KeyboardInterrupt", "linux"),
}


@pytest.mark.parametrize("entry_id,fixture", list(KB_FIXTURES.items()))
def test_kb_entry_matches_its_fixture(entry_id, fixture, kb_entries):
    log, platform = fixture
    matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="any", platform=platform
    )
    matched_ids = [m["id"] for m in matches]
    assert entry_id in matched_ids, f"{entry_id} did not match its fixture"
