#!/usr/bin/env python3
"""Check Parthenon HADES package targets against upstream metadata.

Modes:
- latest: compare target versions in Parthenon source to OHDSI r-universe or
  upstream DESCRIPTION metadata.
- lock: compare target versions to the configured HADES release renv.lock.

The script is networked by default because it is meant for scheduled CI. Use
`--write-targets` only from the drift workflow; it patches both the Darkstar R
inventory and Laravel normalization map while preserving the current package
order.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
R_INVENTORY = ROOT / "darkstar/api/hades_packages.R"
PHP_CONTROLLER = ROOT / "backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php"
DEFAULT_LOCK_URL = "https://raw.githubusercontent.com/OHDSI/Hades/refs/heads/main/hadesWideReleases/2026Q1/renv.lock"
TARGET_SOURCE = "Automated OHDSI upstream metadata refresh"

INSTALL_NAME_OVERRIDES = {
    "KEEPER": "Keeper",
    "ETLSyntheaBuilder": "ETLSyntheaBuilder",
}

GITHUB_DESCRIPTION_FALLBACKS = {
    "BigKnn": ["OHDSI/BigKnn"],
    "BrokenAdaptiveRidge": ["OHDSI/BrokenAdaptiveRidge"],
    "CohortDiagnostics": ["OHDSI/CohortDiagnostics"],
    "CohortIncidence": ["OHDSI/CohortIncidence"],
    "CohortMethod": ["OHDSI/CohortMethod"],
    "DeepPatientLevelPrediction": ["OHDSI/DeepPatientLevelPrediction"],
    "EnsemblePatientLevelPrediction": ["OHDSI/EnsemblePatientLevelPrediction"],
    "EvidenceSynthesis": ["OHDSI/EvidenceSynthesis"],
    "IterativeHardThresholding": ["OHDSI/IterativeHardThresholding"],
    "PatientLevelPrediction": ["OHDSI/PatientLevelPrediction"],
    "PheValuator": ["OHDSI/PheValuator"],
    "SelfControlledCaseSeries": ["OHDSI/SelfControlledCaseSeries"],
    "SelfControlledCohort": ["OHDSI/SelfControlledCohort"],
    "Strategus": ["OHDSI/Strategus"],
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["latest", "lock"], default="latest")
    parser.add_argument("--lock-url", default=DEFAULT_LOCK_URL)
    parser.add_argument("--report", type=Path, default=ROOT / "output/hades-version-report.md")
    parser.add_argument("--json", dest="json_path", type=Path, default=ROOT / "output/hades-version-report.json")
    parser.add_argument("--write-targets", action="store_true")
    parser.add_argument("--no-fail", action="store_true", help="Always exit 0; useful before create-pull-request.")
    args = parser.parse_args()

    targets = read_r_targets(R_INVENTORY.read_text())
    upstream = fetch_latest_versions(targets) if args.mode == "latest" else fetch_lock_versions(args.lock_url, targets)
    rows = build_rows(targets, upstream)
    drift = [row for row in rows if row["status"] in {"behind", "ahead", "missing_upstream"}]

    report = render_report(args.mode, rows, args.lock_url if args.mode == "lock" else None)
    write_text(args.report, report)
    write_text(args.json_path, json.dumps({"mode": args.mode, "drift_count": len(drift), "packages": rows}, indent=2) + "\n")

    if args.write_targets and args.mode == "latest":
        updated_targets = {row["package"]: row["upstream_version"] or row["target_version"] for row in rows}
        patch_targets(updated_targets)

    if drift and not args.no_fail:
        return 1

    return 0


def read_r_targets(source: str) -> dict[str, str]:
    match = re.search(r"\.OHDSI_TARGET_VERSIONS\s*<-\s*c\((.*?)\n\)", source, re.S)
    if not match:
        raise RuntimeError("Could not find .OHDSI_TARGET_VERSIONS in darkstar inventory.")

    targets: dict[str, str] = {}
    for name, version in re.findall(r"^\s*([A-Za-z0-9_.]+)\s*=\s*\"([^\"]+)\"", match.group(1), re.M):
        targets[name] = version

    if not targets:
        raise RuntimeError("HADES target version map is empty.")

    return targets


def fetch_latest_versions(targets: dict[str, str]) -> dict[str, str | None]:
    versions: dict[str, str | None] = {}
    for package in targets:
        install_name = INSTALL_NAME_OVERRIDES.get(package, package)
        versions[package] = fetch_r_universe_version(install_name) or fetch_github_description_version(package)
    return versions


def fetch_r_universe_version(package: str) -> str | None:
    url = f"https://ohdsi.r-universe.dev/api/packages/{package}"
    try:
        payload = json.loads(http_get(url))
    except (RuntimeError, json.JSONDecodeError):
        return None

    version = payload.get("Version") or payload.get("version")
    return str(version) if version else None


def fetch_github_description_version(package: str) -> str | None:
    for repo in GITHUB_DESCRIPTION_FALLBACKS.get(package, []):
        for branch in ("main", "master"):
            url = f"https://raw.githubusercontent.com/{repo}/refs/heads/{branch}/DESCRIPTION"
            try:
                description = http_get(url)
            except RuntimeError:
                continue

            match = re.search(r"^Version:\s*([^\s]+)", description, re.M)
            if match:
                return match.group(1)

    return None


def fetch_lock_versions(lock_url: str, targets: dict[str, str]) -> dict[str, str | None]:
    lock = json.loads(http_get(lock_url))
    packages = lock.get("Packages", {})
    versions: dict[str, str | None] = {}

    for package in targets:
        install_name = INSTALL_NAME_OVERRIDES.get(package, package)
        record = packages.get(install_name) or packages.get(package) or {}
        version = record.get("Version")
        versions[package] = str(version) if version else None

    return versions


def build_rows(targets: dict[str, str], upstream: dict[str, str | None]) -> list[dict[str, str | None]]:
    rows = []
    for package, target_version in targets.items():
        upstream_version = upstream.get(package)
        rows.append(
            {
                "package": package,
                "target_version": target_version,
                "upstream_version": upstream_version,
                "status": version_status(target_version, upstream_version),
            }
        )

    return rows


def version_status(target_version: str, upstream_version: str | None) -> str:
    if not upstream_version:
        return "missing_upstream"

    target_parts = version_parts(target_version)
    upstream_parts = version_parts(upstream_version)
    if target_parts == upstream_parts:
        return "current"
    if target_parts < upstream_parts:
        return "behind"
    return "ahead"


def version_parts(value: str) -> tuple[tuple[int, int | str], ...]:
    parts: list[tuple[int, int | str]] = []
    for part in re.split(r"[.\-+_]", value):
        if part.isdigit():
            parts.append((0, int(part)))
        else:
            parts.append((1, part))
    return tuple(parts)


def render_report(mode: str, rows: list[dict[str, str | None]], lock_url: str | None = None) -> str:
    now = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()
    drift = [row for row in rows if row["status"] != "current"]
    title = "HADES Latest Target Drift" if mode == "latest" else "HADES Stable Release Lock Parity"
    lines = [
        f"# {title}",
        "",
        f"Generated: {now}",
        f"Mode: `{mode}`",
    ]
    if lock_url:
        lines.append(f"Lock URL: {lock_url}")
    lines.extend(
        [
            f"Packages checked: {len(rows)}",
            f"Drift count: {len(drift)}",
            "",
            "| Package | Target | Upstream / Lock | Status |",
            "| --- | --- | --- | --- |",
        ]
    )
    for row in rows:
        lines.append(
            f"| `{row['package']}` | `{row['target_version']}` | `{row['upstream_version'] or 'n/a'}` | `{row['status']}` |"
        )
    lines.append("")
    return "\n".join(lines)


def patch_targets(targets: dict[str, str]) -> None:
    today = dt.date.today().isoformat()
    patch_r_inventory(targets, today)
    patch_php_controller(targets, today)


def patch_r_inventory(targets: dict[str, str], checked_at: str) -> None:
    source = R_INVENTORY.read_text()
    source = re.sub(
        r'\.OHDSI_TARGET_VERSION_CHECKED_AT <- "[^"]+"',
        f'.OHDSI_TARGET_VERSION_CHECKED_AT <- "{checked_at}"',
        source,
    )
    source = re.sub(
        r'\.OHDSI_TARGET_VERSION_SOURCE <- "[^"]+"',
        f'.OHDSI_TARGET_VERSION_SOURCE <- "{TARGET_SOURCE}"',
        source,
    )
    source = replace_r_map(source, targets)
    R_INVENTORY.write_text(source)


def patch_php_controller(targets: dict[str, str], checked_at: str) -> None:
    source = PHP_CONTROLLER.read_text()
    source = re.sub(
        r"private const TARGET_VERSION_CHECKED_AT = '[^']+';",
        f"private const TARGET_VERSION_CHECKED_AT = '{checked_at}';",
        source,
    )
    source = re.sub(
        r"private const TARGET_VERSION_SOURCE = '[^']+';",
        f"private const TARGET_VERSION_SOURCE = '{TARGET_SOURCE}';",
        source,
    )
    source = replace_php_map(source, targets)
    PHP_CONTROLLER.write_text(source)


def replace_r_map(source: str, targets: dict[str, str]) -> str:
    body = "\n".join(f'  {name} = "{version}",' for name, version in targets.items())
    body = body.rstrip(",")
    return re.sub(r"\.OHDSI_TARGET_VERSIONS\s*<-\s*c\((.*?)\n\)", f".OHDSI_TARGET_VERSIONS <- c(\n{body}\n)", source, flags=re.S)


def replace_php_map(source: str, targets: dict[str, str]) -> str:
    body = "\n".join(f"        '{name}' => '{version}'," for name, version in targets.items())
    return re.sub(r"private const TARGET_VERSIONS = \[(.*?)\n    \];", f"private const TARGET_VERSIONS = [\n{body}\n    ];", source, flags=re.S)


def http_get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Parthenon-HADES-version-check/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not fetch {url}: {exc}") from exc


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


if __name__ == "__main__":
    sys.exit(main())
