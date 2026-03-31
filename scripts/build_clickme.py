#!/usr/bin/env python3
"""Build a desktop installer artifact with PyInstaller."""
from __future__ import annotations

import argparse
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC_PATH = REPO_ROOT / "packaging" / "ParthenonInstaller.spec"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Parthenon desktop installer")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete existing build/ and dist/ directories before packaging",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if importlib.util.find_spec("PyInstaller") is None:
        raise SystemExit(
            "PyInstaller is not installed in this Python environment. "
            "Run `python3 -m pip install pyinstaller` first."
        )

    if args.clean:
        shutil.rmtree(REPO_ROOT / "build", ignore_errors=True)
        shutil.rmtree(REPO_ROOT / "dist", ignore_errors=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        str(SPEC_PATH),
    ]
    subprocess.check_call(cmd, cwd=REPO_ROOT)


if __name__ == "__main__":
    main()
