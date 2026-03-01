"""CSV profiling router for large file analysis using pandas."""

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProfileRequest(BaseModel):
    file_path: str
    delimiter: str = ","
    sample_size: int = 10000


class ColumnProfile(BaseModel):
    column_name: str
    column_index: int
    inferred_type: str
    non_null_count: int
    null_count: int
    null_percentage: float
    distinct_count: int
    distinct_percentage: float
    top_values: list[dict[str, Any]] | None = None
    sample_values: list[str] | None = None
    statistics: dict[str, float] | None = None
    is_potential_pii: bool = False
    pii_type: str | None = None


class ProfileResponse(BaseModel):
    columns: list[ColumnProfile]
    row_count: int


_PII_COLUMN_PATTERNS: dict[str, list[str]] = {
    "name": ["first_name", "last_name", "patient_name", "name", "full_name"],
    "ssn": ["ssn", "social_security"],
    "mrn": ["mrn", "medical_record", "patient_id"],
    "phone": ["phone", "telephone", "mobile", "cell"],
    "email": ["email", "e_mail"],
    "address": ["address", "street", "city", "zip", "postal"],
    "dob": ["dob", "date_of_birth", "birth_date", "birthdate"],
}


def _infer_type(series: pd.Series) -> str:  # type: ignore[type-arg]
    """Infer column type from pandas Series."""
    non_null = series.dropna()
    if non_null.empty:
        return "string"

    # Check if already numeric
    if pd.api.types.is_integer_dtype(series):
        return "integer"
    if pd.api.types.is_float_dtype(series):
        return "float"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    # Try parsing as numeric
    numeric = pd.to_numeric(non_null, errors="coerce")
    if numeric.notna().sum() / len(non_null) > 0.9:
        if (numeric.dropna() == numeric.dropna().astype(int)).all():
            return "integer"
        return "float"

    # Try parsing as date
    try:
        dates = pd.to_datetime(non_null, errors="coerce", format="mixed")
        if dates.notna().sum() / len(non_null) > 0.8:
            return "date"
    except Exception:
        pass

    # Check for boolean-like
    lower = non_null.astype(str).str.lower()
    bool_values = {"0", "1", "true", "false", "yes", "no", "y", "n", "t", "f"}
    if set(lower.unique()).issubset(bool_values):
        return "boolean"

    # Check for code-like (short, alphanumeric, high cardinality ratio)
    avg_len = non_null.astype(str).str.len().mean()
    if avg_len <= 10 and non_null.nunique() / len(non_null) < 0.5:
        return "code"

    return "string"


def _detect_pii(column_name: str, series: pd.Series) -> tuple[bool, str | None]:  # type: ignore[type-arg]
    """Detect potential PII from column name patterns."""
    col_lower = column_name.lower().replace(" ", "_")

    for pii_type, patterns in _PII_COLUMN_PATTERNS.items():
        for pattern in patterns:
            if pattern in col_lower:
                return True, pii_type

    return False, None


def _profile_column(col_name: str, col_index: int, series: pd.Series) -> ColumnProfile:  # type: ignore[type-arg]
    """Profile a single column."""
    total = len(series)
    null_count = int(series.isna().sum())
    non_null_count = total - null_count
    null_pct = round(null_count / total * 100, 2) if total > 0 else 0.0
    distinct_count = int(series.nunique())
    distinct_pct = round(distinct_count / non_null_count * 100, 2) if non_null_count > 0 else 0.0

    inferred_type = _infer_type(series)

    # Top values
    top = series.dropna().value_counts().head(10)
    top_values = [{"value": str(v), "count": int(c)} for v, c in top.items()]

    # Sample values
    samples = series.dropna().head(5).astype(str).tolist()

    # Statistics for numeric columns
    statistics = None
    if inferred_type in ("integer", "float"):
        numeric = pd.to_numeric(series, errors="coerce").dropna()
        if not numeric.empty:
            statistics = {
                "min": float(numeric.min()),
                "max": float(numeric.max()),
                "mean": round(float(numeric.mean()), 4),
            }

    # PII detection
    is_pii, pii_type = _detect_pii(col_name, series)

    return ColumnProfile(
        column_name=col_name,
        column_index=col_index,
        inferred_type=inferred_type,
        non_null_count=non_null_count,
        null_count=null_count,
        null_percentage=null_pct,
        distinct_count=distinct_count,
        distinct_percentage=distinct_pct,
        top_values=top_values,
        sample_values=samples,
        statistics=statistics,
        is_potential_pii=is_pii,
        pii_type=pii_type,
    )


@router.post("/profile-csv")
async def profile_csv(request: ProfileRequest) -> ProfileResponse:
    """Profile a CSV file using pandas for large file analysis."""
    file_path = Path(request.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    delimiter = "\t" if request.delimiter == "tab" else request.delimiter

    try:
        # Read full file for profiling (pandas handles memory efficiently with chunks if needed)
        df = pd.read_csv(file_path, delimiter=delimiter, low_memory=False)

        columns = []
        for idx, col_name in enumerate(df.columns):
            profile = _profile_column(str(col_name), idx, df[col_name])
            columns.append(profile)

        return ProfileResponse(columns=columns, row_count=len(df))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profiling failed: {str(e)}") from e
