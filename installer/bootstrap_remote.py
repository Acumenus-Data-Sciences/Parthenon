"""Phase 0 — Remote Bootstrap: Docker detection/installation and repo acquisition.

Handles pre-requisite setup before the main installer can run:
  - Detect Docker Engine and Docker Compose
  - Detect git
  - Auto-install Docker on Linux (with user consent)
  - Acquire the Parthenon repo via git clone or tarball download
"""
from __future__ import annotations

import io
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

GITHUB_REPO = "sudoshi/Parthenon"
GITHUB_CLONE_URL = f"https://github.com/{GITHUB_REPO}.git"
TARBALL_URL = f"https://github.com/{GITHUB_REPO}/archive/refs/heads/main.tar.gz"
DEFAULT_TARGET = Path.home() / "Parthenon"


def detect_docker() -> dict[str, bool]:
    """Check if Docker Engine and Docker Compose are available.

    Returns a dict with keys 'docker' and 'compose', each True if the
    respective tool is found on PATH and responds to a version query.
    """
    result: dict[str, bool] = {"docker": False, "compose": False}

    if shutil.which("docker") is not None:
        try:
            subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                check=True,
                timeout=10,
            )
            result["docker"] = True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass

    if result["docker"]:
        try:
            subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True,
                check=True,
                timeout=10,
            )
            result["compose"] = True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass

    return result


def detect_git() -> bool:
    """Check if git is available on PATH."""
    return shutil.which("git") is not None


def ensure_docker() -> bool:
    """Ensure Docker is installed, offering auto-install on Linux.

    Returns True if Docker is available (either already installed or
    successfully installed). Prints guidance and calls sys.exit(1) on
    macOS/Windows where auto-install is not supported, or if the user
    declines installation on Linux.
    """
    status = detect_docker()
    if status["docker"] and status["compose"]:
        return True

    platform = sys.platform

    if platform == "darwin":
        print(
            "\nDocker is not installed.\n"
            "Please install Docker Desktop for macOS from:\n"
            "  https://docs.docker.com/desktop/install/mac-install/\n"
            "Then re-run the installer."
        )
        sys.exit(1)

    if platform == "win32":
        print(
            "\nDocker is not installed.\n"
            "Please install Docker Desktop for Windows from:\n"
            "  https://docs.docker.com/desktop/install/windows-install/\n"
            "Then re-run the installer."
        )
        sys.exit(1)

    # Linux auto-install path
    print("\nDocker is not installed.")
    answer = input("Install Docker via https://get.docker.com? [y/N] ").strip().lower()
    if answer not in ("y", "yes"):
        print("Docker is required. Exiting.")
        sys.exit(1)

    print("Installing Docker...")
    try:
        subprocess.run(
            ["sh", "-c", "curl -fsSL https://get.docker.com | sh"],
            check=True,
            timeout=300,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        print(f"Docker installation failed: {exc}")
        sys.exit(1)

    # Verify installation succeeded
    post_status = detect_docker()
    if not post_status["docker"]:
        print("Docker installation completed but docker is not responding.")
        sys.exit(1)

    return True


def acquire_repo(target: Path | None = None) -> Path:
    """Acquire the Parthenon repository at the target path.

    Strategy:
      1. If target already contains docker-compose.yml, use it as-is.
      2. If git is available, shallow-clone the repo.
      3. Otherwise, download and extract a tarball from GitHub.

    Returns the Path to the repo root directory.
    """
    if target is None:
        target = DEFAULT_TARGET

    # Already present
    if (target / "docker-compose.yml").is_file():
        print(f"Repository already present at {target}")
        return target

    # Git clone
    if detect_git():
        print(f"Cloning {GITHUB_CLONE_URL} into {target}...")
        subprocess.run(
            ["git", "clone", "--depth", "1", GITHUB_CLONE_URL, str(target)],
            check=True,
        )
        return target

    # Tarball fallback
    print(f"Downloading tarball from {TARBALL_URL}...")
    target.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(TARBALL_URL) as response:  # noqa: S310
        data = response.read()

    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        # GitHub tarballs have a top-level directory like Parthenon-main/
        members = tar.getmembers()
        if not members:
            print("Downloaded tarball is empty.")
            sys.exit(1)

        # Strip the top-level directory prefix
        prefix = members[0].name.split("/")[0]
        for member in members:
            if member.name == prefix:
                continue
            # Remove the prefix from the member path
            member.name = member.name[len(prefix) + 1 :]
            if member.name:
                tar.extract(member, path=target)

    print(f"Repository extracted to {target}")
    return target


def _ensure_pip_deps() -> None:
    """Install rich and questionary if missing (mirrors install.py bootstrap)."""
    required = {"rich": "rich>=13.0", "questionary": "questionary>=2.0"}
    missing = []
    for module, pkg in required.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"Installing dependencies: {', '.join(missing)}")
        cmd = [sys.executable, "-m", "pip", "install", "--quiet", *missing]
        result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if result.returncode != 0:
            if b"externally-managed" in (result.stderr or b""):
                subprocess.run(
                    cmd + ["--break-system-packages"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )


def main(argv: list[str] | None = None) -> None:
    """Entry point for the remote installer binary."""
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Acropolis — Parthenon Remote Installer")
    parser.add_argument("--dir", type=Path, default=DEFAULT_TARGET,
                        help=f"Target directory for Parthenon (default: {DEFAULT_TARGET})")
    args = parser.parse_args(argv)

    print("=" * 56)
    print("  Acropolis — Parthenon Remote Installer")
    print("=" * 56)
    print()

    ensure_docker()
    print("Docker is ready.\n")

    repo_path = acquire_repo(args.dir)
    print()

    # Launch the repo's own installer as a subprocess using system Python.
    # install.py bootstraps pip deps (rich, questionary) before importing
    # the installer package, so they don't need to be pre-installed.
    print("Launching Parthenon installer...\n")
    os.chdir(repo_path)

    # Find system Python (not the PyInstaller-bundled one)
    system_python = shutil.which("python3") or shutil.which("python")
    if not system_python:
        print("Python 3 not found. Install Python 3.9+ and retry.")
        sys.exit(1)

    # Use install.py --webapp which bootstraps deps then runs webapp.main()
    rc = subprocess.run(
        [system_python, "install.py", "--webapp"],
        cwd=str(repo_path),
    ).returncode
    sys.exit(rc)


if __name__ == "__main__":
    main()
