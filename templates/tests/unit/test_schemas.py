"""Tests for runtime.schemas: Pandera validation + Pydantic param models."""

from __future__ import annotations

import polars as pl
import pytest
from pydantic import ValidationError

from runtime.schemas import (
    ParameterModel,
    SchemaValidationError,
    define_dataframe_model,
    validate_frame,
)


def test_define_dataframe_model_accepts_columns() -> None:
    model = define_dataframe_model(
        name="PersonRow",
        columns={
            "id": {"dtype": "int64", "nullable": False},
            "name": {"dtype": "str", "nullable": False},
        },
    )
    frame = pl.DataFrame({"id": [1, 2], "name": ["a", "b"]})
    validated = validate_frame(frame, model)
    assert validated.height == 2


def test_validate_frame_rejects_missing_column() -> None:
    model = define_dataframe_model(
        name="WithAge",
        columns={
            "id": {"dtype": "int64", "nullable": False},
            "age": {"dtype": "int64", "nullable": False},
        },
    )
    frame = pl.DataFrame({"id": [1]})
    with pytest.raises(SchemaValidationError) as exc_info:
        validate_frame(frame, model)
    assert "age" in str(exc_info.value)


def test_validate_frame_rejects_wrong_dtype() -> None:
    model = define_dataframe_model(
        name="StringId",
        columns={"id": {"dtype": "str", "nullable": False}},
    )
    frame = pl.DataFrame({"id": [1, 2]})
    with pytest.raises(SchemaValidationError):
        validate_frame(frame, model)


def test_parameter_model_validates_required_fields() -> None:
    class CsvParams(ParameterModel):
        path: str
        delimiter: str = ","

    parsed = CsvParams.model_validate({"path": "/data.csv"})
    assert parsed.path == "/data.csv"
    assert parsed.delimiter == ","

    with pytest.raises(ValidationError):
        CsvParams.model_validate({})


def test_parameter_model_forbids_extra_fields() -> None:
    class StrictParams(ParameterModel):
        target_table: str

    with pytest.raises(ValidationError):
        StrictParams.model_validate({"target_table": "t", "unknown": 1})
