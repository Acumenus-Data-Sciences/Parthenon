# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
# Remaining phases registered in Tasks 7-10
