#!/usr/bin/env python3
"""
OHDSI Corpus Text Extractor -- Prepare PDFs for Abby Training
=============================================================
After running the harvester, use this to extract text from PDFs
and produce a training-ready JSONL corpus.

Requirements:
    pip install pymupdf   (or: pip install fitz)

Usage:
    python extract_corpus.py --input ohdsi_corpus --output abby_training_corpus.jsonl
"""

import json
import os
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("corpus_extractor")

try:
    import fitz  # pymupdf
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    log.warning("pymupdf not installed. Install with: pip install pymupdf")


def extract_text_pymupdf(pdf_path: str) -> str:
    """Extract text from a PDF using pymupdf."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text("text")
    doc.close()
    return text.strip()


def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks for training."""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        # Try to break at a paragraph or sentence boundary
        if end < len(text):
            # Look for paragraph break
            para_break = text.rfind("\n\n", start + chunk_size // 2, end)
            if para_break > start:
                end = para_break + 2
            else:
                # Look for sentence end
                sent_break = max(
                    text.rfind(". ", start + chunk_size // 2, end),
                    text.rfind(".\n", start + chunk_size // 2, end),
                )
                if sent_break > start:
                    end = sent_break + 2

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap

    return chunks


def load_metadata(corpus_dir: str) -> dict:
    """Load paper metadata from the harvester state files."""
    meta_dir = Path(corpus_dir) / "metadata"
    papers_by_path = {}

    # Try to load the most recent state
    for phase in ["phase5", "phase4", "phase3", "phase2", "phase1"]:
        state_file = meta_dir / f"state_{phase}.json"
        if state_file.exists():
            with open(state_file) as f:
                state = json.load(f)
            for paper in state.get("papers", []):
                if paper.get("pdf_path"):
                    papers_by_path[paper["pdf_path"]] = paper
            log.info(f"Loaded metadata from {state_file}: {len(papers_by_path)} papers with PDFs")
            break

    return papers_by_path


def main():
    parser = argparse.ArgumentParser(description="Extract text from OHDSI corpus PDFs")
    parser.add_argument("--input", default="ohdsi_corpus", help="Corpus directory")
    parser.add_argument("--output", default="abby_training_corpus.jsonl", help="Output JSONL file")
    parser.add_argument("--chunk-size", type=int, default=2000, help="Chunk size in chars")
    parser.add_argument("--overlap", type=int, default=200, help="Chunk overlap in chars")
    parser.add_argument("--min-length", type=int, default=100, help="Min text length to include")
    parser.add_argument("--format", choices=["jsonl", "json"], default="jsonl",
                       help="Output format")
    args = parser.parse_args()

    if not HAS_PYMUPDF:
        log.error("pymupdf is required. Install with: pip install pymupdf")
        sys.exit(1)

    pdf_dir = Path(args.input) / "pdfs"
    if not pdf_dir.exists():
        log.error(f"PDF directory not found: {pdf_dir}")
        sys.exit(1)

    # Load metadata
    metadata = load_metadata(args.input)

    # Process PDFs
    pdfs = list(pdf_dir.glob("*.pdf"))
    log.info(f"Found {len(pdfs)} PDFs to process")

    documents = []
    total_chunks = 0
    errors = 0

    for i, pdf_path in enumerate(sorted(pdfs)):
        if (i + 1) % 50 == 0:
            log.info(f"  Processing {i+1}/{len(pdfs)}...")

        try:
            text = extract_text_pymupdf(str(pdf_path))

            if len(text) < args.min_length:
                log.debug(f"Skipping {pdf_path.name}: too short ({len(text)} chars)")
                continue

            # Get metadata if available
            meta = metadata.get(str(pdf_path), {})
            
            chunks = chunk_text(text, args.chunk_size, args.overlap)
            total_chunks += len(chunks)

            for j, chunk in enumerate(chunks):
                doc = {
                    "text": chunk,
                    "metadata": {
                        "source": "ohdsi_corpus",
                        "title": meta.get("title", pdf_path.stem),
                        "doi": meta.get("doi"),
                        "pmid": meta.get("pmid"),
                        "year": meta.get("year"),
                        "chunk_index": j,
                        "total_chunks": len(chunks),
                        "filename": pdf_path.name,
                        "extracted_at": datetime.now().isoformat(),
                    },
                }
                documents.append(doc)

        except Exception as e:
            log.warning(f"Error processing {pdf_path.name}: {e}")
            errors += 1

    # Write output
    output_path = Path(args.output)
    if args.format == "jsonl":
        with open(output_path, "w") as f:
            for doc in documents:
                f.write(json.dumps(doc) + "\n")
    else:
        with open(output_path, "w") as f:
            json.dump(documents, f, indent=2)

    log.info(f"\n=== Extraction Complete ===")
    log.info(f"PDFs processed: {len(pdfs) - errors}")
    log.info(f"Errors: {errors}")
    log.info(f"Total chunks: {total_chunks}")
    log.info(f"Output: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
