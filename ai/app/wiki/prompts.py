"""Prompt builders for the LLM-maintained wiki engine."""

from __future__ import annotations

from app.wiki.tagging import primary_domain_prompt_block, secondary_tags_prompt_block


def build_ingest_prompt(
    schema: str,
    workspace: str,
    source_title: str,
    source_text: str,
    *,
    doi: str = "",
    authors: str = "",
    journal: str = "",
    publication_year: str = "",
) -> str:
    return f"""You are a wiki editor that creates clean, structured knowledge pages from research papers.

Given the source text below, extract and return JSON with this shape:
{{
  "pages": [
    {{
      "type": "concept",
      "title": "The actual paper title (clean, properly capitalized)",
      "body": "Structured markdown (see rules below)",
      "primary_domain": "one primary domain tag from the controlled vocabulary below",
      "keywords": ["3-7 secondary tags from the controlled vocabulary below"],
      "links": []
    }}
  ]
}}

Rules for the body field:
- Start with a **one-paragraph abstract/summary** of the paper's purpose and findings.
- Then add a **## Authors** section listing author names ONLY.
- Then add a **## Key Findings** section with 3-5 bullet points of the main results or contributions.
- Then add a **## Methods** section with 1-2 sentences about the approach.
- Use the authoritative bibliographic metadata below over anything noisy or contradictory in the PDF text.
- Use the authoritative title and author list from the metadata below instead of guessing from the PDF.
- Do NOT include raw affiliation text, addresses, postal codes, department names, or institutional details.
- Do NOT include editor names, review dates, DOIs, page numbers, or journal metadata.
- Do NOT dump raw text. Synthesize and clean it.
- Use proper markdown formatting.
- Choose exactly one `primary_domain` from this controlled vocabulary:
{primary_domain_prompt_block()}
- Choose 3-7 `keywords` from this controlled vocabulary:
{secondary_tags_prompt_block()}
- Do not invent tags outside this vocabulary.

Schema:
{schema}

Workspace: {workspace}
Source title: {source_title}
Bibliographic metadata (authoritative):
- Title: {source_title}
- Authors: {authors or "Unknown"}
- Journal: {journal or "Unknown"}
- Year: {publication_year or "Unknown"}
- DOI: {doi or "Unknown"}

Source text:
{source_text[:12000]}
"""


def build_query_prompt(question: str, page_context: str, focus_title: str | None = None) -> str:
    focus_block = ""
    if focus_title:
        focus_block = f"""
Current paper focus: {focus_title}
Ground your answer primarily in this paper's content. When drawing on other wiki pages, say so explicitly.
"""

    return f"""You are a knowledgeable research assistant helping a clinical informatician understand research papers in the OHDSI/OMOP health informatics domain.

Answer the question below using the wiki context provided. Be **specific and substantive** — reference actual methods, datasets, findings, metrics, and author contributions from the context. Do not give vague or generic summaries.

Guidelines:
- Cite specific details: study populations, statistical methods, key results with numbers, named tools or standards.
- When the paper describes a method or workflow, explain the steps concretely.
- If the context does not contain enough information to fully answer, state what is covered and what is missing.
- Use well-structured markdown with headers, bullet points, or numbered lists where appropriate.
- Do not repeat the question or add preamble.
{focus_block}
Question: {question}

Wiki context:
{page_context[:18000]}
"""


def build_lint_prompt(page_title: str, page_body: str) -> str:
    return f"""Review this wiki page for factual drift, structure issues, or broken organization.
Return a short markdown note.

Title: {page_title}

Body:
{page_body[:12000]}
"""
