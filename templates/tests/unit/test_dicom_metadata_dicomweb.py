"""DicomMetadataNode dicomweb backend: QIDO-RS metadata over HTTP with bearer auth.

Uses httpx.MockTransport (the same pattern as test_fhir_resource_search.py).
respx was tried first but produced unreliable bypass behavior with the live
httpx.Client embedded in the node module.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx
import polars as pl
import pytest

from runtime.nodes import dicom_metadata as dm_mod
from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-qido",
        node_id="dicom-qido",
        logger=logging.getLogger("test.dicom.qido"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


# QIDO-RS returns DICOM JSON: {"00100020": {"Value": ["PATIENT_ID"]}, ...}
QIDO_INSTANCE_RESPONSE: list[dict[str, Any]] = [
    {
        "0020000D": {"vr": "UI", "Value": ["1.2.3.4.STUDY"]},
        "0020000E": {"vr": "UI", "Value": ["1.2.3.4.SERIES"]},
        "00080018": {"vr": "UI", "Value": ["1.2.3.4.SOP1"]},
        "00080016": {"vr": "UI", "Value": ["1.2.840.10008.5.1.4.1.1.2"]},
        "00080060": {"vr": "CS", "Value": ["CT"]},
        "00080070": {"vr": "LO", "Value": ["AcumeNus Imaging"]},
        "00100020": {"vr": "LO", "Value": ["TEST_PATIENT_001"]},
    },
    {
        "0020000D": {"vr": "UI", "Value": ["1.2.3.4.STUDY"]},
        "0020000E": {"vr": "UI", "Value": ["1.2.3.4.SERIES"]},
        "00080018": {"vr": "UI", "Value": ["1.2.3.4.SOP2"]},
        "00080016": {"vr": "UI", "Value": ["1.2.840.10008.5.1.4.1.1.2"]},
        "00080060": {"vr": "CS", "Value": ["CT"]},
        "00100020": {"vr": "LO", "Value": ["TEST_PATIENT_001"]},
    },
]


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

    monkeypatch.setattr(dm_mod.httpx, "Client", _factory)
    return captured


def test_dicomweb_metadata_to_parquet(
    context: NodeContext, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=QIDO_INSTANCE_RESPONSE)

    _patch_client(monkeypatch, _handler)

    result = DicomMetadataNode().run(
        context,
        {
            "source": "dicomweb",
            "dicomweb_base_url": "https://dicomweb.example.com",
            "bearer_token": "qido-token-xyz",
        },
    )
    assert result.status == NodeStatus.SUCCESS, result.error_message
    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    assert df.height == 2
    assert "Modality" in df.columns
    assert df["Modality"].to_list() == ["CT", "CT"]
    assert df["SOPInstanceUID"].to_list() == ["1.2.3.4.SOP1", "1.2.3.4.SOP2"]


def test_dicomweb_passes_bearer_token(
    context: NodeContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    captured = _patch_client(monkeypatch, _handler)

    DicomMetadataNode().run(
        context,
        {
            "source": "dicomweb",
            "dicomweb_base_url": "https://dicomweb.example.com",
            "bearer_token": "qido-token-xyz",
        },
    )
    assert captured, "no request captured"
    assert captured[0].headers["authorization"] == "Bearer qido-token-xyz"
    assert captured[0].headers["accept"] == "application/dicom+json"


def test_dicomweb_never_calls_wado(context: NodeContext, monkeypatch: pytest.MonkeyPatch) -> None:
    """Defense in depth: the node MUST NOT issue WADO-RS requests."""

    def _handler(req: httpx.Request) -> httpx.Response:
        # Fail loudly if anything other than QIDO-RS /instances was called.
        path = req.url.path
        if "/instances" not in path:
            pytest.fail(f"non-QIDO request issued: {req.url}")
        # Specifically reject WADO-RS instance retrieval shape.
        if "/studies/" in path and "/series/" in path and path.endswith(("SOP1", "SOP2")):
            pytest.fail(f"WADO-RS called: {req.url}")
        return httpx.Response(200, json=QIDO_INSTANCE_RESPONSE)

    captured = _patch_client(monkeypatch, _handler)

    DicomMetadataNode().run(
        context,
        {
            "source": "dicomweb",
            "dicomweb_base_url": "https://dicomweb.example.com",
            "bearer_token": "x",
        },
    )
    # Only QIDO-RS path should have been hit.
    paths = [r.url.path for r in captured]
    assert all("/instances" in p for p in paths), paths
    assert not any("/series/" in p for p in paths), paths


def test_dicomweb_missing_base_url_fails(context: NodeContext) -> None:
    result = DicomMetadataNode().run(context, {"source": "dicomweb"})
    assert result.status == NodeStatus.FAILED
    assert "dicomweb_base_url" in (result.error_message or "")


def test_dicomweb_non_200_fails(context: NodeContext, monkeypatch: pytest.MonkeyPatch) -> None:
    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="forbidden")

    _patch_client(monkeypatch, _handler)

    result = DicomMetadataNode().run(
        context,
        {
            "source": "dicomweb",
            "dicomweb_base_url": "https://dicomweb.example.com",
            "bearer_token": "x",
        },
    )
    assert result.status == NodeStatus.FAILED
    assert "403" in (result.error_message or "")
