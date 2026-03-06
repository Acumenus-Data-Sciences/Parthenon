# Abby AI Assistant — Platform-Wide Enhancement

**Date:** 2026-03-06
**Scope:** P0 (Global Presence + Auto-Context), P0.5 (System Prompts), P1.1 (Help Ingestion), P1.2 (SSE Streaming), P1.3 (User Profile), P3.1 (Markdown Rendering)

## What Was Built

Transformed Abby from a disconnected, page-unaware chat drawer into a unified, context-aware AI assistant with streaming responses and markdown rendering.

### Architecture Changes

**Before:** Two disconnected panels:
- `AiDrawer.tsx` — simple global chat, hardcoded "general" context, messages lost on close
- `AbbyAiPanel.tsx` — cohort-specific panel with build/refine mutations, only on CohortDefinitionDetailPage

**After:** Single unified `AbbyPanel.tsx` with:
- Zustand-backed persistent messages (survive open/close)
- Route-aware context detection (22 page contexts)
- Per-context suggested prompts and welcome messages
- SSE streaming with graceful fallback to non-streaming
- Markdown rendering (react-markdown + remark-gfm)
- User profile injection (name, roles)
- Help content knowledge injection from 30 help JSON files

### Files Created
| File | Purpose |
|------|---------|
| `frontend/src/stores/abbyStore.ts` | Zustand store: panel state, messages, page context, streaming |
| `frontend/src/hooks/useAbbyContext.ts` | Route-to-context mapping (22 patterns) |
| `frontend/src/components/layout/AbbyPanel.tsx` | Unified AI panel replacing AiDrawer |

### Files Modified
| File | Change |
|------|--------|
| `frontend/src/stores/uiStore.ts` | Removed aiDrawer state (moved to abbyStore) |
| `frontend/src/components/layout/MainLayout.tsx` | AiDrawer -> AbbyPanel |
| `frontend/src/components/layout/Header.tsx` | abbyStore.togglePanel |
| `frontend/src/hooks/useGlobalKeyboard.ts` | abbyStore.togglePanel |
| `frontend/src/components/layout/CommandPalette.tsx` | abbyStore.togglePanel |
| `frontend/src/styles/components/ai.css` | Markdown styles (headers, lists, tables, code, links) |
| `frontend/package.json` | +react-markdown, +remark-gfm |
| `ai/app/routers/abby.py` | 22 system prompts, help ingestion, streaming endpoint, user profile |
| `backend/.../AbbyAiController.php` | chatStream() SSE proxy, user_profile validation |
| `backend/routes/api.php` | POST abby/chat/stream route |
| `docker/nginx/default.conf` | SSE location block (fastcgi_buffering off) |
| `docker-compose.yml` | Help files volume mount + HELP_DIR env for AI container |

### Files Deleted
| File | Reason |
|------|--------|
| `frontend/src/components/layout/AiDrawer.tsx` | Replaced by AbbyPanel |

## Key Decisions

1. **Zustand over useState**: Messages persist across panel open/close without needing backend persistence (P2 adds DB persistence later).

2. **SSE with fallback**: Frontend tries `POST /abby/chat/stream` first. If the response isn't `text/event-stream` or fails, falls back to the existing non-streaming `POST /abby/chat`. This makes the feature resilient even if Ollama is down.

3. **Help content at startup**: Python AI service loads all 30 help JSONs at import time and injects relevant content into system prompts based on `CONTEXT_HELP_KEYS` mapping. No RAG needed — the help files are small enough to include directly.

4. **CohortDefinitionDetailPage AbbyAiPanel preserved**: The cohort-specific AbbyAiPanel (with build/refine mutations) remains separate and untouched. It serves a different purpose (structured cohort building) than the global conversational panel.

5. **Context key normalization**: Changed from hyphenated keys (`cohort-builder`) to underscored (`cohort_builder`) in the frontend to match React/JS conventions. Python prompts updated to match.

## Page Context Mapping (22 contexts)

| Route Pattern | Context Key | Label |
|--------------|-------------|-------|
| `/cohort-definitions/:id` | `cohort_builder` | Cohort Builder |
| `/cohort-definitions` | `cohort_list` | Cohort Definitions |
| `/concept-sets/:id` | `concept_set_editor` | Concept Set Editor |
| `/concept-sets` | `concept_set_list` | Concept Sets |
| `/data-sources/:id` | `data_explorer` | Data Explorer |
| `/data-explorer` | `data_explorer` | Data Explorer |
| `/data-sources` | `data_sources` | Data Sources |
| `/analyses/*` | `analyses` | Analyses |
| `/genomics/*` | `genomics` | Genomics |
| `/imaging/*` | `imaging` | Imaging |
| `/heor/*` | `heor` | Health Economics |
| `/data-quality/*` | `data_quality` | Data Quality |
| `/admin/*` | `administration` | Administration |
| `/studies/*` | `studies` | Studies |
| `/vocabulary/*` | `vocabulary` | Vocabulary |
| `/incidence-rates/*` | `incidence_rates` | Incidence Rates |
| `/estimation/*` | `estimation` | Estimation |
| `/prediction/*` | `prediction` | Prediction |
| `/profiles/*` | `patient_profiles` | Patient Profiles |
| `/ingestion/*` | `data_ingestion` | Data Ingestion |
| `/care-bundles/*` | `care_gaps` | Care Gaps |
| `/` | `dashboard` | Dashboard |

## Gotchas

- **nginx SSE location block must come BEFORE general `/api` block** — otherwise buffering stays on and tokens don't stream to the client.
- **Docker `dist/` dir owned by root** — Vite build must run via `docker compose exec node` (not host), or you get EACCES on rebuild.
- **Help files loaded at Python module import** — if the mount isn't ready at container start, help content is empty. The `HELP_DIR` env var and fallback path handle local dev.
- **`react-markdown` must be installed in both host and Docker** node_modules — Docker volume mount shadows host node_modules.

## What's Next (P2+)

- P2.1: Conversation persistence (abby_conversations + abby_messages tables)
- P2.2: Suggestion action chips from LLM responses
- P3.2: Proactive contextual nudges (useAbbyNudge hook)
- P4: Deployment hardening (ABBY_ENABLED feature flag, health endpoint)
