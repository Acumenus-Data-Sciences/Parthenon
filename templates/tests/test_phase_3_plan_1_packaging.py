"""Phase 3 Plan 1: commercial-tier wheel split + import-linter contract.

Tests assert the two-wheel monorepo split:
- ``parthenon-templates`` (AGPLv3 community) at ``templates/pyproject.toml``
  ships ``runtime`` excluding ``runtime.commercial``.
- ``parthenon-templates-commercial`` (proprietary) at
  ``templates/commercial/pyproject.toml`` ships ``runtime.commercial``.

The community wheel must be installable into a clean venv with NO
``templates/commercial/`` source on ``PYTHONPATH`` and still import its
non-commercial public surface.

The ``import-linter`` contract enforces at the static level: nothing under
``runtime.*`` (excluding ``runtime.commercial``) may import
``runtime.commercial.*``.
"""

from __future__ import annotations

import shutil
import subprocess
import venv
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
COMMERCIAL_ROOT = REPO_ROOT / "commercial"


def test_commercial_pyproject_exists() -> None:
    pyproject = COMMERCIAL_ROOT / "pyproject.toml"
    assert pyproject.is_file(), f"missing {pyproject}"
    text = pyproject.read_text(encoding="utf-8")
    assert 'name = "parthenon-templates-commercial"' in text
    # License: proprietary — explicitly NOT AGPLv3 / Apache-2.0.
    assert "Proprietary" in text or "proprietary" in text


def test_community_pyproject_excludes_commercial_subpackage() -> None:
    """The community wheel must not ship ``runtime/commercial`` source."""
    pyproject = (REPO_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    # hatchling wheel target lists explicit packages — must omit the
    # commercial subpackage even if it ever lands under runtime/.
    assert 'packages = ["runtime"]' in pyproject
    # Must explicitly exclude the commercial subpackage from the wheel build.
    assert "exclude" in pyproject
    assert "runtime/commercial" in pyproject


def test_importlinter_config_exists_and_forbids_commercial_imports() -> None:
    cfg = REPO_ROOT / ".importlinter"
    assert cfg.is_file(), f"missing {cfg}"
    text = cfg.read_text(encoding="utf-8")
    # Forbidden contract: runtime.* (excluding runtime.commercial) MUST NOT
    # import runtime.commercial.*.
    assert "[importlinter]" in text
    assert "forbidden" in text
    assert "runtime.commercial" in text


def test_importlinter_contract_holds() -> None:
    """``uv run lint-imports`` must exit 0."""
    result = subprocess.run(
        ["uv", "run", "lint-imports", "--config", ".importlinter"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert (
        result.returncode == 0
    ), f"import-linter contract violated:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"


@pytest.mark.smoke
def test_smoke_marker_canary_imports_without_commercial() -> None:
    """Smoke marker exercises the registry/manifest loader without touching commercial code.

    This is the canary set the ``community-wheel-isolation`` CI job uses.
    """
    from runtime.orchestration.node_registry import NODE_REGISTRY  # noqa: F401
    from runtime.registry.manifest import NODE_TYPES

    assert "sql" in NODE_TYPES
    assert "csv_reader" in NODE_TYPES
    # X12_837_Reader is commercial — must NOT be in the community NODE_TYPES.
    assert "x12_837_reader" not in NODE_TYPES


@pytest.mark.slow
def test_community_wheel_builds_and_installs_without_commercial(tmp_path: Path) -> None:
    """Build the community wheel only, install into a clean venv, smoke-import.

    Marked ``slow`` to keep the fast unit-test path quick. The CI job
    ``community-wheel-isolation`` runs this end-to-end with a real ``uv build``.
    """
    if shutil.which("uv") is None:
        pytest.skip("uv not on PATH")

    dist = tmp_path / "dist"
    dist.mkdir()
    build = subprocess.run(
        ["uv", "build", "--wheel", "--out-dir", str(dist)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, f"uv build failed: {build.stderr}"

    wheels = list(dist.glob("parthenon_templates-*.whl"))
    assert len(wheels) == 1, f"expected exactly 1 community wheel, got {wheels}"
    wheel = wheels[0]

    # Build a clean venv with NO commercial path mounted.
    venv_dir = tmp_path / "venv"
    venv.EnvBuilder(with_pip=True).create(venv_dir)
    py = venv_dir / "bin" / "python"
    pip_install = subprocess.run(
        [str(py), "-m", "pip", "install", "--quiet", str(wheel)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert pip_install.returncode == 0, pip_install.stderr

    # Smoke: import a community-only module — must not require runtime.commercial.
    smoke = subprocess.run(
        [
            str(py),
            "-c",
            "from runtime.registry.manifest import NODE_TYPES; "
            "assert 'sql' in NODE_TYPES; "
            "import importlib; "
            "import sys; "
            "spec = importlib.util.find_spec('runtime.commercial'); "
            "assert spec is None, f'runtime.commercial leaked into community wheel: {spec}'",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert smoke.returncode == 0, f"community-wheel isolation smoke failed:\n{smoke.stderr}"
