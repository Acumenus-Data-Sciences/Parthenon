"""Materializer turns a Manifest + parameter dict into a FlowSpec.

Also enforces the secret-key redaction rule from spec §7: any parameter declared
``secret: true`` (or shaped like *_key/*_token/*_password) is redacted in the
``FlowSpec.parameters`` echo while still being forwarded to the executing node.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.flow_spec import FlowSpec
from runtime.registry.manifest import Manifest, load_manifest, load_manifest_from_path
from runtime.registry.materializer import (
    Materializer,
    ParameterValidationError,
    redact_secrets,
)

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


def _build_manifest_with_param(param_props: dict[str, object]) -> Manifest:
    return load_manifest(
        {
            "apiVersion": "parthenon.acumenus.net/v1",
            "kind": "Template",
            "metadata": {
                "id": "secret_demo",
                "name": "Secret Demo",
                "version": "0.1.0",
                "category": "diagnostic",
                "cdm_versions": [],
            },
            "spec": {
                "parameters": {
                    "type": "object",
                    "properties": param_props,
                    "required": list(param_props.keys()),
                },
                "requires": {"cdm_initialized": False, "vocabularies": []},
                "nodes": [
                    {
                        "node_id": "echo",
                        "type": "python",
                        "params": {
                            "code": "def main(c, p):\n    return p\n",
                            "inputs": {},
                        },
                    }
                ],
                "post_conditions": [],
            },
        }
    )


def test_materializer_returns_flow_spec() -> None:
    manifest = load_manifest_from_path(VALID)
    materializer = Materializer()
    flow, sanitized = materializer.materialize(manifest, {})
    assert isinstance(flow, FlowSpec)
    assert flow.flow_id == "minimal_template"
    assert sanitized == {}
    flow.validate()


def test_materializer_validates_required_parameter() -> None:
    manifest = _build_manifest_with_param({"target_schema": {"type": "string", "minLength": 1}})
    materializer = Materializer()
    with pytest.raises(ParameterValidationError):
        materializer.materialize(manifest, {})


def test_redact_secrets_marks_explicit_secret_true() -> None:
    properties = {"api_key": {"type": "string", "secret": True}}
    sanitized = redact_secrets(params={"api_key": "super-secret"}, properties=properties)
    assert sanitized == {"api_key": "***REDACTED***"}


def test_redact_secrets_detects_shaped_names() -> None:
    properties = {"github_token": {"type": "string"}, "user_password": {"type": "string"}}
    sanitized = redact_secrets(
        params={"github_token": "ghp_xxx", "user_password": "p@ss"}, properties=properties
    )
    assert sanitized["github_token"] == "***REDACTED***"
    assert sanitized["user_password"] == "***REDACTED***"


def test_materializer_redacts_in_flowspec_parameters_echo() -> None:
    manifest = _build_manifest_with_param({"api_key": {"type": "string", "secret": True}})
    materializer = Materializer()
    flow, sanitized = materializer.materialize(manifest, {"api_key": "live-secret"})
    assert sanitized == {"api_key": "***REDACTED***"}
    assert flow.parameters == {"api_key": "***REDACTED***"}
