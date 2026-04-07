# Abby Wiki RAG + Claude Routing Fix

**Date:** 2026-04-07
**Module:** Abby AI / Wiki Knowledge Base
**Type:** Bug Fix

## Summary

Fixed Abby's inability to answer wiki-based questions. Three compounding issues prevented wiki knowledge from reaching users: missing Claude API key causing fallback to MedGemma (which poorly utilizes RAG context), PHI sanitizer false positives on research paper author names in the system prompt, and a ChromaDB where-filter bug in wiki slug queries.

## Root Causes

### 1. Claude API Key Not Wired (`CLAUDE_API_KEY`)

The `docker-compose.yml` python-ai service uses `${CLAUDE_API_KEY:-}` which reads from the **host shell environment**, not from `backend/.env`. The key existed in `.claudeapikey` but was never exported to the root `.env` that Docker Compose uses for variable interpolation.

**Fix:** Added `CLAUDE_API_KEY` to root `.env` for persistent Docker Compose interpolation.

### 2. PHI Sanitizer False Positives on RAG Context

When Claude routing activates, the PHI sanitizer scans text before sending to the cloud. The scan covered the **entire system prompt** including RAG-retrieved content (paper titles, author names like "George Hripcsak"). spaCy NER flagged these as PERSON entities → `phi_detected=True` → automatic fallback to local MedGemma.

**Fix:** Narrowed PHI scan scope to **user-supplied text only** (message + conversation history). The system prompt contains curated knowledge base content that is published research, not patient data.

### 3. Missing spaCy Model (`en_core_web_sm`)

The PHI sanitizer requires spaCy's `en_core_web_sm` model for NER. It was not installed in the Docker image, causing a hard crash (`OSError: [E050]`) on the first Claude-routed request.

**Fix:** Added `python -m spacy download en_core_web_sm` to the Dockerfile pip install step.

### 4. ChromaDB Where-Filter Bug

`_query_chroma_slugs()` in the wiki engine passed `{"workspace": "platform", "source_slug": "..."}` as a ChromaDB `where` filter. ChromaDB requires compound filters to use `$and`/`$or` operators — a multi-key dict raises `ValueError`.

**Fix:** Wrapped compound filters in `{"$and": [{...}, {...}]}`.

### 5. Sources Never Populated in Chat Response

The `sources` field in Abby's chat response was only populated by the grounded-definition fast path. When questions went through the main Claude or local model path, `sources` stayed empty even though RAG results existed.

**Fix:** Added source extraction from `get_ranked_rag_results()` for non-grounded responses, filtered to score ≥ 0.5.

## Files Changed

| File | Change |
|------|--------|
| `ai/app/routers/abby.py` | PHI scan scope narrowed to user text; source population from RAG |
| `ai/app/wiki/engine.py` | ChromaDB `$and` filter for compound where clauses |
| `docker/python/Dockerfile` | Added spaCy `en_core_web_sm` download |

## Verification

```
# Before: all requests fell back to local
Model: local, Reason: claude_unavailable → phi_blocked
Sources: 0
Reply: "No specific information provided..."

# After: Claude with wiki RAG grounding
Model: claude, Reason: stage2_complexity_score
Confidence: high
Sources: 5 (Knowledge Base Papers + conversation memory)
Reply: Detailed answer citing DQD framework, 3300+ checks, OHDSI data quality categories
```

Paper-specific wiki queries (`/wiki/query`) were already functional — the fix was specifically for the Abby chat path (`/abby/chat` with `page_context: commons_ask_abby`).
