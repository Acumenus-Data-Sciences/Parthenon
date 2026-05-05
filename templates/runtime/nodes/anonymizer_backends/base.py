"""Anonymizer backend Protocol — both implementations conform to this surface."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from runtime.nodes.anonymizer_config import AnonymizerConfig


@runtime_checkable
class AnonymizerBackend(Protocol):
    """Backends produce an anonymized copy of a single FHIR resource dict."""

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        """Return an anonymized copy of ``resource`` per ``config``."""
        ...
