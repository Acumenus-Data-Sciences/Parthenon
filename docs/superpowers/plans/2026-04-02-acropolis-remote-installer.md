# Acropolis Remote Installer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable one-command Parthenon installation from a single binary download or `curl` one-liner, handling Docker setup, repo acquisition, and the existing webapp installer flow automatically.

**Architecture:** A new `bootstrap_remote.py` module handles "Phase 0" (Docker detection/install, repo clone/download), then hands off to the existing `webapp.py` installer. Two packaging strategies produce binaries: Cosmopolitan APE (universal) and PyInstaller (per-platform fallback). A landing page and shell script provide distribution.

**Tech Stack:** Python 3.9+ stdlib (no third-party deps in Phase 0), PyInstaller, Cosmopolitan `cosmocc`, GitHub Actions, static HTML/CSS/JS

**Spec:** `docs/superpowers/specs/2026-04-02-acropolis-remote-installer-design.md`

---

## Phase 1: bootstrap_remote.py + CLI entry point

### Task 1: Docker detection module

**Files:**
- Create: `installer/bootstrap_remote.py`
- Create: `tests/installer/test_bootstrap_remote.py`

- [ ] **Step 1: Write failing tests for Docker detection**

```python
# tests/installer/test_bootstrap_remote.py
"""Tests for the remote bootstrap module."""
import subprocess
from unittest.mock import patch, MagicMock

import pytest

from installer.bootstrap_remote import detect_docker, detect_git


class TestDetectDocker:
    @patch("shutil.which", return_value="/usr/bin/docker")
    @patch("subprocess.run")
    def test_docker_installed_and_compose_available(self, mock_run, mock_which):
        mock_run.return_value = MagicMock(returncode=0, stdout="Docker Compose version v5.1.0")
        result = detect_docker()
        assert result["docker"] is True
        assert result["compose"] is True

    @patch("shutil.which", return_value=None)
    def test_docker_not_installed(self, mock_which):
        result = detect_docker()
        assert result["docker"] is False
        assert result["compose"] is False

    @patch("shutil.which", return_value="/usr/bin/docker")
    @patch("subprocess.run", side_effect=FileNotFoundError)
    def test_docker_installed_compose_missing(self, mock_run, mock_which):
        result = detect_docker()
        assert result["docker"] is True
        assert result["compose"] is False


class TestDetectGit:
    @patch("shutil.which", return_value="/usr/bin/git")
    def test_git_available(self, mock_which):
        assert detect_git() is True

    @patch("shutil.which", return_value=None)
    def test_git_not_available(self, mock_which):
        assert detect_git() is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/smudoshi/Github/Parthenon
python3 -m pytest tests/installer/test_bootstrap_remote.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'installer.bootstrap_remote'`

- [ ] **Step 3: Write Docker and Git detection functions**

```python
# installer/bootstrap_remote.py
"""Phase 0 — Remote bootstrap for the Acropolis installer.

Handles Docker detection/installation, repo acquisition, and handoff
to the webapp installer. Designed to run as the entry point of a
standalone binary (Cosmopolitan APE or PyInstaller).

Usage:
    python3 -m installer.bootstrap_remote [--dir ~/Parthenon]
"""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


GITHUB_REPO = "sudoshi/Parthenon"
GITHUB_CLONE_URL = f"https://github.com/{GITHUB_REPO}.git"
TARBALL_URL = f"https://github.com/{GITHUB_REPO}/archive/refs/heads/main.tar.gz"
DEFAULT_TARGET = Path.home() / "Parthenon"


def detect_docker() -> dict[str, bool]:
    """Check whether Docker and Docker Compose are available."""
    docker = shutil.which("docker") is not None
    compose = False
    if docker:
        try:
            result = subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True, text=True, timeout=10,
            )
            compose = result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return {"docker": docker, "compose": compose}


def detect_git() -> bool:
    """Check whether git is available on PATH."""
    return shutil.which("git") is not None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/installer/test_bootstrap_remote.py -v
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/bootstrap_remote.py tests/installer/test_bootstrap_remote.py
git commit -m "feat: Docker and Git detection for remote bootstrap"
```

---

### Task 2: Docker auto-install (Linux) and platform guidance

**Files:**
- Modify: `installer/bootstrap_remote.py`
- Modify: `tests/installer/test_bootstrap_remote.py`

- [ ] **Step 1: Write failing tests for Docker installation**

