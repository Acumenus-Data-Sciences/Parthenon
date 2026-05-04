"""Pydantic models for the template manifest v1 + JSON Schema validation gate."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, ClassVar, Literal

import yaml
from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from runtime.registry.schema import __file__ as _schema_pkg_init

_SCHEMA_PATH = Path(_schema_pkg_init).parent / "template.v1.json"
_SCHEMA: dict[str, Any] = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = Draft202012Validator(_SCHEMA)

NODE_TYPES = (
    "python",
    "sql",
    "csv_reader",
    "db_reader",
    "db_writer",
    "py2table",
    "generic_file",
    "r",
    "fhir_resource",
    "dicom_metadata",
    "anonymizer",
)


class ManifestLoadError(ValueError):
    """Raised when a manifest fails JSON Schema or Pydantic validation."""


class ManifestMetadata(BaseModel):
    """metadata.* fields."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    id: str
    name: str
    version: str
    category: Literal["ingestion", "vocabulary", "diagnostic", "analytic", "transform"]
    cdm_versions: list[Literal["5.3", "5.4", "oncology_ext"]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    author: str | None = None
    singleton: bool = False


class ManifestNode(BaseModel):
    """spec.nodes[*]."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    node_id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)


class ManifestParameters(BaseModel):
    """spec.parameters — a JSON Schema fragment."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    type: Literal["object"]
    properties: dict[str, Any]
    required: list[str] = Field(default_factory=list)


class ManifestRequires(BaseModel):
    """spec.requires."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    cdm_initialized: bool
    vocabularies: list[str] = Field(default_factory=list)


class ManifestPostCondition(BaseModel):
    """One post-condition declaration."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    kind: str
    params: dict[str, Any] = Field(default_factory=dict)


class ManifestSpec(BaseModel):
    """spec.*"""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    parameters: ManifestParameters
    requires: ManifestRequires
    nodes: list[ManifestNode]
    post_conditions: list[ManifestPostCondition] = Field(default_factory=list)


class Manifest(BaseModel):
    """Top-level manifest object."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    apiVersion: Literal["parthenon.acumenus.net/v1"]
    kind: Literal["Template"]
    metadata: ManifestMetadata
    spec: ManifestSpec


def load_manifest(payload: dict[str, Any]) -> Manifest:
    """Validate ``payload`` against JSON Schema then build the Pydantic model."""
    errors = sorted(_VALIDATOR.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        msgs = "; ".join(
            f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}" for e in errors
        )
        raise ManifestLoadError(f"json-schema validation failed: {msgs}")
    try:
        return Manifest.model_validate(payload)
    except ValidationError as exc:
        raise ManifestLoadError(f"pydantic validation failed: {exc}") from exc


def load_manifest_from_path(path: Path) -> Manifest:
    """Read YAML at ``path`` and return a validated ``Manifest``."""
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ManifestLoadError(f"manifest at {path} is not a YAML mapping")
    return load_manifest(payload)
