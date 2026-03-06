# Abby AI Assistant — P2: Conversation Persistence

**Date:** 2026-03-06
**Scope:** Database persistence for Abby conversations + frontend conversation history UI

## What Was Built

### Backend: Database Schema + API

**Migration:** `2026_03_06_400001_create_abby_conversations_table.php`
- `abby_conversations` table: id, user_id (FK→users cascade), title (varchar 500 nullable), page_context (varchar 64 default 'general'), timestamps
- `abby_messages` table: id, conversation_id (FK→abby_conversations cascade), role (varchar 16), content (text), metadata (json nullable), created_at only (no updated_at)
- Indexes on user_id and conversation_id

**Models:**
- `AbbyConversation` — fillable: title, user_id, page_context; relations: user(), messages(); scope: forUser()
- `AbbyMessage` — fillable: conversation_id, role, content, metadata; cast: metadata as array; UPDATED_AT = null

**Controller:** `AbbyConversationController` — CRUD for conversations
- `GET /api/v1/abby/conversations` — paginated list, newest first, withCount('messages')
- `GET /api/v1/abby/conversations/{id}` — with messages, ownership verified
- `POST /api/v1/abby/conversations` — optional title/page_context
- `DELETE /api/v1/abby/conversations/{id}` — ownership verified, cascade delete

**AbbyAiController modifications:**
- `chat()`: accepts optional `conversation_id`; auto-creates conversation if none; saves user + assistant messages; returns conversation_id in response
- `chatStream()`: resolves/creates conversation before streaming; emits `conversation_id` SSE event first; accumulates streamed tokens; persists assistant message after stream completes
- All persistence wrapped in try/catch — failures never break AI responses

### Frontend: Conversation History UI

**abbyStore.ts additions:**
- `conversationId: string | null` — tracks active conversation
- `conversationList: ConversationSummary[]` — cached list of past conversations
- `clearMessages()` also resets conversationId

**AbbyPanel.tsx enhancements:**
- **History sidebar** — full-panel overlay triggered by Clock icon in header
  - Lists conversations with title, relative timestamp, message count
  - Active conversation highlighted
  - Click to load, X to delete, ChevronLeft to go back
  - Empty state: "No past conversations"
- **Conversation loading** — fetches full conversation with messages from API, replaces store messages
- **Auto-persistence** — sends `conversation_id` with chat requests; picks up new conversation_id from SSE events
- **New Chat button** — clears messages and conversationId, starts fresh
- **Conversation list auto-refresh** — fetches on panel open

## API Routes (12 total for Abby)

```
POST   /api/v1/abby/build-cohort
POST   /api/v1/abby/create-cohort
POST   /api/v1/abby/chat
POST   /api/v1/abby/chat/stream
POST   /api/v1/abby/suggest-criteria
POST   /api/v1/abby/explain
POST   /api/v1/abby/suggest-protocol
POST   /api/v1/abby/refine
GET    /api/v1/abby/conversations          (NEW)
POST   /api/v1/abby/conversations          (NEW)
GET    /api/v1/abby/conversations/{id}     (NEW)
DELETE /api/v1/abby/conversations/{id}     (NEW)
```

## Verification

- Migration ran successfully
- Routes compile (`artisan route:list --path=abby` — 12 routes)
- TypeScript compiles clean (`npx tsc --noEmit`)
- Production build succeeds (`npx vite build` in Docker)
- Models have proper types, relations, and scopes

## Files Created
- `backend/database/migrations/2026_03_06_400001_create_abby_conversations_table.php`
- `backend/app/Models/App/AbbyConversation.php`
- `backend/app/Models/App/AbbyMessage.php`
- `backend/app/Http/Controllers/Api/V1/AbbyConversationController.php`

## Files Modified
- `backend/app/Http/Controllers/Api/V1/AbbyAiController.php` — conversation persistence in chat() and chatStream()
- `backend/routes/api.php` — conversation resource routes
- `frontend/src/stores/abbyStore.ts` — conversationId, conversationList state
- `frontend/src/components/layout/AbbyPanel.tsx` — history sidebar, load/delete/switch, auto-persist
