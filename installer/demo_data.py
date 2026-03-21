# installer/demo_data.py — Compatibility shim
#
# All dataset acquisition functionality has moved to the datasets/ package.
# This shim preserves backward compatibility for code that imports from
# installer.demo_data. Remove in a future cleanup pass.
"""Compatibility shim — delegates to datasets/ package."""
from __future__ import annotations

from datasets.tui import main as run_standalone  # noqa: F401
from datasets.loader import run_selected as run  # noqa: F401

__all__ = ["run", "run_standalone"]
