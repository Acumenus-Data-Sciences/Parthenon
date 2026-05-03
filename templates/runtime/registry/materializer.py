"""Convert a Manifest + parameter dict into an executable FlowSpec.

Two sanitization layers:
1. Validate user-supplied parameters against the manifest's JSON Schema.
2. Redact secret-shaped parameter values for the ``FlowSpec.parameters`` echo
   that flows back to Laravel and the database (spec §7).
"""

from __future__ import annotations

import re
from typing import Any

from jsonschema import Draft202012Validator

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.registry.manifest import Manifest

REDACTED_VALUE = "***REDACTED***"
_SECRET_NAME_PATTERN = re.compile(r"(_key|_token|_password|_secret)$", re.IGNORECASE)


class ParameterValidationError(ValueError):
    """Raised when user-supplied parameters fail manifest JSON Schema validation."""


def _is_secret(name: str, prop: dict[str, Any] | None) -> bool:
    if prop and bool(prop.get("secret")):
        return True
    return bool(_SECRET_NAME_PATTERN.search(name))


def redact_secrets(*, params: dict[str, Any], properties: dict[str, Any]) -> dict[str, Any]:
    """Return a shallow copy of ``params`` with secret-shaped values redacted."""
    out: dict[str, Any] = {}
    for key, value in params.items():
        prop = properties.get(key)
        if _is_secret(key, prop if isinstance(prop, dict) else None) and value not in (None, ""):
            out[key] = REDACTED_VALUE
        else:
            out[key] = value
    return out


class Materializer:
    """Build a FlowSpec from a Manifest and user-supplied parameters."""

    def materialize(
        self, manifest: Manifest, parameters: dict[str, Any]
    ) -> tuple[FlowSpec, dict[str, Any]]:
        """Validate parameters, redact secrets, and return ``(flow_spec, sanitized_params)``."""
        param_schema = {
            "type": "object",
            "properties": manifest.spec.parameters.properties,
            "required": list(manifest.spec.parameters.required),
            "additionalProperties": False,
        }
        validator = Draft202012Validator(param_schema)
        errors = sorted(validator.iter_errors(parameters), key=lambda e: list(e.absolute_path))
        if errors:
            msgs = "; ".join(
                f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
                for e in errors
            )
            raise ParameterValidationError(msgs)

        sanitized = redact_secrets(
            params=dict(parameters),
            properties=manifest.spec.parameters.properties,
        )

        nodes = [
            FlowNode(
                node_id=n.node_id,
                type_name=n.type,
                params=dict(n.params),
                depends_on=list(n.depends_on),
            )
            for n in manifest.spec.nodes
        ]
        flow = FlowSpec(
            flow_id=manifest.metadata.id,
            nodes=nodes,
            parameters=sanitized,
        )
        flow.validate()
        return flow, sanitized
