"""Anonymizer config v1: JSON Schema validation + Pydantic loader.

The schema is the portability contract between ``MsAnonymizerBackend`` and
``ParthenonNativeBackend``. Both consume the same JSON; per spec Q7 their
runtime equivalence is *semantic*, not bit-identical.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict, Field

from runtime.nodes.schemas import __file__ as _schema_pkg_init

_SCHEMA_PATH = Path(_schema_pkg_init).parent / "anonymizer_config.v1.json"
_SCHEMA: dict[str, Any] = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = Draft202012Validator(_SCHEMA)


class AnonymizerConfigError(ValueError):
    """Raised when an anonymizer config fails JSON Schema or shape validation."""


class AnonymizerRule(BaseModel):
    """A single rule: apply ``operation`` to FHIR paths matching ``path``."""

    model_config = ConfigDict(extra="forbid")

    path: str
    operation: Literal["redact", "keep", "dateShift", "cryptoHash"]
    params: dict[str, Any] = Field(default_factory=dict)


class AnonymizerConfig(BaseModel):
    """The full anonymizer configuration."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["1"]
    rules: list[AnonymizerRule]
    default_action: Literal["redact", "keep"] = "redact"


def load_config(source: dict[str, Any] | Path) -> AnonymizerConfig:
    """Load and validate an anonymizer config from a dict or JSON file path."""
    payload = json.loads(source.read_text(encoding="utf-8")) if isinstance(source, Path) else source

    errors = sorted(_VALIDATOR.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        msgs = "; ".join(
            f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}" for e in errors
        )
        raise AnonymizerConfigError(msgs)

    try:
        return AnonymizerConfig.model_validate(payload)
    except Exception as exc:
        raise AnonymizerConfigError(str(exc)) from exc
