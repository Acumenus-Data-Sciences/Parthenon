#!/usr/bin/env python3
"""Build the Acropolis installer as a Cosmopolitan APE binary.

Downloads the cosmo Python binary, appends the installer package and
static assets into its embedded zip, and writes a .args file to invoke
bootstrap_remote.main() on startup.

Usage:
    python3 installer/build_cosmo.py [--output dist/acropolis-install.com]
"""
from __future__ import annotations

import argparse
import compileall
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

COSMO_PYTHON_URL = "https://cosmo.zip/pub/cosmos/bin/python"
CACHE_DIR = Path.home() / ".cache" / "cosmofy"

# Files to include from the installer package
INSTALLER_PY_FILES = [
    "__init__.py",
    "bootstrap_remote.py",
    "webapp.py",
    "config.py",
    "preflight.py",
    "launcher.py",
    "utils.py",
    "cli.py",
    "bootstrap.py",
    "docker_ops.py",
    "demo_data.py",
    "eunomia.py",
    "etl_mbu_patient.py",
    "install.sh",
]

# Static web assets
WEB_FILES = [
    "web/app.js",
    "web/index.html",
    "web/styles.css",
    "web/install-landing.html",
    "web/install-landing.css",
    "web/install-landing.js",
]


def download_cosmo_python(cache_dir: Path) -> Path:
    """Download cosmopolitan python binary, caching it."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / "python"
    if cached.exists():
        print(f"  Using cached cosmo python: {cached}")
        return cached
    print(f"  Downloading cosmo python from {COSMO_PYTHON_URL} ...")
    subprocess.run(
        ["curl", "-fSL", COSMO_PYTHON_URL, "-o", str(cached)],
        check=True,
    )
    cached.chmod(cached.stat().st_mode | stat.S_IEXEC)
    print(f"  Downloaded: {cached} ({cached.stat().st_size / 1048576:.1f} MB)")
    return cached


def build(output: Path, installer_dir: Path) -> None:
    """Build the APE binary."""
    print("Building Acropolis installer APE binary\n")

    # Step 1: Get cosmo python
    cosmo_bin = download_cosmo_python(CACHE_DIR)

    # Step 2: Copy as output
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cosmo_bin, output)
    print(f"  Copied cosmo python to {output}")

    # Step 3: Compile .py to .pyc and append to zip
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        pkg_dir = tmp / "installer"
        pkg_dir.mkdir()
        web_dir = pkg_dir / "web"
        web_dir.mkdir()

        # Copy Python files
        for py_file in INSTALLER_PY_FILES:
            src = installer_dir / py_file
            if src.exists():
                shutil.copy2(src, pkg_dir / py_file)

        # Copy web assets
        for web_file in WEB_FILES:
            src = installer_dir / web_file
            if src.exists():
                shutil.copy2(src, pkg_dir / web_file)

        # Compile .py to .pyc
        compileall.compile_dir(str(pkg_dir), quiet=1, force=True)

        # Append to the APE zip
        with zipfile.ZipFile(str(output), "a") as zf:
            # Add .pyc files preserving package structure
            for pyc in pkg_dir.rglob("*.pyc"):
                # __pycache__/foo.cpython-312.pyc → installer/foo.pyc
                stem = pyc.stem.split(".")[0]  # e.g., "webapp"
                parent = pyc.parent.parent  # up from __pycache__
                rel_parent = parent.relative_to(tmp)  # installer or installer/web
                arcname = f"Lib/site-packages/{rel_parent}/{stem}.pyc"
                zf.write(pyc, arcname)
                print(f"  + {arcname}")

            # Add .py source files too (some modules import via source)
            for py in pkg_dir.rglob("*.py"):
                rel = py.relative_to(tmp)
                arcname = f"Lib/site-packages/{rel}"
                zf.write(py, arcname)
                print(f"  + {arcname}")

            # Add web static assets (non-.py files)
            for asset in pkg_dir.rglob("*"):
                if asset.is_file() and asset.suffix not in (".py", ".pyc"):
                    rel = asset.relative_to(tmp)
                    arcname = f"Lib/site-packages/{rel}"
                    zf.write(asset, arcname)
                    print(f"  + {arcname}")

            # Add .args file for startup
            args_content = "-c\nfrom installer.bootstrap_remote import main; main()\n"
            zf.writestr(".args", args_content)
            print("  + .args")

    # Make executable
    output.chmod(output.stat().st_mode | stat.S_IEXEC)
    size_mb = output.stat().st_size / 1048576
    print(f"\nBuilt: {output} ({size_mb:.1f} MB)")
    print("This binary runs on Linux, macOS (Intel + Apple Silicon), and Windows.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Acropolis installer APE")
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=Path("dist/acropolis-install.com"),
        help="Output path (default: dist/acropolis-install.com)",
    )
    args = parser.parse_args()

    installer_dir = Path(__file__).resolve().parent
    build(args.output, installer_dir)


if __name__ == "__main__":
    main()
