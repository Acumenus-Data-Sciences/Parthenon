"""Core wiki engine for ingest, browse, query, and lint operations."""

from __future__ import annotations

import json
import re
import hashlib
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import logging

import httpx

logger = logging.getLogger(__name__)
_MAX_PAGE_SLUG_LENGTH = 120

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)
# Qwen3 often omits the opening <think> tag but includes the closing one
_THINK_CLOSE_RE = re.compile(r"^.*?</think>\s*", re.DOTALL)


def _strip_think_blocks(text: str) -> str:
    """Remove reasoning blocks from model output (handles both tagged and untagged patterns)."""
    # First try standard <think>...</think> blocks
    cleaned = _THINK_RE.sub("", text)
    # Then handle Qwen3 pattern: reasoning text followed by bare </think>
    if "</think>" in cleaned:
        cleaned = _THINK_CLOSE_RE.sub("", cleaned)
    return cleaned.strip()

from app.config import settings
from app.wiki.adapters.base import PreparedSource, build_frontmatter, extract_wikilinks, parse_markdown_page, slugify
from app.wiki.adapters.external import ExternalDocumentAdapter
from app.wiki.git_ops import WORKSPACE_PAGE_DIRS, ensure_workspace_structure, init_wiki_repo, list_branches, wiki_commit
from app.wiki.index_ops import IndexEntry, read_index, search_index, upsert_index_entry
from app.wiki.log_ops import LogEntry, append_log_entry, read_log_entries
from app.wiki.models import (
    WikiActivityItem,
    WikiIngestResponse,
    WikiLintIssue,
    WikiLintResponse,
    WikiPageDetail,
    WikiPageSummary,
    WikiQueryResponse,
    WikiWorkspace,
)
from app.wiki.prompts import build_ingest_prompt, build_query_prompt
from app.wiki.tagging import assign_controlled_tags, clean_bibliographic_text


SCHEMA_PATH = "SCHEMA.md"


