#!/usr/bin/env python3
"""
Medical Textbook Selective Ingestion
====================================
Extracts text from curated medical textbooks and prepares them
for ingestion into Abby's ohdsi_papers ChromaDB collection.

Active scope for Abby:
  - Epidemiology
  - Biostatistics
  - Longitudinal methods
  - Clinical trials
  - Systematic reviews
  - Preventive medicine
  - Cell biology
  - Molecular biology
  - Genetics

Skips: broad clinical textbooks already covered elsewhere, anatomy atlases,
surgery texts, molecular/basic science texts, virology/microbiology references,
physics/math, healthcare operations, and image-heavy references.
"""

import json
import logging
import os
import re
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("textbook_ingest")

try:
    import fitz  # pymupdf
except ImportError:
    log.error("pymupdf required. Install with: pip install pymupdf")
    sys.exit(1)

OUTPUT_DIR = Path("medical_textbooks_extracted")
TEXTS_DIR = Path("Medical Texts")

# High-value textbooks for Abby (NL → OMOP cohort translation).
# Patterns match against filenames — all regex, case-insensitive.
# Duplicates are handled by title: first match wins, subsequent files skipped.
HIGH_VALUE_BOOKS = [
    # ── TIER 1: Core domain ─────────────────────────────────────────────────
    {
        "pattern": r"TheBookOfOhdsi|Book.of.OHDSI",
        "title": "The Book of OHDSI",
        "category": "ohdsi_methodology",
        "priority": "critical",
        "tier": 1,
    },
    {
        "pattern": r"Guyton.and.Hall",
        "title": "Guyton and Hall Textbook of Medical Physiology",
        "category": "physiology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Vinay.Kumar.*Abbas.*Aster|Kumar.*Abbas.*Aster.*Robb",
        "title": "Robbins and Cotran Pathologic Basis of Disease",
        "category": "pathology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Papadakis.*McPhee",
        "title": "Current Medical Diagnosis and Treatment",
        "category": "clinical_medicine",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Karen.Whalen.*Lippincott|Lippincott.Illustrated.Reviews",
        "title": "Lippincott Illustrated Reviews: Pharmacology",
        "category": "pharmacology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Geoffrey.M..Cooper.*The.Cell|The.Cell.A.Molecular.Approach",
        "title": "The Cell: A Molecular Approach",
        "category": "cell_biology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Harvey.Lodish.*Arnold.Berk|Molecular.Cell.Biology",
        "title": "Molecular Cell Biology",
        "category": "cell_biology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"D..Peter.Snustad.*Michael.J..Simmons|Principles.of.Genetics",
        "title": "Principles of Genetics",
        "category": "genetics",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"James.D..Watson.*Tania.A..Baker|Molecular.Biology.of.the.Gene",
        "title": "Molecular Biology of the Gene",
        "category": "molecular_biology",
        "priority": "high",
        "tier": 1,
    },
    {
        "pattern": r"Jocelyn.E..Krebs.*Goldstein|Lewin.?s.GENES",
        "title": "Lewin's GENES XII",
        "category": "genetics",
        "priority": "high",
        "tier": 1,
    },
    # ── TIER 2: Clinical breadth ─────────────────────────────────────────────
    {
        "pattern": r"Kim.E..Barrett.*Barman|Kim.E..Barrett.*Ganong",
        "title": "Ganong's Review of Medical Physiology",
        "category": "physiology",
        "priority": "high",
        "tier": 2,
    },
    {
        "pattern": r"Jean.Louis.Vincent.*Abraham|Vincent.*Abraham.*Patrick",
        "title": "Textbook of Critical Care",
        "category": "critical_care",
        "priority": "high",
        "tier": 2,
    },
    {
        "pattern": r"DeVita.*Rosenberg|Vincent.T..DeVita",
        "title": "DeVita, Hellman, and Rosenberg's Cancer: Principles & Practice of Oncology",
        "category": "oncology",
        "priority": "high",
        "tier": 2,
    },
    {
        "pattern": r"Parks.Textbook.of.Preventive|K..Park.*Preventive",
        "title": "Park's Textbook of Preventive and Social Medicine",
        "category": "preventive_medicine",
        "priority": "high",
        "tier": 2,
    },
    {
        "pattern": r"Kliegman.*Marcdante.*Nelson|Kliegman.*Nelson.e",
        "title": "Nelson Essentials of Pediatrics",
        "category": "pediatrics",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Hutchisons|Michael.Glynn.*Drake",
        "title": "Hutchison's Clinical Methods",
        "category": "clinical_medicine",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"250.cases.in.clinical|R..R.Baliga.*250",
        "title": "250 Cases in Clinical Medicine",
        "category": "clinical_medicine",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Sonpal.*August.*Fischer",
        "title": "Master the Boards: Internal Medicine",
        "category": "clinical_medicine",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Radiology.101|Wilbur.L..Smith.*Radiology",
        "title": "Radiology 101: The Basics and Fundamentals of Imaging",
        "category": "radiology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Goldberger.*A\.L|Goldberger.*Clinical.Electrocardiography",
        "title": "Goldberger's Clinical Electrocardiography",
        "category": "cardiology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Abbas.*Lichtman",
        "title": "Cellular and Molecular Immunology",
        "category": "immunology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Peter.J..Delves.*Martin|Delves.*Martin.*Dennis",
        "title": "Roitt's Essential Immunology",
        "category": "immunology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Mendelsohn.*Howley",
        "title": "The Molecular Basis of Cancer",
        "category": "oncology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Butterfield.*Kaufman|Lisa.H..Butterfield",
        "title": "Cancer Immunotherapy Principles and Practice",
        "category": "oncology",
        "priority": "medium",
        "tier": 2,
    },
    {
        "pattern": r"Pecorino.*Molecular.Biology.of.Cancer",
        "title": "Molecular Biology of Cancer",
        "category": "oncology",
        "priority": "medium",
        "tier": 2,
    },
    # ── TIER 3: Epidemiology & methodology ───────────────────────────────────
    {
        "pattern": r"Cochrane.Hand|Julian.P.T.Higgins",
        "title": "Cochrane Handbook for Systematic Reviews of Interventions",
        "category": "systematic_reviews",
        "priority": "high",
        "tier": 3,
    },
    {
        "pattern": r"Kestenbaum.*Epidemiology|Bryan.Kestenbaum",
        "title": "Epidemiology and Biostatistics: An Introduction to Clinical Research",
        "category": "epidemiology",
        "priority": "high",
        "tier": 3,
    },
    {
        "pattern": r"Biostatistical.Methods.in.Epidemiology|Stephen.C..Newman",
        "title": "Biostatistical Methods in Epidemiology",
        "category": "biostatistics",
        "priority": "high",
        "tier": 3,
    },
    {
        "pattern": r"Applied.Longitudinal.Data|Jos.W..R..Twisk",
        "title": "Applied Longitudinal Data Analysis",
        "category": "biostatistics",
        "priority": "high",
        "tier": 3,
    },
    {
        "pattern": r"Tom.Brody.*Clinical.Trials|Clinical.Trials.*Second.Edition",
        "title": "Clinical Trials: Study Design, Endpoints and Biomarkers",
        "category": "clinical_trials",
        "priority": "high",
        "tier": 3,
    },
    {
        "pattern": r"Marcello.Pagano.*Gauvreau|Pagano.*Principle.*Biostatistics",
        "title": "Principles of Biostatistics",
        "category": "biostatistics",
        "priority": "high",
        "tier": 3,
    },
    # ── TIER 4: Infectious disease (selective) ───────────────────────────────
    {
        "pattern": r"Knipe.*Fields.Virology|Fields.Virology.*Knipe",
        "title": "Fields Virology",
        "category": "virology",
        "priority": "high",
        "tier": 4,
    },
    {
        "pattern": r"J.Flint.*Racaniello|Flint.*Rall.*Skalka.*Principles.of.Virology",
        "title": "Principles of Virology",
        "category": "virology",
        "priority": "high",
        "tier": 4,
    },
    {
        "pattern": r"Essential.Human.Virology|Jennifer.Louten",
        "title": "Essential Human Virology",
        "category": "virology",
        "priority": "medium",
        "tier": 4,
    },
    {
        "pattern": r"Handbook.of.COVID.19.Prevention|COVID.19.Prevention.and.Treatment.*Zhejiang",
        "title": "Handbook of COVID-19 Prevention and Treatment",
        "category": "infectious_disease",
        "priority": "medium",
        "tier": 4,
    },
    {
        "pattern": r"Introduction.to.Clinical.Infectious.Diseases|Joseph.Domachowske",
        "title": "Introduction to Clinical Infectious Diseases: A Problem-Based Approach",
        "category": "infectious_disease",
        "priority": "medium",
        "tier": 4,
    },
    {
        "pattern": r"Infectious.Diseases.*Microbiology.*Virology.*QA|Moore.*Hatcher.*Infectious",
        "title": "Infectious Diseases, Microbiology and Virology: A QA Approach",
        "category": "infectious_disease",
        "priority": "medium",
        "tier": 4,
    },
    {
        "pattern": r"Joanne.Willey.*Sherwood|Prescott.*Microbiology|Willey.*Sherwood.*Woolverton",
        "title": "Prescott's Microbiology",
        "category": "microbiology",
        "priority": "medium",
        "tier": 4,
    },
    {
        "pattern": r"Stephen.Gillespie.*Hawkey|Principles.of.Medical.Microbiology.*Gillespie",
        "title": "Principles of Medical Microbiology",
        "category": "microbiology",
        "priority": "medium",
        "tier": 4,
    },
]

