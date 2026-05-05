"""MsAnonymizerBackend: HTTP client to the parthenon-anonymizer sidecar.

Sidecar contract:
  POST {sidecar_url}/anonymize
  Content-Type: application/json
  Body: {"config": <AnonymizerConfig dict>, "resource": <FHIR resource dict>}
  Response 200: anonymized FHIR resource dict
  Response 4xx/5xx: sidecar error -> SidecarUnavailable
"""

from __future__ import annotations

from typing import Any

import httpx

from runtime.nodes.anonymizer_config import AnonymizerConfig


class SidecarUnavailable(RuntimeError):
    """Raised when the parthenon-anonymizer sidecar is unreachable or returns non-200."""


class MsAnonymizerBackend:
    """Forward FHIR resources to the MS-Anonymizer-backed sidecar."""

    def __init__(self, *, sidecar_url: str, timeout_seconds: float = 30.0) -> None:
        if not sidecar_url:
            raise ValueError("MsAnonymizerBackend requires sidecar_url")
        self.sidecar_url = sidecar_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        payload = {"config": config.model_dump(), "resource": resource}
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                resp = client.post(f"{self.sidecar_url}/anonymize", json=payload)
        except httpx.HTTPError as exc:
            raise SidecarUnavailable(f"sidecar unreachable: {exc}") from exc
        if resp.status_code != 200:
            raise SidecarUnavailable(f"sidecar returned {resp.status_code}: {resp.text[:200]}")
        return dict(resp.json())
