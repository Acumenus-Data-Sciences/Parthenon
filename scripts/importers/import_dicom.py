#!/usr/bin/env python3
"""
Parthenon DICOM Local Import Tool
==================================
Scans a directory of DICOM files, extracts metadata with pydicom, and
POSTs to the Parthenon imaging import API to populate imaging_studies,
imaging_series, and imaging_instances tables.

Usage:
    python3 tools/import_dicom.py --dir dicom_samples/Class-3-malocclusion/...
    python3 tools/import_dicom.py --dir dicom_samples/ --source-id 1

Requirements:
    pip install pydicom requests
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import pydicom
import requests


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def get_str(ds, tag, default=''):
    try:
        val = getattr(ds, tag, None)
        if val is None:
            return default
        if hasattr(val, 'original_string'):  # PersonName VR
            return str(val)
        return str(val).strip()
    except Exception:
        return default


def get_float(ds, tag, default=None):
    try:
        val = getattr(ds, tag, None)
        if val is None:
            return default
        return float(val)
    except Exception:
        return default


def get_int(ds, tag, default=None):
    try:
        val = getattr(ds, tag, None)
        if val is None:
            return default
        return int(val)
    except Exception:
        return default


def parse_study_date(raw):
    """Convert DICOM date YYYYMMDD to ISO 8601 YYYY-MM-DD."""
    if raw and len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return None


def is_dicom(path):
    """Check DICOM magic bytes (offset 128, 4 bytes = 'DICM')."""
    try:
        with open(path, 'rb') as f:
            f.seek(128)
            return f.read(4) == b'DICM'
    except Exception:
        return False


def scan_dicom_files(root_dir):
    """Walk a directory tree and return all DICOM file paths."""
    dicom_files = []
    root = Path(root_dir)
    for p in root.rglob('*'):
        if p.is_file() and is_dicom(p):
            dicom_files.append(p)
    return dicom_files


# ──────────────────────────────────────────────────────────────────────────────
# Build study/series/instance tree
# ──────────────────────────────────────────────────────────────────────────────

def build_tree(dicom_files, repo_root):
    """
    Returns:
        studies: dict[study_uid -> study_info]
        series:  dict[series_uid -> series_info]
        instances: list[instance_info]
    """
    studies = {}
    series = {}
    instances = []

    for file_path in dicom_files:
        try:
            ds = pydicom.dcmread(str(file_path), stop_before_pixels=True)
        except Exception as e:
            print(f"  WARN: cannot read {file_path.name}: {e}", file=sys.stderr)
            continue

        study_uid = get_str(ds, 'StudyInstanceUID')
        series_uid = get_str(ds, 'SeriesInstanceUID')
        sop_uid = get_str(ds, 'SOPInstanceUID')

        if not study_uid or not series_uid or not sop_uid:
            print(f"  WARN: missing required UIDs in {file_path.name}", file=sys.stderr)
            continue

        # File path relative to repo root for serving
        try:
            rel_path = str(file_path.relative_to(repo_root))
        except ValueError:
            rel_path = str(file_path)

        # ── Study ──────────────────────────────────────────────────────────
        if study_uid not in studies:
            raw_pixel_spacing = getattr(ds, 'PixelSpacing', None)
            ps_str = None
            if raw_pixel_spacing is not None:
                try:
                    ps_str = '\\'.join(str(v) for v in raw_pixel_spacing)
                except Exception:
                    pass

            studies[study_uid] = {
                'study_instance_uid': study_uid,
                'modality': get_str(ds, 'Modality') or None,
                'body_part_examined': get_str(ds, 'BodyPartExamined') or None,
                'study_description': get_str(ds, 'StudyDescription') or None,
                'referring_physician': get_str(ds, 'ReferringPhysicianName') or None,
                'study_date': parse_study_date(get_str(ds, 'StudyDate')),
                'accession_number': get_str(ds, 'AccessionNumber') or None,
                'patient_name_dicom': get_str(ds, 'PatientName') or None,
                'patient_id_dicom': get_str(ds, 'PatientID') or None,
                'institution_name': get_str(ds, 'InstitutionName') or None,
                'file_dir': str(file_path.parent.relative_to(repo_root)),
                'status': 'indexed',
            }

        # ── Series ─────────────────────────────────────────────────────────
        if series_uid not in series:
            rows = get_int(ds, 'Rows')
            cols = get_int(ds, 'Columns')
            rows_x_cols = f"{rows}x{cols}" if rows and cols else None

            raw_ps = getattr(ds, 'PixelSpacing', None)
            pixel_spacing = None
            if raw_ps is not None:
                try:
                    pixel_spacing = '\\'.join(str(v) for v in raw_ps)
                except Exception:
                    pass

            series[series_uid] = {
                'study_instance_uid': study_uid,
                'series_instance_uid': series_uid,
                'series_description': get_str(ds, 'SeriesDescription') or None,
                'modality': get_str(ds, 'Modality') or None,
                'body_part_examined': get_str(ds, 'BodyPartExamined') or None,
                'series_number': get_int(ds, 'SeriesNumber'),
                'slice_thickness_mm': get_float(ds, 'SliceThickness'),
                'manufacturer': get_str(ds, 'Manufacturer') or None,
                'manufacturer_model': get_str(ds, 'ManufacturerModelName') or None,
                'pixel_spacing': pixel_spacing,
                'rows_x_cols': rows_x_cols,
                'kvp': get_str(ds, 'KVP') or None,
                'file_dir': str(file_path.parent.relative_to(repo_root)),
                '_instance_count': 0,
            }

        series[series_uid]['_instance_count'] += 1

        # ── Instance ───────────────────────────────────────────────────────
        instances.append({
            'study_instance_uid': study_uid,
            'series_instance_uid': series_uid,
            'sop_instance_uid': sop_uid,
            'sop_class_uid': get_str(ds, 'SOPClassUID') or None,
            'instance_number': get_int(ds, 'InstanceNumber'),
            'slice_location': get_float(ds, 'SliceLocation'),
            'file_path': rel_path,
        })

    # Set num_images on series
    for uid, ser in series.items():
        ser['num_images'] = ser.pop('_instance_count')

    # Set num_series + num_images on studies
    series_by_study = defaultdict(list)
    for uid, ser in series.items():
        series_by_study[ser['study_instance_uid']].append(ser)

    for study_uid, study in studies.items():
        study_series = series_by_study.get(study_uid, [])
        study['num_series'] = len(study_series)
        study['num_images'] = sum(s['num_images'] for s in study_series)

    return studies, series, instances


# ──────────────────────────────────────────────────────────────────────────────
# API call
# ──────────────────────────────────────────────────────────────────────────────

def import_to_api(base_url, token, source_id, studies, series, instances):
    url = f"{base_url.rstrip('/')}/api/v1/imaging/import-local"
    payload = {
        'source_id': source_id,
        'studies': list(studies.values()),
        'series': list(series.values()),
        'instances': instances,
    }
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}',
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=120)
    if resp.status_code not in (200, 201):
        print(f"ERROR {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        sys.exit(1)
    return resp.json()


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Import DICOM files into Parthenon')
    parser.add_argument('--dir', required=True, help='Directory containing DICOM files')
    parser.add_argument('--source-id', type=int, default=1, help='Parthenon source_id (default: 1)')
    parser.add_argument('--url', default='https://parthenon.acumenus.net', help='Base URL')
    parser.add_argument('--token', default='', help='Sanctum API token (or set PARTHENON_TOKEN env)')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, do not POST to API')
    args = parser.parse_args()

    token = args.token or os.environ.get('PARTHENON_TOKEN', '')
    if not token and not args.dry_run:
        print("ERROR: --token or PARTHENON_TOKEN env var required", file=sys.stderr)
        sys.exit(1)

    scan_dir = Path(args.dir).resolve()
    if not scan_dir.is_dir():
        print(f"ERROR: directory not found: {scan_dir}", file=sys.stderr)
        sys.exit(1)

    repo_root = Path(__file__).parent.parent.resolve()  # tools/ -> repo root

    print(f"Scanning {scan_dir} ...")
    dicom_files = scan_dicom_files(scan_dir)
    print(f"Found {len(dicom_files)} DICOM files")

    if not dicom_files:
        print("No DICOM files found. Done.")
        return

    print("Parsing metadata...")
    studies, series, instances = build_tree(dicom_files, repo_root)

    print(f"  Studies:   {len(studies)}")
    print(f"  Series:    {len(series)}")
    print(f"  Instances: {len(instances)}")

    for uid, st in studies.items():
        print(f"\n  Study {uid[:30]}...")
        print(f"    Modality: {st.get('modality')}, Date: {st.get('study_date')}")
        print(f"    Patient: {st.get('patient_name_dicom')} / {st.get('patient_id_dicom')}")
        print(f"    {st.get('num_series')} series, {st.get('num_images')} images")

    if args.dry_run:
        print("\nDry run — not posting to API.")
        return

    print(f"\nPosting to {args.url} (source_id={args.source_id})...")
    result = import_to_api(args.url, token, args.source_id, studies, series, instances)
    print("Import complete:")
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
