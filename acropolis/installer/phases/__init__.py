"""Phase registry — extension point #7 of the CE/EE fork.

The Acropolis installer used to encode its 9-step flow inline in
``acropolis/installer/cli.py``. Plan 02-07 lifts each step into a
:class:`~acropolis.installer.phases.base.Phase` subclass and registers
them through :class:`~acropolis.installer.phases.registry.PhaseRegistry`.

EE bundles add their phases by:

  - Implementing :class:`Phase` and registering through setuptools
    entry-point group ``parthenon.acropolis.phases``, OR
  - Calling ``registry.register(MyPhase())`` from EE's own ``cli.py``
    wrapper before invoking ``run_all``.

CE never patches EE phases; EE never patches CE phases.
"""
from acropolis.installer.phases.base import (
    InstallerContext,
    Phase,
    PhaseError,
    PhaseResult,
)
from acropolis.installer.phases.registry import PhaseRegistry

__all__ = [
    "InstallerContext",
    "Phase",
    "PhaseError",
    "PhaseRegistry",
    "PhaseResult",
]
