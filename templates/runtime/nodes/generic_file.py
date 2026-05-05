"""GenericFileNode: download (http/https) or copy (file://) to an artifact."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class GenericFileNode(Node):
    """Fetch a URL into the run's artifact directory."""

    type_name = "generic_file"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        url = str(params.get("url", ""))
        artifact_name = str(params.get("artifact_name", "")).strip()
        expected_sha256 = params.get("expected_sha256")
        timeout = float(params.get("timeout_seconds", 60.0))
        if not url or not artifact_name:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="GenericFileNode requires 'url' and 'artifact_name'",
            )

        target = context.artifact_dir / artifact_name
        target.parent.mkdir(parents=True, exist_ok=True)

        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        try:
            if scheme in {"http", "https"}:
                self._download_http(url, target, timeout)
            elif scheme == "file":
                src = Path(parsed.path)
                if not src.exists():
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=f"file:// source not found: {src}",
                    )
                shutil.copyfile(src, target)
            else:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"unsupported scheme: {scheme!r}",
                )
        except httpx.HTTPError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"download failed: {exc}",
            )

        size = target.stat().st_size
        digest = self._sha256(target)
        if expected_sha256 and str(expected_sha256).lower() != digest:
            target.unlink(missing_ok=True)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"sha256 mismatch: expected {expected_sha256}, got {digest}",
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "url": url,
                "artifact_name": artifact_name,
                "bytes": size,
                "sha256": digest,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=target,
                    media_type="application/octet-stream",
                    size_bytes=size,
                )
            ],
        )

    @staticmethod
    def _download_http(url: str, target: Path, timeout: float) -> None:
        with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
            response.raise_for_status()
            with target.open("wb") as fh:
                for chunk in response.iter_bytes():
                    fh.write(chunk)

    @staticmethod
    def _sha256(path: Path) -> str:
        hasher = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(64 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
