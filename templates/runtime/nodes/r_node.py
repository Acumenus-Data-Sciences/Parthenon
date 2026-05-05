"""RNode: shell out to Rscript and capture stdout/stderr as artifacts."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class RNode(Node):
    """Execute an inline R ``script`` via Rscript and capture output."""

    type_name = "r"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        script = str(params.get("script", "")).strip()
        artifact_name = str(params.get("artifact_name", "r_output.txt"))
        timeout = float(params.get("timeout_seconds", 600.0))
        if not script:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="RNode requires non-empty 'script' parameter",
            )
        rscript = shutil.which("Rscript")
        if rscript is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Rscript binary not found on PATH",
            )

        with tempfile.NamedTemporaryFile("w", suffix=".R", delete=False) as fh:
            fh.write(script)
            script_path = Path(fh.name)

        try:
            completed = subprocess.run(
                [rscript, "--vanilla", str(script_path)],
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            script_path.unlink(missing_ok=True)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Rscript timed out after {timeout}s",
            )
        finally:
            script_path.unlink(missing_ok=True)

        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(completed.stdout, encoding="utf-8")

        if completed.returncode != 0:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"Rscript exited with code {completed.returncode}: "
                    f"{completed.stderr.strip()[:500]}"
                ),
                outputs={
                    "exit_code": completed.returncode,
                    "stdout": completed.stdout,
                    "stderr": completed.stderr,
                },
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "exit_code": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="text/plain",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )
