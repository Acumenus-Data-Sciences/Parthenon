"""AnonymizerNode: anonymize a directory of FHIR resources via a pluggable backend.

Reads JSON files from ``input_dir`` (one FHIR resource per file), applies the
selected backend (``native`` or ``ms``) to each, and writes the anonymized
results to ``<artifact_dir>/anonymized/`` under the same filename. Per-run
salt is generated via :func:`secrets.token_hex` and only its SHA-256 digest is
surfaced in outputs — the salt itself never leaves this process.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from pathlib import Path
from typing import Any

from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import AnonymizerConfigError, load_config
from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

DEFAULT_SIDECAR_URL = "http://parthenon-anonymizer:8080"


class AnonymizerNode(Node):
    """Anonymize a directory of FHIR JSON files via the selected backend."""

    type_name = "anonymizer"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        backend_name = params.get("backend")
        if backend_name not in {"native", "ms"}:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"AnonymizerNode requires backend in {{'native','ms'}}, got {backend_name!r}"
                ),
            )

        input_dir = Path(params.get("input_dir", ""))
        if not input_dir.exists() or not input_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"input_dir does not exist: {input_dir}",
            )

        config_payload = params.get("config")
        if not isinstance(config_payload, dict):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="AnonymizerNode requires 'config' (dict)",
            )
        try:
            config = load_config(config_payload)
        except AnonymizerConfigError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"invalid anonymizer config: {exc}",
            )

        salt = secrets.token_hex(32)
        salt_digest = hashlib.sha256(salt.encode()).hexdigest()

        backend: AnonymizerBackend
        if backend_name == "native":
            backend = ParthenonNativeBackend(salt=salt)
        else:
            sidecar_url = str(params.get("sidecar_url", DEFAULT_SIDECAR_URL))
            backend = MsAnonymizerBackend(sidecar_url=sidecar_url)

        out_dir = context.artifact_dir / "anonymized"
        out_dir.mkdir(parents=True, exist_ok=True)
        files_processed = 0
        for path in sorted(input_dir.glob("*.json")):
            resource = json.loads(path.read_text(encoding="utf-8"))
            anonymized = backend.anonymize_resource(config, resource)
            (out_dir / path.name).write_text(json.dumps(anonymized), encoding="utf-8")
            files_processed += 1

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "files_processed": files_processed,
                "backend": backend_name,
                "salt_digest": salt_digest,
            },
        )
