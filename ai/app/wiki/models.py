"""Pydantic request/response models for wiki endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WikiWorkspace(BaseModel):
    name: str
    branch: str
    page_count: int = 0
    last_activity_at: str | None = None


class WikiPageSummary(BaseModel):
    workspace: str
    title: str
    slug: str
    page_type: str
    path: str
    keywords: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)
    updated_at: str
    source_slug: str | None = None
    source_type: str | None = None


class WikiPageDetail(WikiPageSummary):
    body: str
    source_title: str | None = None
    stored_filename: str | None = None


class WikiActivityItem(BaseModel):
    timestamp: str
    action: str
    target: str
    message: str


class WikiWorkspaceListResponse(BaseModel):
    workspaces: list[WikiWorkspace]


class WikiPageListResponse(BaseModel):
    pages: list[WikiPageSummary]
    total: int = 0


class WikiActivityResponse(BaseModel):
    activity: list[WikiActivityItem]


class WikiQueryRequest(BaseModel):
    workspace: str = "platform"
    question: str = Field(..., min_length=3, max_length=4000)


class WikiQueryResponse(BaseModel):
    workspace: str
    answer: str
    citations: list[WikiPageSummary] = Field(default_factory=list)


class WikiLintIssue(BaseModel):
    severity: str
    page_slug: str
    message: str


class WikiLintRequest(BaseModel):
    workspace: str = "platform"


class WikiLintResponse(BaseModel):
    workspace: str
    issues: list[WikiLintIssue] = Field(default_factory=list)


class WikiInitWorkspaceResponse(BaseModel):
    workspace: WikiWorkspace


class WikiIngestResponse(BaseModel):
    workspace: str
    source_slug: str
    source_title: str
    created_pages: list[WikiPageSummary] = Field(default_factory=list)
    activity: WikiActivityItem

