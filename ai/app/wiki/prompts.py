"""Prompt builders for the LLM-maintained wiki engine."""

from __future__ import annotations


def build_ingest_prompt(schema: str, workspace: str, source_title: str, source_text: str) -> str:
    return f"""You maintain a persistent markdown wiki.

Return JSON only with this shape:
{{
  "pages": [
    {{
      "type": "entity|concept|comparison|analysis",
      "title": "Page title",
      "summary": "One sentence summary",
      "body": "Markdown body using wikilinks like [[other-page]] when useful",
      "keywords": ["keyword"],
      "links": ["other-page"]
    }}
  ]
}}

Schema:
{schema}

Workspace: {workspace}
Source title: {source_title}

Source text:
{source_text[:12000]}
"""


def build_query_prompt(question: str, page_context: str) -> str:
    return f"""Answer the question using only the provided wiki context.

If the context is incomplete, say so directly.
Use concise markdown.

Question:
{question}

Wiki context:
{page_context[:12000]}
"""


def build_lint_prompt(page_title: str, page_body: str) -> str:
    return f"""Review this wiki page for factual drift, structure issues, or broken organization.
Return a short markdown note.

Title: {page_title}

Body:
{page_body[:12000]}
"""

