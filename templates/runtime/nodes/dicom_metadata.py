"""DicomMetadataNode: scan DICOM sources and emit metadata-only Parquet.

Pixel data is NEVER copied. Two source backends:
  - ``filesystem``: recursive directory scan of ``*.dcm`` (this task).
  - ``dicomweb``: QIDO-RS metadata-only queries (Task 8).

Each source emits a single Parquet artifact ``dicom_metadata.parquet`` with one
row per SOPInstance and columns for the standard DICOM tags listed in
``METADATA_TAGS``. Unparseable files are logged and skipped — they do not abort
the scan, since DICOM directories regularly contain thumbnails, reports, or
non-DICOM artifacts.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
from pydicom import dcmread
from pydicom.dataset import Dataset

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

# Subset of standard DICOM tags surfaced as Parquet columns. PixelData is
# intentionally absent — the contract for this node is metadata-only ingestion.
METADATA_TAGS: tuple[str, ...] = (
    "StudyInstanceUID",
    "SeriesInstanceUID",
    "SOPInstanceUID",
    "SOPClassUID",
    "Modality",
    "Manufacturer",
    "ManufacturerModelName",
    "StationName",
    "BodyPartExamined",
    "StudyDate",
    "StudyTime",
    "SeriesDate",
    "SeriesTime",
    "PatientID",
    "AccessionNumber",
    "InstitutionName",
    "ReferringPhysicianName",
)


def _extract_row(ds: Dataset) -> dict[str, str | None]:
    """Project a pydicom Dataset onto METADATA_TAGS as plain str/None values."""
    row: dict[str, str | None] = {}
    for tag in METADATA_TAGS:
        value = getattr(ds, tag, None)
        row[tag] = None if value is None else str(value)
    return row


def _empty_metadata_frame() -> pl.DataFrame:
    """A 0-row DataFrame whose schema matches a populated metadata frame."""
    return pl.DataFrame(
        {tag: pl.Series(name=tag, values=[], dtype=pl.Utf8) for tag in METADATA_TAGS}
    )


class DicomMetadataNode(Node):
    """Stream DICOM metadata (no pixels) from a directory or DICOMweb endpoint."""

    type_name = "dicom_metadata"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        source = params.get("source")
        if source == "filesystem":
            return self._run_filesystem(context, params)
        if source == "dicomweb":
            return self._run_dicomweb(context, params)
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=(
                f"DicomMetadataNode requires source in {{'filesystem','dicomweb'}}, got {source!r}"
            ),
        )

    def _run_filesystem(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        dicom_dir = Path(params.get("dicom_dir", ""))
        if not dicom_dir.exists() or not dicom_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"dicom_dir does not exist: {dicom_dir}",
            )

        rows: list[dict[str, str | None]] = []
        files_seen = 0
        for path in sorted(dicom_dir.rglob("*.dcm")):
            files_seen += 1
            try:
                ds = dcmread(str(path), stop_before_pixels=True)
            except Exception as exc:
                context.logger.warning("dicom parse failed for %s: %s", path, exc)
                continue
            rows.append(_extract_row(ds))

        df = pl.from_dicts(rows) if rows else _empty_metadata_frame()
        df.write_parquet(context.artifact_dir / "dicom_metadata.parquet")

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"files_processed": files_seen, "rows_emitted": len(rows)},
        )

    def _run_dicomweb(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        # Implemented in Task 8 (QIDO-RS bearer-token paginated metadata queries).
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="dicomweb source is not yet implemented (Task 8)",
        )
