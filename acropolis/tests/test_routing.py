# tests/test_routing.py
"""Tests for installer.routing module."""
from installer.discovery import DiscoveredService
from installer.routing import (
    generate_parthenon_routes,
    generate_acropolis_routes,
    generate_traefik_static,
)


def test_generate_parthenon_routes_local():
    services = [
        DiscoveredService("nginx", "parthenon-nginx", 8082, "parthenon", True),
        DiscoveredService("darkstar", "parthenon-darkstar", 8787, "darkstar", True),
    ]
    yaml_str = generate_parthenon_routes(services, "acumenus.net", "local")
    assert "parthenon.acumenus.net" in yaml_str
    assert "darkstar.acumenus.net" in yaml_str
    assert "http://parthenon-nginx:8082" in yaml_str
    assert "http://parthenon-darkstar:8787" in yaml_str


def test_generate_parthenon_routes_remote():
    services = [
        DiscoveredService("nginx", "parthenon-nginx", 8082, "parthenon", True),
    ]
    yaml_str = generate_parthenon_routes(
        services, "acumenus.net", "remote", remote_url="https://parthenon.example.com"
    )
    assert "https://parthenon.example.com" in yaml_str


def test_generate_parthenon_routes_filters_unexposed():
    services = [
        DiscoveredService("nginx", "parthenon-nginx", 8082, "parthenon", True),
        DiscoveredService("solr", "parthenon-solr", 8983, "solr", False),
    ]
    yaml_str = generate_parthenon_routes(services, "acumenus.net", "local")
    assert "parthenon.acumenus.net" in yaml_str
    assert "solr.acumenus.net" not in yaml_str


def test_generate_parthenon_routes_tls_none():
    services = [
        DiscoveredService("nginx", "parthenon-nginx", 8082, "parthenon", True),
    ]
    yaml_str = generate_parthenon_routes(services, "local.dev", "local", "none")
    assert "web" in yaml_str
    assert "websecure" not in yaml_str
    assert "certResolver" not in yaml_str


def test_generate_parthenon_routes_tls_letsencrypt():
    services = [
        DiscoveredService("nginx", "parthenon-nginx", 8082, "parthenon", True),
    ]
    yaml_str = generate_parthenon_routes(services, "acumenus.net", "local", "letsencrypt")
    assert "websecure" in yaml_str
    assert "certResolver: letsencrypt" in yaml_str


def test_generate_traefik_static_none():
    static = generate_traefik_static("none", "admin@local.dev")
    assert "websecure" not in static
    assert "certificatesResolvers" not in static
    assert "redirect" not in static


def test_generate_traefik_static_letsencrypt():
    static = generate_traefik_static("letsencrypt", "admin@acumenus.net")
    assert "websecure" in static
    assert "certResolver: letsencrypt" in static
    assert "admin@acumenus.net" in static
    assert "redirect" in static.lower() or "Redirect" in static


def test_generate_acropolis_routes_returns_string():
    yaml_str = generate_acropolis_routes("acumenus.net", "community")
    assert isinstance(yaml_str, str)
    assert "Docker labels" in yaml_str


def test_generate_acropolis_routes_enterprise():
    yaml_str = generate_acropolis_routes("acumenus.net", "enterprise")
    assert isinstance(yaml_str, str)
