"""Core wiki engine for ingest, browse, query, and lint operations."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.config import settings
from app.wiki.adapters.base import build_frontmatter, extract_wikilinks, parse_markdown_page, slugify
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

    def init_workspace(self, workspace: str | None = None) -> WikiWorkspace:
        workspace_name = self._normalize_workspace(workspace)
        init_wiki_repo(self.root_dir)
        workspace_dir = ensure_workspace_structure(self.root_dir, workspace_name)
        commit_paths = [self.root_dir / SCHEMA_PATH, workspace_dir / "index.md", workspace_dir / "log.md"]
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
        entries = search_index(workspace_dir, query or "") if query else read_index(workspace_dir)
        return [self._entry_to_summary(workspace_dir.name, entry) for entry in entries]

    def get_page(self, workspace: str | None, slug: str) -> WikiPageDetail:
        workspace_dir = self._workspace_dir(workspace)
        entry = next((candidate for candidate in read_index(workspace_dir) if candidate.slug == slug), None)
        if entry is None:
            raise FileNotFoundError(f"Wiki page '{slug}' not found in workspace '{workspace_dir.name}'.")

        page_path = workspace_dir / entry.path
        metadata, body = parse_markdown_page(page_path)
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
        )

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
    ) -> WikiIngestResponse:
        workspace_dir = self._workspace_dir(workspace)
        source = self.adapter.prepare_source(
            filename=filename,
            content_bytes=content_bytes,
            raw_content=raw_content,
            title=title,
        )
        source_path = workspace_dir / "sources" / source.stored_filename
        source_path.write_bytes(content_bytes if content_bytes is not None else source.content.encode("utf-8"))

        pages = await self._generate_pages(workspace_dir.name, source.title, source.content)
        created_pages: list[WikiPageSummary] = []

        source_summary = self._write_page(
            workspace_dir=workspace_dir,
            page_type="source_summary",
            title=source.title,
            body=self._source_summary_body(source),
            keywords=["source", source.source_type],
            links=[slugify(page["title"]) for page in pages],
            source_title=source.title,
        )
        created_pages.append(source_summary)

        for page in pages:
            created_pages.append(
                self._write_page(
                    workspace_dir=workspace_dir,
                    page_type=page["type"],
                    title=page["title"],
                    body=page["body"],
                    keywords=page.get("keywords", []),
                    links=page.get("links", []),
                    source_title=source.title,
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

    async def query(self, workspace: str | None, question: str) -> WikiQueryResponse:
        workspace_dir = self._workspace_dir(workspace)
        matches = search_index(workspace_dir, question)[:5]
        details = [self.get_page(workspace_dir.name, entry.slug) for entry in matches]
        if not details:
            answer = "No relevant wiki pages matched this question yet."
            citations: list[WikiPageSummary] = []
        else:
            prompt_context = "\n\n".join(
                f"# {detail.title}\n{detail.body[:2500]}" for detail in details
            )
            answer = await self._answer_question(question, prompt_context)
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
            page = self.get_page(workspace_dir.name, slug)
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

    async def _generate_pages(self, workspace: str, source_title: str, source_text: str) -> list[dict[str, str | list[str]]]:
        schema = (self.root_dir / SCHEMA_PATH).read_text(encoding="utf-8")
        prompt = build_ingest_prompt(schema, workspace, source_title, source_text)
        payload = await self._call_llm_json(prompt)
        pages = payload.get("pages") if isinstance(payload, dict) else None
        if not isinstance(pages, list):
            return self._fallback_pages(source_title, source_text)

        normalized: list[dict[str, str | list[str]]] = []
        for page in pages:
            if not isinstance(page, dict):
                continue
            title = str(page.get("title", "")).strip()
            page_type = str(page.get("type", "concept")).strip().lower()
            if not title or page_type not in WORKSPACE_PAGE_DIRS:
                continue
            normalized.append(
                {
                    "title": title,
                    "type": page_type,
                    "body": str(page.get("body", "")).strip() or self._fallback_body(title, source_text),
                    "keywords": [str(item).strip() for item in page.get("keywords", []) if str(item).strip()],
                    "links": [str(item).strip() for item in page.get("links", []) if str(item).strip()],
                }
            )
        return normalized or self._fallback_pages(source_title, source_text)

    async def _answer_question(self, question: str, page_context: str) -> str:
        try:
            return await self._call_llm_text(build_query_prompt(question, page_context))
        except Exception:
            snippets = [segment.strip() for segment in page_context.split("\n\n") if segment.strip()]
            excerpt = "\n\n".join(snippets[:3])
            return f"I found relevant wiki context but could not reach the LLM.\n\n{excerpt[:1800]}"

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

    async def _call_llm_text(self, prompt: str) -> str:
        return await self._call_ollama(prompt, expect_json=False)

    async def _call_ollama(self, prompt: str, *, expect_json: bool) -> str:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(
                f"{settings.abby_llm_base_url}/api/chat",
                json={
                    "model": settings.abby_llm_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Return JSON only." if expect_json else "Answer with concise markdown only.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "think": False,
                    "keep_alive": settings.abby_ollama_keep_alive,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": max(settings.ollama_num_predict, 512),
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return str(data.get("message", {}).get("content", "")).strip()

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
    ) -> WikiPageSummary:
        slug = slugify(title)
        relative_dir = WORKSPACE_PAGE_DIRS[page_type]
        relative_path = f"{relative_dir}/{slug}.md"
        absolute_path = workspace_dir / relative_path
        updated_at = _utc_now()
        normalized_links = sorted({link for link in links if link})
        frontmatter = build_frontmatter(
            {
                "title": title,
                "slug": slug,
                "type": page_type,
                "keywords": keywords,
                "links": normalized_links,
                "updated_at": updated_at,
                "source_title": source_title or "",
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
        )
        upsert_index_entry(workspace_dir, entry)
        return self._entry_to_summary(workspace_dir.name, entry)

    def _workspace_dir(self, workspace: str | None) -> Path:
        workspace_summary = self.init_workspace(workspace)
        return self.root_dir / workspace_summary.name

    def _normalize_workspace(self, workspace: str | None) -> str:
        return slugify(workspace or self.default_workspace)

    def _branch_for_workspace(self, workspace: str) -> str:
        branches = set(list_branches(self.root_dir))
        candidate = f"workspace/{workspace}"
        return candidate if candidate in branches else "main"

    def _fallback_pages(self, source_title: str, source_text: str) -> list[dict[str, str | list[str]]]:
        first_line = next((line.strip() for line in source_text.splitlines() if line.strip()), source_title)
        concept_title = source_title if source_title != first_line else f"{source_title} Overview"
        return [
            {
                "title": concept_title,
                "type": "concept",
                "body": self._fallback_body(concept_title, source_text),
                "keywords": [slugify(source_title).replace("-", " "), "summary"],
                "links": [],
            }
        ]

    def _fallback_body(self, title: str, source_text: str) -> str:
        excerpt = source_text.strip()[:3000]
        return f"## Summary\n\n{excerpt}\n"

    def _source_summary_body(self, source) -> str:
        excerpt = source.content.strip()[:3000]
        return (
            f"## Source\n\n"
            f"- Original filename: `{source.original_filename}`\n"
            f"- Source type: `{source.source_type}`\n\n"
            f"## Extracted Content\n\n{excerpt}\n"
        )

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
        )


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()