# Final active allowlist. Abby benefits most from methods-oriented references
# that complement OHDSI materials without drowning retrieval in broad textbooks.
ACTIVE_CATEGORIES = {
    "epidemiology",
    "biostatistics",
    "clinical_trials",
    "systematic_reviews",
    "preventive_medicine",
    "cell_biology",
    "molecular_biology",
    "genetics",
}

# Max pages to extract per book (prevents runaway on 3000+ page tomes)
MAX_PAGES = 1500


def match_book(filename: str) -> dict | None:
    """Match a filename against the curated keep set."""
    for book in HIGH_VALUE_BOOKS:
        if (
            book["category"] in ACTIVE_CATEGORIES
            and re.search(book["pattern"], filename, re.IGNORECASE)
        ):
            return book
    return None


def extract_text_from_pdf(pdf_path: Path, max_pages: int = MAX_PAGES) -> str:
    """Extract text from a PDF, skipping image-heavy pages."""
    doc = fitz.open(str(pdf_path))
    pages_to_process = min(len(doc), max_pages)
    text_parts = []

    for i in range(pages_to_process):
        page = doc[i]
        page_text = page.get_text("text")

        # Skip pages with very little text (likely images/figures)
        if len(page_text.strip()) < 50:
            continue

        # Skip table of contents / index pages (lots of dots/numbers)
        dot_ratio = page_text.count('.') / max(len(page_text), 1)
        if dot_ratio > 0.15 and len(page_text) < 2000:
            continue

        text_parts.append(page_text)

    doc.close()
    return "\n\n".join(text_parts).strip()


