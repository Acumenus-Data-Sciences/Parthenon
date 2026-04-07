"""Prompt builders for the LLM-maintained wiki engine."""

from __future__ import annotations


def build_ingest_prompt(schema: str, workspace: str, source_title: str, source_text: str) -> str:
    return f"""You are a wiki editor that creates clean, structured knowledge pages from research papers.

Given the source text below, extract and return JSON with this shape:
{{
  "pages": [
    {{
      "type": "concept",
      "title": "The actual paper title (clean, properly capitalized)",
      "body": "Structured markdown (see rules below)",
      "keywords": ["3-5 topical keywords like: OMOP, ETL, cohort, pharmacovigilance"],
      "links": []
    }}
  ]
}}

Rules for the body field:
- Start with a **one-paragraph abstract/summary** of the paper's purpose and findings.
- Then add a **## Authors** section listing author names ONLY (no affiliations, no superscripts, no department names).
- Then add a **## Key Findings** section with 3-5 bullet points of the main results or contributions.
- Then add a **## Methods** section with 1-2 sentences about the approach.
- Do NOT include raw affiliation text, addresses, postal codes, department names, or institutional details.
- Do NOT include editor names, review dates, DOIs, page numbers, or journal metadata.
- Do NOT dump raw text. Synthesize and clean it.
- Use proper markdown formatting.

Schema:
{schema}

Workspace: {workspace}
Source title: {source_title}

Source text:
{source_text[:12000]}
"""


def build_query_prompt(question: str, page_context: str, focus_title: str | None = None) -> str:
    focus_block = ""
    if focus_title:
        focus_block = f"""
Current paper focus:
{focus_title}
"""

    return f"""Answer the question using only the wiki context below.

Rules:
- Output ONLY the final answer in concise markdown. No reasoning, no chain of thought, no preamble.
- If the context is incomplete, say so in one sentence.
- Do not repeat the question.
- Do not explain your reasoning process.
- Prioritize the current paper focus when it is provided, but note clearly when broader wiki context is also being used.

Question: {question}
{focus_block}

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
