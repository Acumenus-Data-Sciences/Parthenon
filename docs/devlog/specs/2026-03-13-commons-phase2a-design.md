# Commons Phase 2a: Rich Communication — Design Spec

**Date:** 2026-03-13
**Scope:** Threaded replies, message edit/delete UI, typing indicators
**Depends on:** Phase 1 (Foundation) — channels, messages, WebSocket infrastructure

---

## Overview

Phase 2a extends the Commons messaging system with threaded conversations, inline message editing and deletion, and a minimal typing indicator. All features build on the existing Reverb WebSocket infrastructure from Phase 1.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Thread UI | Inline expansion | Replies expand below parent in the main list; no separate panel |
| Thread depth | One level of nesting | Direct replies (depth 1) and reply-to-replies (depth 2); no deeper |
| Edit/Delete UI | Three-dot hover menu | Extensible for future actions (Pin, Copy link); familiar pattern |
| Typing indicator | Minimal dot animation | No user names; three animated dots; simplest UX |

---

## 1. Database Changes

Single migration adding one column to `commons_messages`:

- **`depth`** — `tinyInteger`, default `0`. Top-level = 0, direct reply = 1, reply-to-reply = 2. Max depth of 2 enforced at the application layer.

**Already exists from Phase 1 (no changes needed):**
- `parent_id` — nullable foreign key to `commons_messages.id` with cascade on delete
- `is_edited` — boolean, default false
- `deleted_at` — soft-delete timestamp
- Partial index on `parent_id WHERE parent_id IS NOT NULL`

---

## 2. Backend API Changes

### Modified Endpoints

**`GET /channels/{slug}/messages`**
- Returns top-level messages only (`WHERE parent_id IS NULL`)
- Each message includes `reply_count` (integer) and `latest_reply_at` (timestamp) via Eloquent `withCount('replies')` and `withMax('replies', 'created_at')`
- `reply_count` includes soft-deleted replies (they show as "[message deleted]" in the UI, so they still count)
- Real-time `reply_count` updates: when a `MessageSent` broadcast arrives with a non-null `parent_id`, the frontend increments the parent message's `reply_count` in the query cache optimistically — no refetch needed

**`POST /channels/{slug}/messages`**
- Accepts optional `parent_id` in request body
- Validation rules:
  - Parent message must exist and belong to the same channel
  - If parent `depth = 1`, new reply gets `depth = 2`
  - If parent `depth = 2`, reject with 422 (max depth exceeded)
  - If parent `depth = 0`, new reply gets `depth = 1`

**`PATCH /messages/{id}`** — Existing edit endpoint. No changes needed.

**`DELETE /messages/{id}`** — Existing soft-delete endpoint. No changes needed.

### New Endpoint

**`GET /channels/{slug}/messages/{message}/replies`**
- Returns all replies for a given parent message
- Ordered by `created_at ASC`
- Flat list; frontend uses `depth` field to determine indentation

### Broadcasting Changes

**`MessageSent` event:**
- Add `parent_id` and `depth` to the broadcast payload
- Clients can slot replies into the correct thread without refetching

**`MessageUpdated` event:**
- No changes needed; already broadcasts edit and delete state

**Typing indicator:**
- Uses Echo client-side whisper on the existing `.private('commons.channel.{channelId}')` subscription (same channel used by `useChannelSubscription` for message events)
- Client calls `channel.whisper('typing', { user_id, user_name })` — whispers require private/presence channels, so this is auth-gated
- No server endpoint; whispers are peer-to-peer via Reverb
- 3-second debounce on send, 3-second timeout on receive

---

## 3. Frontend Components

### MessageItem (modified)

- **Three-dot menu on hover:** Appears at top-right corner on mouse enter
  - **Reply** — expands thread inline, focuses compact composer
  - **Edit** — own messages only; swaps body to editable textarea
  - **Delete** — own messages or admin; shows confirmation dialog
- **Reply count link:** If `reply_count > 0`, shows clickable "N replies" below message body; clicking expands thread

### ThreadView (new)

- Rendered inline below parent message when expanded
- Fetches replies via `GET /channels/{slug}/messages/{message}/replies`
- Indentation: `depth=1` → ~24px left padding, `depth=2` → ~48px
- Compact composer at bottom for adding replies
- Reply composer logic:
  - Replying to a `depth=0` parent → `parent_id = parent.id`, `depth = 1`
  - Replying to a `depth=1` message → `parent_id = that message.id`, `depth = 2`
  - Replying to a `depth=2` message → `parent_id = that message's parent_id` (caps at `depth=2`; the reply appears as a sibling of the depth-2 message, not nested deeper)
