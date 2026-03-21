# tests/test_discovery.py
"""Tests for installer.discovery module."""
from installer.discovery import (
    DiscoveredService,
    CURATED_SERVICES,
    match_containers_to_registry,
)


def test_curated_services_has_darkstar():
    names = [s.name for s in CURATED_SERVICES]
    assert "darkstar" in names


def test_curated_services_has_morpheus():
    names = [s.name for s in CURATED_SERVICES]
    assert "morpheus-ingest" in names


def test_match_containers_known():
    containers = ["parthenon-nginx", "parthenon-darkstar", "parthenon-ai"]
    matched, unknown = match_containers_to_registry(containers)
    assert len(matched) == 3
    assert len(unknown) == 0
    assert all(isinstance(s, DiscoveredService) for s in matched)


def test_match_containers_with_unknown():
    containers = ["parthenon-nginx", "parthenon-custom-service"]
    matched, unknown = match_containers_to_registry(containers)
    assert len(matched) == 1
    assert unknown == ["parthenon-custom-service"]


def test_match_containers_empty():
    matched, unknown = match_containers_to_registry([])
    assert matched == []
    assert unknown == []


def test_discovered_service_fields():
    s = DiscoveredService("test", "container", 8080, "test", True)
    assert s.name == "test"
    assert s.host == "container"
    assert s.port == 8080
    assert s.subdomain == "test"
    assert s.expose is True
