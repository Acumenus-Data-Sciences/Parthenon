# tests/test_preflight.py
"""Tests for installer.preflight module."""
from unittest.mock import patch
from installer.preflight import (
    CheckResult,
    check_python_version,
    check_docker_version,
    check_docker_compose,
    check_docker_daemon,
    check_disk_space,
    check_ports_free,
    run_preflight,
)


def test_check_result_namedtuple():
    r = CheckResult("test", "ok", "all good")
    assert r.name == "test"
    assert r.status == "ok"
    assert r.detail == "all good"


def test_check_python_version_passes():
    result = check_python_version()
    assert result.status == "ok"


@patch("installer.preflight.docker_version", return_value="24.0.7")
def test_check_docker_version_passes(mock_ver):
    result = check_docker_version()
    assert result.status == "ok"


@patch("installer.preflight.docker_version", return_value="23.0.0")
def test_check_docker_version_too_old(mock_ver):
    result = check_docker_version()
    assert result.status == "fail"


@patch("installer.preflight.docker_version", return_value=None)
def test_check_docker_version_not_found(mock_ver):
    result = check_docker_version()
    assert result.status == "fail"


@patch("installer.preflight.docker_compose_version", return_value="2.24.5")
def test_check_docker_compose_passes(mock_ver):
    result = check_docker_compose()
    assert result.status == "ok"


@patch("installer.preflight.docker_compose_version", return_value=None)
def test_check_docker_compose_missing(mock_ver):
    result = check_docker_compose()
    assert result.status == "fail"


@patch("installer.preflight.docker_daemon_running", return_value=True)
def test_check_docker_daemon_running(mock_run):
    result = check_docker_daemon()
    assert result.status == "ok"


@patch("installer.preflight.docker_daemon_running", return_value=False)
def test_check_docker_daemon_not_running(mock_run):
    result = check_docker_daemon()
    assert result.status == "fail"


@patch("installer.preflight.free_disk_gb", return_value=20.0)
def test_check_disk_space_ok(mock_disk):
    result = check_disk_space()
    assert result.status == "ok"


@patch("installer.preflight.free_disk_gb", return_value=7.0)
def test_check_disk_space_warn(mock_disk):
    result = check_disk_space()
    assert result.status == "warn"


@patch("installer.preflight.free_disk_gb", return_value=3.0)
def test_check_disk_space_fail(mock_disk):
    result = check_disk_space()
    assert result.status == "fail"


@patch("installer.preflight.is_port_free", return_value=True)
def test_check_ports_all_free(mock_port):
    result = check_ports_free([80, 443, 8090])
    assert result.status == "ok"


@patch("installer.preflight.is_port_free", side_effect=lambda p: p != 80)
def test_check_ports_one_busy(mock_port):
    result = check_ports_free([80, 443, 8090])
    assert result.status == "fail"
    assert "80" in result.detail


@patch("installer.preflight.docker_daemon_running", return_value=True)
@patch("installer.preflight.docker_compose_version", return_value="2.24.5")
@patch("installer.preflight.docker_version", return_value="24.0.7")
@patch("installer.preflight.is_port_free", return_value=True)
@patch("installer.preflight.free_disk_gb", return_value=20.0)
@patch("installer.preflight.user_in_docker_group", return_value=True)
def test_run_preflight_returns_list(*mocks):
    results = run_preflight()
    assert isinstance(results, list)
    assert all(isinstance(r, CheckResult) for r in results)
