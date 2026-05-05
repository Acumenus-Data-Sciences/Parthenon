"""ParthenonNativeBackend: pure-Python anonymizer implementing the v1 config schema.

Per spec Q7 the runtime equivalence between this backend and the MS sidecar
backend is *semantic*, not bit-identical. The native backend exists so:

- a customer who can't run the MS sidecar still has a working anonymizer
- the anonymizer config v1 schema has a reference implementation against
  which any future MS sidecar regression can be diffed
- offline / air-gapped runs are possible without a Docker dependency

Date shifts are deterministic per (salt, patient_id) via HMAC, so re-runs
with the same salt reproduce. Salt rotation is the AnonymizerNode's
responsibility (not this backend's).
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import date, timedelta
from typing import Any

from runtime.nodes.anonymizer_config import AnonymizerConfig, AnonymizerRule

REDACTED = "***REDACTED***"


class ParthenonNativeBackend:
    """Pure-Python anonymizer. Per-patient deterministic via HMAC(salt, patient_id)."""

    def __init__(self, *, salt: str) -> None:
        if not salt:
            raise ValueError("ParthenonNativeBackend requires a non-empty salt")
        self.salt = salt

    def anonymize_resource(
        self, config: AnonymizerConfig, resource: dict[str, Any]
    ) -> dict[str, Any]:
        rtype = str(resource.get("resourceType", ""))
        rules_for_resource = [r for r in config.rules if r.path.startswith(f"{rtype}.")]
        keep_fields = {r.path.split(".", 1)[1] for r in rules_for_resource if r.operation == "keep"}
        out: dict[str, Any] = dict(resource)

        for rule in rules_for_resource:
            field = rule.path.split(".", 1)[1]
            if field not in out:
                continue
            out[field] = self._apply(rule, out[field], resource)

        if config.default_action == "redact":
            explicit_fields = {r.path.split(".", 1)[1] for r in rules_for_resource}
            for key in list(out.keys()):
                if key in {"resourceType", "id"}:
                    continue
                if key in keep_fields or key in explicit_fields:
                    continue
                out[key] = REDACTED
        return out

    def _apply(self, rule: AnonymizerRule, value: Any, resource: dict[str, Any]) -> Any:
        op = rule.operation
        if op == "redact":
            return REDACTED
        if op == "keep":
            return value
        if op == "dateShift":
            max_days = int(rule.params["max_days"])
            return self._shift_date(str(value), max_days, str(resource.get("id", "")))
        # op == "cryptoHash" — the AnonymizerRule.operation Literal makes this
        # case exhaustive, so no fallback needed (the schema validator rejects
        # other values upstream).
        algo = str(rule.params["algorithm"])
        return self._hash(str(value), algo)

    def _hash(self, value: str, algorithm: str) -> str:
        salted = f"{self.salt}:{value}".encode()
        if algorithm == "sha256":
            return hashlib.sha256(salted).hexdigest()
        if algorithm == "sha512":
            return hashlib.sha512(salted).hexdigest()
        raise ValueError(f"unsupported hash algorithm: {algorithm}")

    def _shift_date(self, iso_date: str, max_days: int, patient_id: str) -> str:
        # Deterministic per (salt, patient_id) via HMAC. Shift in [-max_days, +max_days].
        mac = hmac.new(self.salt.encode(), patient_id.encode(), hashlib.sha256)
        offset = int.from_bytes(mac.digest()[:4], "big") % (2 * max_days + 1) - max_days
        d = date.fromisoformat(iso_date)
        return (d + timedelta(days=offset)).isoformat()
