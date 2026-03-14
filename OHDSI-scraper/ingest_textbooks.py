#!/usr/bin/env python3
"""
Medical Textbook Selective Ingestion
====================================
Extracts text from high-value medical textbooks and prepares them
for ingestion into Abby's ohdsi_papers ChromaDB collection.

Only processes textbooks directly relevant to outcomes research:
- Epidemiology & biostatistics
- Pharmacology
- Pathology & pathophysiology
- Clinical trials & systematic reviews
- Medical physiology
- Healthcare operations & HEOR

Skips anatomy atlases, surgery texts, basic science, physics/math,
and image-heavy references that produce poor text extraction.
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

# High-value textbooks for outcomes research — substring matches against filenames
HIGH_VALUE_BOOKS = [
    {
        "pattern": "Cochrane-Hand",
        "title": "Cochrane Handbook for Systematic Reviews of Interventions",
        "category": "systematic_reviews",
        "priority": "high",
    },
    {
        "pattern": "Kestenbaum",
        "title": "Epidemiology and Biostatistics: An Introduction to Clinical Research",
        "category": "epidemiology",
        "priority": "high",
    },
    {
        "pattern": "Biostatistical-Methods-in-Epidemiology",
        "title": "Biostatistical Methods in Epidemiology",
        "category": "biostatistics",
        "priority": "high",
    },
    {
        "pattern": "Applied-Longitudinal-Data-Ana",
        "title": "Applied Longitudinal Data Analysis",
        "category": "biostatistics",
        "priority": "high",
    },
    {
        "pattern": "Clinical-Trials",
        "title": "Clinical Trials: Study Design, Endpoints and Biomarkers",
        "category": "clinical_trials",
        "priority": "high",
    },
    {
        "pattern": "Pagano.*Principle",
        "title": "Principles of Biostatistics",
        "category": "biostatistics",
        "priority": "high",
    },
    {
        "pattern": "Storytelling-with-Dat",
        "title": "Storytelling with Data",
        "category": "data_visualization",
        "priority": "medium",
    },
    {
        "pattern": "Guyton-and-Hall",
        "title": "Guyton and Hall Textbook of Medical Physiology",
        "category": "physiology",
        "priority": "high",
    },
    {
        "pattern": "Robb.*Kumar.*Abbas.*Aster",
        "title": "Robbins Pathologic Basis of Disease",
        "category": "pathology",
        "priority": "high",
    },
    {
        "pattern": "Lippincott.*Pharmacology",
        "title": "Lippincott Illustrated Reviews: Pharmacology",
        "category": "pharmacology",
        "priority": "high",
    },
    {
        "pattern": "Abbas.*Lichtman",
        "title": "Cellular and Molecular Immunology",
        "category": "immunology",
        "priority": "medium",
    },
    {
        "pattern": "COVID-19-Prevention-and-Treatment",
        "title": "Handbook of COVID-19 Prevention and Treatment",
        "category": "infectious_disease",
        "priority": "medium",
    },
    {
        "pattern": "Patient-Flow",
        "title": "Patient Flow: Reducing Delay in Healthcare Delivery",
        "category": "healthcare_operations",
        "priority": "medium",
    },
    {
        "pattern": "PROCESS-REDESIGN",
        "title": "Process Redesign for Health Care Using Lean Thinking",
        "category": "healthcare_operations",
        "priority": "medium",
    },
    {
        "pattern": "Human-factors-in-healthcare",
        "title": "Human Factors in Healthcare",
        "category": "healthcare_operations",
        "priority": "medium",
    },
    {
        "pattern": "Nurse-Led-Health",
        "title": "Nurse-Led Health Clinics: Operations, Policy, and Opportunities",
        "category": "healthcare_operations",
        "priority": "low",
    },
    {
        "pattern": "Leadership-for-Smooth-Patient",
        "title": "Leadership for Smooth Patient Flow",
        "category": "healthcare_operations",
        "priority": "medium",
    },
    {
        "pattern": "Goldberger.*A.L",
        "title": "Goldberger's Clinical Electrocardiography",
        "category": "cardiology",
        "priority": "medium",
    },
    {
        "pattern": "Interpreting-Che",
        "title": "Interpreting Chest X-Rays",
        "category": "diagnostics",
        "priority": "low",
    },
    {
        "pattern": "Delves.*Martin.*Roitt",
        "title": "Roitt's Essential Immunology",
        "category": "immunology",
        "priority": "medium",
    },
    {
        "pattern": "Kim-E.-Barrett.*Ganong",
        "title": "Ganong's Review of Medical Physiology",
        "category": "physiology",
        "priority": "medium",
    },
    {
        "pattern": "Papadakis.*McPhee",
        "title": "Current Medical Diagnosis and Treatment",
        "category": "clinical_medicine",
        "priority": "high",
    },
    {
        "pattern": "Hutchisons",
        "title": "Hutchison's Clinical Methods",
        "category": "clinical_medicine",
        "priority": "medium",
    },
    {
        "pattern": "250-cases-in-clinical",
        "title": "250 Cases in Clinical Medicine",
        "category": "clinical_medicine",
        "priority": "medium",
    },
    {
        "pattern": "Parks-Textbook-of-Preventive",
        "title": "Park's Textbook of Preventive and Social Medicine",
        "category": "preventive_medicine",
        "priority": "high",
    },
    {
        "pattern": "Nelson-e.*Kliegman",
        "title": "Nelson Essentials of Pediatrics",
        "category": "pediatrics",
        "priority": "medium",
    },
    {
        "pattern": "Rodwell.*Bender.*Harper",
        "title": "Harper's Illustrated Biochemistry",
        "category": "biochemistry",
        "priority": "low",
    },
    {
        "pattern": "DeVita.*Rosenberg.*Cancer",
        "title": "DeVita, Hellman, and Rosenberg's Cancer",
        "category": "oncology",
        "priority": "high",
    },
    {
        "pattern": "Mendelsohn.*Howley.*Molecular-Biology.*Cancer",
        "title": "The Molecular Basis of Cancer",
        "category": "oncology",
        "priority": "medium",
    },
    {
        "pattern": "Butterfield.*Cancer-Immunotherapy",
        "title": "Cancer Immunotherapy Principles and Practice",
        "category": "oncology",
        "priority": "medium",
    },
    {
        "pattern": "Pecorino.*Molecular-Biology-of-Cancer",
        "title": "Molecular Biology of Cancer",
        "category": "oncology",
        "priority": "medium",
    },
    {
        "pattern": "atlas-of-clinical-diagnosis",
        "title": "Atlas of Clinical Diagnosis",
        "category": "clinical_medicine",
        "priority": "low",
    },
    {
        "pattern": "Sonpal.*August.*Fischer",
        "title": "Master the Boards: Internal Medicine",
        "category": "clinical_medicine",
        "priority": "medium",
    },
    {
        "pattern": "Karl-Disque.*ACLS",
        "title": "Advanced Cardiac Life Support Provider Manual",
        "category": "emergency_medicine",
        "priority": "low",
    },
    {
        "pattern": "Radiology-101",
        "title": "Radiology 101: The Basics and Fundamentals of Imaging",
        "category": "radiology",
        "priority": "medium",
    },
    {
        "pattern": "Conti.*Netter.*Cardiovascular",
        "title": "Netter Collection: Cardiovascular System",
        "category": "cardiology",
        "priority": "medium",
    },
    {
        "pattern": "Vincent.*Abraham.*Textbook.*Critical-Care",
        "title": "Textbook of Critical Care",
        "category": "critical_care",
        "priority": "medium",
    },
]

# Max pages to extract per book (prevents runaway on 3000+ page tomes)
MAX_PAGES = 1500


def match_book(filename: str) -> dict | None:
    """Match a filename against the high-value book patterns."""
    for book in HIGH_VALUE_BOOKS:
        if re.search(book["pattern"], filename, re.IGNORECASE):
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

    for pdf in pdf_files:
        book = match_book(pdf.name)
        if book:
            matched.append((pdf, book))
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