```python
# Append to tests/installer/test_bootstrap_remote.py

from installer.bootstrap_remote import ensure_docker


class TestEnsureDocker:
    @patch("installer.bootstrap_remote.detect_docker", return_value={"docker": True, "compose": True})
    def test_already_installed_returns_true(self, mock_detect):
        assert ensure_docker() is True

    @patch("installer.bootstrap_remote.detect_docker", return_value={"docker": False, "compose": False})
    @patch("platform.system", return_value="Darwin")
    def test_macos_missing_docker_exits(self, mock_platform, mock_detect):
        with pytest.raises(SystemExit):
            ensure_docker()

    @patch("installer.bootstrap_remote.detect_docker", return_value={"docker": False, "compose": False})
    @patch("platform.system", return_value="Linux")
    @patch("builtins.input", return_value="n")
    def test_linux_user_declines_install_exits(self, mock_input, mock_platform, mock_detect):
        with pytest.raises(SystemExit):
            ensure_docker()

    @patch("installer.bootstrap_remote.detect_docker")
    @patch("platform.system", return_value="Linux")
    @patch("builtins.input", return_value="y")
    @patch("subprocess.run")
    def test_linux_user_accepts_install(self, mock_run, mock_input, mock_platform, mock_detect):
        # First call: not installed. Second call (after install): installed.
        mock_detect.side_effect = [
            {"docker": False, "compose": False},
            {"docker": True, "compose": True},
        ]
        mock_run.return_value = MagicMock(returncode=0)
        assert ensure_docker() is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/installer/test_bootstrap_remote.py::TestEnsureDocker -v
```

Expected: FAIL — `ImportError: cannot import name 'ensure_docker'`

- [ ] **Step 3: Implement ensure_docker**

Append to `installer/bootstrap_remote.py`:

```python
def _platform() -> str:
    """Return normalized platform name: Linux, Darwin, or Windows."""
    return platform.system()


def ensure_docker() -> bool:
    """Ensure Docker and Compose are available. Auto-install on Linux with consent.

    Returns True if Docker is ready. Calls sys.exit(1) if the user
    declines or the platform requires manual installation.
    """
    status = detect_docker()
    if status["docker"] and status["compose"]:
        return True

    plat = _platform()

    if plat == "Linux":
        print("\nDocker is not installed on this machine.")
        answer = input("Install Docker now? [Y/n] ").strip().lower()
        if answer in ("n", "no"):
            print("Docker is required. Install it and re-run this installer.")
            sys.exit(1)

        print("Installing Docker via get.docker.com ...")
        rc = subprocess.run(
            ["sh", "-c", "curl -fsSL https://get.docker.com | sh"],
            timeout=300,
        ).returncode
        if rc != 0:
            print("Docker installation failed. Install manually and re-run.")
            sys.exit(1)

        # Add current user to docker group
        user = os.environ.get("USER", "")
        if user:
            subprocess.run(["sudo", "usermod", "-aG", "docker", user])
            print(f"Added {user} to the docker group.")
            print("You may need to log out and back in for group changes to take effect.")

        # Re-check
        status = detect_docker()
        if status["docker"] and status["compose"]:
            return True
        print("Docker installed but Compose not detected. Install docker-compose-plugin and re-run.")
        sys.exit(1)

    elif plat == "Darwin":
        print("\nDocker Desktop is required on macOS.")
        print("Download and install from:")
        print("  https://docs.docker.com/desktop/install/mac-install/")
        print("\nAfter installing, start Docker Desktop, then re-run this installer.")
        sys.exit(1)

    else:
        # Windows or other
        print("\nDocker Desktop with WSL2 is required.")
        print("Download and install from:")
        print("  https://docs.docker.com/desktop/install/windows-install/")
        print("\nAfter installing, open a WSL terminal and re-run this installer.")
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/installer/test_bootstrap_remote.py -v
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/bootstrap_remote.py tests/installer/test_bootstrap_remote.py
git commit -m "feat: Docker auto-install on Linux with platform guidance"
```

---

### Task 3: Repo acquisition (git clone or tarball)

**Files:**
- Modify: `installer/bootstrap_remote.py`
- Modify: `tests/installer/test_bootstrap_remote.py`

- [ ] **Step 1: Write failing tests for repo acquisition**

```python
# Append to tests/installer/test_bootstrap_remote.py

from installer.bootstrap_remote import acquire_repo, DEFAULT_TARGET


class TestAcquireRepo:
    @patch("pathlib.Path.exists", return_value=True)
    def test_existing_repo_detected(self, mock_exists, tmp_path):
        target = tmp_path / "Parthenon"
        target.mkdir()
        (target / "docker-compose.yml").touch()
        result = acquire_repo(target)
        assert result == target

    @patch("installer.bootstrap_remote.detect_git", return_value=True)
    @patch("subprocess.run")
    def test_git_clone_when_available(self, mock_run, mock_git, tmp_path):
        target = tmp_path / "Parthenon"
        mock_run.return_value = MagicMock(returncode=0)
        result = acquire_repo(target)
        assert result == target
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert "git" in args[0]
        assert "clone" in args

    @patch("installer.bootstrap_remote.detect_git", return_value=False)
    @patch("subprocess.run")
    def test_tarball_fallback_when_no_git(self, mock_run, mock_git, tmp_path):
        target = tmp_path / "Parthenon"
        mock_run.return_value = MagicMock(returncode=0)
        result = acquire_repo(target)
        assert result == target
        args = mock_run.call_args[0][0]
        # Should use curl to download tarball
        cmd_str = " ".join(str(a) for a in args)
        assert "curl" in cmd_str or "tar" in cmd_str
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/installer/test_bootstrap_remote.py::TestAcquireRepo -v
```

