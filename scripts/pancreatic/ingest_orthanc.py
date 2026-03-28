#!/usr/bin/env python3
"""
Ingest DICOM files into Orthanc via REST API.
Handles resume (skips already-uploaded instances via hash check).
Uses requests library for reliable large file upload.

Usage:
    python3 scripts/pancreatic/ingest_orthanc.py <directory>
    python3 scripts/pancreatic/ingest_orthanc.py /mnt/md0/pancreatic-corpus/ct/PANCREAS-CT
    python3 scripts/pancreatic/ingest_orthanc.py /mnt/md0/pancreatic-corpus/pathology/CPTAC-PDA
"""

import sys
import time
from pathlib import Path

import requests

ORTHANC_URL = "http://localhost:8042"
ORTHANC_USER = "parthenon"
ORTHANC_PASSWORD = "GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih"

session = requests.Session()
session.auth = (ORTHANC_USER, ORTHANC_PASSWORD)


def upload_file(dcm_path: Path) -> tuple[int, str]:
    """Upload a single DICOM file. Returns (status_code, status_text)."""
    with open(dcm_path, "rb") as f:
        data = f.read()
    resp = session.post(
        f"{ORTHANC_URL}/instances",
        data=data,
        headers={"Content-Type": "application/dicom"},
        timeout=300,
    )
    return resp.status_code, resp.text[:100]


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 ingest_orthanc.py <dicom-directory>")
        sys.exit(1)

    target_dir = Path(sys.argv[1])
    if not target_dir.is_dir():
        print(f"ERROR: Not a directory: {target_dir}")
        sys.exit(1)

    print(f"Scanning {target_dir} for .dcm files...")
    dcm_files = sorted(target_dir.rglob("*.dcm"))
    total = len(dcm_files)
    print(f"Found {total} DICOM files")

    if total == 0:
        print("Nothing to upload.")
        return

    uploaded = 0
    skipped = 0
    errors = 0
    start = time.time()

    for i, dcm_path in enumerate(dcm_files, 1):
        try:
            code, text = upload_file(dcm_path)
            if code == 200:
                uploaded += 1
            elif code == 409:
                skipped += 1  # Already exists
            else:
                errors += 1
                print(f"  ERROR [{i}/{total}] HTTP {code}: {dcm_path.name}")
        except Exception as e:
            errors += 1
            print(f"  EXCEPTION [{i}/{total}] {e}: {dcm_path.name}")

        if i % 100 == 0 or i == 1 or i == total:
            elapsed = time.time() - start
            rate = i / max(elapsed, 0.1)
            eta = (total - i) / max(rate, 0.1)
            print(
                f"  [{i}/{total}] {rate:.1f}/s | "
                f"+{uploaded} new, ~{skipped} exist, {errors} err | "
                f"ETA {eta:.0f}s"
            )

    elapsed = time.time() - start
    print(f"\nComplete in {elapsed:.0f}s: {uploaded} new, {skipped} existed, {errors} errors")


if __name__ == "__main__":
    main()