- Real-time: listens for `MessageSent` events with matching `parent_id` and appends

### EditMessageInline (new)

- Replaces message body with textarea pre-filled with original markdown source
- Save button → `PATCH /messages/{id}` request; Cancel → restores original view
- On success, `MessageUpdated` broadcast updates all clients
- Edited messages show "(edited)" tag after the body

### DeleteConfirmation (new)

- Simple confirmation dialog: "Delete this message?" (soft delete — no user-facing restore UI)
- `DELETE /messages/{id}` → `MessageUpdated` broadcast with `action: 'deleted'`
- Deleted messages render as "[message deleted]" in grey italic
- If deleted message had replies, replies remain visible (parent shows deleted state)

### TypingIndicator (new)

- Positioned at bottom of message list, above the composer
- Shows three animated dots when any `typing` whisper is received
- 3-second timeout: no new whisper → dots disappear
- Composer fires whisper on `keydown`, debounced to once per 3 seconds
- No user names displayed

---

## 4. Data Flows

### Sending a Reply

1. User clicks "Reply" on a message → thread expands, compact composer appears
2. User types and submits → `POST /channels/{slug}/messages` with `parent_id` and `body`
3. Backend validates depth, saves message, broadcasts `MessageSent` with `parent_id` and `depth`
4. All clients with thread expanded receive broadcast and append the reply
5. All clients see `reply_count` increment on the parent message

### Editing a Message

1. User hovers → three-dot menu → "Edit"
2. Message body swaps to editable textarea with original markdown
3. User modifies and clicks Save → `PATCH /messages/{id}`
4. Backend re-renders markdown, sets `is_edited = true`, broadcasts `MessageUpdated`
5. All clients update the message in place, showing "(edited)" tag

### Deleting a Message

1. User hovers → three-dot menu → "Delete" → confirmation dialog
2. `DELETE /messages/{id}` → soft delete (`deleted_at` set)
3. Backend broadcasts `MessageUpdated` with `action: 'deleted'`
4. All clients replace message body with "[message deleted]"
5. Replies to deleted messages remain visible

### Typing Indicator

1. User starts typing → `channel.whisper('typing', { user_id, user_name })` (debounced 3s)
2. Other clients receive whisper → show animated dots for 3 seconds
3. Timer resets on each new whisper
4. No whispers for 3s → dots disappear

---

## 5. Files Modified/Created

### Backend
- **Modify:** `database/migrations/` — new migration adding `depth` column to `commons_messages`
- **Modify:** `app/Http/Controllers/Api/V1/Commons/MessageController.php` — add `replies()` action, update `index()` for `withCount`, update `store()` for depth validation
- **Modify:** `app/Http/Requests/Commons/SendMessageRequest.php` — add `parent_id` validation rules
- **Modify:** `app/Models/Commons/Message.php` — add `replies` relationship, `depth` fillable
- **Modify:** `app/Events/MessageSent.php` — include `parent_id` and `depth` in broadcast payload
- **Modify:** `routes/api.php` — add replies route

### Frontend
- **Modify:** `features/commons/components/MessageItem.tsx` — add hover menu, reply count link
- **Create:** `features/commons/components/ThreadView.tsx` — inline thread expansion
- **Create:** `features/commons/components/EditMessageInline.tsx` — inline message editor
- **Create:** `features/commons/components/DeleteConfirmation.tsx` — delete confirmation dialog
- **Create:** `features/commons/components/TypingIndicator.tsx` — animated dots
- **Create:** `features/commons/components/MessageActionMenu.tsx` — three-dot dropdown menu
- **Modify:** `features/commons/hooks/useEcho.ts` — handle `parent_id` in `MessageSent` for reply count updates

## 6. Privacy Note

When a message is deleted (soft delete), the `MessageUpdated` broadcast should null out `body` and `body_html` in the payload. The `action: 'deleted'` flag tells clients to render "[message deleted]" — no need to transmit the original content.

---

## 7. Out of Scope (Phase 2b)

- Direct messages (DM channels)
- @mention autocomplete
- File uploads and attachments
- Read receipts
- Message reactions/emoji
