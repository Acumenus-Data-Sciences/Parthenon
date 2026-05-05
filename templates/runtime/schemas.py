"""Schema utilities for parthenon-templates.

Two boundaries are validated:

* **DataFrames** flowing between nodes — validated with Pandera (Polars dialect).
* **Parameter dicts** flowing into nodes — validated with Pydantic models
  (subclass :class:`ParameterModel` to opt in).

Pandera 0.21 raises :class:`pandera.errors.SchemaError` for eager validation
and :class:`pandera.errors.SchemaErrors` (note: separate class, not subclass)
for ``lazy=True`` validation. Both are normalised to
:class:`SchemaValidationError` for callers.
"""

from __future__ import annotations

from typing import Any, ClassVar

import pandera.polars as pa
import polars as pl
from pandera.errors import SchemaError, SchemaErrors
from pydantic import BaseModel, ConfigDict


class SchemaValidationError(ValueError):
    """Raised when a Polars frame does not match its declared schema."""


# Pandera 0.21 accepts ``str | type | polars.DataTypeClass`` for column dtypes.
# Polars dtype singletons (``pl.Int64`` etc.) are ``DataTypeClass`` instances;
# typing the map as ``Any`` avoids a misleading mypy ``arg-type`` error without
# losing the runtime check below (unknown keys raise at definition time).
_DTYPE_MAP: dict[str, Any] = {
    "int64": pl.Int64,
    "int32": pl.Int32,
    "float64": pl.Float64,
    "float32": pl.Float32,
    "str": pl.Utf8,
    "bool": pl.Boolean,
    "date": pl.Date,
    "datetime": pl.Datetime,
}


def define_dataframe_model(*, name: str, columns: dict[str, dict[str, Any]]) -> pa.DataFrameSchema:
    """Build a Pandera (polars) schema from a column spec.

    ``columns`` maps column-name to a ``{dtype: str, nullable: bool}`` dict;
    ``dtype`` must be a key of :data:`_DTYPE_MAP`. Unknown dtypes raise
    :class:`ValueError` at definition time so misconfiguration surfaces before
    a frame ever flows through.
    """
    schema_columns: dict[str, pa.Column] = {}
    for col_name, col_spec in columns.items():
        dtype_key = str(col_spec["dtype"])
        if dtype_key not in _DTYPE_MAP:
            raise ValueError(f"unsupported dtype {dtype_key!r} for column {col_name}")
        schema_columns[col_name] = pa.Column(
            _DTYPE_MAP[dtype_key],
            nullable=bool(col_spec.get("nullable", False)),
        )
    return pa.DataFrameSchema(schema_columns, name=name, strict=False)


def validate_frame(frame: pl.DataFrame, schema: pa.DataFrameSchema) -> pl.DataFrame:
    """Validate ``frame`` against ``schema``; normalise errors.

    Uses ``lazy=True`` so all violations are reported at once. Both
    :class:`SchemaError` (eager fallback) and :class:`SchemaErrors`
    (lazy aggregate) are re-raised as :class:`SchemaValidationError`.
    """
    try:
        validated = schema.validate(frame, lazy=True)
    except (SchemaError, SchemaErrors) as exc:
        raise SchemaValidationError(str(exc)) from exc
    if not isinstance(validated, pl.DataFrame):
        raise SchemaValidationError("schema.validate returned non-DataFrame")
    return validated


class ParameterModel(BaseModel):
    """Base class for node-parameter Pydantic models.

    Forbids unknown fields (``extra="forbid"``) so manifest typos surface as
    validation errors rather than silently-ignored keys. Strings are stripped
    of surrounding whitespace at parse time for friendlier YAML/JSON inputs.
    """

    model_config: ClassVar[ConfigDict] = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


__all__ = [
    "ParameterModel",
    "SchemaValidationError",
    "define_dataframe_model",
    "validate_frame",
]
