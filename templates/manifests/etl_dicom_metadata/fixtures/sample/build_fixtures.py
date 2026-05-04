"""Stage a tiny DICOM corpus from pydicom's bundled test data.

Run from repo root::

    uv run --project templates python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py

Output: ``templates/manifests/etl_dicom_metadata/fixtures/sample/dicom/``
"""

from __future__ import annotations

from pathlib import Path

from pydicom.data import get_testdata_files

OUT = Path(__file__).resolve().parent / "dicom"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("CT_small.dcm", "MR_small.dcm", "OT-PAL-8-face.dcm"):
        for src in get_testdata_files(name):
            dest = OUT / Path(src).name
            dest.write_bytes(Path(src).read_bytes())
    files = sorted(p.name for p in OUT.glob("*.dcm"))
    print(f"staged {len(files)} fixture DICOMs to {OUT}: {files}")


if __name__ == "__main__":
    main()
