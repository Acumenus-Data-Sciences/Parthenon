"""Scratch pad for session-scoped intermediate artifacts (SQL drafts, cohort specs, etc.)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Artifact:
    key: str
    value: str
    version: int = 1


class ScratchPad:
    """Session-scoped storage for intermediate reasoning artifacts."""

    def __init__(self) -> None:
        self._artifacts: dict[str, Artifact] = {}

    def store(self, key: str, value: str) -> None:
        existing = self._artifacts.get(key)
        version = (existing.version + 1) if existing else 1
        self._artifacts[key] = Artifact(key=key, value=value, version=version)

    def get(self, key: str) -> str | None:
        artifact = self._artifacts.get(key)
        return artifact.value if artifact else None

    def get_version(self, key: str) -> int:
        artifact = self._artifacts.get(key)
        return artifact.version if artifact else 0

    def list_keys(self) -> list[str]:
        return list(self._artifacts.keys())

    def clear(self) -> None:
        self._artifacts.clear()

    def estimated_tokens(self) -> int:
        total_chars = sum(len(a.key) + len(a.value) + 20 for a in self._artifacts.values())
        return total_chars // 4

    def get_context_string(self) -> str:
        if not self._artifacts:
            return ""
        parts = ["Working scratch pad:"]
        for artifact in self._artifacts.values():
            parts.append(f"[{artifact.key} v{artifact.version}]: {artifact.value}")
        return "\n".join(parts)

    def to_dict(self) -> dict[str, Any]:
        return {"artifacts": {k: {"value": a.value, "version": a.version} for k, a in self._artifacts.items()}}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ScratchPad:
        pad = cls()
        for key, artifact_data in data.get("artifacts", {}).items():
            pad._artifacts[key] = Artifact(key=key, value=artifact_data["value"], version=artifact_data["version"])
        return pad
