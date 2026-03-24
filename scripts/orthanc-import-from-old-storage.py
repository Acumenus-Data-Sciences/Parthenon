#!/usr/bin/env python3
"""Import DICOM files from old Orthanc storage into PG-indexed Orthanc.

Reads files from /old-data (mounted read-only from old SQLite storage)
and POSTs each to localhost:8042/instances for re-indexing into PG.

Runs INSIDE the Orthanc container via docker compose exec.

Usage (from host):
    docker compose exec orthanc python3 /import.py
    docker compose exec orthanc python3 /import.py --workers 8
    docker compose exec orthanc python3 /import.py --dry-run
"""

import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

OLD_STORAGE = Path("/old-data")
_user = os.environ.get("ORTHANC_USER", "parthenon")
_pass = os.environ.get("ORTHANC_PASSWORD", "")
AUTH = "Basic " + base64.b64encode(f"{_user}:{_pass}".encode()).decode()

# Skip these non-DICOM files in the storage directory
SKIP_FILES = {"index", "index-shm", "index-wal", ".gitkeep"}


def import_file(filepath: Path) -> tuple[str, bool, str]:
    """POST a DICOM file to Orthanc. Returns (path, success, detail)."""
    try:
        data = filepath.read_bytes()
        req = urllib.request.Request(
            "http://localhost:8042/instances",
            data=data,
            method="POST",
            headers={
                "Authorization": AUTH,
                "Content-Type": "application/dicom",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            status = result.get("Status", "Unknown")
            return str(filepath), True, status
    except urllib.error.HTTPError as e:
        return str(filepath), False, f"HTTP {e.code}"
    except Exception as e:
        return str(filepath), False, str(e)[:100]


def walk_storage(storage_path: Path):
    """Yield all DICOM file paths in the 2-level hex bucket structure."""
    for bucket1 in sorted(storage_path.iterdir()):
        if not bucket1.is_dir() or bucket1.name in SKIP_FILES:
            continue
        # Skip non-hex directories
        try:
            int(bucket1.name, 16)
        except ValueError:
            continue
        for bucket2 in sorted(bucket1.iterdir()):
            if not bucket2.is_dir():
                continue
            for dicom_file in bucket2.iterdir():
                if dicom_file.is_file() and dicom_file.name not in SKIP_FILES:
                    yield dicom_file


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--storage", default=str(OLD_STORAGE))
    args = parser.parse_args()

    storage = Path(args.storage)
    if not storage.exists():
        print(f"  ✗ Storage not found: {storage}")
        sys.exit(1)

    print()
    print("=" * 60)
    print("  Orthanc DICOM Import from Old Storage")
    print("=" * 60)
    print()
    print(f"  Storage: {storage}")

    # Quick count of top-level buckets
    buckets = [d for d in storage.iterdir() if d.is_dir() and d.name not in SKIP_FILES]
    hex_buckets = []
    for b in buckets:
        try:
            int(b.name, 16)
            hex_buckets.append(b)
        except ValueError:
            pass
    print(f"  Hex buckets: {len(hex_buckets)} (expected 256)")

    if args.dry_run:
        # Count files in first few buckets to estimate total
        sample_count = 0
        for b in hex_buckets[:4]:
            for b2 in b.iterdir():
                if b2.is_dir():
                    sample_count += sum(1 for f in b2.iterdir() if f.is_file())
        estimated = sample_count * len(hex_buckets) // 4
        print(f"  Estimated files: ~{estimated:,}")
        print("  Dry run — no imports.")
        return

    # Check current Orthanc stats
    try:
        req = urllib.request.Request("http://localhost:8042/statistics", headers={"Authorization": AUTH})
        with urllib.request.urlopen(req, timeout=10) as resp:
            stats = json.loads(resp.read())
        print(f"  Current instances: {stats['CountInstances']:,}")
    except Exception as e:
        print(f"  ⚠ Cannot reach Orthanc: {e}")
        sys.exit(1)

    print(f"  Workers: {args.workers}")
    print()

    imported = 0
    skipped = 0
    failed = 0
    start_time = time.time()
    last_report = start_time

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        # Submit files in batches to avoid memory buildup
        batch = []
        batch_size = 200

        for filepath in walk_storage(storage):
            batch.append(executor.submit(import_file, filepath))

            if len(batch) >= batch_size:
                for future in as_completed(batch):
                    path, success, detail = future.result()
                    if success:
                        if detail == "AlreadyStored":
                            skipped += 1
                        else:
                            imported += 1
                    else:
                        failed += 1

                batch = []
                total = imported + skipped + failed
                now = time.time()

                # Report every 30 seconds
                if now - last_report >= 30:
                    elapsed = now - start_time
                    rate = total / max(elapsed, 1)
                    # Rough ETA based on expected 926K total
                    remaining = max(926000 - total, 0)
                    eta_s = remaining / max(rate, 0.01)
                    if eta_s > 3600:
                        eta = f"{eta_s/3600:.1f}h"
                    else:
                        eta = f"{eta_s/60:.0f}m"
                    print(f"  → {total:,} processed ({imported:,} new, {skipped:,} dup, {failed:,} err) — {rate:.0f}/sec — ETA: {eta}")
                    last_report = now

        # Process remaining batch
        for future in as_completed(batch):
            path, success, detail = future.result()
            if success:
                if detail == "AlreadyStored":
                    skipped += 1
                else:
                    imported += 1
            else:
                failed += 1

    elapsed = time.time() - start_time
    total = imported + skipped + failed

    # Final stats from Orthanc
    try:
        req = urllib.request.Request("http://localhost:8042/statistics", headers={"Authorization": AUTH})
        with urllib.request.urlopen(req, timeout=10) as resp:
            stats = json.loads(resp.read())
    except Exception:
        stats = {}

    print()
    print("=" * 60)
    print(f"  Imported:    {imported:,}")
    print(f"  Duplicates:  {skipped:,}")
    print(f"  Failed:      {failed:,}")
    print(f"  Total:       {total:,}")
    print(f"  Duration:    {elapsed/60:.1f} min ({total/max(elapsed,1):.0f}/sec)")
    if stats:
        print(f"  Orthanc now: {stats.get('CountInstances', '?'):,} instances / {stats.get('CountStudies', '?'):,} studies")
    print("=" * 60)


if __name__ == "__main__":
    main()
