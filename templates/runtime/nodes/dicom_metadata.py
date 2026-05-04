"""DicomMetadataNode: scan DICOM sources and emit metadata-only Parquet.

Pixel data is NEVER copied. Two source backends:
  - ``filesystem``: recursive directory scan of ``*.dcm``.
  - ``dicomweb``: QIDO-RS metadata-only queries with bearer-token auth.

Each source emits a single Parquet artifact ``dicom_metadata.parquet`` with one
row per SOPInstance and columns for the standard DICOM tags listed in
``METADATA_TAGS``. Unparseable files are logged and skipped — they do not abort
the scan, since DICOM directories regularly contain thumbnails, reports, or
non-DICOM artifacts.

DICOMweb mode is QIDO-RS only by design (spec §6.2 defense-in-depth): the node
NEVER issues WADO-RS requests, so it cannot exfiltrate pixel data even if a
caller misconfigures the endpoint.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
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


# DICOM JSON tag codes (8-hex) -> METADATA_TAGS keyword (DICOM PS3.18 Annex F).
# We only map tags that appear in METADATA_TAGS; other QIDO fields are dropped.
DICOM_JSON_KEYWORDS: dict[str, str] = {
    "0020000D": "StudyInstanceUID",
    "0020000E": "SeriesInstanceUID",
    "00080018": "SOPInstanceUID",
    "00080016": "SOPClassUID",
    "00080060": "Modality",
    "00080070": "Manufacturer",
    "00081090": "ManufacturerModelName",
    "00081010": "StationName",
    "00180015": "BodyPartExamined",
    "00080020": "StudyDate",
    "00080030": "StudyTime",
    "00080021": "SeriesDate",
    "00080031": "SeriesTime",
    "00100020": "PatientID",
    "00080050": "AccessionNumber",
    "00080080": "InstitutionName",
    "00080090": "ReferringPhysicianName",
}


def _dicom_json_to_row(record: dict[str, Any]) -> dict[str, str | None]:
    """Project one DICOM-JSON record (QIDO-RS response item) onto METADATA_TAGS."""
    row: dict[str, str | None] = {tag: None for tag in METADATA_TAGS}
    for code, attr in DICOM_JSON_KEYWORDS.items():
        node = record.get(code)
        if not node:
            continue
        values = node.get("Value") or []
        if values:
            row[attr] = str(values[0])
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
        base_url = str(params.get("dicomweb_base_url", "")).rstrip("/")
        if not base_url:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="dicomweb source requires 'dicomweb_base_url' param",
            )

        headers: dict[str, str] = {"Accept": "application/dicom+json"}
        bearer = params.get("bearer_token")
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"

        rows: list[dict[str, str | None]] = []
        with httpx.Client(headers=headers, timeout=60.0) as client:
            # QIDO-RS /instances returns one DICOM-JSON object per SOPInstance.
            # Pagination on QIDO-RS is server-defined; the spec leaves it to the
            # caller to use `_offset` + `_limit` if needed. Phase 1 fetches the
            # default page and surfaces the count via outputs; explicit paging
            # lands when a customer endpoint requires it.
            resp = client.get(f"{base_url}/instances")
            if resp.status_code == 204:
                records: list[dict[str, Any]] = []
            elif resp.status_code != 200:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=(f"QIDO-RS {base_url}/instances returned {resp.status_code}"),
                )
            else:
                records = resp.json() or []
        for record in records:
            rows.append(_dicom_json_to_row(record))

        df = pl.from_dicts(rows) if rows else _empty_metadata_frame()
        df.write_parquet(context.artifact_dir / "dicom_metadata.parquet")
        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"rows_emitted": len(rows)},
        )
