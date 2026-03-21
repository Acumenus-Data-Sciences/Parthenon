"""Loader stub for CMS SynPUF datasets (Phase 2)."""
from __future__ import annotations

from pathlib import Path

from rich.console import Console


def is_loaded(**kwargs: object) -> bool:
    """SynPUF is not yet available — always returns False."""
    return False


def load(*, console: Console, downloads_dir: Path, **kwargs: object) -> bool:
    """SynPUF loading is coming in a future release."""
    console.print(
        "[yellow]CMS SynPUF datasets are coming in a future release.[/yellow]"
    )
    return False