Expected: FAIL — `ImportError: cannot import name 'acquire_repo'`

- [ ] **Step 3: Implement acquire_repo**

Append to `installer/bootstrap_remote.py`:

```python
def acquire_repo(target: Path | None = None) -> Path:
    """Ensure the Parthenon repo exists at target directory.

    Strategies (in order):
    1. If target already contains docker-compose.yml, use it as-is.
    2. If git is available, shallow clone the repo.
    3. Download and extract the release tarball.

    Returns the resolved repo path.
    """
    target = (target or DEFAULT_TARGET).expanduser().resolve()

    # Already exists?
    if target.exists() and (target / "docker-compose.yml").exists():
        print(f"Existing Parthenon repo found at {target}")
        return target

    if detect_git():
        print(f"Cloning Parthenon to {target} ...")
        rc = subprocess.run(
            ["git", "clone", "--depth", "1", GITHUB_CLONE_URL, str(target)],
            timeout=600,
        ).returncode
        if rc == 0 and (target / "docker-compose.yml").exists():
            print(f"Cloned successfully to {target}")
            return target
        print("git clone failed, falling back to tarball download...")

    # Tarball fallback
    print(f"Downloading Parthenon to {target} ...")
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        tarball = Path(tmpdir) / "parthenon.tar.gz"
        rc = subprocess.run(
            ["curl", "-fSL", TARBALL_URL, "-o", str(tarball)],
            timeout=600,
        ).returncode
        if rc != 0:
            print("Download failed. Check your internet connection and retry.")
            sys.exit(1)

        # Extract — GitHub tarballs contain a top-level directory like Parthenon-main/
        subprocess.run(
            ["tar", "xzf", str(tarball), "-C", tmpdir],
            check=True,
        )
        # Find the extracted directory
        extracted = [d for d in Path(tmpdir).iterdir() if d.is_dir() and d.name != "__MACOSX"]
        if not extracted:
            print("Tarball extraction failed — no directory found.")
            sys.exit(1)

        # Move to target
        target.parent.mkdir(parents=True, exist_ok=True)
        extracted[0].rename(target)

    if (target / "docker-compose.yml").exists():
        print(f"Extracted successfully to {target}")
        return target

    print(f"Repo at {target} is incomplete (no docker-compose.yml). Re-download or clone manually.")
    sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/installer/test_bootstrap_remote.py -v
```

Expected: all 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/bootstrap_remote.py tests/installer/test_bootstrap_remote.py
git commit -m "feat: repo acquisition via git clone or tarball fallback"
```

---

### Task 4: Main entry point and webapp handoff

**Files:**
- Modify: `installer/bootstrap_remote.py`
- Modify: `installer/webapp.py`
- Modify: `installer/web/app.js`

- [ ] **Step 1: Add `remote` flag to webapp bootstrap API**

In `installer/webapp.py`, modify the `InstallerBackend.__init__` and `bootstrap` methods:

```python
# installer/webapp.py — InstallerBackend class

class InstallerBackend:
    def __init__(self, *, remote: bool = False) -> None:
        self._lock = threading.Lock()
        self.install_state = InstallState()
        self._remote = remote

    # ... existing methods unchanged ...

    def bootstrap(self) -> dict[str, Any]:
        defaults = config.build_config_defaults()
        return {
            "defaults": defaults,
            "repo_path": launcher.default_repo_path(),
            "wsl_distro": launcher.default_wsl_distro(),
            "wsl_repo_path": launcher.default_wsl_repo_path(),
            "platform": {"windows": launcher.is_windows_host()},
            "ollama": self._detect_ollama(),
            "remote": self._remote,
        }
