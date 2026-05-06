"""Parthenon ingestion-templates runtime."""

# Phase 3 Plan 1 (T-021A): two-wheel split. The proprietary commercial wheel
# (parthenon-templates-commercial) ships ``runtime/commercial/`` as a sibling
# subpackage of this one. Both wheels share the ``runtime`` namespace; we
# extend ``__path__`` here so Python's import system finds
# ``runtime.commercial`` when both wheels are installed (or both editable
# source roots are on ``sys.path``). The one-way arrow is enforced
# statically by ``templates/.importlinter`` — code under ``runtime.*`` may
# never import ``runtime.commercial.*``.
from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

__all__ = ["__version__"]
__version__ = "0.1.0"
