"""ARTEMIS subsystem exceptions."""

from __future__ import annotations


class ArtemisLibraryError(RuntimeError):
    """Raised when the regimen pattern library cannot be loaded or is malformed."""
