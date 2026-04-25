"""End-to-end round-trip tests for the new contract actions.

Each test invokes `python install.py --contract <action> --community ...` as
a subprocess and asserts the JSON output shape. This catches argparse and
dispatch wiring regressions that unit tests miss.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_contract(action: str, *, input_json: dict | None = None) -> dict:
    cmd = [
        sys.executable,
        "install.py",
        "--contract",
        action,
        "--community",
        "--contract-redact",
        "--contract-pretty",
    ]
    if input_json is not None:
        input_path = REPO_ROOT / f".test-{action}-input.json"
        input_path.write_text(json.dumps(input_json))
        cmd.extend(["--contract-input", str(input_path)])
    try:
        proc = subprocess.run(
            cmd, cwd=REPO_ROOT, capture_output=True, text=True, check=False
        )
    finally:
        if input_json is not None:
            (REPO_ROOT / f".test-{action}-input.json").unlink(missing_ok=True)
    if proc.returncode != 0:
        pytest.fail(f"contract {action} exited {proc.returncode}: {proc.stderr}")
    return json.loads(proc.stdout)


def test_open_app_round_trip():
    payload = _run_contract(
        "open-app", input_json={"app_url": "http://localhost", "nginx_port": 8082}
    )
    assert payload == {"url": "http://localhost:8082"}


def test_credentials_round_trip_when_file_missing():
    payload = _run_contract("credentials", input_json={"admin_email": "admin@x.test"})
    assert payload["admin_email"] == "admin@x.test"
    assert payload["admin_password"] is None
    assert "error" in payload


def test_recover_round_trip_no_state():
    payload = _run_contract("recover")
    assert payload["mode"] == "retry"
    assert payload["can_resume"] is False


def test_diagnose_round_trip_with_match():
    payload = _run_contract(
        "diagnose",
        input_json={
            "_diagnose_input": {
                "stdout": "OSError: [Errno 98] Address already in use: ('0.0.0.0', 8082)",
                "stderr": "",
                "exit_code": 1,
                "phase": "bootstrap",
                "platform": "linux",
            }
        },
    )
    assert len(payload["matches"]) >= 1
    assert payload["matches"][0]["id"] == "port-conflict-generic"


def test_diagnose_round_trip_no_match_marks_ai_assist_eligible():
    payload = _run_contract(
        "diagnose",
        input_json={
            "_diagnose_input": {
                "stdout": "novel error not in the KB",
                "stderr": "",
                "exit_code": 1,
                "phase": "frontend",
                "platform": "linux",
            }
        },
    )
    assert payload["matches"] == []
    assert payload["ai_assist_eligible"] is True


def test_port_holder_round_trip():
    payload = _run_contract("port-holder", input_json={"_port": 65535})
    # Port 65535 is unlikely to be in use; either way we get a valid shape.
    assert "found" in payload
    assert payload["port"] == 65535
