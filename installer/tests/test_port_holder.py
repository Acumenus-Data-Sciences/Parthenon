"""Tests for installer.port_holder module."""
from __future__ import annotations

from unittest.mock import patch

from installer import port_holder


def test_identify_parses_lsof_output_on_macos():
    lsof_output = (
        "COMMAND     PID    USER   FD   TYPE\n"
        "nginx     12345 smudoshi   6u  IPv4\n"
    )
    with patch("installer.port_holder._platform", return_value="Darwin"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.return_value = (0, lsof_output, "")
            result = port_holder.identify(8082)

    assert result == {
        "found": True,
        "port": 8082,
        "pid": 12345,
        "name": "nginx",
        "command": "nginx",
        "platform_used": "lsof",
    }


def test_identify_returns_not_found_on_empty_lsof():
    with patch("installer.port_holder._platform", return_value="Linux"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.return_value = (1, "", "")
            result = port_holder.identify(9999)

    assert result == {"found": False, "port": 9999, "platform_used": "lsof"}


def test_identify_falls_back_to_ss_when_lsof_missing():
    ss_output = (
        "Netid State Recv-Q Send-Q Local Address:Port  Peer  Process\n"
        "tcp   LISTEN 0 511 0.0.0.0:8082 0.0.0.0:* users:((\"nginx\",pid=4321,fd=6))\n"
    )
    with patch("installer.port_holder._platform", return_value="Linux"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.side_effect = [
                (127, "", "command not found"),  # lsof missing
                (0, ss_output, ""),               # ss succeeds
            ]
            result = port_holder.identify(8082)

    assert result["found"] is True
    assert result["pid"] == 4321
    assert result["name"] == "nginx"
    assert result["platform_used"] == "ss"


def test_identify_uses_netstat_on_windows():
    netstat_output = (
        "Active Connections\n"
        "  Proto  Local Address          Foreign Address        State           PID\n"
        "  TCP    0.0.0.0:8082           0.0.0.0:0              LISTENING       1234\n"
    )
    tasklist_output = '"nginx.exe","1234","Console","1","12,345 K"'

    with patch("installer.port_holder._platform", return_value="Windows"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.side_effect = [
                (0, netstat_output, ""),    # netstat succeeds
                (0, tasklist_output, ""),   # tasklist resolves the pid
            ]
            result = port_holder.identify(8082)

    assert result["found"] is True
    assert result["pid"] == 1234
    assert result["platform_used"] == "netstat"
