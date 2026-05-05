"""FhirResourceNode: search fallback path with httpx MockTransport."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx
import polars as pl
import pytest

from runtime.nodes import fhir_resource as fr_mod
from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-search",
        node_id="fhir-search",
        logger=logging.getLogger("test.fhir.search"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler: Any) -> list[httpx.Request]:
    """Replace httpx.Client in fhir_resource module with one using MockTransport.

    Returns the list that the handler appends each request to.
    """
    captured: list[httpx.Request] = []

    def _wrapped(req: httpx.Request) -> httpx.Response:
        captured.append(req)
        return handler(req)

    transport = httpx.MockTransport(_wrapped)
    real_client_cls = httpx.Client

    def _factory(*args: Any, **kwargs: Any) -> httpx.Client:
        kwargs["transport"] = transport
        return real_client_cls(*args, **kwargs)

    monkeypatch.setattr(fr_mod.httpx, "Client", _factory)
    return captured


def test_search_paginates_through_bundle(
    context: NodeContext, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Walk a 2-page Patient bundle via the next-link Bundle convention."""
    page1 = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "p1"}},
            {"resource": {"resourceType": "Patient", "id": "p2"}},
        ],
        "link": [
            {"relation": "next", "url": "https://fhir.example.com/Patient?_page=2"},
        ],
    }
    page2 = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "p3"}},
        ],
    }

    def _handler(req: httpx.Request) -> httpx.Response:
        if "_page=2" in str(req.url):
            return httpx.Response(200, json=page2)
        return httpx.Response(200, json=page1)

    _patch_client(monkeypatch, _handler)

    result = FhirResourceNode().run(
        context,
        {
            "source": "search",
            "fhir_base_url": "https://fhir.example.com",
            "profile": "us-core",
            "resource_types": ["Patient"],
        },
    )
    assert result.status == NodeStatus.SUCCESS, result.error_message
    patients = pl.read_parquet(tmp_path / "patient.parquet")
    assert patients.height == 3
    assert set(patients["id"].to_list()) == {"p1", "p2", "p3"}


def test_search_passes_bearer_token(
    context: NodeContext, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bearer_token param is sent as Authorization header on every call."""

    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"resourceType": "Bundle", "entry": []})

    captured = _patch_client(monkeypatch, _handler)

    FhirResourceNode().run(
        context,
        {
            "source": "search",
            "fhir_base_url": "https://fhir.example.com",
            "profile": "us-core",
            "resource_types": ["Patient"],
            "bearer_token": "test-token-abc",
        },
    )
    assert captured, "no request captured"
    assert captured[0].headers["authorization"] == "Bearer test-token-abc"


def test_search_skips_unknown_resource_types(
    context: NodeContext, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If resource_types includes a type not in the profile, skip with a log entry."""

    def _handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "resourceType": "Bundle",
                "entry": [{"resource": {"resourceType": "Patient", "id": "p1"}}],
            },
        )

    _patch_client(monkeypatch, _handler)

    result = FhirResourceNode().run(
        context,
        {
            "source": "search",
            "fhir_base_url": "https://fhir.example.com",
            "profile": "us-core",
            "resource_types": ["Patient", "MadeUpType"],
        },
    )
    assert result.status == NodeStatus.SUCCESS
    assert "MadeUpType" in result.outputs.get("skipped_resource_types", [])
