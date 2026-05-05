"""Smoke test that Phase 2 Plan 1 deps are pinned in pyproject.toml.

The project uses ``==`` pinning everywhere (Phase 0 convention). The plan's
narrative requirement is ``openai>=1.0.0`` / ``jsonschema>=4.0`` /
``cryptography>=42.0``; we verify both that the pin exists AND that it
satisfies the lower bound.
"""

from __future__ import annotations

import re
from pathlib import Path

_LOWER_BOUNDS: dict[str, tuple[int, int]] = {
    "openai": (1, 0),
    "jsonschema": (4, 0),
    "cryptography": (42, 0),
}


def _pin_version(pyproject: str, name: str) -> tuple[int, int] | None:
    m = re.search(rf'"{re.escape(name)}==(\d+)\.(\d+)', pyproject)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def test_pyproject_pins_phase_2_plan_1_deps() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for name, (min_major, min_minor) in _LOWER_BOUNDS.items():
        pin = _pin_version(pyproject, name)
        assert pin is not None, f"missing pinned dep: {name}=="
        major, minor = pin
        assert (major, minor) >= (
            min_major,
            min_minor,
        ), f"{name}=={major}.{minor} < required {min_major}.{min_minor}"
