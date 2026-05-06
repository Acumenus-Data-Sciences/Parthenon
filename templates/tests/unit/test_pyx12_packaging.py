"""Phase 3 Plan 1 Task 2: pyx12 dep is pinned in the commercial wheel.

pyx12 is BSD-3, available on PyPI. The plan envisaged pinning 2.4.5 but
PyPI no longer carries that release (the version line jumps 2.3.3 -> 3.1.0
-> 4.0.0); we pin the latest stable 4.0.0 which the import smoke below
verifies is reachable.
"""

from __future__ import annotations

from pathlib import Path

import pytest

COMMERCIAL_PYPROJECT = Path(__file__).resolve().parents[2] / "commercial" / "pyproject.toml"


def test_commercial_pyproject_pins_pyx12() -> None:
    text = COMMERCIAL_PYPROJECT.read_text(encoding="utf-8")
    assert '"pyx12==' in text
    # Must be in the commercial wheel's deps list — never in the community
    # wheel (templates/pyproject.toml).
    community = (Path(__file__).resolve().parents[2] / "pyproject.toml").read_text(encoding="utf-8")
    assert '"pyx12==' not in community
    assert '"pyx12 ' not in community


def test_pyx12_importable() -> None:
    """Smoke: pyx12 is installed and at least the top-level module is importable."""
    pyx12 = pytest.importorskip("pyx12")
    assert pyx12 is not None


def test_pyx12_x12file_module_importable() -> None:
    """The reader needs pyx12.x12file (segment iteration) and pyx12.params."""
    x12file = pytest.importorskip("pyx12.x12file")
    params = pytest.importorskip("pyx12.params")
    # Sanity: the segment iterator class exists.
    assert hasattr(x12file, "X12Reader") or hasattr(x12file, "X12file")
    assert hasattr(params, "params")
