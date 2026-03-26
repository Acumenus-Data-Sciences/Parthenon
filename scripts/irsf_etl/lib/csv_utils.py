"""CSV reading utilities for IRSF ETL.

Handles encoding issues common in clinical research exports
and normalizes empty strings to pd.NA for consistent downstream processing.
"""

from __future__ import annotations

from pathlib import Path
from typing import IO, Union

import pandas as pd


def read_csv_safe(
    path_or_buffer: Union[str, Path, IO],
    **kwargs,
) -> pd.DataFrame:
    """Read a CSV file with safe encoding handling and empty-string normalization.

    Args:
        path_or_buffer: File path (str or Path) or file-like object (StringIO, etc.)
        **kwargs: Additional keyword arguments passed to pd.read_csv.

    Returns:
        DataFrame with empty strings replaced by pd.NA.

    Notes:
        - Uses low_memory=False to avoid mixed-type warnings on large clinical files.
        - Uses encoding_errors='replace' to handle malformed bytes in source CSVs.
        - Replaces empty strings with pd.NA per research pitfall #5 (IRSF exports
          use empty strings instead of NULL for missing values).
    """
    defaults = {
        "low_memory": False,
        "encoding_errors": "replace",
    }
    merged = {**defaults, **kwargs}

    df = pd.read_csv(path_or_buffer, **merged)

    # Replace empty strings with pd.NA -- critical for IRSF data
    df = df.replace("", pd.NA)

    return df
