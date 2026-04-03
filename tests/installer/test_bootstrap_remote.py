"""Tests for installer.bootstrap_remote — Phase 0 remote bootstrap."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest

# Ensure the project root is on sys.path so `installer` is importable.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer.bootstrap_remote import (
    DEFAULT_TARGET,
    GITHUB_CLONE_URL,
    TARBALL_URL,
    acquire_repo,
    detect_docker,
    detect_git,
    ensure_docker,
)


# ---------------------------------------------------------------------------
# TestDetectDocker
# ---------------------------------------------------------------------------

class TestDetectDocker:
    """Tests for detect_docker()."""

    @mock.patch("installer.bootstrap_remote.subprocess.run")
    @mock.patch("installer.bootstrap_remote.shutil.which", return_value="/usr/bin/docker")
    def test_docker_and_compose_installed(
        self, mock_which: mock.MagicMock, mock_run: mock.MagicMock
    ) -> None:
        """Both docker and compose are available."""
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)
        result = detect_docker()
        assert result == {"docker": True, "compose": True}
        assert mock_run.call_count == 2

    @mock.patch("installer.bootstrap_remote.shutil.which", return_value=None)
    def test_docker_missing(self, mock_which: mock.MagicMock) -> None:
        """Docker binary not found on PATH."""
        result = detect_docker()
        assert result == {"docker": False, "compose": False}

    @mock.patch("installer.bootstrap_remote.subprocess.run")
    @mock.patch("installer.bootstrap_remote.shutil.which", return_value="/usr/bin/docker")
    def test_docker_installed_compose_missing(
        self, mock_which: mock.MagicMock, mock_run: mock.MagicMock
    ) -> None:
        """Docker present but compose plugin missing."""

        def side_effect(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            if cmd == ["docker", "--version"]:
                return subprocess.CompletedProcess(args=cmd, returncode=0)
            # docker compose version fails
            raise subprocess.CalledProcessError(1, cmd)

        mock_run.side_effect = side_effect
        result = detect_docker()
        assert result == {"docker": True, "compose": False}


# ---------------------------------------------------------------------------
# TestDetectGit
# ---------------------------------------------------------------------------

class TestDetectGit:
    """Tests for detect_git()."""

    @mock.patch("installer.bootstrap_remote.shutil.which", return_value="/usr/bin/git")
    def test_git_available(self, mock_which: mock.MagicMock) -> None:
        result = detect_git()
        assert result is True

    @mock.patch("installer.bootstrap_remote.shutil.which", return_value=None)
    def test_git_missing(self, mock_which: mock.MagicMock) -> None:
        result = detect_git()
        assert result is False


# ---------------------------------------------------------------------------
# TestEnsureDocker
# ---------------------------------------------------------------------------

class TestEnsureDocker:
    """Tests for ensure_docker()."""

    @mock.patch(
        "installer.bootstrap_remote.detect_docker",
        return_value={"docker": True, "compose": True},
    )
    def test_already_installed(self, mock_detect: mock.MagicMock) -> None:
        assert ensure_docker() is True

    @mock.patch("installer.bootstrap_remote.sys.platform", "darwin")
    @mock.patch(
        "installer.bootstrap_remote.detect_docker",
        return_value={"docker": False, "compose": False},
    )
    def test_macos_exits(self, mock_detect: mock.MagicMock) -> None:
        with pytest.raises(SystemExit) as exc_info:
            ensure_docker()
        assert exc_info.value.code == 1

    @mock.patch("installer.bootstrap_remote.input", return_value="n")
    @mock.patch("installer.bootstrap_remote.sys.platform", "linux")
    @mock.patch(
        "installer.bootstrap_remote.detect_docker",
        return_value={"docker": False, "compose": False},
    )
    def test_linux_user_declines(
        self, mock_detect: mock.MagicMock, mock_input: mock.MagicMock
    ) -> None:
        with pytest.raises(SystemExit) as exc_info:
            ensure_docker()
        assert exc_info.value.code == 1

    @mock.patch("installer.bootstrap_remote.subprocess.run")
    @mock.patch("installer.bootstrap_remote.input", return_value="y")
    @mock.patch("installer.bootstrap_remote.sys.platform", "linux")
    @mock.patch("installer.bootstrap_remote.detect_docker")
    def test_linux_user_accepts(
        self,
        mock_detect: mock.MagicMock,
        mock_input: mock.MagicMock,
        mock_run: mock.MagicMock,
    ) -> None:
        # First call: not installed. Second call (post-install verification): installed.
        mock_detect.side_effect = [
            {"docker": False, "compose": False},
            {"docker": True, "compose": True},
        ]
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)

        assert ensure_docker() is True
        # Verify the install command was executed
        mock_run.assert_called_once_with(
            ["sh", "-c", "curl -fsSL https://get.docker.com | sh"],
            check=True,
            timeout=300,
        )


# ---------------------------------------------------------------------------
# TestAcquireRepo
# ---------------------------------------------------------------------------

class TestAcquireRepo:
    """Tests for acquire_repo()."""

    def test_existing_repo_detected(self, tmp_path: Path) -> None:
        """If docker-compose.yml exists, return the path immediately."""
        (tmp_path / "docker-compose.yml").write_text("version: '3'")
        result = acquire_repo(tmp_path)
        assert result == tmp_path

    @mock.patch("installer.bootstrap_remote.subprocess.run")
    @mock.patch("installer.bootstrap_remote.detect_git", return_value=True)
    def test_git_clone_when_available(
        self, mock_git: mock.MagicMock, mock_run: mock.MagicMock, tmp_path: Path
    ) -> None:
        """Uses git clone --depth 1 when git is available."""
        target = tmp_path / "Parthenon"
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)

        result = acquire_repo(target)
        assert result == target
        mock_run.assert_called_once_with(
            ["git", "clone", "--depth", "1", GITHUB_CLONE_URL, str(target)],
            check=True,
        )

    @mock.patch("installer.bootstrap_remote.tarfile.open")
    @mock.patch("installer.bootstrap_remote.urllib.request.urlopen")
    @mock.patch("installer.bootstrap_remote.detect_git", return_value=False)
    def test_tarball_fallback_when_no_git(
        self,
        mock_git: mock.MagicMock,
        mock_urlopen: mock.MagicMock,
        mock_taropen: mock.MagicMock,
        tmp_path: Path,
    ) -> None:
        """Falls back to tarball download when git is not available."""
        target = tmp_path / "Parthenon"

        # Mock the HTTP response
        mock_response = mock.MagicMock()
        mock_response.read.return_value = b"fake-tarball-data"
        mock_response.__enter__ = mock.MagicMock(return_value=mock_response)
        mock_response.__exit__ = mock.MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        # Mock tarfile with members that have a top-level prefix
        mock_tar = mock.MagicMock()
        member_root = mock.MagicMock()
        member_root.name = "Parthenon-main"
        member_file = mock.MagicMock()
        member_file.name = "Parthenon-main/docker-compose.yml"
        mock_tar.getmembers.return_value = [member_root, member_file]
        mock_tar.__enter__ = mock.MagicMock(return_value=mock_tar)
        mock_tar.__exit__ = mock.MagicMock(return_value=False)
        mock_taropen.return_value = mock_tar

        result = acquire_repo(target)
        assert result == target
        # Verify the prefix was stripped from the member name
        assert member_file.name == "docker-compose.yml"
        mock_tar.extract.assert_called_once_with(member_file, path=target)