```

- [ ] **Step 2: Update webapp.main() to accept remote flag and repo_path override**

In `installer/webapp.py`, update the `main` function signature:

```python
def main(*, remote: bool = False, repo_path: str | None = None) -> None:
    port = _find_port()
    backend = InstallerBackend(remote=remote)

    # If a repo_path override was provided (from bootstrap_remote), set it
    if repo_path:
        utils.REPO_ROOT = Path(repo_path)

    class BoundHandler(InstallerHandler):
        pass

    BoundHandler.backend = backend
    server = ThreadingHTTPServer(("127.0.0.1", port), BoundHandler)
    url = f"http://127.0.0.1:{port}/"
    webbrowser.open(url)
    print(f"Parthenon installer running at {url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if backend.install_state.proc and backend.install_state.proc.poll() is None:
            backend.install_state.proc.terminate()
            backend.install_state.proc.wait(timeout=5)
```

- [ ] **Step 3: Update app.js beginner flow for remote mode**

In `installer/web/app.js`, update the `beginner_setup` step to show repo path as read-only confirmation when `state.bootstrap.remote` is true:

Find the beginner_setup section that renders the "Workspace" section and replace:

```javascript
  // Inside renderStep(), beginner_setup branch, the Workspace section:
  if (stepKey === "beginner_setup") {
    const repoReadOnly = state.bootstrap.remote;
    const windowsFields = state.bootstrap.platform.windows
      ? `
          <section class="section glass-soft">
            <div class="section-kicker">WSL Configuration</div>
            <h4>Windows Subsystem for Linux</h4>
            <p class="section-copy">Parthenon runs inside WSL. Specify the distro and path if the repo lives inside the WSL filesystem.</p>
            <div class="grid two">
              ${renderFields([
                { key: "wsl_distro", label: "WSL distro" },
                { key: "wsl_repo_path", label: "WSL repo path" },
              ])}
            </div>
          </section>
        `
      : "";
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">Administrator</div>
          <h4>Who is this installation for?</h4>
          <p class="section-copy">Create the first admin account. Leave the password blank to auto-generate one. Credentials are saved to <code>.install-credentials</code> after installation.</p>
          <div class="grid two">
            ${renderFields([
              { key: "admin_email", label: "Your email address" },
              { key: "admin_name", label: "Display name" },
              { key: "admin_password", label: "Admin password (optional)", secret: true },
            ])}
          </div>
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Workspace</div>
          <h4>Parthenon Repository</h4>
          <p class="section-copy">${
            repoReadOnly
              ? "Parthenon was downloaded automatically by the Acropolis installer."
              : state.bootstrap.platform.windows
                ? "Confirm the path to the Parthenon repository. On Windows, you may also specify a WSL path below."
                : "Confirm the local path to the Parthenon repository. The installer will write configuration files and start Docker services from this directory."
          }</p>
          <div class="grid">
            <label class="field">
              <span class="field-label">Repository path</span>
              <input class="field-input" data-field="repo_path" type="text" ${repoReadOnly ? "readonly" : ""} />
            </label>
          </div>
        </section>
        ${repoReadOnly ? "" : windowsFields}
      </div>
    `;
    bindValues();
    return;
  }
```

- [ ] **Step 4: Add main() and __main__ block to bootstrap_remote.py**

Append to `installer/bootstrap_remote.py`:

```python
def main(argv: list[str] | None = None) -> None:
    """Entry point for the remote installer binary.

    Phase 0: ensure Docker, acquire repo, then launch the webapp installer.
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Acropolis — Parthenon Remote Installer",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=DEFAULT_TARGET,
        help=f"Target directory for Parthenon (default: {DEFAULT_TARGET})",
    )
    args = parser.parse_args(argv)

    print("=" * 56)
    print("  Acropolis — Parthenon Remote Installer")
    print("=" * 56)
    print()

    # Step 1: Docker
    ensure_docker()
    print("Docker is ready.\n")

    # Step 2: Repo
    repo_path = acquire_repo(args.dir)
    print()

    # Step 3: Launch webapp
    os.chdir(repo_path)

    # Add repo to sys.path so installer package is importable
    if str(repo_path) not in sys.path:
        sys.path.insert(0, str(repo_path))

    # Bootstrap pip deps (rich, questionary) the same way install.py does
    _ensure_pip_deps()

    from installer.webapp import main as webapp_main
    webapp_main(remote=True, repo_path=str(repo_path))


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


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Test the entry point locally**

```bash
cd /home/smudoshi/Github/Parthenon
python3 -m installer.bootstrap_remote --dir /home/smudoshi/Github/Parthenon
```

Expected: Docker detected (already installed), repo detected (already exists), webapp launches on localhost, browser opens with the modal.

- [ ] **Step 6: Commit**

```bash
git add installer/bootstrap_remote.py installer/webapp.py installer/web/app.js
git commit -m "feat: remote bootstrap entry point with webapp handoff"
```

---

### Task 5: Cosmopolitan resource path in launcher.py

**Files:**
- Modify: `installer/launcher.py`

- [ ] **Step 1: Add Cosmopolitan resource path detection**

In `installer/launcher.py`, update the `resource_path` function:

```python
def resource_path(relative_path: str) -> Path:
    # PyInstaller
    base_path = getattr(sys, "_MEIPASS", "")
    if base_path:
        return Path(base_path) / relative_path
    # Cosmopolitan — assets extracted to a temp dir
    cosmo_root = os.environ.get("COSMO_RESOURCE_ROOT", "")
    if cosmo_root:
        return Path(cosmo_root) / relative_path
    # Normal execution
    return REPO_ROOT / relative_path
```

- [ ] **Step 2: Commit**

```bash
git add installer/launcher.py
git commit -m "feat: Cosmopolitan resource path support in launcher"
```

---

## Phase 2: PyInstaller packaging + GitHub Actions

### Task 6: PyInstaller spec file

**Files:**
- Create: `installer/acropolis-install.spec`

- [ ] **Step 1: Create the PyInstaller spec**

```python
# installer/acropolis-install.spec
# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Acropolis remote installer binary."""

import os

block_cipher = None

a = Analysis(
    ["bootstrap_remote.py"],
    pathex=[os.path.dirname(os.path.abspath("bootstrap_remote.py"))],
    binaries=[],
    datas=[
        ("web/*", "installer/web"),
    ],
    hiddenimports=[
        "installer",
        "installer.webapp",
        "installer.config",
        "installer.preflight",
        "installer.launcher",
        "installer.utils",
        "installer.cli",
        "installer.bootstrap",
        "installer.docker_ops",
        "installer.demo_data",
        "installer.eunomia",
        "http.server",
        "json",
        "threading",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="acropolis-install",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

- [ ] **Step 2: Test PyInstaller build locally**

```bash
cd /home/smudoshi/Github/Parthenon/installer
pip install pyinstaller --break-system-packages 2>/dev/null || pip install pyinstaller
pyinstaller acropolis-install.spec --noconfirm
ls -lh dist/acropolis-install
```

Expected: Binary created at `dist/acropolis-install`, ~25-40MB

- [ ] **Step 3: Test the built binary**

```bash
./dist/acropolis-install --dir /home/smudoshi/Github/Parthenon
```

Expected: Docker detected, repo detected, webapp launches

- [ ] **Step 4: Commit**

```bash
git add installer/acropolis-install.spec
git commit -m "feat: PyInstaller spec for Acropolis installer binary"
```

---

### Task 7: install.sh one-liner bootstrap script

**Files:**
- Create: `installer/install.sh`

- [ ] **Step 1: Write the bootstrap script**

```bash
#!/bin/sh
# Acropolis — Parthenon Remote Installer
# Usage: curl -fsSL https://install.acumenus.net | sh
set -e

REPO="sudoshi/Parthenon"
COSMO_BINARY="acropolis-install.com"

# Detect platform
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Linux*)  PLATFORM_BINARY="acropolis-install-linux" ;;
    Darwin*) PLATFORM_BINARY="acropolis-install-macos" ;;
    *)       echo "Unsupported platform: $OS. Use WSL on Windows."; exit 1 ;;
esac

# Get latest release tag
echo "Checking latest Parthenon release..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | \
    grep '"tag_name"' | head -1 | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
    echo "Could not determine latest release. Check your internet connection."
    exit 1
fi

echo "Latest release: $LATEST"

BASE_URL="https://github.com/$REPO/releases/download/$LATEST"
TMPDIR=$(mktemp -d)
BINARY="$COSMO_BINARY"
URL="$BASE_URL/$BINARY"

# Download — try Cosmopolitan first, fall back to platform-specific
echo "Downloading Acropolis installer..."
if ! curl -fSL "$URL" -o "$TMPDIR/$BINARY" 2>/dev/null; then
    echo "Cosmopolitan binary not available, using platform-specific build..."
    BINARY="$PLATFORM_BINARY"
    URL="$BASE_URL/$BINARY"
    curl -fSL "$URL" -o "$TMPDIR/$BINARY" || {
        echo "Download failed. Check your internet connection."
        rm -rf "$TMPDIR"
        exit 1
    }
fi

# Verify checksum
CHECKSUM_URL="$BASE_URL/checksums.sha256"
if curl -fsSL "$CHECKSUM_URL" -o "$TMPDIR/checksums.sha256" 2>/dev/null; then
    cd "$TMPDIR"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c checksums.sha256 --ignore-missing --quiet 2>/dev/null || {
            echo "Checksum verification failed. Aborting."
            rm -rf "$TMPDIR"
            exit 1
        }
        echo "Checksum verified."
    elif command -v shasum >/dev/null 2>&1; then
        # macOS
        shasum -a 256 -c checksums.sha256 --ignore-missing --quiet 2>/dev/null || {
            echo "Checksum verification failed. Aborting."
            rm -rf "$TMPDIR"
            exit 1
        }
        echo "Checksum verified."
    fi
    cd - >/dev/null
else
    echo "Warning: Could not download checksums. Proceeding without verification."
fi

# Make executable and run
chmod +x "$TMPDIR/$BINARY"
echo "Starting Acropolis installer..."
echo ""
exec "$TMPDIR/$BINARY" "$@"
```

- [ ] **Step 2: Verify script is valid**

```bash
shellcheck installer/install.sh 2>/dev/null || bash -n installer/install.sh
```

Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add installer/install.sh
git commit -m "feat: install.sh one-liner bootstrap for curl pipe"
```

---

### Task 8: GitHub Actions build workflow

**Files:**
- Create: `.github/workflows/build-installer.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/build-installer.yml
name: Build Installer Binaries

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: "Release tag to build for (e.g., v1.1.0)"
        required: true

permissions:
  contents: write

jobs:
  pyinstaller:
    name: PyInstaller (${{ matrix.os }})
    runs-on: ${{ matrix.runner }}
    strategy:
      matrix:
        include:
          - os: linux
            runner: ubuntu-22.04
            artifact: acropolis-install-linux
          - os: macos
            runner: macos-13
            artifact: acropolis-install-macos
          - os: windows
            runner: windows-2022
            artifact: acropolis-install-win.exe
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install PyInstaller
        run: pip install pyinstaller

      - name: Build binary
        working-directory: installer
        run: pyinstaller acropolis-install.spec --noconfirm

      - name: Rename artifact
        shell: bash
        run: |
          if [ "${{ matrix.os }}" = "windows" ]; then
            mv installer/dist/acropolis-install.exe installer/dist/${{ matrix.artifact }}
          else
            mv installer/dist/acropolis-install installer/dist/${{ matrix.artifact }}
          fi

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: installer/dist/${{ matrix.artifact }}

  cosmo:
    name: Cosmopolitan APE
    runs-on: ubuntu-22.04
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4

      - name: Install cosmocc
        run: |
          mkdir -p /opt/cosmo
          curl -fsSL https://cosmo.zip/pub/cosmocc/cosmocc.zip -o /tmp/cosmocc.zip
          unzip -q /tmp/cosmocc.zip -d /opt/cosmo
          echo "/opt/cosmo/bin" >> $GITHUB_PATH

      - name: Build Cosmopolitan Python APE
        run: |
          echo "Cosmopolitan APE build — implementation depends on cosmo Python packaging"
          echo "This step will be refined once cosmo Python bundling is validated"
          # Placeholder: cosmo Python packaging is experimental
          # If this step fails, the release proceeds with PyInstaller binaries only
          exit 0

      - name: Upload artifact
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: acropolis-install.com
          path: acropolis-install.com

  release:
    name: Upload to Release
    needs: [pyinstaller, cosmo]
    if: always() && needs.pyinstaller.result == 'success'
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Generate checksums
        run: |
          cd artifacts
          find . -type f -not -name "checksums.sha256" | sort | while read f; do
            sha256sum "$f" >> checksums.sha256
          done
          cat checksums.sha256

      - name: Copy install.sh
        uses: actions/checkout@v4
        with:
          sparse-checkout: installer/install.sh
          path: repo

      - name: Determine tag
        id: tag
        run: |
          if [ "${{ github.event_name }}" = "release" ]; then
            echo "tag=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
          else
            echo "tag=${{ github.event.inputs.tag }}" >> $GITHUB_OUTPUT
          fi

      - name: Upload release assets
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.tag.outputs.tag }}
          files: |
            artifacts/**/*
            repo/installer/install.sh
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build-installer.yml
git commit -m "ci: GitHub Actions workflow for installer binary builds"
```

---

## Phase 3: Cosmopolitan APE Binary

### Task 9: Validate Cosmopolitan Python compatibility

**Files:**
- Create: `installer/test_cosmo_compat.py`

- [ ] **Step 1: Create a compatibility test script**

```python
#!/usr/bin/env python3
"""Validate that all stdlib modules needed by the installer work.

Run this under cosmopolitan python to check compatibility before
shipping the APE binary. Exit 0 if all pass, 1 if any fail.
"""
import sys

REQUIRED_MODULES = [
    "http.server",
    "threading",
    "subprocess",
    "json",
    "socket",
    "tempfile",
    "pathlib",
    "shutil",
    "argparse",
    "dataclasses",
    "urllib.parse",
    "urllib.request",
    "contextlib",
    "platform",
    "os",
]

def main() -> int:
    failures = []
    for mod in REQUIRED_MODULES:
        try:
            __import__(mod)
            print(f"  OK  {mod}")
        except ImportError as e:
            print(f"  FAIL {mod}: {e}")
            failures.append(mod)

    # Functional test: can we bind a socket and serve HTTP?
    try:
        from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
        import threading

        class TestHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"ok")
            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), TestHandler)
        port = server.server_address[1]
        t = threading.Thread(target=server.handle_request, daemon=True)
        t.start()

        import urllib.request
        resp = urllib.request.urlopen(f"http://127.0.0.1:{port}/")
        assert resp.read() == b"ok"
        server.server_close()
        print("  OK  HTTP server functional test")
    except Exception as e:
        print(f"  FAIL HTTP server functional test: {e}")
        failures.append("http_functional")

    if failures:
        print(f"\n{len(failures)} module(s) failed. Cosmopolitan APE cannot be shipped.")
        return 1

    print("\nAll modules compatible. Cosmopolitan APE is viable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run locally to validate baseline**

```bash
python3 installer/test_cosmo_compat.py
```

Expected: All OK (this validates the test itself works under standard CPython)

- [ ] **Step 3: Commit**

```bash
git add installer/test_cosmo_compat.py
git commit -m "test: Cosmopolitan Python stdlib compatibility checker"
```

- [ ] **Step 4: Update GitHub Actions cosmo job to run compatibility test**

In `.github/workflows/build-installer.yml`, replace the placeholder cosmo build step:

```yaml
      - name: Build Cosmopolitan Python APE
        run: |
          # Download cosmopolitan python
          curl -fsSL https://cosmo.zip/pub/cosmos/bin/python3 -o /tmp/cosmo-python3
          chmod +x /tmp/cosmo-python3

          # Run compatibility test
          /tmp/cosmo-python3 installer/test_cosmo_compat.py

          # If compatible, build the APE with bundled installer
          # (Cosmo Python APE packaging is still being refined —
          #  this step will be updated once the packaging method is confirmed)
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/build-installer.yml
git commit -m "ci: add Cosmopolitan compatibility validation to build workflow"
```

---

## Phase 4: Landing Page + Production Deployment

### Task 10: Install landing page

**Files:**
- Create: `installer/web/install-landing.html`
- Create: `installer/web/install-landing.css`
- Create: `installer/web/install-landing.js`

- [ ] **Step 1: Create the landing page HTML**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Install Parthenon — Acropolis</title>
    <meta name="description" content="One-command installation for Parthenon, the unified OHDSI outcomes research platform." />
    <link rel="stylesheet" href="install-landing.css" />
  </head>
  <body>
    <div class="landing">
      <div class="landing-bg"></div>
      <div class="landing-card">
        <div class="accent-line"></div>
        <h1>Install Parthenon</h1>
        <p class="subtitle">Unified Outcomes Research Platform on OMOP CDM</p>
        <p class="copy">
          Download the Acropolis installer and have Parthenon running in minutes.
          Docker will be installed automatically on Linux. macOS and Windows
          users need Docker Desktop.
        </p>

        <div class="download-section">
          <a class="btn-download" id="download-primary" href="#">
            <span class="btn-label" id="download-label">Download Installer</span>
            <span class="btn-hint" id="download-hint">Detecting platform...</span>
          </a>
        </div>

        <div class="oneliner-section">
          <p class="oneliner-label">or run in your terminal:</p>
          <div class="oneliner-box">
            <code id="oneliner">curl -fsSL https://install.acumenus.net | sh</code>
            <button class="copy-btn" id="copy-oneliner" aria-label="Copy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="fallback-section">
          <p class="fallback-label">Having trouble? Download for your platform:</p>
          <div class="fallback-links">
            <a id="link-linux" href="#">Linux</a>
            <span class="sep">&middot;</span>
            <a id="link-macos" href="#">macOS</a>
            <span class="sep">&middot;</span>
            <a id="link-windows" href="#">Windows (WSL)</a>
          </div>
        </div>

        <div class="requirements">
          <h3>Requirements</h3>
          <ul>
            <li>8 GB RAM, 20 GB free disk space</li>
            <li>Docker (auto-installed on Linux if missing)</li>
            <li>macOS / Windows: <a href="https://docs.docker.com/get-docker/">Docker Desktop</a></li>
          </ul>
        </div>

        <div class="footer-links">
          <a href="https://github.com/sudoshi/Parthenon">GitHub</a>
          <span class="sep">&middot;</span>
          <a href="https://discord.gg/GkkT7dzmwf">Discord</a>
          <span class="sep">&middot;</span>
          <a href="https://www.acumenus.io">Acumenus Data Sciences</a>
        </div>
      </div>
    </div>
    <script src="install-landing.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the landing page JavaScript**

```javascript
// installer/web/install-landing.js
(function () {
  const REPO = "sudoshi/Parthenon";
  const COSMO = "acropolis-install.com";
  const LINUX = "acropolis-install-linux";
  const MACOS = "acropolis-install-macos";
  const WIN = "acropolis-install-win.exe";

  function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "macos";
    if (ua.includes("win")) return "windows";
    return "linux";
  }

  async function getLatestRelease() {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`
      );
      const data = await res.json();
      return data.tag_name;
    } catch {
      return null;
    }
  }

  function releaseUrl(tag, file) {
    return `https://github.com/${REPO}/releases/download/${tag}/${file}`;
  }

  async function init() {
    const platform = detectPlatform();
    const tag = await getLatestRelease();

    const labels = { linux: "Linux", macos: "macOS", windows: "Windows (WSL)" };
    const hint = document.getElementById("download-hint");
    const label = document.getElementById("download-label");
    const btn = document.getElementById("download-primary");

    if (tag) {
      label.textContent = `Download for ${labels[platform]}`;
      hint.textContent = `${tag} — Cosmopolitan universal binary`;
      btn.href = releaseUrl(tag, COSMO);

      document.getElementById("link-linux").href = releaseUrl(tag, LINUX);
      document.getElementById("link-macos").href = releaseUrl(tag, MACOS);
      document.getElementById("link-windows").href = releaseUrl(tag, WIN);
    } else {
      hint.textContent = "Could not fetch release — use the curl command below";
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }

    document.getElementById("copy-oneliner").addEventListener("click", () => {
      const text = document.getElementById("oneliner").textContent;
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById("copy-oneliner");
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 2000);
      });
    });
  }

  init();
})();
```

- [ ] **Step 3: Create the landing page CSS**

Use the same Acropolis design tokens (glassmorphic card, crimson accents, dark base) from `installer/web/styles.css`. The landing page is a single centered card over the hero background image. Keep it under 200 lines — it shares the same `@import` fonts and color variables as the installer.

```css
/* installer/web/install-landing.css */
@import url("https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");

