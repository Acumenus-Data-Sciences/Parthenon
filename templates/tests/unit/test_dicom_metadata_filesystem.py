"""DicomMetadataNode filesystem backend: scan a directory of *.dcm files."""

from __future__ import annotations

import logging
from pathlib import Path

import polars as pl
import pytest
from pydicom.data import get_testdata_files

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.dicom_metadata import DicomMetadataNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-dicom",
        node_id="dicom-1",
        logger=logging.getLogger("test.dicom"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


@pytest.fixture()
def dicom_dir(tmp_path: Path) -> Path:
    """Drop a couple of pydicom's bundled test DICOMs into a directory."""
    src = tmp_path / "dcm"
    src.mkdir()
    for name in ("CT_small.dcm", "MR_small.dcm"):
        for f in get_testdata_files(name):
            (src / Path(f).name).write_bytes(Path(f).read_bytes())
    return src


def test_type_name() -> None:
    assert DicomMetadataNode.type_name == "dicom_metadata"


def test_scans_filesystem_to_parquet(context: NodeContext, dicom_dir: Path, tmp_path: Path) -> None:
    result = DicomMetadataNode().run(
        context,
        {"source": "filesystem", "dicom_dir": str(dicom_dir)},
    )
    assert result.status == NodeStatus.SUCCESS, result.error_message
    out = tmp_path / "dicom_metadata.parquet"
    assert out.exists()
    df = pl.read_parquet(out)
    assert df.height >= 2
    for col in ("StudyInstanceUID", "SeriesInstanceUID", "SOPInstanceUID", "Modality"):
        assert col in df.columns


def test_missing_dicom_dir_fails(context: NodeContext) -> None:
    result = DicomMetadataNode().run(context, {"source": "filesystem", "dicom_dir": "/nonexistent"})
    assert result.status == NodeStatus.FAILED
    assert "dicom_dir" in (result.error_message or "")


def test_empty_dir_emits_empty_artifact(context: NodeContext, tmp_path: Path) -> None:
    """Empty directory is not an error; it produces a 0-row Parquet with canonical columns."""
    empty = tmp_path / "empty"
    empty.mkdir()
    result = DicomMetadataNode().run(context, {"source": "filesystem", "dicom_dir": str(empty)})
    assert result.status == NodeStatus.SUCCESS
    df = pl.read_parquet(tmp_path / "dicom_metadata.parquet")
    assert df.height == 0
    for col in ("StudyInstanceUID", "SeriesInstanceUID", "SOPInstanceUID", "Modality"):
        assert col in df.columns


def test_unknown_source_fails(context: NodeContext) -> None:
    result = DicomMetadataNode().run(context, {"source": "made-up"})
    assert result.status == NodeStatus.FAILED
    assert "filesystem" in (result.error_message or "")
