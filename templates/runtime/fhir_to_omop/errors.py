"""Exceptions raised by the fhir_to_omop mapping layer."""

from __future__ import annotations


class FhirToOmopError(ValueError):
    """Base class for fhir_to_omop mapping errors."""


class UnmappedConceptError(FhirToOmopError):
    """Raised in strict mode when a (system, code) pair has no OMOP concept."""


class ProfileConflictError(FhirToOmopError):
    """Raised when a resource declares meta.profile incompatible with the run's profile.

    Per spec decision Q3, fhir_to_omop fails loudly on profile conflicts.
    """
