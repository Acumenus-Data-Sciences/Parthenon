#!/usr/bin/env python3
"""
Book of OHDSI Scraper
=====================
Downloads the Book of OHDSI chapters from the OHDSI GitHub repo.
The book is the canonical reference for OMOP CDM, study design,
and analytical methods.

Source: https://github.com/OHDSI/TheBookOfOhdsi
Format: R Markdown (.Rmd) chapters

Quality filters:
- Strips R code blocks (not useful for knowledge retrieval)
- Preserves methodology text, definitions, and examples
- Adds chapter metadata for retrieval context
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
log = logging.getLogger("book_scraper")

OUTPUT_DIR = Path("book_of_ohdsi")
REPO = "OHDSI/TheBookOfOhdsi"
BRANCH = "master"
API_BASE = "https://api.github.com"


def get_chapter_files() -> list[dict]:
    """List all .Rmd chapter files from the repo."""
    url = f"{API_BASE}/repos/{REPO}/contents"
    resp = requests.get(url, params={"ref": BRANCH}, timeout=30)
    resp.raise_for_status()

    chapters = []
    for item in resp.json():
        if item["name"].endswith(".Rmd") and item["type"] == "file":
            chapters.append({
                "name": item["name"],
                "download_url": item["download_url"],
                "path": item["path"],
            })

    # Sort by filename (they're numbered: 01-xxx.Rmd, 02-xxx.Rmd, etc.)
    chapters.sort(key=lambda c: c["name"])
    return chapters


def clean_rmd_content(text: str) -> str:
    """Clean R Markdown content for knowledge extraction.

    - Removes R code chunks (```{r ...} ... ```)
    - Removes LaTeX-heavy equations (keeps simple inline math)
    - Preserves markdown structure, definitions, methodology text
    - Strips HTML comments
    """
    # Remove R code chunks
    text = re.sub(r'```\{r[^}]*\}.*?```', '', text, flags=re.DOTALL)

    # Remove generic code blocks that are R-specific
    text = re.sub(r'```\{.*?\}.*?```', '', text, flags=re.DOTALL)

    # Remove HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # Remove figure references like \@ref(fig:xxx)
    text = re.sub(r'\\@ref\([^)]+\)', '', text)

    # Remove knitr/bookdown directives
    text = re.sub(r'\{#[^}]+\}', '', text)

    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def extract_chapter_title(text: str, filename: str) -> str:
    """Extract chapter title from Rmd content."""
    # Look for first # heading
    match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
    if match:
        title = match.group(1).strip()
        # Remove bookdown cross-ref syntax
        title = re.sub(r'\{[^}]+\}', '', title).strip()
        return title

    # Fall back to filename
    name = filename.replace('.Rmd', '').replace('-', ' ')
    # Remove leading number
    name = re.sub(r'^\d+\s*', '', name)
    return name.title()


def main():
    log.info("Book of OHDSI Scraper — Starting")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    chapters = get_chapter_files()
    log.info("Found %d chapter files", len(chapters))

    results = []
    for i, chapter in enumerate(chapters):
        log.info("[%d/%d] Downloading: %s", i + 1, len(chapters), chapter["name"])
        time.sleep(0.5)  # Be polite to GitHub API

        try:
            resp = requests.get(chapter["download_url"], timeout=30)
            resp.raise_for_status()
            raw_text = resp.text

            # Clean and extract
            clean_text = clean_rmd_content(raw_text)
            title = extract_chapter_title(raw_text, chapter["name"])

            if len(clean_text) < 100:
                log.warning("  Skipping %s: too short after cleaning", chapter["name"])
                continue

            # Extract chapter number from filename
            chapter_num_match = re.match(r'(\d+)', chapter["name"])
            chapter_num = int(chapter_num_match.group(1)) if chapter_num_match else i

            # Save cleaned markdown
            output_file = OUTPUT_DIR / chapter["name"].replace(".Rmd", ".md")
            output_file.write_text(clean_text, encoding="utf-8")

            results.append({
                "filename": chapter["name"],
                "title": title,
                "chapter_number": chapter_num,
                "char_count": len(clean_text),
                "source": "book_of_ohdsi",
                "source_url": f"https://ohdsi.github.io/TheBookOfOhdsi/{chapter['name'].replace('.Rmd', '.html')}",
                "priority": "high",  # Canonical reference
            })

            log.info("  Saved: %s (%d chars) — %s", output_file.name, len(clean_text), title)

        except Exception as e:
            log.warning("  Error downloading %s: %s", chapter["name"], e)

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "source": "Book of OHDSI",
            "repo": f"https://github.com/{REPO}",
            "chapters": results,
            "total_chars": sum(r["char_count"] for r in results),
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, f, indent=2)

    log.info("=== Complete ===")
    log.info("Chapters saved: %d", len(results))
    log.info("Total text: %d chars", sum(r["char_count"] for r in results))
    log.info("Manifest: %s", manifest_path)


if __name__ == "__main__":
    main()
