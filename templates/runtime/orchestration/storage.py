"""Local filesystem storage adapter (Phase 0 default)."""

from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path

from runtime.orchestration.interface import ArtifactRef


@dataclass
class LocalFilesystemStorage:
    """Persists artifacts under ``root / {run_id} / {node_id} / {artifact_name}``."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def artifact_dir(self, *, run_id: str, node_id: str) -> Path:
        path = self.root / run_id / node_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_artifacts(self, *, run_id: str) -> list[ArtifactRef]:
        run_root = self.root / run_id
        if not run_root.exists():
            return []
        results: list[ArtifactRef] = []
        for node_dir in sorted(run_root.iterdir()):
            if not node_dir.is_dir():
                continue
            for artifact in sorted(node_dir.iterdir()):
                if not artifact.is_file():
                    continue
                rel = artifact.relative_to(self.root)
                media_type = mimetypes.guess_type(artifact.name)[0] or "application/octet-stream"
                results.append(
                    ArtifactRef(
                        run_id=run_id,
                        node_id=node_dir.name,
                        name=artifact.name,
                        relative_path=str(rel),
                        size_bytes=artifact.stat().st_size,
                        media_type=media_type,
                    )
                )
        return results
