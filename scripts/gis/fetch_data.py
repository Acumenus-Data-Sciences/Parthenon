#!/usr/bin/env python3
"""Download external GIS datasets for Parthenon use cases.

Usage:
    python scripts/gis/fetch_data.py --fetch          # Download all datasets
    python scripts/gis/fetch_data.py --fetch --only svi  # Download specific dataset
    python scripts/gis/fetch_data.py --check           # Check which datasets exist locally
"""

import argparse
import os
import sys
import zipfile
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"

DATASETS = {
    "tiger_tracts": {
        "url": "https://www2.census.gov/geo/tiger/TIGER2020/TRACT/tl_2020_42_tract.zip",
        "dir": "tiger",
        "filename": "tl_2020_42_tract.zip",
        "description": "PA Census Tract Shapefiles (2020)",
    },
    "tiger_counties": {
        "url": "https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip",
        "dir": "tiger",
        "filename": "tl_2020_us_county.zip",
        "description": "US County Shapefiles (2020) — filtered to PA",
    },
    "svi": {
        "url": "https://data.cdc.gov/api/views/4d8n-kk8a/rows.csv?accessType=DOWNLOAD",
        "dir": "svi",
        "filename": "SVI_2020_US.csv",
        "description": "CDC Social Vulnerability Index (2020)",
    },
    "crosswalk": {
        "url": "https://www.huduser.gov/portal/datasets/usps/TRACT_ZIP_032020.xlsx",
        "dir": "crosswalk",
        "filename": "TRACT_ZIP_032020.xlsx",
        "description": "HUD ZIP-Tract Crosswalk (Q1 2020)",
    },
    "rucc": {
        "url": "https://www.ers.usda.gov/webdocs/DataFiles/53251/ruralurbancodes2013.csv",
        "dir": "rucc",
        "filename": "ruralurbancodes2013.csv",
        "description": "USDA Rural-Urban Continuum Codes (2013)",
    },
    "aqs": {
        "url": "https://aqs.epa.gov/aqsweb/airdata/annual_conc_by_monitor_2020.zip",
        "dir": "aqs",
        "filename": "annual_conc_by_monitor_2020.zip",
        "description": "EPA Air Quality System Annual Data (2020)",
    },
    "hospitals": {
        "url": "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?limit=5000&offset=0&format=csv",
        "dir": "hospitals",
        "filename": "Hospital_General_Information.csv",
        "description": "CMS Hospital General Information",
    },
}


def download_dataset(key: str, force: bool = False) -> bool:
    """Download a single dataset. Returns True if successful."""
    ds = DATASETS[key]
    target_dir = BASE_DIR / ds["dir"]
    target_file = target_dir / ds["filename"]

    if target_file.exists() and not force:
        print(f"  SKIP {key}: {target_file} already exists (use --force to re-download)")
        return True

    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"  DOWNLOADING {key}: {ds['description']}")
    print(f"    URL: {ds['url']}")

    try:
        resp = requests.get(ds["url"], stream=True, timeout=120)
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0

        with open(target_file, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = int(100 * downloaded / total)
                    print(f"\r    Progress: {pct}% ({downloaded // 1024}KB / {total // 1024}KB)", end="")
        print(f"\n    SAVED: {target_file} ({target_file.stat().st_size // 1024}KB)")

        # Unzip if needed
        if target_file.suffix == ".zip":
            print(f"    EXTRACTING: {target_file}")
            with zipfile.ZipFile(target_file, "r") as zf:
                zf.extractall(target_dir)
            print(f"    EXTRACTED to {target_dir}")

        return True
    except Exception as e:
        print(f"\n    ERROR: {e}")
        if target_file.exists():
            target_file.unlink()
        return False


def check_datasets():
    """Report which datasets exist locally."""
    print("Dataset Status:")
    for key, ds in DATASETS.items():
        target = BASE_DIR / ds["dir"] / ds["filename"]
        status = "FOUND" if target.exists() else "MISSING"
        size = f"({target.stat().st_size // 1024}KB)" if target.exists() else ""
        print(f"  [{status}] {key}: {ds['description']} {size}")


def main():
    parser = argparse.ArgumentParser(description="Download GIS datasets for Parthenon use cases")
    parser.add_argument("--fetch", action="store_true", help="Download datasets from source URLs")
    parser.add_argument("--check", action="store_true", help="Check which datasets exist locally")
    parser.add_argument("--only", type=str, help="Download only this dataset (comma-separated)")
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    if args.check:
        check_datasets()
        return

    if not args.fetch:
        parser.print_help()
        return

    keys = args.only.split(",") if args.only else list(DATASETS.keys())
    invalid = [k for k in keys if k not in DATASETS]
    if invalid:
        print(f"Unknown datasets: {invalid}. Valid: {list(DATASETS.keys())}")
        sys.exit(1)

    print(f"Downloading {len(keys)} datasets to {BASE_DIR}")
    results = {}
    for key in keys:
        results[key] = download_dataset(key, force=args.force)

    failed = [k for k, v in results.items() if not v]
    if failed:
        print(f"\nFailed: {failed}")
        sys.exit(1)
    print(f"\nAll {len(keys)} datasets ready.")


if __name__ == "__main__":
    main()
