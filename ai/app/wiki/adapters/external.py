"""External document adapter for markdown, text, and PDF ingestion."""

from __future__ import annotations

from pathlib import Path

import fitz

from app.wiki.adapters.base import PreparedSource, slugify


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

        resolved_title = title or self._resolve_title(inferred_filename, content)
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

    def _resolve_title(self, filename: str, content: str) -> str:
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                return stripped[2:].strip()
            if stripped:
                return stripped[:80]
        return Path(filename).stem.replace("-", " ").replace("_", " ").strip().title()

    def _extract_pdf_text(self, content_bytes: bytes) -> str:
        document = fitz.open(stream=content_bytes, filetype="pdf")
        try:
            pages = [page.get_text("text").strip() for page in document]
        finally:
            document.close()
        return "\n\n".join(page for page in pages if page).strip()

