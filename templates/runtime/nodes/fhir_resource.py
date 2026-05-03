"""FhirResourceNode: ingest FHIR R4 resources to per-type Parquet artifacts.

Two source modes:
  - ``ndjson``: read a directory of NDJSON files (one per resource type), as produced
    by the FHIR Bulk Data ``$export`` operation. Streams line-by-line; never loads
    a whole bundle into memory.
  - ``search``: paginated REST search against a FHIR R4 server (Task 4).

Output: one Parquet artifact per resource type, named ``<resourceType>.parquet`` (lowercased).
Resources whose type is not in the selected profile pack are skipped (not failed) so
unknown extensions don't break ingestion.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

PROFILE_PACK_DIR = Path(__file__).resolve().parent / "profile_packs"


def _load_profile_pack(profile: str) -> dict[str, Any]:
    path = PROFILE_PACK_DIR / f"{profile}.json"
    if not path.exists():
        raise ValueError(
            f"unknown profile {profile!r}; expected one of "
            f"{[p.stem for p in PROFILE_PACK_DIR.glob('*.json')]}"
        )
    return dict(json.loads(path.read_text(encoding="utf-8")))


def _profile_resource_types(pack: dict[str, Any]) -> set[str]:
    return {r["type"] for r in pack.get("resources", [])}


class FhirResourceNode(Node):
    """Ingest FHIR R4 resources into per-type Parquet artifacts."""

    type_name = "fhir_resource"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        source = params.get("source")
        profile_name = params.get("profile")

        if not profile_name:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="FhirResourceNode requires 'profile' param",
            )
        try:
            pack = _load_profile_pack(profile_name)
        except ValueError as exc:
            return NodeResult(status=NodeStatus.FAILED, error_message=str(exc))

        allowed_types = _profile_resource_types(pack)

        if source == "ndjson":
            return self._run_ndjson(context, params, allowed_types)
        if source == "search":
            return self._run_search(context, params, allowed_types)
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=(
                f"FhirResourceNode requires source in {{'ndjson','search'}}, got {source!r}"
            ),
        )

    def _run_ndjson(
        self,
        context: NodeContext,
        params: dict[str, Any],
        allowed_types: set[str],
    ) -> NodeResult:
        ndjson_dir = Path(params.get("ndjson_dir", ""))
        if not ndjson_dir.exists() or not ndjson_dir.is_dir():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"ndjson_dir does not exist: {ndjson_dir}",
            )

        per_type: dict[str, list[dict[str, Any]]] = {}
        skipped: set[str] = set()
        files_seen = 0
        lines_seen = 0

        for path in sorted(ndjson_dir.glob("*.ndjson")):
            files_seen += 1
            with path.open("r", encoding="utf-8") as f:
                for raw_line in f:
                    line = raw_line.strip()
                    if not line:
                        continue
                    lines_seen += 1
                    record = json.loads(line)
                    rtype = record.get("resourceType", path.stem)
                    if rtype not in allowed_types:
                        skipped.add(rtype)
                        continue
                    per_type.setdefault(rtype, []).append(record)

        for rtype, rows in per_type.items():
            df = pl.from_dicts(rows)
            artifact_name = f"{rtype.lower()}.parquet"
            df.write_parquet(context.artifact_dir / artifact_name)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "files_processed": files_seen,
                "lines_processed": lines_seen,
                "resource_types_emitted": sorted(per_type.keys()),
                "skipped_resource_types": sorted(skipped),
            },
        )

    def _run_search(
        self,
        context: NodeContext,
        params: dict[str, Any],
        allowed_types: set[str],
    ) -> NodeResult:
        # Implemented in Task 4.
        return NodeResult(
            status=NodeStatus.FAILED,
            error_message="search source is not yet implemented (Task 4)",
        )
