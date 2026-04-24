# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
DEFAULT_REGISTRY.register(CONFIG)
# Remaining phases registered in Tasks 8-10