def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks at paragraph/sentence boundaries."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            # Try paragraph break
            para_break = text.rfind("\n\n", start + chunk_size // 2, end)
            if para_break > start:
                end = para_break + 2
            else:
                # Try sentence end
                sent_break = max(
                    text.rfind(". ", start + chunk_size // 2, end),
                    text.rfind(".\n", start + chunk_size // 2, end),
                )
                if sent_break > start:
                    end = sent_break + 2

        chunk = text[start:end].strip()
        if chunk and len(chunk) >= 100:
            chunks.append(chunk)
        start = end - overlap

    return chunks


def main():
    log.info("Medical Textbook Selective Extraction — Starting")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not TEXTS_DIR.exists():
        log.error("Medical Texts directory not found: %s", TEXTS_DIR)
        sys.exit(1)

    pdf_files = sorted(TEXTS_DIR.glob("*.pdf"))
    log.info("Found %d PDF files in %s", len(pdf_files), TEXTS_DIR)

    matched = []
    skipped = []
    seen_titles: set[str] = set()

    for pdf in sorted(pdf_files):
        book = match_book(pdf.name)
        if book:
            if book["title"] in seen_titles:
                log.info("  Dedup skip (already matched): %s", pdf.name)
                skipped.append(pdf.name)
            else:
                matched.append((pdf, book))
                seen_titles.add(book["title"])
        else:
            skipped.append(pdf.name)

    log.info("Matched %d high-value books, skipping %d", len(matched), len(skipped))

    results = []
    total_chunks = 0
    total_chars = 0

    for i, (pdf_path, book_meta) in enumerate(matched):
        log.info("[%d/%d] Extracting: %s", i + 1, len(matched), book_meta["title"])
        log.info("  File: %s (%.0f MB)", pdf_path.name, pdf_path.stat().st_size / 1_000_000)

        try:
            text = extract_text_from_pdf(pdf_path)

            if len(text) < 500:
                log.warning("  Skipping: too little extractable text (%d chars)", len(text))
                continue

            chunks = chunk_text(text)
            log.info("  Extracted %d chars, %d chunks", len(text), len(chunks))

            # Save as JSONL for the ingestion pipeline
            safe_name = re.sub(r'[^\w\-.]', '_', book_meta["title"][:80])
            output_file = OUTPUT_DIR / f"{safe_name}.jsonl"

            with open(output_file, "w") as f:
                for j, chunk in enumerate(chunks):
                    doc = {
                        "text": chunk,
                        "metadata": {
                            "source": "medical_textbook",
                            "title": book_meta["title"],
                            "category": book_meta["category"],
                            "priority": book_meta["priority"],
                            "tier": book_meta.get("tier", 3),
                            "chunk_index": j,
                            "total_chunks": len(chunks),
                            "filename": pdf_path.name,
                        },
                    }
                    f.write(json.dumps(doc) + "\n")

            results.append({
                "title": book_meta["title"],
                "category": book_meta["category"],
                "priority": book_meta["priority"],
                "tier": book_meta.get("tier", 3),
                "filename": pdf_path.name,
                "output_file": str(output_file),
                "char_count": len(text),
                "chunk_count": len(chunks),
                "file_size_mb": round(pdf_path.stat().st_size / 1_000_000, 1),
            })

            total_chunks += len(chunks)
            total_chars += len(text)

        except Exception as e:
            log.warning("  Error extracting %s: %s", pdf_path.name, e)

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "source": "Medical Reference Textbooks",
            "total_books": len(results),
            "total_chunks": total_chunks,
            "total_chars": total_chars,
            "skipped_books": len(skipped),
            "books": results,
            "category_distribution": {},
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, f, indent=2)

    # Category summary
    cat_counts: dict[str, int] = {}
    for r in results:
        cat = r["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    log.info("")
    log.info("=== Extraction Complete ===")
    log.info("Books processed: %d / %d matched", len(results), len(matched))
    log.info("Total text: %d chars (%.1f MB)", total_chars, total_chars / 1_000_000)
    log.info("Total chunks: %d", total_chunks)
    log.info("Categories: %s", dict(sorted(cat_counts.items())))
    log.info("Output: %s", OUTPUT_DIR)
    log.info("")
    log.info("Next step: ingest into ChromaDB via API or add to ingestion pipeline")


if __name__ == "__main__":
    main()
