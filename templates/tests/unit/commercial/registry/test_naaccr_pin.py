"""Phase 3 Plan 4A Task 1 (T-022A): OHDSI NAACCR pin file shape."""

from __future__ import annotations

from pathlib import Path

_PIN_FILE = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "runtime"
    / "commercial"
    / "registry"
    / "naaccr"
    / "ohdsi_pin.txt"
)


def test_pin_file_exists() -> None:
    assert _PIN_FILE.is_file(), f"OHDSI pin file not found at {_PIN_FILE}"


def test_pin_file_carries_required_keys() -> None:
    text = _PIN_FILE.read_text(encoding="utf-8")
    # Stable contract for the upstream-diff CI workflow (Task 9).
    assert "repository=" in text
    assert "commit=" in text
    assert "license=" in text


def test_pin_file_references_correct_upstream() -> None:
    text = _PIN_FILE.read_text(encoding="utf-8")
    assert "OHDSI/CdmEtlNaaccr" in text


def test_pin_file_records_apache_license() -> None:
    """OHDSI CdmEtlNaaccr is Apache-2.0; the port preserves that.

    Apache 2.0 composes with both the AGPLv3 community wheel and the
    proprietary commercial wheel — we ship the ported SQL inside the
    commercial wheel to preserve attribution.
    """
    text = _PIN_FILE.read_text(encoding="utf-8")
    assert "license=Apache-2.0" in text
