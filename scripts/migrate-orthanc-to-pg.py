#!/usr/bin/env python3
"""Migrate Orthanc index from SQLite to PostgreSQL via instance-level transfer.

Reads each DICOM instance from the temp SQLite-indexed Orthanc and POSTs the raw
DICOM binary to the production PG-indexed Orthanc's /instances endpoint.

This is faster and more reliable than peer transfer because:
  - /instances accepts raw DICOM and indexes it immediately
  - No peer protocol overhead
  - Handles duplicates gracefully (Orthanc deduplicates by SOP Instance UID)

Usage:
    python3 scripts/migrate-orthanc-to-pg.py
    python3 scripts/migrate-orthanc-to-pg.py --dry-run
    python3 scripts/migrate-orthanc-to-pg.py --workers 8
"""

import argparse
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ORTHANC_USER = os.environ.get("ORTHANC_USER", "parthenon")
ORTHANC_PASS = os.environ["ORTHANC_PASSWORD"]  # Required — no default
SQLITE_PORT = 8043
PG_PORT = 8042
TEMP_CONTAINER = "orthanc-sqlite-migrator"
AUTH_HEADER = "Basic " + base64.b64encode(f"{ORTHANC_USER}:{ORTHANC_PASS}".encode()).decode()


def orthanc_get(port: int, path: str) -> bytes:
    req = urllib.request.Request(
        f"http://localhost:{port}{path}",
        headers={"Authorization": AUTH_HEADER},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def orthanc_post(port: int, path: str, data: bytes, content_type: str = "application/json") -> int:
    req = urllib.request.Request(
        f"http://localhost:{port}{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": AUTH_HEADER,
            "Content-Type": content_type,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def get_json(port: int, path: str):
    return json.loads(orthanc_get(port, path))


def get_stats(port: int) -> dict:
    return get_json(port, "/statistics")


def start_temp_orthanc(data_path: str) -> bool:
    """Start a temporary SQLite-indexed Orthanc."""
    # Clean up any leftover
    subprocess.run(["docker", "rm", "-f", TEMP_CONTAINER], capture_output=True)

    result = subprocess.run([
        "docker", "run", "-d",
        "--name", TEMP_CONTAINER,
        "--network", "parthenon_parthenon",
        "-p", f"{SQLITE_PORT}:8042",
        "-v", f"{data_path}:/var/lib/orthanc/db:ro",
        "-e", "ORTHANC__NAME=SQLite Migrator (temp)",
        "-e", "ORTHANC__REMOTE_ACCESS_ALLOWED=true",
        "-e", "ORTHANC__AUTHENTICATION_ENABLED=true",
        "-e", f'ORTHANC__REGISTERED_USERS={{"{ORTHANC_USER}": "{ORTHANC_PASS}"}}',
        "-e", "ORTHANC__CONCURRENT_JOBS=4",
        "-e", "DICOM_WEB_PLUGIN_ENABLED=false",
        "--memory=2g",
        "orthancteam/orthanc:latest",
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"  ✗ Failed to start temp Orthanc: {result.stderr}", file=sys.stderr)
        return False

    # Wait for startup
    for _ in range(30):
        try:
            get_stats(SQLITE_PORT)
            return True
        except Exception:
            time.sleep(2)

    print("  ✗ Temp Orthanc failed to start within 60s", file=sys.stderr)
    return False


def stop_temp_orthanc():
    subprocess.run(["docker", "rm", "-f", TEMP_CONTAINER], capture_output=True)


def migrate_instance(instance_id: str) -> tuple[str, bool]:
    """Download DICOM from SQLite Orthanc, upload to PG Orthanc."""
    try:
        dicom_data = orthanc_get(SQLITE_PORT, f"/instances/{instance_id}/file")
        status = orthanc_post(PG_PORT, "/instances", dicom_data, "application/dicom")
        # 200 = new, 409 = duplicate (already exists) — both are success
        return instance_id, status in (200, 409)
    except Exception as e:
        return instance_id, False


def main():
    parser = argparse.ArgumentParser(description="Migrate Orthanc SQLite → PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Show counts without migrating")
    parser.add_argument("--workers", type=int, default=4, help="Parallel transfer threads (default: 4)")
    parser.add_argument("--batch-size", type=int, default=500, help="Instances per progress report (default: 500)")
    args = parser.parse_args()

    print()
    print("═" * 60)
    print("  Orthanc SQLite → PostgreSQL Index Migration (v2)")
    print("═" * 60)
    print()

    # Check production Orthanc
    try:
        pg_stats = get_stats(PG_PORT)
        print(f"  ✓ Production Orthanc (PG): {pg_stats['CountInstances']} instances")
    except Exception:
        print("  ✗ Production Orthanc not reachable at :8042")
        sys.exit(1)

    # Find data path
    result = subprocess.run(
        ["docker", "inspect", "parthenon-orthanc", "--format",
         '{{range .Mounts}}{{if eq .Destination "/var/lib/orthanc/db"}}{{.Source}}{{end}}{{end}}'],
        capture_output=True, text=True,
    )
    data_path = result.stdout.strip()
    if not data_path:
        print("  ✗ Cannot determine Orthanc data path")
        sys.exit(1)

    index_path = Path(data_path) / "index"
    if not index_path.exists():
        print(f"  ✗ SQLite index not found at {index_path}")
        sys.exit(1)

    index_size = index_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ SQLite index: {index_path} ({index_size:.0f} MB)")

    # Start temp SQLite Orthanc (read-only mount)
    print("  → Starting temporary SQLite-indexed Orthanc...")
    if not start_temp_orthanc(data_path):
        sys.exit(1)

    try:
        sqlite_stats = get_stats(SQLITE_PORT)
        total_instances = sqlite_stats["CountInstances"]
        total_studies = sqlite_stats["CountStudies"]
        total_patients = sqlite_stats["CountPatients"]
        print(f"  ✓ SQLite Orthanc: {total_instances:,} instances, {total_studies:,} studies, {total_patients:,} patients")

        if args.dry_run:
            print(f"\n  Would migrate: {total_instances:,} instances ({total_studies:,} studies)")
            return

        # Work study-by-study to avoid SQLite timeouts on large queries
        print(f"  → Fetching study list ({total_studies:,} studies)...")
        all_studies = get_json(SQLITE_PORT, "/studies")
        print(f"  ✓ Retrieved {len(all_studies):,} study IDs")

        # Migrate study-by-study with parallel instance transfers
        print(f"  → Migrating with {args.workers} workers...")
        print()

        migrated = 0
        failed = 0
        studies_done = 0
        start_time = time.time()

        for study_id in all_studies:
            studies_done += 1
            # Get instances for this study (small query — typically 50-500 instances)
            try:
                study_instances = get_json(SQLITE_PORT, f"/studies/{study_id}/instances")
            except Exception:
                # Retry once
                time.sleep(1)
                try:
                    study_instances = get_json(SQLITE_PORT, f"/studies/{study_id}/instances")
                except Exception:
                    failed += 1
                    continue

            instance_ids = [inst["ID"] for inst in study_instances]

            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = {executor.submit(migrate_instance, iid): iid for iid in instance_ids}
                for future in as_completed(futures):
                    _, success = future.result()
                    if success:
                        migrated += 1
                    else:
                        failed += 1

            # Progress every 10 studies
            if studies_done % 10 == 0 or studies_done == len(all_studies):
                elapsed = time.time() - start_time
                total_done = migrated + failed
                rate = total_done / max(elapsed, 1)
                remaining_instances = total_instances - total_done
                eta_s = remaining_instances / max(rate, 0.01)
                if eta_s > 3600:
                    eta = f"{eta_s/3600:.1f}h"
                elif eta_s > 60:
                    eta = f"{eta_s/60:.0f}m"
                else:
                    eta = f"{eta_s:.0f}s"
                pct = total_done / total_instances * 100
                print(f"  → Study {studies_done:,}/{len(all_studies):,} | {total_done:,}/{total_instances:,} instances ({pct:.1f}%) — {rate:.0f}/sec — ETA: {eta} — failed: {failed}")

        # Final stats
        elapsed = time.time() - start_time
        pg_final = get_stats(PG_PORT)

        print()
        print("═" * 60)
        print(f"  Source (SQLite):    {total_instances:,} instances / {total_studies:,} studies")
        print(f"  Target (PG):       {pg_final['CountInstances']:,} instances / {pg_final['CountStudies']:,} studies")
        print(f"  Migrated:          {migrated:,} instances")
        if failed:
            print(f"  Failed:            {failed:,} instances")
        print(f"  Duration:          {elapsed/60:.1f} minutes ({migrated/max(elapsed,1):.0f} instances/sec)")
        print("═" * 60)
        print()

        if pg_final["CountInstances"] >= total_instances:
            print(f"  ✓ Migration complete! Safe to delete SQLite index:")
            print(f"    rm {index_path}")
        else:
            diff = total_instances - pg_final["CountInstances"]
            print(f"  ⚠ {diff:,} instances not yet migrated. Re-run to retry (duplicates are skipped).")

    finally:
        print("  → Stopping temp container...")
        stop_temp_orthanc()
        print("  ✓ Done")


if __name__ == "__main__":
    main()
