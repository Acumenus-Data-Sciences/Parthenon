#!/usr/bin/env python3
"""
Parthenon Installer
===================
One-command setup for Parthenon:

  macOS / Linux:  python3 install.py
  Windows:        python install.py

With production infrastructure (Traefik, Portainer, pgAdmin, + Enterprise):

  python3 install.py --with-infrastructure

Requires: Python 3.9+, Docker >= 24.0 with Compose v2

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
    parser.add_argument(
        "--with-infrastructure",
        action="store_true",
        default=False,
        help="Also install Acropolis infrastructure (Traefik, Portainer, pgAdmin, + Enterprise)",
    )
    parser.add_argument(
        "--community",
        action="store_true",
        default=False,
        help="Community Edition fast-boot: minimal service set, skip enterprise sidecars and demo data, go straight to login page",
    )
    parser.add_argument(
        "--upgrade",
        action="store_true",
        default=False,
        help="Upgrade an existing installation to the latest version",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        default=False,
        help="Run without questionary prompts, using defaults and --defaults-file values",
    )
    parser.add_argument(
        "--webapp",
        action="store_true",
        default=False,
        help="Launch the web-based installer UI (used by the remote installer binary)",
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

    if args.community and args.with_infrastructure:
        print("Error: --community and --with-infrastructure are mutually exclusive.", file=sys.stderr)
        sys.exit(2)

    if args.community:
        community_defaults = {
            "experience": "Beginner",
            "edition": "Community Edition",
            "enterprise_key": "",
            "umls_api_key": "",
            "vocab_zip_path": None,
            "cdm_dialect": "PostgreSQL",
            "app_url": "http://localhost",
            "env": "local",
            "timezone": "UTC",
            "include_eunomia": False,
            "ollama_url": "",
            "modules": ["research"],
            "enable_solr": False,
            "enable_study_agent": False,
            "enable_blackrabbit": False,
            "enable_fhir_to_cdm": False,
            "enable_hecate": False,
            "enable_qdrant": False,
            "enable_orthanc": False,
            "enable_livekit": False,
            "datasets": [],
        }
        if defaults:
            community_defaults.update(defaults)
        defaults = community_defaults
        args.non_interactive = True

    try:
        if args.webapp:
            from installer.webapp import main as webapp_main
            webapp_main(remote=True)
            return
        if args.with_infrastructure:
            # Run the Acropolis infrastructure installer, which will call
            # the Parthenon installer internally if Parthenon isn't running yet.
            from acropolis.installer.cli import run as run_infrastructure
            run_infrastructure(upgrade=args.upgrade)
        else:
            run(pre_seed=defaults, upgrade=args.upgrade, non_interactive=args.non_interactive)
    except KeyboardInterrupt:
        print("\n\nInstall cancelled by user.")
        sys.exit(130)


if __name__ == "__main__":
    main()
