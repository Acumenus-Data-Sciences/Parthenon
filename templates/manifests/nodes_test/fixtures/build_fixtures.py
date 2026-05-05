"""Generate ``sample.parquet`` from ``sample.csv``.

Idempotent — re-run on fixture changes. Used by the ``nodes_test`` template's
``db_writer`` node, which loads the canonical Parquet fixture into a Postgres
schema during the E2E smoke test.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

HERE = Path(__file__).parent


def build() -> None:
    """Read ``sample.csv`` and write the matching ``sample.parquet`` next to it."""
    df = pl.read_csv(HERE / "sample.csv")
    df.write_parquet(HERE / "sample.parquet")


if __name__ == "__main__":
    build()
