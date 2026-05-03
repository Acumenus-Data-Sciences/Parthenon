"""Tests for runtime.nodes.generic_file.GenericFileNode."""

from __future__ import annotations

import hashlib
import http.server
import logging
import socket
import threading
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.generic_file import GenericFileNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-gf",
        node_id="gf-1",
        logger=logging.getLogger("test.gf"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


@pytest.fixture()
def http_server(tmp_path: Path) -> Generator[str, None, None]:
    """Serve tmp_path over HTTP on a random port; yield the base URL."""
    served = tmp_path / "served"
    served.mkdir()
    (served / "data.bin").write_bytes(b"hello-world-payload")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(served), **kwargs)

        def log_message(self, fmt: str, *args: Any) -> None:  # silence
            return

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = int(sock.getsockname()[1])

    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        thread.join(timeout=2)


def test_type_name() -> None:
    assert GenericFileNode.type_name == "generic_file"


def test_downloads_http_url(context: NodeContext, http_server: str) -> None:
    params: dict[str, Any] = {
        "url": f"{http_server}/data.bin",
        "artifact_name": "fetched.bin",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["bytes"] == len(b"hello-world-payload")
    assert result.outputs["sha256"] == hashlib.sha256(b"hello-world-payload").hexdigest()
    assert (context.artifact_dir / "fetched.bin").read_bytes() == b"hello-world-payload"


def test_copies_local_file(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "src.txt"
    src.write_bytes(b"local-bytes")
    params: dict[str, Any] = {
        "url": f"file://{src}",
        "artifact_name": "copied.txt",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert (context.artifact_dir / "copied.txt").read_bytes() == b"local-bytes"


def test_unsupported_scheme_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "url": "ftp://example.com/file",
        "artifact_name": "x.bin",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "scheme" in (result.error_message or "")


def test_expected_sha256_mismatch_fails(context: NodeContext, http_server: str) -> None:
    params: dict[str, Any] = {
        "url": f"{http_server}/data.bin",
        "artifact_name": "fetched.bin",
        "expected_sha256": "0" * 64,
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "sha256" in (result.error_message or "")
