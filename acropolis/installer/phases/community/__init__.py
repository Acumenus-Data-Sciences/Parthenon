"""Community-edition installer phases.

Importing this package triggers definition of every CE phase class. The
:func:`register_into` helper attaches them to a :class:`PhaseRegistry`
in canonical order — the same flow ``cli.run()`` used to encode inline.
"""
from __future__ import annotations

from acropolis.installer.phases.community.configuration import ConfigurationPhase
from acropolis.installer.phases.community.deploy import DeployPhase
from acropolis.installer.phases.community.discovery import DiscoveryPhase
from acropolis.installer.phases.community.edition import EditionSelectionPhase
from acropolis.installer.phases.community.network import NetworkSetupPhase
from acropolis.installer.phases.community.parthenon_install import ParthenonInstallPhase
from acropolis.installer.phases.community.preflight import PreflightPhase
from acropolis.installer.phases.community.topology import TopologyPhase
from acropolis.installer.phases.community.traefik import TraefikPhase
from acropolis.installer.phases.community.verify import VerifyPhase

# Canonical CE phase order. Numeric prefixes preserve the legacy state
# machine's phase ids (1..9) plus the unnumbered Parthenon-install
# sub-phase that runs between 5 and 6.
__all_phases__ = [
    PreflightPhase,
    TopologyPhase,
    EditionSelectionPhase,
    DiscoveryPhase,
    ConfigurationPhase,
    ParthenonInstallPhase,
    NetworkSetupPhase,
    DeployPhase,
    TraefikPhase,
    VerifyPhase,
]


def register_into(registry) -> None:
    """Attach every CE phase to ``registry`` in canonical order."""
    for cls in __all_phases__:
        registry.register(cls())


__all__ = [
    "ConfigurationPhase",
    "DeployPhase",
    "DiscoveryPhase",
    "EditionSelectionPhase",
    "NetworkSetupPhase",
    "ParthenonInstallPhase",
    "PreflightPhase",
    "TopologyPhase",
    "TraefikPhase",
    "VerifyPhase",
    "__all_phases__",
    "register_into",
]
