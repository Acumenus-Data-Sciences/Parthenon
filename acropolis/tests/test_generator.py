# tests/test_generator.py
"""Tests for installer.generator module."""
from installer.generator import generate_acropolis_sh


def test_generate_community_edition():
    script = generate_acropolis_sh(
        tier="community",
        domain="acumenus.net",
        topology_mode="local",
        services=["portainer", "pgadmin"],
    )
    assert "docker-compose.community.yml" in script
    assert "docker-compose.enterprise.yml" not in script


def test_generate_enterprise_edition():
    script = generate_acropolis_sh(
        tier="enterprise",
        domain="acumenus.net",
        topology_mode="local",
        services=["portainer", "pgadmin", "n8n", "superset"],
    )
    assert "docker-compose.enterprise.yml" in script
    assert "https://wazuh.$DOMAIN" in script


def test_generate_has_all_commands():
    script = generate_acropolis_sh(
        tier="community",
        domain="acumenus.net",
        topology_mode="standalone",
        services=[],
    )
    for cmd in ["cmd_up", "cmd_down", "cmd_status", "cmd_logs", "cmd_urls",
                "cmd_backup", "cmd_smoke_test", "cmd_update", "cmd_reconfigure"]:
        assert cmd in script


def test_generate_standalone_no_parthenon():
    script = generate_acropolis_sh(
        tier="community",
        domain="example.com",
        topology_mode="standalone",
        services=[],
    )
    assert 'PARTHENON_MODE="standalone"' in script


def test_generate_remote_has_url():
    script = generate_acropolis_sh(
        tier="community",
        domain="example.com",
        topology_mode="remote",
        services=[],
        parthenon_url="https://p.example.com",
    )
    assert 'PARTHENON_URL="https://p.example.com"' in script