:root {
  --font-display: "Crimson Pro", Georgia, serif;
  --font-heading: "Source Serif 4", Georgia, serif;
  --font-body: "Source Sans 3", "Helvetica Neue", sans-serif;
  --font-mono: "IBM Plex Mono", Consolas, monospace;
  --surface-darkest: #08080a;
  --text-primary: #f0ede8;
  --text-secondary: #c5c0b8;
  --text-muted: #8a857d;
  --text-ghost: #5a5650;
  --primary: #9b1b30;
  --primary-dark: #6a1220;
  --accent: #c9a227;
  --accent-muted: #a68b1f;
  --gradient-crimson: linear-gradient(135deg, var(--primary), var(--primary-dark));
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--surface-darkest);
  color: var(--text-primary);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.landing { position: relative; width: 100%; min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
.landing-bg { position: fixed; inset: 0; background: url("/assets/parthenon-login-bg.png") center 40% / cover; filter: brightness(0.4) saturate(0.8); }

.landing-card {
  position: relative; z-index: 1; max-width: 560px; width: 100%; text-align: center;
  background: linear-gradient(135deg, rgba(10,8,6,0.72), rgba(6,5,4,0.58));
  backdrop-filter: blur(28px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.10);
  border-top: 1px solid rgba(255,255,255,0.20);
  border-radius: 20px; padding: 48px 44px;
  box-shadow: 0 24px 72px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08);
}