class WikiEngine:
    def __init__(
        self,
        root_dir: str | None = None,
        default_workspace: str | None = None,
        adapter: ExternalDocumentAdapter | None = None,
    ) -> None:
        self.root_dir = Path(root_dir or settings.wiki_root_dir)
        self.default_workspace = default_workspace or settings.wiki_default_workspace
        self.adapter = adapter or ExternalDocumentAdapter()
        self._ollama_client: httpx.AsyncClient | None = None
        self._chroma_upsert_disabled = False
        self._llm_page_generation_disabled = False

    def init_workspace(self, workspace: str | None = None) -> WikiWorkspace:
        workspace_name = self._normalize_workspace(workspace)
        init_wiki_repo(self.root_dir)
        workspace_dir = ensure_workspace_structure(self.root_dir, workspace_name)
        commit_paths: list[str | Path] = [self.root_dir / SCHEMA_PATH, workspace_dir / "index.md", workspace_dir / "log.md"]
        wiki_commit(self.root_dir, f"wiki: initialize workspace {workspace_name}", commit_paths)
        activity = read_log_entries(workspace_dir, limit=1)
        return WikiWorkspace(
            name=workspace_name,
            branch=self._branch_for_workspace(workspace_name),
            page_count=len(read_index(workspace_dir)),
            last_activity_at=activity[0].timestamp if activity else None,
        )

    def list_workspaces(self) -> list[WikiWorkspace]:
        init_wiki_repo(self.root_dir)
        workspaces: list[WikiWorkspace] = []
        for child in sorted(self.root_dir.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            if not (child / "index.md").exists():
                continue
            activities = read_log_entries(child, limit=1)
            workspaces.append(
                WikiWorkspace(
                    name=child.name,
                    branch=self._branch_for_workspace(child.name),
                    page_count=len(read_index(child)),
                    last_activity_at=activities[0].timestamp if activities else None,
                )
            )
        return workspaces

    def list_pages(self, workspace: str | None = None, query: str | None = None) -> list[WikiPageSummary]:
        workspace_dir = self._workspace_dir(workspace)
        entries = self._read_entries(workspace_dir)
        if query:
            entries = search_index(workspace_dir, query, entries=entries)
        else:
            entries = self._sort_entries_for_listing(entries)
        return [self._entry_to_summary(workspace_dir.name, entry) for entry in entries]

    def get_page(self, workspace: str | None, slug: str) -> WikiPageDetail:
        workspace_dir = self._workspace_dir(workspace)
        _, entries_by_slug = self._entry_maps(workspace_dir)
        entry = entries_by_slug.get(slug)
        if entry is None:
            raise FileNotFoundError(f"Wiki page '{slug}' not found in workspace '{workspace_dir.name}'.")
        return self._page_detail_from_entry(workspace_dir, entry)

    def list_activity(self, workspace: str | None = None, limit: int = 50) -> list[WikiActivityItem]:
        workspace_dir = self._workspace_dir(workspace)
        return [
            WikiActivityItem(
                timestamp=entry.timestamp,
                action=entry.action,
                target=entry.target,
                message=entry.message,
            )
            for entry in read_log_entries(workspace_dir, limit=limit)
        ]

    async def ingest(
        self,
        *,
        workspace: str | None,
        filename: str | None,
        content_bytes: bytes | None,
        raw_content: str | None,
        title: str | None,
        doi: str | None = None,
        authors: str | None = None,
        first_author: str | None = None,
        journal: str | None = None,
        publication_year: str | None = None,
        pmid: str | None = None,
        pmcid: str | None = None,
        pdf_keywords: str | None = None,
        commit: bool = True,
    ) -> WikiIngestResponse:
        workspace_dir = self._workspace_dir(workspace)
        source_metadata = self._normalize_source_metadata(
            doi=doi,
            authors=authors,
            first_author=first_author,
            journal=journal,
            publication_year=publication_year,
            pmid=pmid,
            pmcid=pmcid,
            pdf_keywords=pdf_keywords,
        )
        source = self.adapter.prepare_source(
            filename=filename,
            content_bytes=content_bytes,
            raw_content=raw_content,
            title=title,
        )
        source.title = clean_bibliographic_text(title or source.title)
        source.slug = self._resolve_source_slug(
            workspace_dir,
            slugify(source.title),
            source_metadata,
            filename=filename,
        )
        source.stored_filename = f"{source.slug}{Path(source.stored_filename).suffix or '.txt'}"
        source_path = workspace_dir / "sources" / source.stored_filename
        source_path.write_bytes(content_bytes if content_bytes is not None else source.content.encode("utf-8"))

        if commit:
            # Commit source file immediately so it persists even if LLM fails
            wiki_commit(self.root_dir, f"wiki: store source {source.slug}")

        try:
            pages = await self._generate_pages(workspace_dir.name, source.title, source.content, source_metadata)
        except Exception:
            pages = self._fallback_pages(source.title, source.content, source_metadata)
        created_pages: list[WikiPageSummary] = []

        primary_domain = str(pages[0].get("primary_domain", "")).strip() if pages else ""
        secondary_tags = [str(tag).strip() for tag in pages[0].get("keywords", []) if str(tag).strip()] if pages else []
        source_keywords = ["source", source.source_type]
        if primary_domain:
            source_keywords.append(primary_domain)
        source_keywords.extend(secondary_tags)
        page_slug_map = {
            id(page): self._resolve_page_slug(
                workspace_dir,
                title=str(page["title"]),
                page_type=str(page["type"]),
                source_slug=source.slug,
                metadata=source_metadata,
            )
            for page in pages
        }

        source_summary = self._write_page(
            workspace_dir=workspace_dir,
            page_type="source_summary",
            title=source.title,
            body=self._source_summary_body(source, source_metadata, primary_domain=primary_domain, secondary_tags=secondary_tags),
            keywords=source_keywords,
            links=[page_slug_map[id(page)] for page in pages],
            source_title=source.title,
            source_slug=source.slug,
            source_type=source.source_type,
            metadata=source_metadata,
            primary_domain=primary_domain,
            slug_override=f"source-summary-{source.slug}",
        )
        created_pages.append(source_summary)

        for page in pages:
            page_keywords = page.get("keywords", [])
            page_links = page.get("links", [])
            created_pages.append(
                self._write_page(
                    workspace_dir=workspace_dir,
                    page_type=str(page["type"]),
                    title=str(page["title"]),
                    body=str(page["body"]),
                    keywords=page_keywords if isinstance(page_keywords, list) else [],
                    links=page_links if isinstance(page_links, list) else [],
                    source_title=source.title,
                    source_slug=source.slug,
                    source_type=source.source_type,
                    metadata=source_metadata,
                    primary_domain=str(page.get("primary_domain", "")).strip(),
                    slug_override=page_slug_map[id(page)],
                )
            )

        timestamp = _utc_now()
        log_entry = LogEntry(
            timestamp=timestamp,
            action="ingest",
            target=source.slug,
            message=f"Ingested '{source.title}' and updated {len(created_pages)} wiki pages.",
        )
        append_log_entry(workspace_dir, log_entry)
        if commit:
            wiki_commit(self.root_dir, f"wiki: ingest {source.slug}")

        return WikiIngestResponse(
            workspace=workspace_dir.name,
            source_slug=source.slug,
            source_title=source.title,
            created_pages=created_pages,
            activity=WikiActivityItem(
                timestamp=log_entry.timestamp,
                action=log_entry.action,
                target=log_entry.target,
                message=log_entry.message,
            ),
        )

    async def query(
        self,
        workspace: str | None,
        question: str,
        *,
        page_slug: str | None = None,
        source_slug: str | None = None,
        primary_domain: str | None = None,
        journal: str | None = None,
        publication_year_min: str | None = None,
        publication_year_max: str | None = None,
        first_author: str | None = None,
    ) -> WikiQueryResponse:
        workspace_dir = self._workspace_dir(workspace)
        entries, entries_by_slug = self._entry_maps(workspace_dir)
        details = self._resolve_query_details(
            workspace_dir,
            question,
            entries,
            entries_by_slug,
            page_slug=page_slug,
            source_slug=source_slug,
            primary_domain=primary_domain,
            journal=journal,
            publication_year_min=publication_year_min,
            publication_year_max=publication_year_max,
            first_author=first_author,
        )
        focus_detail = next((detail for detail in details if detail.slug == page_slug), None) if page_slug else None
        focus_title = (focus_detail.source_title or focus_detail.title) if focus_detail else None

        if not details:
            answer = "No relevant wiki pages matched this question yet."
            citations: list[WikiPageSummary] = []
        else:
            prompt_context = self._build_query_context(details, focus_detail)
            answer = await self._answer_question(question, prompt_context, focus_title=focus_title)
            citations = [self._detail_to_summary(detail) for detail in details]

        append_log_entry(
            workspace_dir,
            LogEntry(
                timestamp=_utc_now(),
                action="query",
                target=slugify(question)[:48],
                message=f"Answered wiki query: {question[:120]}",
            ),
        )
        return WikiQueryResponse(workspace=workspace_dir.name, answer=answer, citations=citations)

    async def lint(self, workspace: str | None) -> WikiLintResponse:
        workspace_dir = self._workspace_dir(workspace)
        known_entries = {entry.slug: entry for entry in read_index(workspace_dir)}
        issues: list[WikiLintIssue] = []

        for slug, entry in known_entries.items():
            page = self._page_detail_from_entry(workspace_dir, entry)
            links = extract_wikilinks(page.body)
            for link in links:
                if link not in known_entries:
                    issues.append(
                        WikiLintIssue(
                            severity="error",
                            page_slug=slug,
                            message=f"Broken wikilink [[{link}]]",
                        )
                    )
            if not page.body.strip():
                issues.append(
                    WikiLintIssue(
                        severity="warning",
                        page_slug=slug,
                        message="Page body is empty.",
                    )
                )

        append_log_entry(
            workspace_dir,
            LogEntry(
                timestamp=_utc_now(),
                action="lint",
                target=workspace_dir.name,
                message=f"Linted wiki workspace and found {len(issues)} issue(s).",
            ),
        )
        return WikiLintResponse(workspace=workspace_dir.name, issues=issues)

    async def _generate_pages(
        self,
        workspace: str,
        source_title: str,
        source_text: str,
        source_metadata: dict[str, str],
    ) -> list[dict[str, str | list[str]]]:
        if self._llm_page_generation_disabled:
            return self._fallback_pages(source_title, source_text, source_metadata)
        schema = (self.root_dir / SCHEMA_PATH).read_text(encoding="utf-8")
        prompt = build_ingest_prompt(
            schema,
            workspace,
            source_title,
            source_text,
            doi=source_metadata["doi"],
            authors=source_metadata["authors"],
            journal=source_metadata["journal"],
            publication_year=source_metadata["publication_year"],
        )
        try:
            payload = await self._call_llm_json(prompt)
        except Exception:
            self._llm_page_generation_disabled = True
            logger.warning(
                "Wiki page generation LLM unavailable; falling back to deterministic pages for the rest of this run",
                exc_info=True,
            )
            return self._fallback_pages(source_title, source_text, source_metadata)
        pages = payload.get("pages") if isinstance(payload, dict) else None
        if not isinstance(pages, list):
            return self._fallback_pages(source_title, source_text, source_metadata)

        normalized: list[dict[str, str | list[str]]] = []
        for page in pages:
            if not isinstance(page, dict):
                continue
            title = str(page.get("title", "")).strip()
            page_type = str(page.get("type", "concept")).strip().lower()
            if not title or page_type not in WORKSPACE_PAGE_DIRS:
                continue
            primary_domain, secondary_tags = assign_controlled_tags(
                title=source_title,
                body=str(page.get("body", "")).strip() or source_text,
                journal=source_metadata["journal"],
                pdf_keywords=source_metadata["pdf_keywords"],
                candidate_primary_domain=str(page.get("primary_domain", "")),
                candidate_secondary_tags=[str(item).strip() for item in page.get("keywords", []) if str(item).strip()],
            )
            normalized.append(
                {
                    "title": clean_bibliographic_text(title),
                    "type": page_type,
                    "body": str(page.get("body", "")).strip() or self._fallback_body(title, source_text),
                    "primary_domain": primary_domain,
                    "keywords": secondary_tags,
                    "links": [str(item).strip() for item in page.get("links", []) if str(item).strip()],
                }
            )
        return normalized or self._fallback_pages(source_title, source_text, source_metadata)

    async def _answer_question(
        self,
        question: str,
        page_context: str,
        *,
        focus_title: str | None = None,
    ) -> str:
        prompt = build_query_prompt(question, page_context, focus_title)

        # Try Claude first if configured — better reasoning for research Q&A
        claude_reply = self._try_claude_answer(prompt)
        if claude_reply:
            return claude_reply

        # Fall back to local Ollama with higher token budget for wiki queries
        try:
            return await self._call_llm_text(
                prompt,
                num_predict=2048,
                temperature=0.3,
            )
        except Exception:
            snippets = [segment.strip() for segment in page_context.split("\n\n") if segment.strip()]
            excerpt = "\n\n".join(snippets[:3])
            return f"I found relevant wiki context but could not reach the LLM.\n\n{excerpt[:1800]}"

    def _try_claude_answer(self, prompt: str) -> str | None:
        """Attempt to answer via Claude API. Returns None if unavailable or fails."""
        if not settings.claude_api_key:
            return None
        try:
            from app.routing.claude_client import ClaudeClient

            client = ClaudeClient(api_key=settings.claude_api_key)
            response = client.chat(
                system_prompt=(
                    "You are Abby, a research assistant for clinical informaticians working with "
                    "OHDSI/OMOP health informatics research papers. Answer questions with specific "
                    "details from the provided context — cite methods, datasets, findings, and metrics. "
                    "Use well-structured markdown. Be thorough but focused."
                ),
                message=prompt,
            )
            if response.reply and response.reply.strip():
                logger.info(
                    "Wiki query answered via Claude (tokens_in=%d, tokens_out=%d, cost=$%.4f)",
                    response.tokens_in,
                    response.tokens_out,
                    response.cost_usd,
                )
                return response.reply.strip()
        except Exception:
            logger.warning("Claude wiki query failed, falling back to local", exc_info=True)
        return None

    _WIKI_SYSTEM_PROMPT = (
        "You are Abby, a research assistant for clinical informaticians working with "
        "OHDSI/OMOP health informatics research papers. Answer questions with specific "
        "details from the provided context — cite methods, datasets, findings, and metrics. "
        "Use well-structured markdown. Be thorough but focused."
    )

    async def stream_answer(
        self,
        workspace: str | None,
        question: str,
        *,
        page_slug: str | None = None,
        source_slug: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream wiki answer tokens as SSE events (data: {...}\\n\\n)."""
        workspace_dir = self._workspace_dir(workspace)
        entries, entries_by_slug = self._entry_maps(workspace_dir)
        details = self._resolve_query_details(
            workspace_dir, question, entries, entries_by_slug,
            page_slug=page_slug, source_slug=source_slug,
            primary_domain=None,
            journal=None,
            publication_year_min=None,
            publication_year_max=None,
            first_author=None,
        )
        focus_detail = next((d for d in details if d.slug == page_slug), None) if page_slug else None
        focus_title = (focus_detail.source_title or focus_detail.title) if focus_detail else None

        if not details:
            yield f"data: {json.dumps({'token': 'No relevant wiki pages matched this question yet.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        prompt_context = self._build_query_context(details, focus_detail)
        prompt = build_query_prompt(question, prompt_context, focus_title)
        citations = [self._detail_to_summary(d) for d in details]

        # Emit citations metadata before tokens start
        yield f"data: {json.dumps({'citations': [c.model_dump() for c in citations]})}\n\n"

        # Try Claude streaming first
        if settings.claude_api_key:
            try:
                async for event in self._stream_claude(prompt):
                    yield event
                self._log_wiki_query(workspace_dir, question)
                return
            except Exception:
                logger.warning("Claude streaming failed, falling back to Ollama", exc_info=True)

        # Ollama streaming fallback
        try:
            async for event in self._stream_ollama_answer(prompt):
                yield event
        except Exception:
            logger.exception("Ollama streaming failed")
            yield f"data: {json.dumps({'token': 'I found relevant context but could not reach the LLM.'})}\n\n"

        self._log_wiki_query(workspace_dir, question)
        yield "data: [DONE]\n\n"

    def _log_wiki_query(self, workspace_dir: Path, question: str) -> None:
        append_log_entry(
            workspace_dir,
            LogEntry(
                timestamp=_utc_now(),
                action="query",
                target=slugify(question)[:48],
                message=f"Answered wiki query: {question[:120]}",
            ),
        )

    async def _stream_claude(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream tokens from Claude API as SSE events."""
        import asyncio
        import queue

        import anthropic

        token_queue: queue.Queue[str | None] = queue.Queue()

        def _run_sync_stream() -> None:
            """Run the synchronous Claude stream in a thread, pushing tokens to a queue."""
            try:
                client = anthropic.Anthropic(api_key=settings.claude_api_key)
                with client.messages.stream(
                    model=settings.claude_model,
                    max_tokens=settings.claude_max_tokens,
                    system=self._WIKI_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                ) as stream:
                    for text in stream.text_stream:
                        if text:
                            token_queue.put(text)
            except Exception:
                logger.exception("Claude sync stream error")
            finally:
                token_queue.put(None)  # sentinel

        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _run_sync_stream)

        while True:
            # Poll the queue without blocking the event loop
            try:
                token = token_queue.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.05)
                continue
            if token is None:
                break
            yield f"data: {json.dumps({'token': token})}\n\n"

    async def _stream_ollama_answer(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama as SSE events."""
        async with self._get_ollama_client().stream(
            "POST",
            f"{settings.abby_llm_base_url}/api/chat",
            json={
                "model": settings.abby_llm_model,
                "messages": [
                    {"role": "system", "content": self._WIKI_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "stream": True,
                "think": False,
                "keep_alive": settings.abby_ollama_keep_alive,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 2048,
                },
            },
            timeout=settings.ollama_timeout,
        ) as resp:
            resp.raise_for_status()
            pending = ""
            suppress_reasoning: bool | None = None
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    if data.get("done"):
                        break
                    token = data.get("message", {}).get("content", "")
                    if not token:
                        continue
                    pending += token
                    # Handle reasoning model think blocks
                    if suppress_reasoning is None:
                        stripped = pending.lstrip()
                        if stripped.startswith("<think>"):
                            suppress_reasoning = True
                        elif len(pending) >= 16:
                            suppress_reasoning = False
                    if suppress_reasoning is True:
                        cleaned = _strip_think_blocks(pending)
                        if cleaned:
                            yield f"data: {json.dumps({'token': cleaned})}\n\n"
                            pending = ""
                            suppress_reasoning = False
                    elif suppress_reasoning is False:
                        yield f"data: {json.dumps({'token': pending})}\n\n"
                        pending = ""
                except json.JSONDecodeError:
                    continue
            # Flush remaining
            if pending and suppress_reasoning is not True:
                yield f"data: {json.dumps({'token': pending})}\n\n"

    async def _call_llm_json(self, prompt: str) -> dict[str, object]:
        response = await self._call_ollama(prompt, expect_json=True)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    async def _call_llm_text(
        self,
        prompt: str,
        *,
        num_predict: int | None = None,
        temperature: float = 0.1,
    ) -> str:
        return await self._call_ollama(
            prompt,
            expect_json=False,
            num_predict=num_predict,
            temperature=temperature,
        )

    async def _call_ollama(
        self,
        prompt: str,
        *,
        expect_json: bool,
        system_prompt: str | None = None,
        num_predict: int | None = None,
        temperature: float = 0.1,
    ) -> str:
        if system_prompt is None:
            system_prompt = (
                "Return valid JSON only. No explanation."
                if expect_json
                else "Output the final answer only. No reasoning, no chain of thought. Use concise markdown."
            )
        resolved_num_predict = num_predict or max(settings.ollama_num_predict, 512)
        response = await self._get_ollama_client().post(
            f"{settings.abby_llm_base_url}/api/chat",
            json={
                "model": settings.abby_llm_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "think": False,
                "keep_alive": settings.abby_ollama_keep_alive,
                "options": {
                    "temperature": temperature,
                    "num_predict": resolved_num_predict,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        raw = str(data.get("message", {}).get("content", "")).strip()
        # Strip reasoning model think blocks that leak through despite think=False
        return _strip_think_blocks(raw)

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
        """Split text into overlapping chunks."""
        if not text.strip():
            return []
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start = end - overlap
        return chunks

    def _upsert_page_to_chroma(
        self,
        *,
        workspace: str,
        slug: str,
        title: str,
        page_type: str,
        body: str,
        keywords: list[str],
        source_slug: str,
        source_type: str,
        metadata: dict[str, str],
        primary_domain: str,
    ) -> None:
        """Chunk and upsert a wiki page into ChromaDB for semantic search."""
        from app.chroma.collections import get_wiki_collection
        from app.chroma.ingestion import _upsert_resilient

        collection = get_wiki_collection()

        # Split body into chunks
        chunks = self._chunk_text(body, chunk_size=800, overlap=100)
        if not chunks:
            return

        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, str | int | float | bool]] = []

        for i, chunk in enumerate(chunks):
            chunk_id = f"{workspace}:{slug}:chunk-{i}"
            ids.append(chunk_id)
            documents.append(f"{title}\n\n{chunk}")
            metadatas.append({
                "workspace": workspace,
                "slug": slug,
                "title": title,
                "page_type": page_type,
                "keywords": ", ".join(keywords),
                "source_slug": source_slug or "",
                "source_type": source_type or "",
                "chunk_index": i,
                "doi": metadata["doi"],
                "authors": metadata["first_author"] or metadata["authors"],
                "first_author": metadata["first_author"],
                "journal": metadata["journal"],
                "publication_year": metadata["publication_year"],
                "primary_domain": primary_domain,
            })

        # Delete old chunks for this page (slug may have different chunk count now)
        try:
            existing = collection.get(where={"slug": slug})
            if existing and existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass  # Collection may be empty or where filter unsupported

        _upsert_resilient(collection, ids, documents, metadatas, chunk_size=50)

    def _write_page(
        self,
        *,
        workspace_dir: Path,
        page_type: str,
        title: str,
        body: str,
        keywords: list[str],
        links: list[str],
        source_title: str | None,
        source_slug: str = "",
        source_type: str = "",
        metadata: dict[str, str] | None = None,
        primary_domain: str = "",
        slug_override: str | None = None,
    ) -> WikiPageSummary:
        slug = self._bounded_slug(slug_override or slugify(title), f"{page_type}:{source_slug or ''}:{title}")
        relative_dir = WORKSPACE_PAGE_DIRS[page_type]
        relative_path = f"{relative_dir}/{slug}.md"
        absolute_path = workspace_dir / relative_path
        updated_at = _utc_now()
        normalized_links = sorted({link for link in links if link})
        source_metadata = metadata or self._normalize_source_metadata()

        # Preserve ingested_at from existing entry; set on first ingest
        existing_entries = {e.slug: e for e in read_index(workspace_dir)}
        existing = existing_entries.get(slug)
        ingested_at = existing.ingested_at if existing and existing.ingested_at else updated_at

        frontmatter = build_frontmatter(
            {
                "title": title,
                "slug": slug,
                "type": page_type,
                "keywords": keywords,
                "links": normalized_links,
                "updated_at": updated_at,
                "source_title": source_title or "",
                "doi": source_metadata["doi"],
                "authors": source_metadata["authors"],
                "first_author": source_metadata["first_author"],
                "journal": source_metadata["journal"],
                "publication_year": source_metadata["publication_year"],
                "pmid": source_metadata["pmid"],
                "pmcid": source_metadata["pmcid"],
                "primary_domain": primary_domain,
            }
        )
        absolute_path.write_text(f"{frontmatter}\n\n{body.strip()}\n", encoding="utf-8")
        entry = IndexEntry(
            page_type=page_type,
            title=title,
            slug=slug,
            path=relative_path,
            keywords=keywords,
            links=normalized_links,
            updated_at=updated_at,
            source_slug=source_slug,
            source_type=source_type,
            ingested_at=ingested_at,
            doi=source_metadata["doi"],
            authors=source_metadata["authors"],
            first_author=source_metadata["first_author"],
            journal=source_metadata["journal"],
            publication_year=source_metadata["publication_year"],
            pmid=source_metadata["pmid"],
            pmcid=source_metadata["pmcid"],
            primary_domain=primary_domain,
        )
        upsert_index_entry(workspace_dir, entry)

        # Upsert into ChromaDB for semantic search (non-blocking on failure)
        if not self._chroma_upsert_disabled:
            try:
                self._upsert_page_to_chroma(
                    workspace=workspace_dir.name,
                    slug=slug,
                    title=title,
                    page_type=page_type,
                    body=body,
                    keywords=keywords,
                    source_slug=source_slug,
                    source_type=source_type,
                    metadata=source_metadata,
                    primary_domain=primary_domain,
                )
            except Exception:
                self._chroma_upsert_disabled = True
                import logging
                logging.getLogger(__name__).warning(
                    "ChromaDB upsert failed for wiki page %s; disabling further wiki upserts for this run",
                    slug,
                    exc_info=True,
                )

        return self._entry_to_summary(workspace_dir.name, entry)

    def _read_entries(self, workspace_dir: Path) -> list[IndexEntry]:
        return read_index(workspace_dir)

    def _entry_maps(self, workspace_dir: Path) -> tuple[list[IndexEntry], dict[str, IndexEntry]]:
        entries = self._read_entries(workspace_dir)
        return entries, {entry.slug: entry for entry in entries}

    @staticmethod
    def _sort_entries_for_listing(entries: list[IndexEntry]) -> list[IndexEntry]:
        return sorted(
            entries,
            key=lambda entry: (
                entry.ingested_at or entry.updated_at,
                1 if entry.page_type != "source_summary" else 0,
                entry.title.lower(),
            ),
            reverse=True,
        )

    def _resolve_source_slug(
        self,
        workspace_dir: Path,
        preferred_slug: str,
        metadata: dict[str, str],
        *,
        filename: str | None,
    ) -> str:
        fingerprint_source = metadata["doi"] or metadata["pmid"] or metadata["pmcid"] or filename or preferred_slug
        preferred_slug = self._bounded_slug(preferred_slug, fingerprint_source)
        entries = read_index(workspace_dir)
        matched_existing = next(
            (
                entry.source_slug
                for entry in entries
                if entry.source_slug and self._entry_matches_metadata(entry, metadata)
            ),
            "",
        )
        if matched_existing:
            return matched_existing
        related = [entry for entry in entries if entry.source_slug == preferred_slug]
        if not related:
            return preferred_slug
        if all(self._entry_matches_source(entry, metadata, preferred_slug) for entry in related):
            return preferred_slug
        return f"{preferred_slug}-{self._slug_fingerprint(metadata, filename or preferred_slug)}"

    def _resolve_page_slug(
        self,
        workspace_dir: Path,
        *,
        title: str,
        page_type: str,
        source_slug: str,
        metadata: dict[str, str],
    ) -> str:
        preferred_slug = self._bounded_slug(
            slugify(title),
            f"{source_slug}:{page_type}:{metadata['doi'] or metadata['pmid'] or metadata['pmcid'] or title}",
        )
        entries = read_index(workspace_dir)
        matched_existing = next(
            (
                entry.slug
                for entry in entries
                if entry.page_type == page_type and entry.title == title and self._entry_matches_source(entry, metadata, source_slug)
            ),
            "",
        )
        if matched_existing:
            return matched_existing
        related = [entry for entry in entries if entry.slug == preferred_slug]
        if not related:
            return preferred_slug
        if all(entry.source_slug == source_slug or self._entry_matches_source(entry, metadata, source_slug) for entry in related):
            return preferred_slug
        return f"{preferred_slug}-{self._slug_fingerprint(metadata, source_slug)}"

    @staticmethod
    def _entry_matches_source(entry: IndexEntry, metadata: dict[str, str], source_slug: str) -> bool:
        if WikiEngine._entry_matches_metadata(entry, metadata):
            return True
        if not (metadata["doi"] or metadata["pmid"] or metadata["pmcid"]) and entry.source_slug and entry.source_slug == source_slug:
            return True
        return False

    @staticmethod
    def _entry_matches_metadata(entry: IndexEntry, metadata: dict[str, str]) -> bool:
        if metadata["doi"] and entry.doi == metadata["doi"]:
            return True
        if metadata["pmid"] and entry.pmid == metadata["pmid"]:
            return True
        if metadata["pmcid"] and entry.pmcid == metadata["pmcid"]:
            return True
        return False

    @staticmethod
    def _slug_fingerprint(metadata: dict[str, str], fallback: str) -> str:
        source = metadata["doi"] or metadata["pmid"] or metadata["pmcid"] or fallback
        return hashlib.sha1(source.encode("utf-8")).hexdigest()[:8]

    @staticmethod
    def _bounded_slug(candidate: str, fingerprint_source: str) -> str:
        normalized = slugify(candidate)
        if len(normalized) <= _MAX_PAGE_SLUG_LENGTH:
            return normalized
        suffix = hashlib.sha1(fingerprint_source.encode("utf-8")).hexdigest()[:8]
        prefix_length = _MAX_PAGE_SLUG_LENGTH - len(suffix) - 1
        truncated = normalized[:prefix_length].rstrip("-")
        return f"{truncated}-{suffix}"

    def _source_filename_map(self, workspace_dir: Path) -> dict[str, str]:
        sources_dir = workspace_dir / "sources"
        if not sources_dir.exists():
            return {}
        return {
            candidate_path.stem: candidate_path.name
            for candidate_path in sources_dir.iterdir()
            if candidate_path.is_file()
        }

    def _page_detail_from_entry(
        self,
        workspace_dir: Path,
        entry: IndexEntry,
        *,
        source_files: dict[str, str] | None = None,
    ) -> WikiPageDetail:
        page_path = workspace_dir / entry.path
        metadata, body = parse_markdown_page(page_path)
        source_slug = entry.source_slug or None
        source_type = entry.source_type or None
        stored_filename: str | None = None
        if source_slug:
            source_files = source_files or self._source_filename_map(workspace_dir)
            candidate_name = source_files.get(source_slug)
            if candidate_name:
                candidate_path = workspace_dir / "sources" / candidate_name
                stored_filename = candidate_name
                if source_type == "pdf" and candidate_path.suffix.lower() == ".pdf":
                    try:
                        with open(candidate_path, "rb") as handle:
                            if handle.read(5) != b"%PDF-":
                                stored_filename = None
                                source_type = None
                    except OSError:
                        stored_filename = None
                        source_type = None

        return WikiPageDetail(
            workspace=workspace_dir.name,
            title=str(metadata.get("title", entry.title)),
            slug=entry.slug,
            page_type=str(metadata.get("type", entry.page_type)),
            path=entry.path,
            keywords=list(metadata.get("keywords", entry.keywords)),
            links=list(metadata.get("links", entry.links)),
            updated_at=str(metadata.get("updated_at", entry.updated_at)),
            body=body,
            source_title=str(metadata.get("source_title")) if metadata.get("source_title") else None,
            source_slug=source_slug,
            source_type=source_type,
            stored_filename=stored_filename,
            ingested_at=entry.ingested_at or None,
            doi=str(metadata.get("doi", entry.doi)) or None,
            authors=str(metadata.get("authors", entry.authors)) or None,
            first_author=str(metadata.get("first_author", entry.first_author)) or None,
            journal=str(metadata.get("journal", entry.journal)) or None,
            publication_year=str(metadata.get("publication_year", entry.publication_year)) or None,
            pmid=str(metadata.get("pmid", entry.pmid)) or None,
            pmcid=str(metadata.get("pmcid", entry.pmcid)) or None,
            primary_domain=str(metadata.get("primary_domain", entry.primary_domain)) or None,
        )

    def _build_query_context(
        self,
        details: list[WikiPageDetail],
        focus_detail: WikiPageDetail | None,
    ) -> str:
        sections: list[str] = []
        if focus_detail:
            sections.append(
                "\n".join(
                    [
                        "# Current paper focus",
                        f"- Paper: {focus_detail.source_title or focus_detail.title}",
                        f"- Current page: {focus_detail.title}",
                        f"- Page type: {focus_detail.page_type}",
                        f"- Authors: {focus_detail.authors or 'Unknown'}",
                        f"- Journal: {focus_detail.journal or 'Unknown'}",
                        f"- Year: {focus_detail.publication_year or 'Unknown'}",
                        f"- Primary domain: {focus_detail.primary_domain or 'Unknown'}",
                    ]
                )
            )

        for index, detail in enumerate(details, start=1):
            sections.append(
                "\n".join(
                    [
                        f"# Source {index}: {detail.title}",
                        f"- Page type: {detail.page_type}",
                        f"- Source title: {detail.source_title or detail.title}",
                        f"- Source slug: {detail.source_slug or detail.slug}",
                        f"- Authors: {detail.authors or 'Unknown'}",
                        f"- Journal: {detail.journal or 'Unknown'}",
                        f"- Year: {detail.publication_year or 'Unknown'}",
                        f"- DOI: {detail.doi or 'Unknown'}",
                        f"- Primary domain: {detail.primary_domain or 'Unknown'}",
                        "",
                        detail.body[:6000],
                    ]
                ).strip()
            )
        return "\n\n".join(section for section in sections if section.strip())

    def _resolve_query_details(
        self,
        workspace_dir: Path,
        question: str,
        entries: list[IndexEntry],
        entries_by_slug: dict[str, IndexEntry],
        *,
        page_slug: str | None,
        source_slug: str | None,
        primary_domain: str | None,
        journal: str | None,
        publication_year_min: str | None,
        publication_year_max: str | None,
        first_author: str | None,
    ) -> list[WikiPageDetail]:
        source_files = self._source_filename_map(workspace_dir)
        resolved_source_slug = source_slug
        if page_slug and not resolved_source_slug:
            resolved_source_slug = entries_by_slug[page_slug].source_slug if page_slug in entries_by_slug else None

        selected_entries: list[IndexEntry] = []
        selected_slugs: set[str] = set()
        if page_slug and page_slug in entries_by_slug:
            selected_entry = entries_by_slug[page_slug]
            selected_entries.append(selected_entry)
            selected_slugs.add(selected_entry.slug)
        if resolved_source_slug:
            selected_entries.extend(
                entry
                for entry in entries
                if entry.source_slug == resolved_source_slug and entry.slug not in selected_slugs
            )
            selected_slugs.update(entry.slug for entry in selected_entries)

        detail_map: dict[str, WikiPageDetail] = {}
        for entry in selected_entries:
            detail_map[entry.slug] = self._page_detail_from_entry(workspace_dir, entry, source_files=source_files)

        for slug in self._query_chroma_slugs(
            workspace_dir.name,
            question,
            source_slug=resolved_source_slug,
            primary_domain=primary_domain,
            journal=journal,
            publication_year_min=publication_year_min,
            publication_year_max=publication_year_max,
            first_author=first_author,
        ):
            chroma_entry = entries_by_slug.get(slug)
            if chroma_entry and slug not in detail_map:
                detail_map[slug] = self._page_detail_from_entry(workspace_dir, chroma_entry, source_files=source_files)
            if len(detail_map) >= 5:
                break

        if len(detail_map) < 5:
            search_pool = entries
            if resolved_source_slug:
                scoped_pool = [entry for entry in entries if entry.source_slug == resolved_source_slug]
                if scoped_pool:
                    search_pool = scoped_pool
            if primary_domain:
                scoped_pool = [entry for entry in search_pool if entry.primary_domain == primary_domain]
                if scoped_pool:
                    search_pool = scoped_pool
            if journal:
                journal_query = clean_bibliographic_text(journal).lower()
                scoped_pool = [entry for entry in search_pool if journal_query in entry.journal.lower()]
                if scoped_pool:
                    search_pool = scoped_pool
            if first_author:
                author_query = clean_bibliographic_text(first_author).lower()
                scoped_pool = [entry for entry in search_pool if author_query in entry.first_author.lower() or author_query in entry.authors.lower()]
                if scoped_pool:
                    search_pool = scoped_pool
            if publication_year_min or publication_year_max:
                scoped_pool = [
                    entry
                    for entry in search_pool
                    if self._year_in_range(entry.publication_year, publication_year_min, publication_year_max)
                ]
                if scoped_pool:
                    search_pool = scoped_pool
            matches = search_index(workspace_dir, question, entries=search_pool)
            for entry in matches:
                if entry.slug not in detail_map:
                    detail_map[entry.slug] = self._page_detail_from_entry(workspace_dir, entry, source_files=source_files)
                if len(detail_map) >= 5:
                    break

        ordered_details: list[WikiPageDetail] = []
        ordered_slugs: set[str] = set()
        for entry in selected_entries:
            detail = detail_map.get(entry.slug)
            if detail and detail.slug not in ordered_slugs:
                ordered_details.append(detail)
                ordered_slugs.add(detail.slug)
        for detail in detail_map.values():
            if detail.slug not in ordered_slugs:
                ordered_details.append(detail)
                ordered_slugs.add(detail.slug)
        return ordered_details[:5]

    def _query_chroma_slugs(
        self,
        workspace: str,
        question: str,
        *,
        source_slug: str | None = None,
        primary_domain: str | None = None,
        journal: str | None = None,
        publication_year_min: str | None = None,
        publication_year_max: str | None = None,
        first_author: str | None = None,
    ) -> list[str]:
        try:
            from app.chroma.collections import get_wiki_collection

            collection = get_wiki_collection()
            slug_candidates: list[str] = []
            where_filters = self._build_query_filters(
                workspace=workspace,
                source_slug=source_slug,
                primary_domain=primary_domain,
                journal=journal,
                publication_year_min=publication_year_min,
                publication_year_max=publication_year_max,
                first_author=first_author,
            )

            for where_filter in where_filters:
                results = collection.query(query_texts=[question], n_results=8, where=where_filter)  # type: ignore[arg-type]
                metadatas = results.get("metadatas") if results else None
                for meta in (metadatas[0] if metadatas else []):
                    slug = str(meta.get("slug", "")).strip()
                    if slug and slug not in slug_candidates:
                        slug_candidates.append(slug)
                    if len(slug_candidates) >= 5:
                        return slug_candidates
            return slug_candidates
        except Exception:
            import logging

            logging.getLogger(__name__).warning(
                "ChromaDB query failed, falling back to keyword search", exc_info=True
            )
            return []

    def _build_query_filters(
        self,
        *,
        workspace: str,
        source_slug: str | None,
        primary_domain: str | None,
        journal: str | None,
        publication_year_min: str | None,
        publication_year_max: str | None,
        first_author: str | None,
    ) -> list[dict[str, Any]]:
        base_and: list[dict[str, Any]] = [{"workspace": workspace}]
        if source_slug:
            base_and.append({"source_slug": source_slug})
        if primary_domain:
            base_and.append({"primary_domain": primary_domain})
        if journal:
            base_and.append({"journal": clean_bibliographic_text(journal)})
        if first_author:
            base_and.append({"authors": clean_bibliographic_text(first_author)})

        year_filter: dict[str, str] = {}
        if publication_year_min:
            year_filter["$gte"] = publication_year_min
        if publication_year_max:
            year_filter["$lte"] = publication_year_max
        if year_filter:
            base_and.append({"publication_year": year_filter})

        exact_filter: dict[str, Any] = (
            {"$and": base_and} if len(base_and) > 1 else base_and[0]
        )
        filters: list[dict[str, Any]] = [exact_filter]
        if len(base_and) > 1:
            filters.append({"workspace": workspace})
        return filters

    @staticmethod
    def _year_in_range(year: str, year_min: str | None, year_max: str | None) -> bool:
        if not year:
            return False
        if year_min and year < year_min:
            return False
        if year_max and year > year_max:
            return False
        return True

    def _get_ollama_client(self) -> httpx.AsyncClient:
        if self._ollama_client is None:
            self._ollama_client = httpx.AsyncClient(
                timeout=settings.ollama_timeout,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                trust_env=False,
            )
        return self._ollama_client

    def _workspace_dir(self, workspace: str | None) -> Path:
        workspace_summary = self.init_workspace(workspace)
        return self.root_dir / workspace_summary.name

    def _normalize_workspace(self, workspace: str | None) -> str:
        return slugify(workspace or self.default_workspace)

    def _branch_for_workspace(self, workspace: str) -> str:
        branches = set(list_branches(self.root_dir))
        candidate = f"workspace/{workspace}"
        return candidate if candidate in branches else "main"

    def _fallback_pages(
        self,
        source_title: str,
        source_text: str,
        source_metadata: dict[str, str],
    ) -> list[dict[str, str | list[str]]]:
        primary_domain, secondary_tags = assign_controlled_tags(
            title=source_title,
            body=source_text,
            journal=source_metadata["journal"],
            pdf_keywords=source_metadata["pdf_keywords"],
        )
        return [
            {
                "title": source_title,
                "type": "concept",
                "body": self._fallback_body(source_title, source_text),
                "primary_domain": primary_domain,
                "keywords": secondary_tags,
                "links": [],
            }
        ]

    def _fallback_body(self, title: str, source_text: str) -> str:
        # Extract a clean excerpt — skip lines that look like affiliations or metadata
        clean_lines: list[str] = []
        for line in source_text.splitlines():
            stripped = line.strip()
            if not stripped:
                if clean_lines:
                    clean_lines.append("")
                continue
            # Skip affiliation-like lines (contain department, university, postal codes)
            lower = stripped.lower()
            if any(skip in lower for skip in [
                "department of", "university of", "school of", "institute",
                "medical center", "hospital,", "@", "edited by", "approved",
                "received for review", "doi:", "http", "www.", "copyright",
                "elsevier", "springer", "wiley", "rights reserved",
            ]):
                continue
            # Skip lines that are mostly superscript references (a,b,c,1 patterns)
            if len(stripped) < 200 and sum(1 for c in stripped if c in "abcdefghijklmnopqrstuvwxyz,") > len(stripped) * 0.4:
                if any(c.isdigit() for c in stripped) and "," in stripped:
                    continue
            clean_lines.append(stripped)

        cleaned = "\n".join(clean_lines).strip()[:2500]
        return f"{cleaned}\n" if cleaned else f"Content extracted from: {title}\n"

    def _source_summary_body(
        self,
        source: PreparedSource,
        metadata: dict[str, str],
        *,
        primary_domain: str,
        secondary_tags: list[str],
    ) -> str:
        lines = [
            "## Citation",
            f"- Authors: {metadata['authors'] or 'Unknown'}",
            f"- Journal: {metadata['journal'] or 'Unknown'}",
            f"- Publication Year: {metadata['publication_year'] or 'Unknown'}",
            f"- DOI: {metadata['doi'] or 'Unknown'}",
            f"- PMID: {metadata['pmid'] or 'Unknown'}",
            f"- PMCID: {metadata['pmcid'] or 'Unknown'}",
            f"- Primary Domain: {primary_domain or 'Unknown'}",
            f"- Tags: {', '.join(secondary_tags) if secondary_tags else 'None'}",
            "",
            "## Extracted Source Text",
            self._fallback_body(source.title, source.content).strip(),
        ]
        return "\n".join(lines).strip() + "\n"

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        """Extract meaningful keywords from text."""
        # Common OHDSI/medical terms to look for
        term_pool = [
            "OMOP", "OHDSI", "CDM", "ETL", "FHIR", "phenotype", "cohort",
            "pharmacovigilance", "real-world data", "data quality", "vocabulary",
            "treatment pathways", "patient-level prediction", "characterization",
            "oncology", "cancer", "diabetes", "cardiovascular",
            "SNOMED", "ICD", "RxNorm", "LOINC", "claims", "EHR",
            "federated", "distributed", "harmonization", "standardization",
            "machine learning", "NLP", "clinical trial",
        ]
        lower_text = text.lower()
        found = [term for term in term_pool if term.lower() in lower_text]
        return found[:5] if found else ["research"]

    @staticmethod
    def _normalize_source_metadata(
        *,
        doi: str | None = None,
        authors: str | None = None,
        first_author: str | None = None,
        journal: str | None = None,
        publication_year: str | None = None,
        pmid: str | None = None,
        pmcid: str | None = None,
        pdf_keywords: str | None = None,
    ) -> dict[str, str]:
        resolved_authors = clean_bibliographic_text(authors)
        resolved_first_author = clean_bibliographic_text(first_author)
        if not resolved_first_author and resolved_authors:
            resolved_first_author = resolved_authors.split(",")[0].strip()
        return {
            "doi": clean_bibliographic_text(doi),
            "authors": resolved_authors,
            "first_author": resolved_first_author,
            "journal": clean_bibliographic_text(journal),
            "publication_year": clean_bibliographic_text(publication_year),
            "pmid": clean_bibliographic_text(pmid),
            "pmcid": clean_bibliographic_text(pmcid),
            "pdf_keywords": clean_bibliographic_text(pdf_keywords),
        }

    def _entry_to_summary(self, workspace: str, entry: IndexEntry) -> WikiPageSummary:
        return WikiPageSummary(
            workspace=workspace,
            title=entry.title,
            slug=entry.slug,
            page_type=entry.page_type,
            path=entry.path,
            keywords=entry.keywords,
            links=entry.links,
            updated_at=entry.updated_at,
            source_slug=entry.source_slug or None,
            source_type=entry.source_type or None,
            ingested_at=entry.ingested_at or None,
            doi=entry.doi or None,
            authors=entry.authors or None,
            first_author=entry.first_author or None,
            journal=entry.journal or None,
            publication_year=entry.publication_year or None,
            pmid=entry.pmid or None,
            pmcid=entry.pmcid or None,
            primary_domain=entry.primary_domain or None,
        )

    def _detail_to_summary(self, detail: WikiPageDetail) -> WikiPageSummary:
        return WikiPageSummary(
            workspace=detail.workspace,
            title=detail.title,
            slug=detail.slug,
            page_type=detail.page_type,
            path=detail.path,
            keywords=detail.keywords,
            links=detail.links,
            updated_at=detail.updated_at,
            source_slug=detail.source_slug,
            source_type=detail.source_type,
            ingested_at=detail.ingested_at,
            doi=detail.doi,
            authors=detail.authors,
            first_author=detail.first_author,
            journal=detail.journal,
            publication_year=detail.publication_year,
            pmid=detail.pmid,
            pmcid=detail.pmcid,
            primary_domain=detail.primary_domain,
        )


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()
