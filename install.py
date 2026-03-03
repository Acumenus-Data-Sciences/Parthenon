#!/usr/bin/env python3
"""
Parthenon Installer
===================
One-command setup for Parthenon:

  macOS / Linux:  python3 install.py
  Windows:        python install.py

Requires: Python 3.9+, Docker ≥ 24.0 with Compose v2

This script bootstraps missing Python dependencies (rich, questionary)
before handing off to the installer package.
"""
from __future__ import annotations

import subprocess
import sys

REQUIRED = {
    "rich": "rich>=13.0",
    "questionary": "questionary>=2.0",
}


def _ensure_deps() -> None:
    """Install missing dependencies silently before importing them."""
    missing = []
    for module, pkg in REQUIRED.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"Installing missing dependencies: {', '.join(missing)}")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet", *missing],
            stdout=subprocess.DEVNULL,
        )
        print("Dependencies installed.\n")


def main() -> None:
    _ensure_deps()

    # Deferred import — deps now guaranteed to exist
    from installer.cli import run

    try:
        run()
    except KeyboardInterrupt:
        print("\n\nInstall cancelled by user.")
        sys.exit(130)


if __name__ == "__main__":
    main()
