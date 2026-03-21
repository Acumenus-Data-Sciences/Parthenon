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

import argparse
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
        # Try normal install first; fall back to --break-system-packages for
        # Debian/Ubuntu systems that block system-wide pip installs (PEP 668).
        cmd = [sys.executable, "-m", "pip", "install", "--quiet", *missing]
        result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if result.returncode != 0:
            if b"externally-managed" in result.stderr:
                subprocess.check_call(
                    cmd + ["--break-system-packages"],
                    stdout=subprocess.DEVNULL,
                )
            else:
                sys.stderr.buffer.write(result.stderr)
                raise SystemExit(1)
        print("Dependencies installed.\n")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parthenon Installer")
    parser.add_argument(
        "--defaults-file",
        type=str,
        default=None,
        help="Path to JSON file with default config values (pre-seeds interactive prompts)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    _ensure_deps()

    # Deferred import — deps now guaranteed to exist
    import json
    from installer.cli import run

    defaults = None
    if args.defaults_file:
        from pathlib import Path
        defaults_path = Path(args.defaults_file)
        if defaults_path.exists():
            defaults = json.loads(defaults_path.read_text())
            print(f"Loaded defaults from {args.defaults_file}\n")
        else:
            print(f"Warning: defaults file {args.defaults_file} not found, ignoring.\n")

    try:
        run(pre_seed=defaults)
    except KeyboardInterrupt:
        print("\n\nInstall cancelled by user.")
        sys.exit(130)


if __name__ == "__main__":
    main()
