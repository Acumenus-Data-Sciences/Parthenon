"""External document adapter for markdown, text, and PDF ingestion."""

from __future__ import annotations

import re
from pathlib import Path

import fitz

from app.wiki.adapters.base import PreparedSource, slugify

# Junk patterns that should never be a title
_JUNK_PATTERNS = re.compile(
    r"^("
    r"page\s*\d|"
    r"\d+\s*$|"
    r"since\s+january|"
    r"free\s+information|"
    r"elsevier|springer|wiley|"
    r"research\s+article|"
    r"original\s+article|"
    r"international\s+journal|"
    r"background\s*:?\s*$|"
    r"systems-level|"
    r"slide\s+\d|"
    r"candidate\s+pharmacovigilance|"
    r"background\s+color\s+codes|"
    r"OP-[A-Z]+\d|"
    r"doi:|"
    r"http|"
    r"www\.|"
    r"\d{4}\s+(IEEE|ACM)|"
    r"copyright\s|"
    r"all\s+rights\s+reserved|"
    r"accepted\s+\d|"
    r"received\s+\d|"
    r"published\s+\d|"
    r"article\s+in\s+press|"
    r"provisional|"
    r"arxiv:|"
    r"arXiv:\d|"
    r"\d+\.\s+the\s+covid|"
    r"redcap\s+to\s+omop\s*$|"
    r"readme\.md\s*$|"
    r"untitled\s*$"
    r")",
    re.IGNORECASE,
)

_MIN_TITLE_LEN = 8
_MAX_TITLE_LEN = 120


class ExternalDocumentAdapter:
    """Prepare source text for wiki ingestion."""

    def prepare_source(
        self,
        *,
        filename: str | None,
        content_bytes: bytes | None,
        raw_content: str | None,
        title: str | None,
    ) -> PreparedSource:
        if not filename and not raw_content:
            raise ValueError("Either filename or raw_content is required for wiki ingestion.")

        inferred_filename = filename or f"{slugify(title or 'source')}.txt"
        suffix = Path(inferred_filename).suffix.lower()
        source_type = {
            ".md": "markdown",
            ".markdown": "markdown",
            ".txt": "text",
            ".pdf": "pdf",
        }.get(suffix, "text")

        if raw_content is not None:
            content = raw_content.strip()
        elif source_type == "pdf":
            if content_bytes is None:
                raise ValueError("PDF ingestion requires uploaded bytes.")
            content = self._extract_pdf_text(content_bytes)
        else:
            if content_bytes is None:
                raise ValueError("Uploaded source bytes are required.")
            content = content_bytes.decode("utf-8", errors="ignore").strip()

        # Use explicit title if provided, otherwise extract intelligently
        if title:
            resolved_title = title.strip()
        elif source_type == "pdf" and content_bytes:
            resolved_title = self._extract_pdf_title(content_bytes, content)
        else:
            resolved_title = self._resolve_title(inferred_filename, content)

        slug = slugify(resolved_title)
        stored_filename = f"{slug}{suffix or '.txt'}"
        return PreparedSource(
            title=resolved_title,
            slug=slug,
            source_type=source_type,
            content=content,
            original_filename=inferred_filename,
            stored_filename=stored_filename,
            metadata={"suffix": suffix or ".txt"},
        )

    def _extract_pdf_title(self, content_bytes: bytes, content: str) -> str:
        """Extract best title from PDF using metadata, font analysis, and content."""
        doc = fitz.open(stream=content_bytes, filetype="pdf")
        try:
            # Strategy 1: PDF metadata title (most reliable when present)
            meta_title = (doc.metadata.get("title") or "").strip()
            if self._is_good_title(meta_title):
                return meta_title[:_MAX_TITLE_LEN]

            # Strategy 2: Largest font text on page 1 (works for academic papers)
            if doc.page_count > 0:
                largest_title = self._largest_font_text(doc[0])
                if self._is_good_title(largest_title):
                    return largest_title[:_MAX_TITLE_LEN]

            # Strategy 3: First meaningful line from extracted text
            return self._resolve_title("", content)
        finally:
            doc.close()

    def _largest_font_text(self, page: fitz.Page) -> str:
        """Find the largest-font text on a page, combining spans on the same line."""
        blocks = page.get_text("dict")["blocks"]
        largest_size = 0.0
        candidates: list[tuple[float, str]] = []

        for block in blocks:
            for line_data in block.get("lines", []):
                spans = line_data.get("spans", [])
                if not spans:
                    continue
                max_span_size = max(s["size"] for s in spans)
                line_text = " ".join(s["text"].strip() for s in spans if s["text"].strip())
                if line_text and max_span_size > largest_size:
                    largest_size = max_span_size
                    candidates = [(max_span_size, line_text)]
                elif line_text and max_span_size == largest_size:
                    candidates.append((max_span_size, line_text))

        if not candidates:
            return ""

        # For posters with huge fonts (>40pt), the title may be fragmented
        # across multiple lines — join them
        if largest_size > 40 and len(candidates) > 1:
            combined = " ".join(text for _, text in candidates[:3])
            return combined.strip()

        return candidates[0][1].strip()

    def _is_good_title(self, title: str) -> bool:
        """Check if a candidate title is meaningful."""
        if not title or len(title) < _MIN_TITLE_LEN:
            return False
        if _JUNK_PATTERNS.search(title):
            return False
        # Pure numbers, single words, or generic labels
        if title.replace(" ", "").isdigit():
            return False
        return True

    def _resolve_title(self, filename: str, content: str) -> str:
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                candidate = stripped[2:].strip()
                if self._is_good_title(candidate):
                    return candidate[:_MAX_TITLE_LEN]
            if stripped and self._is_good_title(stripped):
                return stripped[:_MAX_TITLE_LEN]
        # Last resort: filename
        return Path(filename).stem.replace("-", " ").replace("_", " ").strip().title() or "Untitled"

    def _extract_pdf_text(self, content_bytes: bytes) -> str:
        document = fitz.open(stream=content_bytes, filetype="pdf")
        try:
            pages = [page.get_text("text").strip() for page in document]
        finally:
            document.close()
        return "\n\n".join(page for page in pages if page).strip()
