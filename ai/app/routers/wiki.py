"""FastAPI router for the filesystem-backed wiki engine."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.wiki.engine import WikiEngine
from app.wiki.models import (
    WikiActivityResponse,
    WikiIngestResponse,
    WikiInitWorkspaceResponse,
    WikiLintRequest,
    WikiLintResponse,
    WikiPageDetail,
    WikiPageListResponse,
    WikiQueryRequest,
    WikiQueryResponse,
    WikiWorkspaceListResponse,
)


router = APIRouter()
_engine: WikiEngine | None = None


def _get_engine() -> WikiEngine:
    global _engine
    if _engine is None:
        _engine = WikiEngine()
    return _engine


@router.get("/workspaces", response_model=WikiWorkspaceListResponse)
def list_workspaces() -> WikiWorkspaceListResponse:
    return WikiWorkspaceListResponse(workspaces=_get_engine().list_workspaces())


@router.post("/workspaces/{workspace}/init", response_model=WikiInitWorkspaceResponse)
def init_workspace(workspace: str) -> WikiInitWorkspaceResponse:
    return WikiInitWorkspaceResponse(workspace=_get_engine().init_workspace(workspace))


@router.get("/pages", response_model=WikiPageListResponse)
def list_pages(
    workspace: str = "platform",
    q: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> WikiPageListResponse:
    all_pages = _get_engine().list_pages(workspace, q)
    total = len(all_pages)
    if limit is not None:
        all_pages = all_pages[offset:offset + limit]
    return WikiPageListResponse(pages=all_pages, total=total)


@router.get("/pages/{slug}", response_model=WikiPageDetail)
def get_page(slug: str, workspace: str = "platform") -> WikiPageDetail:
    try:
        return _get_engine().get_page(workspace, slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/activity", response_model=WikiActivityResponse)
def list_activity(workspace: str = "platform", limit: int = 50) -> WikiActivityResponse:
    return WikiActivityResponse(activity=_get_engine().list_activity(workspace, limit))


@router.post("/ingest", response_model=WikiIngestResponse)
async def ingest(
    workspace: str = Form("platform"),
    title: str | None = Form(default=None),
    raw_content: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> WikiIngestResponse:
    if file is None and not raw_content:
        raise HTTPException(status_code=422, detail="Either file or raw_content is required.")

    content_bytes = await file.read() if file is not None else None
    return await _get_engine().ingest(
        workspace=workspace,
        filename=file.filename if file is not None else None,
        content_bytes=content_bytes,
        raw_content=raw_content,
        title=title,
    )


@router.post("/query", response_model=WikiQueryResponse)
async def query(request: WikiQueryRequest) -> WikiQueryResponse:
    return await _get_engine().query(
        request.workspace,
        request.question,
        page_slug=request.page_slug,
        source_slug=request.source_slug,
    )


@router.post("/lint", response_model=WikiLintResponse)
async def lint(request: WikiLintRequest) -> WikiLintResponse:
    return await _get_engine().lint(request.workspace)


def _detect_media_type(path: "Path") -> str:
    """Detect actual media type by checking file magic bytes, not just extension."""
    ext_types = {
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".txt": "text/plain",
    }
    ext = path.suffix.lower()
    if ext in ext_types:
        return ext_types[ext]

    # For .pdf files, verify they are actually PDFs via magic bytes
    if ext == ".pdf":
        try:
            with open(path, "rb") as f:
                header = f.read(5)
            if header == b"%PDF-":
                return "application/pdf"
            # Many scraped "PDFs" are actually saved HTML pages
            return "text/html"
        except OSError:
            return "application/octet-stream"

    return "application/octet-stream"


@router.get("/sources/{workspace}/{filename}")
def download_source(workspace: str, filename: str) -> FileResponse:
    """Serve an original source file (PDF, markdown, text) for viewing or download."""
    engine = _get_engine()
    workspace_dir = engine.root_dir / workspace
    source_path = workspace_dir / "sources" / filename

    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"Source file '{filename}' not found.")

    # Prevent path traversal
    try:
        source_path.resolve().relative_to(workspace_dir.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Access denied.") from exc

    media_type = _detect_media_type(source_path)

    return FileResponse(
        path=source_path,
        media_type=media_type,
        filename=filename,
    )
