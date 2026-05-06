"""Node SDK core: ``Node`` ABC, ``NodeContext``, ``NodeResult``.

Every node implementation in ``runtime/nodes/`` subclasses ``Node`` and
declares a unique ``type_name`` class attribute. Manifest YAML references
nodes by ``type_name`` (see ADR 0001 + ADR 0003).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class NodeStatus(str, Enum):
    """Terminal and intermediate states for a node execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass(frozen=True)
class NodeArtifact:
    """Pointer to a file produced by a node, recorded for downstream consumers."""

    name: str
    path: Path
    media_type: str = "application/octet-stream"
    size_bytes: int | None = None


@dataclass(frozen=True)
class NodeResult:
    """Return value from ``Node.run``."""

    status: NodeStatus
    outputs: dict[str, Any] = field(default_factory=dict)
    artifacts: list[NodeArtifact] = field(default_factory=list)
    error_message: str | None = None


@dataclass
class NodeContext:
    """Per-invocation execution context.

    Provides a logger, secret accessor, artifact writer rooted at the run's
    artifact directory, and an optional SQLAlchemy-style DSN. The orchestration
    backend constructs and supplies this object.

    ``manifest_dir`` is the directory containing the source ``manifest.yaml``;
    nodes that resolve ``file://<rel-path>`` references (e.g. ``SqlNode``'s
    ``sql_file`` parameter — Phase 3 Plan 0) read it from here. ``None`` when
    the node is invoked outside the registry-driven path (the dev runner).
    """

    run_id: str
    node_id: str
    logger: logging.Logger
    secrets: dict[str, str]
    artifact_dir: Path
    db_dsn: str | None
    manifest_dir: Path | None = None
    run_parameters: dict[str, Any] = field(default_factory=dict)

    def get_secret(self, key: str) -> str:
        if key not in self.secrets:
            raise KeyError(f"secret not provided: {key}")
        return self.secrets[key]

    def write_artifact(self, relative_name: str, payload: bytes) -> Path:
        """Write ``payload`` to ``artifact_dir / relative_name``.

        Rejects absolute paths and any name that would resolve outside the
        artifact directory (path traversal guard).
        """
        candidate = Path(relative_name)
        if candidate.is_absolute() or any(part == ".." for part in candidate.parts):
            raise ValueError(f"path traversal not allowed: {relative_name!r}")
        target = (self.artifact_dir / candidate).resolve()
        try:
            target.relative_to(self.artifact_dir.resolve())
        except ValueError as exc:
            raise ValueError(f"path traversal not allowed: {relative_name!r}") from exc
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return target


class Node(ABC):
    """Abstract base class for every executable node.

    Concrete subclasses MUST:
    * declare a class-level ``type_name: str`` matching the manifest reference.
    * implement ``run(context, params) -> NodeResult``.
    """

    type_name: str = ""

    def __init__(self) -> None:
        if not self.type_name:
            raise ValueError(
                f"{type(self).__name__} must declare a non-empty class attribute 'type_name'"
            )

    @abstractmethod
    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        """Execute the node. Implementations must be idempotent where feasible."""

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
