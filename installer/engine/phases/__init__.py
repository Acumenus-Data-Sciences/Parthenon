# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
DEFAULT_REGISTRY.register(CONFIG)
DEFAULT_REGISTRY.register(HECATE)
DEFAULT_REGISTRY.register(DOCKER)
# Remaining phases registered in Tasks 9-10
