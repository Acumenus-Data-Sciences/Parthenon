"""Platform-aware launcher helpers for the desktop installer."""
from __future__ import annotations

import os
import platform
import shlex
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


def is_windows_host() -> bool:
    return platform.system() == "Windows"


def default_repo_path() -> str:
    env_repo = os.environ.get("PARTHENON_REPO_PATH", "").strip()
    if env_repo:
        return env_repo
    if is_windows_host():
        return ""
    return str(REPO_ROOT)


def default_wsl_distro() -> str:
    return os.environ.get("PARTHENON_WSL_DISTRO", "").strip()


def default_wsl_repo_path() -> str:
    return os.environ.get("PARTHENON_WSL_REPO_PATH", "").strip()


def resource_path(relative_path: str) -> Path:
    base_path = getattr(sys, "_MEIPASS", "")
    if base_path:
        return Path(base_path) / relative_path
    return REPO_ROOT / relative_path


def windows_path_to_wsl(path: str, *, distro: str = "") -> str:
    """Convert a Windows path to a Linux path via wslpath."""
    command = ["wsl.exe"]
    if distro:
        command += ["-d", distro]
    command += ["wslpath", "-a", path]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def validate_repo_path(path: str) -> Path:
    repo_path = Path(path).expanduser().resolve()
    if not repo_path.exists():
        raise ValueError(f"Repo path does not exist: {repo_path}")
    if not (repo_path / "install.py").exists():
        raise ValueError(f"install.py not found under repo path: {repo_path}")
    return repo_path


def build_install_command(
    *,
    defaults_path: str,
    upgrade: bool,
    repo_path: str | None = None,
    wsl_distro: str = "",
    wsl_repo_path: str = "",
) -> tuple[list[str], str]:
    """Return a command list and working directory for the current host."""
    if is_windows_host():
        if wsl_repo_path.strip():
            repo_linux = wsl_repo_path.strip()
        elif repo_path:
            repo_linux = windows_path_to_wsl(str(Path(repo_path).expanduser().resolve()), distro=wsl_distro)
        else:
            raise ValueError("A Windows repo path or WSL repo path is required on Windows")

        defaults_linux = windows_path_to_wsl(str(Path(defaults_path).expanduser().resolve()), distro=wsl_distro)
        script = (
            f"cd {shlex.quote(repo_linux)} && "
            f"python3 install.py --defaults-file {shlex.quote(defaults_linux)} --non-interactive"
        )
        if upgrade:
            script += " --upgrade"

        command = ["wsl.exe"]
        if wsl_distro:
            command += ["-d", wsl_distro]
        command += ["bash", "-lc", script]
        return command, str(REPO_ROOT)

    repo_dir = str(validate_repo_path(repo_path or str(REPO_ROOT)))
    command = [sys.executable, "install.py", "--defaults-file", defaults_path, "--non-interactive"]
    if upgrade:
        command.append("--upgrade")
    return command, repo_dir
