"""Tests for installer.service_status module."""
from __future__ import annotations

from unittest.mock import patch

from installer import service_status


def test_collect_parses_docker_compose_ps_json():
    docker_output = (
        '{"Service":"nginx","State":"running","Health":"healthy","Status":"Up 3 minutes"}\n'
        '{"Service":"postgres","State":"running","Health":"healthy","Status":"Up 3 minutes"}\n'
        '{"Service":"php","State":"running","Health":"starting","Status":"Up 30 seconds"}\n'
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result == {
        "available": True,
        "services": [
            {"name": "nginx", "state": "running", "health": "healthy", "status": "Up 3 minutes"},
            {"name": "postgres", "state": "running", "health": "healthy", "status": "Up 3 minutes"},
            {"name": "php", "state": "running", "health": "starting", "status": "Up 30 seconds"},
        ],
    }


def test_collect_handles_empty_health_field():
    docker_output = '{"Service":"redis","State":"running","Health":"","Status":"Up 1 minute"}\n'
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result["services"][0]["health"] == "none"


def test_collect_returns_unavailable_when_docker_missing():
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (127, "", "command not found")
        result = service_status.collect()

    assert result == {
        "available": False,
        "services": [],
        "error": "command not found",
    }


def test_collect_skips_blank_lines():
    docker_output = (
        '{"Service":"nginx","State":"running","Health":"healthy","Status":"Up"}\n'
        "\n"
        "  \n"
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert len(result["services"]) == 1


def test_collect_parses_modern_compose_json_array():
    """Docker Compose v2.21+ / v5.x emits a single JSON array."""
    docker_output = (
        '[{"Service":"nginx","State":"running","Health":"healthy","Status":"Up 3 minutes"},'
        '{"Service":"postgres","State":"running","Health":"healthy","Status":"Up 3 minutes"}]'
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result["available"] is True
    assert len(result["services"]) == 2
    assert result["services"][0]["name"] == "nginx"
    assert result["services"][1]["name"] == "postgres"


def test_collect_parses_pretty_printed_json_array():
    """Some Compose versions pretty-print the array."""
    docker_output = (
        "[\n"
        '  {"Service":"nginx","State":"running","Health":"healthy","Status":"Up"},\n'
        '  {"Service":"postgres","State":"running","Health":"","Status":"Up"}\n'
        "]"
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert len(result["services"]) == 2
    assert result["services"][1]["health"] == "none"  # empty Health → "none"


def test_collect_skips_invalid_json_lines_in_ndjson_fallback():
    """In the NDJSON fallback path, lines that fail to parse are skipped."""
    docker_output = (
        '{"Service":"nginx","State":"running","Health":"healthy","Status":"Up"}\n'
        "not valid json\n"
        '{"Service":"postgres","State":"running","Health":"healthy","Status":"Up"}\n'
    )
    # The whole-string parse will fail (mixed valid+invalid), then NDJSON fallback runs.
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert len(result["services"]) == 2
    assert {s["name"] for s in result["services"]} == {"nginx", "postgres"}


def test_collect_handles_empty_stdout():
    """Compose returns 0 with empty stdout when no services exist."""
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, "", "")
        result = service_status.collect()

    assert result == {"available": True, "services": []}


def test_collect_returns_empty_when_array_contains_non_dicts():
    """Defensive: array with garbage entries returns empty services list, not a crash."""
    docker_output = '["not a dict", 42, null]'
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result == {"available": True, "services": []}
