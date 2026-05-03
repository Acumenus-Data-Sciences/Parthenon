"""FastAPI dependencies — process-singleton Registry, storage, and backend."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from runtime.orchestration.factory import build_backend
from runtime.orchestration.interface import OrchestrationBackend
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.registry.registry import Registry
from runtime.settings import get_settings


@lru_cache(maxsize=1)
def get_storage() -> LocalFilesystemStorage:
    """Return the process-wide LocalFilesystemStorage singleton."""
    return LocalFilesystemStorage(root=Path(get_settings().storage_root))


@lru_cache(maxsize=1)
def get_registry() -> Registry:
    """Return the process-wide Registry singleton.

    The manifests root is taken from ``PARTHENON_MANIFESTS_ROOT`` (used by tests)
    and falls back to ``<package-parent>/manifests`` (in-image default).
    """
    root_env = os.environ.get(
        "PARTHENON_MANIFESTS_ROOT",
        str(Path(__file__).resolve().parent.parent / "manifests"),
    )
    return Registry(root=Path(root_env))


@lru_cache(maxsize=1)
def get_backend() -> OrchestrationBackend:
    """Return the process-wide OrchestrationBackend singleton."""
    return build_backend(storage=get_storage())
