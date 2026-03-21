# tests/test_utils.py
"""Tests for installer.utils module."""
import subprocess
from unittest.mock import patch, MagicMock
from installer.utils import (
    os_name,
    is_port_free,
    free_disk_gb,
    docker_version,
    docker_compose_version,
    docker_daemon_running,
    container_health,
    user_in_docker_group,
    generate_password,
)


def test_os_name_returns_string():
    name = os_name()
    assert name in ("Linux", "macOS", "Windows")


def test_is_port_free_nothing_listening():
    # Nothing listens on port 0, so connect_ex fails = port is free
    assert is_port_free(0) is True


def test_free_disk_gb_returns_positive():
    gb = free_disk_gb()
    assert gb > 0


@patch("installer.utils.subprocess.run")
def test_docker_version_parses_output(mock_run):
    mock_run.return_value = MagicMock(
        returncode=0, stdout="Docker version 24.0.7, build afdd53b"
    )
    ver = docker_version()
    assert ver == "24.0.7"


@patch("installer.utils.subprocess.run")
def test_docker_version_returns_none_on_failure(mock_run):
    mock_run.side_effect = FileNotFoundError
    ver = docker_version()
    assert ver is None


@patch("installer.utils.subprocess.run")
def test_docker_compose_version_parses_output(mock_run):
    mock_run.return_value = MagicMock(
        returncode=0, stdout="Docker Compose version v2.24.5"
    )
    ver = docker_compose_version()
    assert ver == "2.24.5"


@patch("installer.utils.subprocess.run")
def test_docker_daemon_running_true(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    assert docker_daemon_running() is True


@patch("installer.utils.subprocess.run")
def test_docker_daemon_running_false(mock_run):
    mock_run.return_value = MagicMock(returncode=1)
    assert docker_daemon_running() is False


@patch("installer.utils.subprocess.run")
def test_container_health_healthy(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="healthy\n")
    assert container_health("test-container") == "healthy"


@patch("installer.utils.subprocess.run")
def test_container_health_not_found(mock_run):
    mock_run.return_value = MagicMock(returncode=1, stdout="")
    assert container_health("missing-container") == "unknown"


def test_generate_password_length():
    pw = generate_password(24)
    assert len(pw) == 24


def test_generate_password_charset():
    pw = generate_password(100)
    for c in pw:
        assert c.isalnum() or c in "-_"
