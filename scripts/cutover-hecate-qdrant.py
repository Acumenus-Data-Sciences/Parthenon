#!/usr/bin/env python3
"""Snapshot and cut Hecate's fixed ``meddra`` name over to a Qdrant alias.

This is intentionally a separate, explicit operation from collection build.
Without ``--apply`` it performs read-only preflight. With ``--apply`` it first
creates, exports, and hashes a Qdrant snapshot of the old collection on retained
storage, then replaces the fixed live name with an alias to the already
validated versioned target.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from hecate_vocabulary_sync import QDRANT_URL, collection_info, qdrant_request, validate_collection_name


def preflight(active: str, target: str, expected_count: int) -> dict[str, Any]:
    active = validate_collection_name(active)
    target = validate_collection_name(target)
    if active == target:
        raise ValueError("Active and target collection names must differ")
    active_info = collection_info(active)
    target_info = collection_info(target)
    if active_info is None:
        raise RuntimeError(f"Active collection {active!r} does not exist")
    if target_info is None:
        raise RuntimeError(f"Target collection {target!r} does not exist")
    if target_info.get("status") != "green" or int(target_info.get("points_count") or 0) != expected_count:
        raise RuntimeError(
            f"Target {target!r} is not cutover-ready: status={target_info.get('status')} "
            f"points={target_info.get('points_count')} expected={expected_count}"
        )
    aliases = qdrant_request("GET", "/aliases")["result"]["aliases"]
    if any(alias.get("alias_name") == active for alias in aliases):
        raise RuntimeError(f"The active name {active!r} is already an alias")
    return {
        "active_collection": active,
        "active_count": int(active_info.get("points_count") or 0),
        "target_collection": target,
        "target_count": int(target_info.get("points_count") or 0),
        "expected_count": expected_count,
    }


def download_snapshot(active: str, snapshot_name: str, snapshot_dir: Path) -> dict[str, Any]:
    if Path(snapshot_name).name != snapshot_name:
        raise RuntimeError(f"Qdrant returned an unsafe snapshot name: {snapshot_name!r}")
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    destination = snapshot_dir / snapshot_name
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    digest = hashlib.sha256()
    size = 0
    try:
        with urllib.request.urlopen(
            f"{QDRANT_URL}/collections/{active}/snapshots/{snapshot_name}",
            timeout=3_600,
        ) as response, temporary.open("wb") as handle:
            while chunk := response.read(8 * 1024 * 1024):
                handle.write(chunk)
                digest.update(chunk)
                size += len(chunk)
            handle.flush()
            os.fsync(handle.fileno())
        if size <= 0:
            raise RuntimeError("Downloaded Qdrant rollback snapshot is empty")
        os.replace(temporary, destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    checksum = digest.hexdigest()
    destination.with_suffix(destination.suffix + ".sha256").write_text(
        f"{checksum}  {destination.name}\n",
        encoding="utf-8",
    )
    return {"path": str(destination), "size": size, "sha256": checksum}


def apply_cutover(active: str, target: str, snapshot_dir: Path) -> dict[str, Any]:
    snapshot = qdrant_request("POST", f"/collections/{active}/snapshots", {}, timeout=3_600)["result"]
    if not snapshot.get("name") or int(snapshot.get("size") or 0) <= 0:
        raise RuntimeError(f"Qdrant returned an invalid rollback snapshot: {snapshot}")
    rollback_snapshot = download_snapshot(active, str(snapshot["name"]), snapshot_dir)
    if rollback_snapshot["size"] != int(snapshot["size"]):
        raise RuntimeError(
            "Downloaded Qdrant rollback snapshot size does not match the server manifest: "
            f"downloaded={rollback_snapshot['size']} server={snapshot['size']}"
        )
    qdrant_request("DELETE", f"/collections/{active}", timeout=3_600)
    qdrant_request("POST", "/collections/aliases", {
        "actions": [{"create_alias": {"collection_name": target, "alias_name": active}}],
    })
    resolved = collection_info(active)
    if resolved is None or resolved.get("status") != "green":
        raise RuntimeError(f"Alias {active!r} did not resolve to a healthy collection")
    return {
        "snapshot": snapshot,
        "rollback_snapshot": rollback_snapshot,
        "resolved_count": int(resolved.get("points_count") or 0),
    }


def write_manifest(path: Path, payload: dict[str, Any]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    path.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n")
    return digest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--active", default="meddra")
    parser.add_argument("--target", required=True)
    parser.add_argument("--expected-count", required=True, type=int)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--snapshot-dir", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-hecate-stopped", action="store_true")
    args = parser.parse_args()

    started = time.monotonic()
    evidence = preflight(args.active, args.target, args.expected_count)
    result: dict[str, Any] = {"mode": "preflight", **evidence}
    if args.apply:
        if not args.confirm_hecate_stopped:
            raise SystemExit("--apply requires --confirm-hecate-stopped after the Hecate container is stopped")
        if args.snapshot_dir is None:
            raise SystemExit("--apply requires --snapshot-dir on retained storage")
        result.update(apply_cutover(args.active, args.target, args.snapshot_dir))
        result["mode"] = "applied"
    result.update({
        "format": "parthenon.hecate-qdrant-cutover.v1",
        "created_at": datetime.now(UTC).isoformat(),
        "duration_seconds": round(time.monotonic() - started, 3),
    })
    digest = write_manifest(args.manifest, result)
    print(json.dumps({"manifest": str(args.manifest), "sha256": digest, **result}, indent=2))


if __name__ == "__main__":
    main()
