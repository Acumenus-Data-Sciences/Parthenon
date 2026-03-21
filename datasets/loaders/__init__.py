"""Loader infrastructure for Parthenon Dataset Acquisition TUI.

Public API:
    DatasetLoader   — Protocol defining the loader interface
    _exec_php(cmd)  — Run artisan via docker compose exec -T php
    _query_count(sql) — Run COUNT query via docker compose exec postgres psql
    REPO_ROOT       — Absolute path to the repository root
"""
from __future__ import annotations

import shlex
import subprocess
from pathlib import Path
from typing import Protocol, runtime_checkable

from rich.console import Console

REPO_ROOT = Path(__file__).parent.parent.parent


@runtime_checkable
class DatasetLoader(Protocol):
    """Protocol that every dataset loader module must satisfy."""

    def is_loaded(self) -> bool:
        """Return True if the dataset is already present in the database."""
        ...

    def load(self, *, console: Console, downloads_dir: Path) -> bool:
        """Load the dataset.  Return True on success, False on failure."""
        ...


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _exec_php(
    cmd: str,
    *,
    check: bool = True,
    stream: bool = False,
) -> "subprocess.CompletedProcess[str] | int":
    """Run *cmd* inside the PHP container via ``docker compose exec -T php``.

    When *stream* is True, stdout is forwarded to the terminal in real time
    and the integer return code is returned.

    When *stream* is False, a :class:`subprocess.CompletedProcess` is returned.
    """
    # Build the full invocation
    prefix = shlex.split("docker compose exec -T php")
    args = prefix + shlex.split(cmd)

    if stream:
        proc = subprocess.Popen(
            args,
            cwd=str(REPO_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if proc.stdout:
            for line in proc.stdout:
                print(line, end="", flush=True)
        proc.wait()
        return proc.returncode
    else:
        return subprocess.run(
            args,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=check,
        )


def _query_count(sql: str) -> int:
    """Execute *sql* (expected to return a single integer) via psql inside
    the postgres container and return the result as an int.

    Returns 0 on any error (container not running, table absent, etc.).
    """
    args = shlex.split(
        "docker compose exec -T postgres psql -U parthenon -d parthenon -tAc"
    ) + [sql]

    try:
        result = subprocess.run(
            args,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        return int(result.stdout.strip())
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError):
        return 0