.accent-line { width: 56px; height: 3px; border-radius: 999px; background: var(--gradient-crimson); margin: 0 auto 20px; }
h1 { font-family: var(--font-display); font-size: clamp(2.2rem, 4vw, 3rem); font-weight: 400; letter-spacing: -0.025em; margin: 0; }
.subtitle { font-family: var(--font-heading); font-size: 1.1rem; color: var(--text-secondary); margin: 8px 0 0; }
.copy { color: var(--text-muted); line-height: 1.65; margin: 16px 0 0; font-size: 0.9rem; }

.download-section { margin-top: 28px; }
.btn-download { display: block; padding: 14px 24px; background: var(--gradient-crimson); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: box-shadow 200ms, transform 100ms; }
.btn-download:hover { box-shadow: 0 6px 28px rgba(155,27,48,0.4); transform: translateY(-1px); }
.btn-hint { display: block; margin-top: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.5); font-family: var(--font-mono); }

.oneliner-section { margin-top: 24px; }
.oneliner-label { color: var(--text-muted); font-size: 0.8rem; margin: 0 0 8px; }
.oneliner-box { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; }
.oneliner-box code { flex: 1; font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent); word-break: break-all; }
.copy-btn { background: none; border: none; color: var(--text-ghost); cursor: pointer; padding: 4px; transition: color 200ms; }
.copy-btn:hover { color: var(--text-secondary); }

