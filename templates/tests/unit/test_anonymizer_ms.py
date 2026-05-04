"""MsAnonymizerBackend: HTTP client to the parthenon-anonymizer sidecar.

Uses httpx.MockTransport (the same pattern adopted in the Task 4/8 search
test files after respx proved unreliable with the live httpx.Client embedded
in the backend module).
"""

from __future__ import annotations

import json as _json
from typing import Any

import httpx
import pytest

from runtime.nodes.anonymizer_backends import ms as ms_mod
from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend, SidecarUnavailable
from runtime.nodes.anonymizer_config import load_config


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler: Any) -> list[httpx.Request]:
    captured: list[httpx.Request] = []

    def _wrapped(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return handler(req)

    transport = httpx.MockTransport(_wrapped)
    real_client_cls = httpx.Client

    def _factory(*args: Any, **kwargs: Any) -> httpx.Client:
        kwargs["transport"] = transport
        return real_client_cls(*args, **kwargs)

    monkeypatch.setattr(ms_mod.httpx, "Client", _factory)
    return captured


def test_implements_protocol() -> None:
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")
    assert isinstance(backend, AnonymizerBackend)


def test_posts_resource_and_returns_response(monkeypatch: pytest.MonkeyPatch) -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")

    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"resourceType": "Patient", "id": "p1", "name": "***REDACTED***"}
        )

    _patch_client(monkeypatch, _handler)

    out = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]}
    )
    assert out["name"] == "***REDACTED***"


def test_request_payload_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")

    def _handler(req: httpx.Request) -> httpx.Response:
        body = _json.loads(req.content)
        assert "config" in body, body
        assert "resource" in body, body
        return httpx.Response(200, json=body["resource"])

    captured = _patch_client(monkeypatch, _handler)
    backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})
    assert captured, "no request captured"
    assert captured[0].url.path == "/anonymize"
    assert captured[0].headers["content-type"].startswith("application/json")


def test_sidecar_unavailable_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")

    def _handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("nope")

    _patch_client(monkeypatch, _handler)

    with pytest.raises(SidecarUnavailable):
        backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})


def test_5xx_raises_with_status(monkeypatch: pytest.MonkeyPatch) -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = MsAnonymizerBackend(sidecar_url="http://parthenon-anonymizer:8080")

    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="busy")

    _patch_client(monkeypatch, _handler)

    with pytest.raises(SidecarUnavailable, match="503"):
        backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})


def test_missing_sidecar_url_raises() -> None:
    with pytest.raises(ValueError, match="sidecar_url"):
        MsAnonymizerBackend(sidecar_url="")
