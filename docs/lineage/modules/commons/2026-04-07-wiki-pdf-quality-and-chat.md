# Wiki PDF Quality, Chat Context, and Engine Refactor

**Date:** 2026-04-07
**Status:** Implemented
**Scope:** Fix fake PDF detection, add paper-scoped chat, refactor wiki engine, harden scraper

## Problem

After ingesting ~1,800 OHDSI research papers via the harvester pipeline, users saw "Unable to Load PDF" errors on ~91 papers in the wiki Knowledge Base. The root cause was twofold:

1. **Scraper accepted junk downloads**: The `download_pdf()` function in `OHDSI-scraper/harvester.py` had a fallback condition (`len(resp.content) > 10000`) that saved any HTTP response larger than 10KB as a PDF—including HTML login pages, cookie consent walls, and PMC error pages.

2. **Backend trusted file extensions over content**: The wiki engine and download endpoint served files based on `.pdf` extension alone, never checking whether the bytes were actually a valid PDF.

## What Changed

### Scraper hardening (`OHDSI-scraper/harvester.py`)
- Removed the size-based fallback that treated any large response as a PDF
- Added early rejection of HTML/XML content types (login walls, error pages)
- Added `%PDF-` magic byte validation—only files whose first 5 bytes match the PDF header are saved
- Upgraded logging from silent skip to explicit debug messages for rejected downloads

### Wiki engine refactor (`ai/app/wiki/engine.py`)
- Extracted `_page_detail_from_entry()` to centralize page detail construction with source file resolution
- Added `_entry_maps()` and `_source_filename_map()` helpers to avoid repeated directory scans
- In `_page_detail_from_entry()`: when `source_type == "pdf"`, the engine now reads the first 5 bytes of the source file. If the magic header isn't `%PDF-`, it nullifies `stored_filename` and `source_type`, which hides the "View PDF" button in the frontend
- Added `_resolve_query_details()` for paper-scoped semantic search (ChromaDB + keyword fallback)
- Added `_build_query_context()` for focused paper context in wiki chat prompts
- Reused a persistent `httpx.AsyncClient` for Ollama calls instead of creating one per request

### Download endpoint (`ai/app/routers/wiki.py`)
- Added `_detect_media_type()` that checks file magic bytes instead of trusting the extension
- Files with `.pdf` extension but HTML content are now served as `text/html` (defense in depth)

### Wiki chat enhancements
- Wiki queries now accept `pageSlug` and `sourceSlug` parameters for paper-scoped answers
- Chat context is scoped per paper (by `source_slug`), so switching papers gives each its own conversation
- `WikiChatDrawer` wired up as an expandable full-height chat panel
- `WikiChatPanel` shows current paper title and supports expand-to-drawer

### Infinite render loop fix (`WikiPage.tsx`)
- The Zustand selector `s.chatMessagesByScope[chatScopeId] ?? []` created a new array reference on every call when the scope key didn't exist, causing React to re-render infinitely
- Fixed by moving the `?? EMPTY_CHAT` fallback outside the selector so Zustand sees stable `undefined`

## Impact

- **225 papers** with valid PDFs: "View PDF" button works correctly
- **91 papers** with fake PDFs (HTML saved as .pdf): button is now hidden, no more browser errors
- Future scraper runs will not download junk files
- Wiki chat answers are now scoped to the paper being viewed

## Files Modified

### Python AI service
- `ai/app/wiki/engine.py` — major refactor with PDF validation and query scoping
- `ai/app/routers/wiki.py` — magic-byte content type detection
- `ai/app/wiki/models.py` — added query request fields
- `ai/app/wiki/prompts.py` — focus-aware query prompt
- `ai/app/wiki/index_ops.py` — search_index accepts pre-loaded entries

### Laravel backend
- `backend/app/Http/Controllers/Api/V1/WikiController.php` — pass new query params
- `backend/app/Services/AiService.php` — forward pageSlug/sourceSlug to AI service

### React frontend
- `frontend/src/features/commons/components/wiki/WikiPage.tsx` — chat scoping, render loop fix
- `frontend/src/features/commons/components/wiki/WikiChatPanel.tsx` — paper title display
- `frontend/src/features/commons/components/wiki/WikiChatDrawer.tsx` — full chat drawer
- `frontend/src/features/commons/types/wiki.ts` — WikiChatMessage, WikiQueryRequest types
- `frontend/src/features/commons/api/wiki.ts` — updated query mutation
- `frontend/src/stores/wikiStore.ts` — per-scope chat message storage

### Scraper
- `OHDSI-scraper/harvester.py` — PDF validation in download_pdf()
