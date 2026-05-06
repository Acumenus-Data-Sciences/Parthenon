"""Plan 6 Task 3: SdtmDomain enum + exception hierarchy."""

from __future__ import annotations

from runtime.sdtm.exceptions import SdtmDomainError, XptReadError
from runtime.sdtm.types import SdtmDomain


def test_v1_domains_are_dm_ae_cm_vs_lb() -> None:
    """Q9 — only 5 domains in v1."""
    assert {d.value for d in SdtmDomain} == {"DM", "AE", "CM", "VS", "LB"}


def test_xpt_read_error_subclasses_sdtm_domain_error() -> None:
    assert issubclass(XptReadError, SdtmDomainError)


def test_sdtm_domain_string_value() -> None:
    assert SdtmDomain("DM").value == "DM"
    assert str(SdtmDomain.AE) in ("SdtmDomain.AE", "AE")
