"""SDTM subsystem exceptions."""

from __future__ import annotations


class SdtmDomainError(RuntimeError):
    """Base for all SDTM-related failures."""


class XptReadError(SdtmDomainError):
    """Raised when a SAS XPT file cannot be parsed by pyreadstat."""
