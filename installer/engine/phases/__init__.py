# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER
from .bootstrap import PHASE as BOOTSTRAP
from .datasets import PHASE as DATASETS
from .frontend import PHASE as FRONTEND
from .solr import PHASE as SOLR
from .admin import PHASE as ADMIN

DEFAULT_REGISTRY = PhaseRegistry()
for phase in (PREFLIGHT, CONFIG, HECATE, DOCKER, BOOTSTRAP, DATASETS, FRONTEND, SOLR, ADMIN):
    DEFAULT_REGISTRY.register(phase)
