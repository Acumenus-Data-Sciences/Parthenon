#!/usr/bin/env python3
"""Re-index orphaned DICOM files in Orthanc's storage directory.

Finds files on disk that aren't in Orthanc's PostgreSQL index (attachedfiles)
and POSTs them to the REST API. Orthanc deduplicates by SOP Instance UID,
so already-indexed files are skipped cheaply.

After completion, orphaned files (old UUIDs not in the DB) can be cleaned up
with --cleanup mode.

Usage:
    python3 scripts/orthanc-reindex-orphans.py                    # run with 64 workers
    python3 scripts/orthanc-reindex-orphans.py --workers 32       # fewer workers
    python3 scripts/orthanc-reindex-orphans.py --dry-run          # count orphans only
    python3 scripts/orthanc-reindex-orphans.py --cleanup          # remove orphaned files after reindex
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

STORAGE_DIR = Path("/mnt/md0/orthanc-data-pg")
ORTHANC_URL = "http://localhost:8042"
SKIP_FILES = {"index", "index-shm", "index-wal", ".gitkeep"}


def get_orthanc_auth() -> str:
    """Read Orthanc credentials from backend/.env."""
    env_file = Path(__file__).resolve().parent.parent / "backend" / ".env"
    user = "parthenon"
    password = ""
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("ORTHANC_USER="):
                user = line.split("=", 1)[1].strip().strip("\"'")
            elif line.startswith("ORTHANC_PASSWORD="):
                password = line.split("=", 1)[1].strip().strip("\"'")
    return "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()


AUTH = get_orthanc_auth()


def get_known_uuids() -> set[str]:
    """Get all file UUIDs currently in Orthanc's PostgreSQL index."""
    result = subprocess.run(
        [
            "psql", "-h", "localhost", "-U", "claude_dev", "-d", "parthenon",
            "-t", "-A", "-c", "SELECT uuid FROM public.attachedfiles",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return {line.strip() for line in result.stdout.strip().split("\n") if line.strip()}


def walk_storage() -> list[Path]:
    """Collect all file paths in the 2-level hex bucket structure."""
    files: list[Path] = []
    for bucket1 in sorted(STORAGE_DIR.iterdir()):
        if not bucket1.is_dir() or bucket1.name in SKIP_FILES:
            continue
        try:
            int(bucket1.name, 16)
        except ValueError:
            continue
        for bucket2 in sorted(bucket1.iterdir()):
            if not bucket2.is_dir():
                continue
            for dicom_file in bucket2.iterdir():
                if dicom_file.is_file() and dicom_file.name not in SKIP_FILES:
                    files.append(dicom_file)
    return files


def upload_file(filepath: Path) -> tuple[str, bool, str]:
    """POST a DICOM file to Orthanc. Returns (path, success, detail)."""
    try:
        data = filepath.read_bytes()
        req = urllib.request.Request(
            f"{ORTHANC_URL}/instances",
            data=data,
            method="POST",
            headers={
                "Authorization": AUTH,
                "Content-Type": "application/dicom",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read())
            return str(filepath), True, result.get("Status", "Unknown")
    except urllib.error.HTTPError as e:
        return str(filepath), False, f"HTTP {e.code}"
    except Exception as e:
        return str(filepath), False, str(e)[:120]


def cleanup_orphans(known_uuids: set[str]) -> tuple[int, int]:
    """Delete files on disk whose UUID is not in the index. Returns (deleted, bytes_freed)."""
    deleted = 0
    freed = 0
    for bucket1 in sorted(STORAGE_DIR.iterdir()):
        if not bucket1.is_dir() or bucket1.name in SKIP_FILES:
            continue
        try:
            int(bucket1.name, 16)
        except ValueError:
            continue
        for bucket2 in sorted(bucket1.iterdir()):
            if not bucket2.is_dir():
                continue
            for dicom_file in bucket2.iterdir():
                if dicom_file.is_file() and dicom_file.name not in SKIP_FILES:
                    if dicom_file.name not in known_uuids:
                        size = dicom_file.stat().st_size
                        dicom_file.unlink()
                        deleted += 1
                        freed += size
    return deleted, freed


def get_orthanc_stats() -> dict:
    """Fetch current Orthanc statistics."""
    req = urllib.request.Request(
        f"{ORTHANC_URL}/statistics",
        headers={"Authorization": AUTH},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-index orphaned DICOM files in Orthanc")
    parser.add_argument("--workers", type=int, default=64, help="Parallel upload workers (default: 64)")
    parser.add_argument("--dry-run", action="store_true", help="Count orphans without uploading")
    parser.add_argument("--cleanup", action="store_true", help="Delete orphaned files (run AFTER reindex)")
    parser.add_argument("--storage", type=str, default=str(STORAGE_DIR), help="Storage directory path")
    args = parser.parse_args()

    storage = Path(args.storage)
    if not storage.exists():
        print(f"  ERROR: Storage not found: {storage}")
        sys.exit(1)

    print()
    print("=" * 65)

    # ── Cleanup mode ──────────────────────────────────────────────────
    if args.cleanup:
        print("  Orthanc Orphan Cleanup")
        print("=" * 65)
        print()
        print("  Loading current index from PostgreSQL...")
        known = get_known_uuids()
        print(f"  Indexed UUIDs: {len(known):,}")
        print()
        print("  Scanning for orphaned files...")
        # Count first
        orphan_count = 0
        orphan_bytes = 0
        for bucket1 in sorted(storage.iterdir()):
            if not bucket1.is_dir() or bucket1.name in SKIP_FILES:
                continue
            try:
                int(bucket1.name, 16)
            except ValueError:
                continue
            for bucket2 in sorted(bucket1.iterdir()):
                if not bucket2.is_dir():
                    continue
                for f in bucket2.iterdir():
                    if f.is_file() and f.name not in SKIP_FILES and f.name not in known:
                        orphan_count += 1
                        orphan_bytes += f.stat().st_size
        print(f"  Orphaned files: {orphan_count:,} ({orphan_bytes / 1024**3:.1f} GB)")
        if orphan_count == 0:
            print("  Nothing to clean up!")
            return
        print()
        confirm = input(f"  Delete {orphan_count:,} orphaned files? [y/N] ")
        if confirm.lower() != "y":
            print("  Aborted.")
            return
        print("  Deleting...")
        deleted, freed = cleanup_orphans(known)
        print(f"  Deleted {deleted:,} files, freed {freed / 1024**3:.1f} GB")
        return

    # ── Reindex mode ──────────────────────────────────────────────────
    print("  Orthanc Orphan Re-Indexer")
    print("=" * 65)
    print()

    # Step 1: Get known UUIDs
    print("  Step 1: Loading indexed UUIDs from PostgreSQL...")
    known = get_known_uuids()
    print(f"    Indexed files: {len(known):,}")

    # Step 2: Walk disk and find orphans
    print("  Step 2: Scanning storage directory...")
    all_files = walk_storage()
    print(f"    Total files on disk: {len(all_files):,}")

    orphaned = [f for f in all_files if f.name not in known]
    print(f"    Orphaned (not indexed): {len(orphaned):,}")

    if not orphaned:
        print("\n  All files are indexed. Nothing to do!")
        return

    if args.dry_run:
        total_bytes = sum(f.stat().st_size for f in orphaned[:1000])
        avg_size = total_bytes / min(len(orphaned), 1000)
        est_total = avg_size * len(orphaned)
        print(f"    Estimated orphan size: {est_total / 1024**3:.1f} GB")
        print(f"    Avg file size: {avg_size / 1024:.0f} KB")
        print("\n  Dry run — no uploads.")
        return

    # Step 3: Check Orthanc is healthy
    try:
        stats = get_orthanc_stats()
        print(f"\n  Orthanc status: {stats['CountInstances']:,} instances indexed")
    except Exception as e:
        print(f"\n  ERROR: Cannot reach Orthanc: {e}")
        sys.exit(1)

    # Step 4: Upload orphaned files
    print(f"\n  Step 3: Uploading {len(orphaned):,} orphaned files ({args.workers} workers)")
    print(f"          Orthanc will deduplicate by SOP Instance UID")
    print()

    imported = 0
    already_stored = 0
    failed = 0
    failed_files: list[str] = []
    start_time = time.time()
    last_report = start_time
    total_target = len(orphaned)

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        batch: list = []
        batch_size = 500

        for filepath in orphaned:
            batch.append(executor.submit(upload_file, filepath))

            if len(batch) >= batch_size:
                for future in as_completed(batch):
                    path, success, detail = future.result()
                    if success:
                        if detail == "AlreadyStored":
                            already_stored += 1
                        else:
                            imported += 1
                    else:
                        failed += 1
                        if len(failed_files) < 20:
                            failed_files.append(f"{path}: {detail}")

                batch = []
                total = imported + already_stored + failed
                now = time.time()

                if now - last_report >= 15:
                    elapsed = now - start_time
                    rate = total / max(elapsed, 1)
                    remaining = max(total_target - total, 0)
                    eta_s = remaining / max(rate, 0.01)
                    if eta_s > 3600:
                        eta = f"{eta_s / 3600:.1f}h"
                    elif eta_s > 60:
                        eta = f"{eta_s / 60:.0f}m"
                    else:
                        eta = f"{eta_s:.0f}s"
                    pct = total * 100 // total_target
                    print(
                        f"  [{pct:3d}%] {total:,}/{total_target:,}"
                        f"  | +{imported:,} new, {already_stored:,} dup, {failed:,} err"
                        f"  | {rate:.0f}/sec | ETA {eta}"
                    )
                    last_report = now

        # Drain remaining batch
        for future in as_completed(batch):
            path, success, detail = future.result()
            if success:
                if detail == "AlreadyStored":
                    already_stored += 1
                else:
                    imported += 1
            else:
                failed += 1
                if len(failed_files) < 20:
                    failed_files.append(f"{path}: {detail}")

    elapsed = time.time() - start_time
    total = imported + already_stored + failed

    # Final stats
    try:
        stats = get_orthanc_stats()
    except Exception:
        stats = {}

    print()
    print("=" * 65)
    print(f"  New instances indexed:  {imported:,}")
    print(f"  Already stored (dup):   {already_stored:,}")
    print(f"  Failed:                 {failed:,}")
    print(f"  Total processed:        {total:,}")
    print(f"  Duration:               {elapsed / 60:.1f} min ({total / max(elapsed, 1):.0f}/sec)")
    if stats:
        print(
            f"  Orthanc now:            {stats.get('CountInstances', '?'):,} instances"
            f" / {stats.get('CountStudies', '?'):,} studies"
            f" / {stats.get('TotalDiskSizeMB', 0):,} MB"
        )
    print("=" * 65)

    if failed_files:
        print(f"\n  First {len(failed_files)} failures:")
        for line in failed_files:
            print(f"    {line}")

    if imported > 0:
        print(
            f"\n  NOTE: {imported:,} new files were stored with new UUIDs."
            f"\n  Run with --cleanup to remove orphaned old copies and reclaim disk space."
        )


if __name__ == "__main__":
    main()
