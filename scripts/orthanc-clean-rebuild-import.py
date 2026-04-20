#!/usr/bin/env python3
"""Import local DICOM files into a clean Orthanc rebuild instance.

The importer is intentionally conservative:
- scans one or more source trees for real DICOM files (`DICM` preamble)
- deduplicates hardlinks by device/inode
- records progress in a SQLite state database for resume
- POSTs files to a target Orthanc `/instances` endpoint
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


SKIP_FILES = {"index", "index-shm", "index-wal", ".gitkeep"}
LONG_VR = {b"OB", b"OD", b"OF", b"OL", b"OV", b"OW", b"SQ", b"UC", b"UR", b"UT", b"UN"}

sys.stdout.reconfigure(line_buffering=True)


@dataclass(frozen=True)
class Candidate:
    key: str
    path: Path
    size: int


def is_dicom(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            header = handle.read(132)
        return len(header) >= 132 and header[128:132] == b"DICM"
    except OSError:
        return False


def walk_sources(sources: list[Path]):
    seen_inodes: set[tuple[int, int]] = set()
    for source in sources:
        for dirpath, _, filenames in os.walk(source):
            base = Path(dirpath)
            for name in filenames:
                if name in SKIP_FILES:
                    continue
                path = base / name
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if stat.st_size <= 0:
                    continue
                inode = (stat.st_dev, stat.st_ino)
                if inode in seen_inodes:
                    continue
                seen_inodes.add(inode)
                if not is_dicom(path):
                    continue
                yield Candidate(f"{stat.st_dev}:{stat.st_ino}", path, stat.st_size)


def connect_state(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("pragma journal_mode=wal")
    conn.execute("pragma synchronous=normal")
    conn.execute(
        """
        create table if not exists files (
            key text primary key,
            path text not null,
            size integer not null,
            status text not null default 'pending',
            detail text,
            updated_at real not null
        )
        """
    )
    conn.execute("create index if not exists files_status_idx on files(status)")
    conn.commit()
    return conn


def load_completed_keys(conn: sqlite3.Connection) -> set[str]:
    return {
        row[0]
        for row in conn.execute(
            "select key from files where status in ('success', 'already_stored')"
        )
    }


def record_scan(conn: sqlite3.Connection, candidates: list[Candidate]) -> None:
    now = time.time()
    conn.executemany(
        """
        insert or ignore into files(key, path, size, status, updated_at)
        values (?, ?, ?, 'pending', ?)
        """,
        [(c.key, str(c.path), c.size, now) for c in candidates],
    )
    conn.commit()


def update_results(conn: sqlite3.Connection, results: list[tuple[str, str, str]]) -> None:
    now = time.time()
    conn.executemany(
        "update files set status = ?, detail = ?, updated_at = ? where key = ?",
        [(status, detail, now, key) for key, status, detail in results],
    )
    conn.commit()


def extract_file_meta_sop_instance_uid(data: bytes) -> str | None:
    """Return (0002,0003) from an explicit-VR DICOM file meta header."""
    if len(data) < 140 or data[128:132] != b"DICM":
        return None

    offset = 132
    while offset + 8 <= len(data):
        group = int.from_bytes(data[offset : offset + 2], "little")
        element = int.from_bytes(data[offset + 2 : offset + 4], "little")
        if group != 0x0002:
            return None

        vr = data[offset + 4 : offset + 6]
        if vr in LONG_VR:
            if offset + 12 > len(data):
                return None
            length = int.from_bytes(data[offset + 8 : offset + 12], "little")
            value_start = offset + 12
        else:
            length = int.from_bytes(data[offset + 6 : offset + 8], "little")
            value_start = offset + 8

        value_end = value_start + length
        if value_end > len(data):
            return None
        if element == 0x0003:
            return data[value_start:value_end].rstrip(b"\0 ").decode("ascii", errors="ignore")
        offset = value_end + (value_end % 2)

    return None


def target_has_sop_instance(target_url: str, sop_instance_uid: str) -> bool:
    payload = json.dumps(
        {"Level": "Instance", "Query": {"SOPInstanceUID": sop_instance_uid}}
    ).encode()
    request = urllib.request.Request(
        f"{target_url.rstrip('/')}/tools/find",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        matches = json.loads(response.read())
    return bool(matches)


def upload_file(target_url: str, candidate: Candidate) -> tuple[str, str, str]:
    data = b""
    try:
        data = candidate.path.read_bytes()
        request = urllib.request.Request(
            f"{target_url.rstrip('/')}/instances",
            data=data,
            method="POST",
            headers={"Content-Type": "application/dicom"},
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read())
        status = str(body.get("Status", "Unknown"))
        normalized = "already_stored" if status == "AlreadyStored" else "success"
        return candidate.key, normalized, status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        if exc.code == 400 and "Bad file format" in detail:
            sop_instance_uid = extract_file_meta_sop_instance_uid(data)
            if sop_instance_uid:
                try:
                    if target_has_sop_instance(target_url, sop_instance_uid):
                        return (
                            candidate.key,
                            "already_stored",
                            f"Invalid duplicate covered by SOPInstanceUID {sop_instance_uid}",
                        )
                except Exception:
                    pass
        return candidate.key, "failed", f"HTTP {exc.code}: {detail}"
    except Exception as exc:  # noqa: BLE001 - preserve failure detail in state DB
        return candidate.key, "failed", str(exc)[:500]


def get_stats(target_url: str) -> dict:
    with urllib.request.urlopen(f"{target_url.rstrip('/')}/statistics", timeout=10) as response:
        return json.loads(response.read())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        action="append",
        required=True,
        help="Source directory to scan; can be repeated",
    )
    parser.add_argument("--target", default="http://127.0.0.1:8044", help="Target Orthanc URL")
    parser.add_argument(
        "--state",
        default="/mnt/md0/orthanc-rebuild/import-state.sqlite",
        help="SQLite progress database",
    )
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=250)
    parser.add_argument("--max-files", type=int, default=None)
    parser.add_argument("--scan-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sources = [Path(source) for source in args.source]
    missing_sources = [source for source in sources if not source.exists()]
    if missing_sources:
        for source in missing_sources:
            print(f"Missing source: {source}", file=sys.stderr)
        return 2

    state_path = Path(args.state)
    conn = connect_state(state_path)
    completed = load_completed_keys(conn)

    print(f"Target: {args.target}")
    print(f"State:  {state_path}")
    print("Sources:")
    for source in sources:
        print(f"  - {source}")
    print(f"Already completed in state: {len(completed):,}")
    print()

    candidates: list[Candidate] = []
    scanned = 0
    last_report = time.time()
    print("Scanning sources for unique DICOM files...")
    for candidate in walk_sources(sources):
        scanned += 1
        if candidate.key in completed:
            continue
        candidates.append(candidate)
        if args.max_files and len(candidates) >= args.max_files:
            break
        now = time.time()
        if now - last_report >= 30:
            print(f"  scan found {scanned:,} unique DICOM files; queued {len(candidates):,}")
            last_report = now

    record_scan(conn, candidates)
    print(f"Scan complete: {scanned:,} unique DICOM files seen; {len(candidates):,} queued")

    if args.scan_only:
        return 0

    try:
        stats = get_stats(args.target)
        print(f"Initial target instances: {stats.get('CountInstances', '?'):,}")
    except Exception as exc:  # noqa: BLE001
        print(f"Cannot reach target Orthanc: {exc}", file=sys.stderr)
        return 2

    imported = 0
    already = 0
    failed = 0
    processed = 0
    started = time.time()
    last_report = started

    print(f"Importing with {args.workers} workers...")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for batch_start in range(0, len(candidates), args.batch_size):
            batch = candidates[batch_start : batch_start + args.batch_size]
            futures = [pool.submit(upload_file, args.target, candidate) for candidate in batch]
            results: list[tuple[str, str, str]] = []
            for future in as_completed(futures):
                key, status, detail = future.result()
                results.append((key, status, detail))
                processed += 1
                if status == "already_stored":
                    already += 1
                elif status == "success":
                    imported += 1
                else:
                    failed += 1

            update_results(conn, results)

            now = time.time()
            if now - last_report >= 30:
                elapsed = now - started
                rate = processed / max(elapsed, 1)
                remaining = max(len(candidates) - processed, 0)
                eta_seconds = remaining / max(rate, 0.01)
                print(
                    f"  {processed:,}/{len(candidates):,} processed; "
                    f"{imported:,} imported, {already:,} duplicate, {failed:,} failed; "
                    f"{rate:.1f}/sec; ETA {eta_seconds / 3600:.1f}h"
                )
                last_report = now

    final_stats = get_stats(args.target)
    elapsed = time.time() - started
    print()
    print(f"Processed: {processed:,}")
    print(f"Imported:  {imported:,}")
    print(f"Duplicate: {already:,}")
    print(f"Failed:    {failed:,}")
    print(f"Rate:      {processed / max(elapsed, 1):.1f}/sec")
    print(f"Final target instances: {final_stats.get('CountInstances', '?'):,}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