.fallback-section { margin-top: 20px; }
.fallback-label { color: var(--text-ghost); font-size: 0.75rem; margin: 0 0 6px; }
.fallback-links { font-size: 0.85rem; }
.fallback-links a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-muted); }
.fallback-links a:hover { color: var(--text-primary); }
.sep { color: var(--text-ghost); margin: 0 6px; }

.requirements { margin-top: 28px; text-align: left; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
.requirements h3 { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin: 0 0 8px; }
.requirements ul { margin: 0; padding: 0 0 0 18px; color: var(--text-muted); font-size: 0.85rem; line-height: 1.7; }
.requirements a { color: var(--accent); text-decoration: none; }

.footer-links { margin-top: 28px; font-size: 0.8rem; }
.footer-links a { color: var(--text-ghost); text-decoration: none; transition: color 200ms; }
.footer-links a:hover { color: var(--text-muted); }
```

- [ ] **Step 4: Commit**

```bash
git add installer/web/install-landing.html installer/web/install-landing.css installer/web/install-landing.js
git commit -m "feat: Acropolis install landing page with platform detection"
```

---

### Task 11: tests/__init__.py and test infrastructure

**Files:**
- Create: `tests/installer/__init__.py` (if missing)

- [ ] **Step 1: Ensure test directory exists**

```bash
mkdir -p tests/installer
touch tests/installer/__init__.py
```

- [ ] **Step 2: Run full test suite**

```bash
python3 -m pytest tests/installer/ -v
```

Expected: All tests from Tasks 1-3 pass

- [ ] **Step 3: Commit**

```bash
git add tests/installer/__init__.py
git commit -m "chore: test infrastructure for installer tests"
```

---

### Task 12: Final integration test

**Files:**
- No new files — manual validation

- [ ] **Step 1: Test the full remote bootstrap flow locally**

```bash
cd /tmp
python3 /home/smudoshi/Github/Parthenon/installer/bootstrap_remote.py --dir /home/smudoshi/Github/Parthenon
```

Expected:
1. "Docker is ready." (already installed)
2. "Existing Parthenon repo found at /home/smudoshi/Github/Parthenon"
3. Webapp launches on localhost
4. Browser opens with the modal
5. Both Beginner and Experienced flows work
6. Dry run completes successfully

- [ ] **Step 2: Verify install.sh syntax and download logic**

```bash
bash -n /home/smudoshi/Github/Parthenon/installer/install.sh && echo "Syntax OK"
```

Expected: "Syntax OK"

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "test: integration validation for remote installer"
```
