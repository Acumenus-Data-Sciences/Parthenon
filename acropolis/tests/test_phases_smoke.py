"""Smoke tests — every CE phase is importable, has metadata, and the
canonical CE phase list resolves to the expected order."""
from __future__ import annotations

from acropolis.installer.phases import PhaseRegistry
from acropolis.installer.phases.community import __all_phases__, register_into


CE_EXPECTED_ORDER = [
    "community.preflight",
    "community.topology",
    "community.edition",
    "community.discovery",
    "community.configuration",
    "community.parthenon_install",
    "community.network",
    "community.deploy",
    "community.traefik",
    "community.verify",
]


def test_community_phases_exposes_ten_phases():
    assert len(__all_phases__) == len(CE_EXPECTED_ORDER)


def test_register_into_populates_canonical_order():
    reg = PhaseRegistry()
    register_into(reg)
    actual = [p.id for p in reg.sorted_phases("community")]
    assert actual == CE_EXPECTED_ORDER


def test_every_ce_phase_has_required_metadata():
    for cls in __all_phases__:
        instance = cls()
        assert instance.id, f"{cls.__name__} missing id"
        assert instance.id.startswith("community."), f"{cls.__name__} id should be community-prefixed"
        # Topology + Edition + Discovery + Configuration + Network + Deploy + Traefik + Verify
        # all map to legacy_state_id; ParthenonInstall is intentionally None.
        if cls.__name__ == "ParthenonInstallPhase":
            assert instance.legacy_state_id is None
        else:
            assert isinstance(instance.legacy_state_id, int) and 1 <= instance.legacy_state_id <= 9


def test_every_ce_phase_is_applicable_to_community_edition():
    for cls in __all_phases__:
        assert cls().is_applicable("community"), f"{cls.__name__} not applicable to community"


def test_every_ce_phase_is_applicable_to_enterprise_edition_too():
    for cls in __all_phases__:
        assert cls().is_applicable("enterprise"), f"{cls.__name__} not applicable to enterprise"


def test_build_registry_helper_includes_ce_phases():
    from acropolis.installer.cli import build_registry

    registry = build_registry()
    names = registry.names()
    for expected in CE_EXPECTED_ORDER:
        assert expected in names
