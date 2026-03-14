#!/usr/bin/env python3
"""
HADES Package Vignettes Scraper
================================
Downloads vignettes (tutorial documentation) from all OHDSI HADES R packages.

HADES = Health Analytics Data-to-Evidence Suite
These are the actual analytical tools researchers use.

Source: https://github.com/OHDSI/<package>/vignettes/
Key packages: CohortMethod, PatientLevelPrediction, CohortGenerator,
              Achilles, DataQualityDashboard, FeatureExtraction, etc.

Quality filters:
- Only pulls from current default branch (not archived versions)
- Strips R code chunks but keeps explanatory text
- Tags each chunk with package name and vignette title
- Skips test/internal vignettes
"""

import json
import logging
import os
import re
import sys
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("hades_scraper")

OUTPUT_DIR = Path("hades_vignettes")
API_BASE = "https://api.github.com"

# Core HADES packages — these are the ones researchers actually use
HADES_PACKAGES = [
    # Population-Level Estimation
    "CohortMethod",
    "SelfControlledCaseSeries",
    "SelfControlledCohort",
    "EvidenceSynthesis",
    # Patient-Level Prediction
    "PatientLevelPrediction",
    "DeepPatientLevelPrediction",
    # Characterization
    "CohortIncidence",
    "Characterization",
    # Cohort Building
    "CohortGenerator",
    "Capr",
    "CirceR",
    "PhenotypeLibrary",
    "PheValuator",
    # Data Quality
    "Achilles",
    "DataQualityDashboard",
    "CdmInspection",
    # Feature Extraction
    "FeatureExtraction",
    "Andromeda",
    # CDM / ETL
    "CommonDataModel",
    "Eunomia",
    "ETL-Synthea",
    # Infrastructure
    "DatabaseConnector",
    "SqlRender",
    "ParallelLogger",
    "ResultModelManager",
    "OhdsiShinyModules",
    "ROhdsiWebApi",
    "Strategus",
    "Hades",
    "KeyringR",
]


def get_vignette_files(package: str) -> list[dict]:
    """List vignette files (.Rmd, .md) from a HADES package repo."""
    url = f"{API_BASE}/repos/OHDSI/{package}/contents/vignettes"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 404:
            # Some packages use 'inst/doc' or don't have vignettes
            return []
        resp.raise_for_status()

        files = []
        for item in resp.json():
            if isinstance(item, dict) and item.get("type") == "file":
                name = item.get("name", "")
                if name.endswith((".Rmd", ".md", ".Rmarkdown")):
                    # Skip internal/test vignettes
                    if any(skip in name.lower() for skip in ["test", "internal", "temp", "draft"]):
                        continue
                    files.append({
                        "name": name,
                        "download_url": item["download_url"],
                        "path": item["path"],
                    })
        return files
    except Exception as e:
        log.warning("Failed to list vignettes for %s: %s", package, e)
        return []


def get_readme(package: str) -> str | None:
    """Download README.md from a package repo."""
    for readme_name in ["README.md", "Readme.md", "readme.md"]:
        url = f"https://raw.githubusercontent.com/OHDSI/{package}/main/{readme_name}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                return resp.text
        except Exception:
            pass

        # Try master branch
        url = f"https://raw.githubusercontent.com/OHDSI/{package}/master/{readme_name}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                return resp.text
        except Exception:
            pass

    return None


def clean_rmd(text: str) -> str:
    """Clean R Markdown: remove code chunks, keep explanatory text."""
    # Remove R code chunks
    text = re.sub(r'```\{r[^}]*\}.*?```', '', text, flags=re.DOTALL)
    text = re.sub(r'```\{.*?\}.*?```', '', text, flags=re.DOTALL)
    # Remove HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    # Remove YAML frontmatter
    text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', text, flags=re.DOTALL)
    # Collapse blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_title(text: str, filename: str) -> str:
    """Extract title from vignette content."""
    # Check YAML frontmatter first
    yaml_match = re.search(r'^---\s*\n.*?title:\s*["\']?(.+?)["\']?\s*\n.*?---', text, re.DOTALL)
    if yaml_match:
        return yaml_match.group(1).strip().strip('"').strip("'")

    # First heading
    heading_match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()

    # Fallback to filename
    return filename.replace('.Rmd', '').replace('.md', '').replace('-', ' ').replace('_', ' ').title()


def get_package_last_updated(package: str) -> str | None:
    """Get the last commit date for a package repo."""
    url = f"{API_BASE}/repos/OHDSI/{package}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("pushed_at", "")[:10]  # YYYY-MM-DD
    except Exception:
        pass
    return None


def main():
    log.info("HADES Vignettes Scraper — Starting")
    log.info("Packages to scan: %d", len(HADES_PACKAGES))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_results = []
    total_chars = 0

    for pkg_idx, package in enumerate(HADES_PACKAGES):
        log.info("[%d/%d] Scanning: %s", pkg_idx + 1, len(HADES_PACKAGES), package)
        time.sleep(0.5)  # GitHub rate limit

        pkg_dir = OUTPUT_DIR / package
        pkg_dir.mkdir(exist_ok=True)

        last_updated = get_package_last_updated(package)

        # Get README
        readme = get_readme(package)
        if readme:
            clean = clean_rmd(readme)
            if len(clean) > 200:
                output_file = pkg_dir / "README.md"
                output_file.write_text(clean, encoding="utf-8")
                all_results.append({
                    "package": package,
                    "filename": "README.md",
                    "title": f"{package} — Overview",
                    "char_count": len(clean),
                    "source": "hades_readme",
                    "last_updated": last_updated,
                    "priority": "high",
                })
                total_chars += len(clean)

        # Get vignettes
        vignettes = get_vignette_files(package)
        if not vignettes:
            log.info("  No vignettes found")
            continue

        log.info("  Found %d vignettes", len(vignettes))

        for vig in vignettes:
            time.sleep(0.3)
            try:
                resp = requests.get(vig["download_url"], timeout=30)
                resp.raise_for_status()
                raw = resp.text

                title = extract_title(raw, vig["name"])
                clean = clean_rmd(raw)

                if len(clean) < 200:
                    continue

                output_file = pkg_dir / vig["name"].replace(".Rmd", ".md").replace(".Rmarkdown", ".md")
                output_file.write_text(clean, encoding="utf-8")

                all_results.append({
                    "package": package,
                    "filename": vig["name"],
                    "title": title,
                    "char_count": len(clean),
                    "source": "hades_vignette",
                    "last_updated": last_updated,
                    "priority": "high",
                })
                total_chars += len(clean)

                log.info("    Saved: %s (%d chars) — %s", output_file.name, len(clean), title)

            except Exception as e:
                log.warning("    Error: %s — %s", vig["name"], e)

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "source": "HADES Package Vignettes",
            "packages_scanned": len(HADES_PACKAGES),
            "files": all_results,
            "total_files": len(all_results),
            "total_chars": total_chars,
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, f, indent=2)

    log.info("=== Complete ===")
    log.info("Files saved: %d across %d packages", len(all_results), len(HADES_PACKAGES))
    log.info("Total text: %d chars (%.1f MB)", total_chars, total_chars / 1_000_000)


if __name__ == "__main__":
    main()
