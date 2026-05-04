"""Defense in depth: DicomMetadataNode never emits pixel data.

If either of these tests fails, the metadata-only invariant of
``DicomMetadataNode`` has been broken — treat as a HIGHSEC blocker.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import polars as pl
import pytest
from pydicom.data import get_testdata_files

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def dicom_dir(tmp_path: Path) -> Path:
    src = tmp_path / "dcm"
    src.mkdir()
    # CT_small.dcm has real pixel data; a successful run must not surface any of it.
    for f in get_testdata_files("CT_small.dcm"):
        (src / Path(f).name).write_bytes(Path(f).read_bytes())
    return src


def test_artifact_has_no_pixel_columns(tmp_path: Path, dicom_dir: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = DicomMetadataNode().run(ctx, {"source": "filesystem", "dicom_dir": str(dicom_dir)})
    assert result.status == NodeStatus.SUCCESS

    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    pixel_pattern = re.compile(r"pixel", re.IGNORECASE)
    bad_cols = [c for c in df.columns if pixel_pattern.search(c)]
    assert not bad_cols, f"DicomMetadataNode emitted pixel-related columns: {bad_cols}"


def test_artifact_size_is_metadata_only(tmp_path: Path, dicom_dir: Path) -> None:
    """The output Parquet should be a tiny fraction of the source DICOM file size.

    Sanity check: if pixel data ever leaked through, the Parquet would balloon
    to DICOM-file-sized (KB-MB range). Metadata-only stays well under 100 KB.
    """
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    DicomMetadataNode().run(ctx, {"source": "filesystem", "dicom_dir": str(dicom_dir)})

    parquet_size = (tmp_path / "dicom_metadata.parquet").stat().st_size
    source_size = sum(p.stat().st_size for p in dicom_dir.glob("*.dcm"))
    assert parquet_size < source_size, (
        f"metadata Parquet ({parquet_size} bytes) >= source DICOM ({source_size} bytes); "
        f"pixel data may have leaked"
    )
    assert parquet_size < 100_000, f"metadata Parquet unexpectedly large: {parquet_size} bytes"
