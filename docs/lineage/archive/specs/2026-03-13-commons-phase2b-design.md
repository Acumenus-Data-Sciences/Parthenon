# Commons Phase 2b: Message Reactions & Unread Indicators — Design Spec

**Date:** 2026-03-13
**Scope:** Message reactions (fixed emoji set), unread count badges in sidebar
**Depends on:** Phase 2a (Threaded replies, edit/delete, typing indicators)

---

## Overview

Phase 2b adds two features to the Commons messaging system: emoji reactions on messages and unread count indicators in the channel sidebar. Both enhance existing infrastructure without introducing new WebSocket channels or major architectural changes.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Emoji set | Fixed 6 emoji | Simple, no picker library needed, clean UI |
| Reaction storage | Dedicated table | Unique constraints, clean queries, proper indexing |
| Reaction scope | All messages (top-level + replies) | Consistent UX across threads |
| Reaction tooltip | Names for <5 reactors, "and N others" for >=5 | Privacy-aware at scale |
| Unread storage | Redis-cached counts from DB query | Fast reads, bounded drift (60s TTL) |
| Unread display | Bold channel name + crimson numeric badge | Familiar Slack/Discord pattern |

---

## 1. Database Changes

### New Table: `commons_message_reactions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `bigIncrements` | Primary key |
| `message_id` | `unsignedBigInteger` | FK → `commons_messages.id` ON DELETE CASCADE |
| `user_id` | `unsignedBigInteger` | FK → `users.id` ON DELETE CASCADE |
| `emoji` | `varchar(20)` | One of the 6 allowed emoji keys |
| `created_at` | `timestamp` | When reaction was added |

**Constraints:**
- Unique index on `(message_id, user_id, emoji)` — one reaction per emoji per user per message
- Index on `message_id` for fast lookups when rendering message reactions

**No schema changes for unread indicators** — the existing `last_read_at` on `commons_channel_members` is sufficient.

### Fixed Emoji Set

| Key | Emoji | Label |
|-----|-------|-------|
| `thumbsup` | 👍 | Like |
| `heart` | ❤️ | Love |
| `laugh` | 😂 | Haha |
| `surprised` | 😮 | Wow |
| `celebrate` | 🎉 | Celebrate |
| `eyes` | 👀 | Looking |

---

## 2. Backend API Changes

### New Endpoints

**`POST /api/v1/commons/messages/{id}/reactions`**
- Body: `{ "emoji": "thumbsup" }`
- Validates `emoji` is one of the 6 allowed keys
- Toggle behavior: adds reaction if not present, removes if already exists
- Validates message is not soft-deleted (`deleted_at IS NULL`)
- Returns `{ "data": { "thumbsup": { "count": 3, "users": [{"id": 1, "name": "Dr. Smith"}], "reacted": true }, ... } }` — `reacted` is accurate here since this is a unicast response to the requesting user
- Broadcasts `ReactionUpdated` event on `commons.channel.{channel_id}`
- Rate limited: `throttle:30,1` (30 per minute)

**`GET /api/v1/commons/channels/unread`**
- Returns unread counts for all channels the authenticated user is a member of
- Response shape: `{ "data": { "general": 5, "research": 0, "data-quality": 12 } }`
- Count query: `SELECT COUNT(*) FROM commons_messages WHERE channel_id = ? AND created_at > ? AND parent_id IS NULL AND deleted_at IS NULL` (per channel, comparing against `channel_members.last_read_at`)
- Result cached in Redis: key `commons:unread:{user_id}`, TTL 60 seconds
- Cache invalidated on: new message stored, channel marked read

### Modified Endpoints

**`GET /api/v1/commons/channels/{slug}/messages`**
- Each message now includes a `reactions` summary object
- Shape: `{ "thumbsup": { "count": 3, "users": [{"id": 1, "name": "Dr. Smith"}, ...], "reacted": true }, ... }`
- Only emoji with count > 0 are included
- `reacted` boolean indicates whether the authenticated user has this reaction
- Loaded via eager loading to avoid N+1 queries: single query grouped by `(message_id, emoji)` for the message batch

**`GET /api/v1/commons/channels/{slug}/messages/{messageId}/replies`**
- Same `reactions` summary added to each reply message

### New Backend Classes

**Model: `Reaction`** (`app/Models/Commons/Reaction.php`)
- `$fillable`: `message_id`, `user_id`, `emoji`
- Relationships: `message()` (BelongsTo Message), `user()` (BelongsTo User)
- Set `const UPDATED_AT = null;` — table has only `created_at`, no `updated_at` column

**Service: `ReactionService`** (`app/Services/Commons/ReactionService.php`)
- `toggleReaction(Message $message, User $user, string $emoji): array` — adds or removes, returns summary
- `getReactionSummary(Message $message, ?User $user): array` — builds summary with user lists and `reacted` flag
- `getReactionSummaryForMessages(Collection $messages, ?User $user): array` — batch version for message lists

**Service: `UnreadService`** (`app/Services/Commons/UnreadService.php`)
- `getUnreadCounts(User $user): array` — returns `[slug => count]` map, Redis-cached
- `invalidateCache(User $user): void` — deletes Redis key
- `markRead(string $slug, User $user): void` — delegates to existing logic + invalidates cache

**Event: `ReactionUpdated`** (`app/Events/Commons/ReactionUpdated.php`)
- Broadcasts on `commons.channel.{channel_id}` (existing private channel)
- Payload: `{ message_id, emoji, user: {id, name}, action: "added"|"removed", summary: { [emoji]: { count, users: [{id, name}] } } }`
- Note: `summary` omits the `reacted` boolean because this is a broadcast to all channel members. Each client computes `reacted` locally by checking if their `user.id` is in the emoji's `users` array.

**Request: `ToggleReactionRequest`** (`app/Http/Requests/Commons/ToggleReactionRequest.php`)
- Validates: `emoji` required, in: `thumbsup,heart,laugh,surprised,celebrate,eyes`

**Controller: `ReactionController`** (`app/Http/Controllers/Api/V1/Commons/ReactionController.php`)
- `toggle(ToggleReactionRequest $request, int $id): JsonResponse`

---

## 3. Frontend Changes

### New Components

**`ReactionPills.tsx`** (`components/chat/ReactionPills.tsx`)
- Renders a row of reaction pills below message body
- Each pill: emoji + count, crimson highlight if user has reacted, gray otherwise
- Click toggles the reaction (calls `useToggleReaction` mutation)
- `+` button at the end opens `EmojiPicker`
- Hidden when no reactions exist (only `+` button visible on message hover)

**`EmojiPicker.tsx`** (`components/chat/EmojiPicker.tsx`)
- Horizontal bar with 6 emoji buttons
- Positioned as a popup (absolute, above or below trigger)
- Click-outside-to-close behavior
- Triggered from: `+` button on ReactionPills, or "React" option in MessageActionMenu

**`ReactionTooltip.tsx`** (`components/chat/ReactionTooltip.tsx`)
- Hover tooltip on reaction pills showing who reacted
- <5 users: "Dr. Smith, Dr. Jones"
- >=5 users: "Dr. Smith, Dr. Jones, Dr. Lee, Dr. Park, and 1 other"

### Modified Components

**`MessageItem.tsx`**
- Renders `<ReactionPills>` below the message body (after markdown, before reply count link)
- Passes message reactions summary and message ID

**`ThreadView.tsx`**
- Renders `<ReactionPills>` on each threaded reply

**`MessageActionMenu.tsx`**
- Adds "React" option (available to all users, not just author/admin)
- "React" opens `EmojiPicker` anchored to the menu position

**`ChannelList.tsx`**
- Channels with unread > 0: bold name (`font-semibold text-foreground`) + crimson badge
- Channels with unread = 0: normal weight (`text-muted-foreground`)
- Badge capped at "99+" for >99 unread
- Unread counts sourced from `useUnreadCounts` hook

### New Hooks

**`useUnreadCounts.ts`** (`hooks/useUnreadCounts.ts`)
- TanStack Query hook: `GET /commons/channels/unread`
- Refetch interval: 60 seconds (matches Redis TTL)
- Also updated in real-time: when `MessageSent` broadcast arrives for a channel the user is NOT currently viewing, increment that slug's count in the query cache
- When user navigates to a channel (existing `markRead` fires), set that slug's count to 0

### Modified Hooks

**`useEcho.ts`**
- `ReactionUpdated` listener: patches the message's reactions in TanStack Query cache. Derives `reacted` boolean locally by checking if authenticated user's ID is in each emoji's `users` array (broadcast omits `reacted`).
- `MessageSent` listener: if message is for a non-active channel, increment unread count in `useUnreadCounts` cache

### New API Functions

**`toggleReaction(messageId: number, emoji: string)`** → `POST /commons/messages/{id}/reactions`
**`fetchUnreadCounts()`** → `GET /commons/channels/unread`

**`useToggleReaction()`** — mutation hook with optimistic update on reaction pills
**`useUnreadCounts()`** — query hook with 60s refetch interval

### Updated Types

```typescript
// New type
interface ReactionSummary {
  [emoji: string]: {
    count: number;
    users: { id: number; name: string }[];
    reacted: boolean;
  };
}

// Updated Message interface
interface Message {
  // ... existing fields ...
  reactions: ReactionSummary;
}
```

---

## 4. File List

### New Files (Backend)
- `backend/database/migrations/2026_03_13_500005_create_commons_message_reactions_table.php`
- `backend/app/Models/Commons/Reaction.php`
- `backend/app/Services/Commons/ReactionService.php`
- `backend/app/Services/Commons/UnreadService.php`
- `backend/app/Events/Commons/ReactionUpdated.php`
- `backend/app/Http/Requests/Commons/ToggleReactionRequest.php`
- `backend/app/Http/Controllers/Api/V1/Commons/ReactionController.php`

### Modified Files (Backend)
- `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php` — add reaction summaries to message responses
- `backend/app/Http/Controllers/Api/V1/Commons/MemberController.php` — invalidate unread cache on markRead
- `backend/app/Services/Commons/MessageService.php` — invalidate unread cache on createMessage
- `backend/app/Models/Commons/Message.php` — add `reactions()` HasMany relationship
- `backend/routes/api.php` — add reaction toggle route and unread counts route

### New Files (Frontend)
- `frontend/src/features/commons/components/chat/ReactionPills.tsx`
- `frontend/src/features/commons/components/chat/EmojiPicker.tsx`
- `frontend/src/features/commons/components/chat/ReactionTooltip.tsx`
- `frontend/src/features/commons/hooks/useUnreadCounts.ts`

### Modified Files (Frontend)
- `frontend/src/features/commons/types.ts` — add `ReactionSummary`, update `Message`
- `frontend/src/features/commons/api.ts` — add `toggleReaction`, `fetchUnreadCounts`, `useToggleReaction`, `useUnreadCounts`
- `frontend/src/features/commons/hooks/useEcho.ts` — add `ReactionUpdated` listener, unread increment on `MessageSent`
- `frontend/src/features/commons/components/chat/MessageItem.tsx` — render `ReactionPills`
- `frontend/src/features/commons/components/chat/ThreadView.tsx` — render `ReactionPills` on replies
- `frontend/src/features/commons/components/chat/MessageActionMenu.tsx` — add "React" option
- `frontend/src/features/commons/components/sidebar/ChannelList.tsx` — bold + badge for unread channels

---

## 5. Data Flow

### Reactions

1. User clicks emoji pill or picks from emoji picker
2. Optimistic update: pill toggles immediately in UI
3. `POST /commons/messages/{id}/reactions` sends `{ emoji }`
4. Backend toggles reaction in DB, broadcasts `ReactionUpdated` on `commons.channel.{channel_id}`
5. All connected clients receive event → patch message reactions in TanStack Query cache
6. On error: optimistic update rolls back

### Unread Counts

1. On Commons page load: `GET /commons/channels/unread` fetches counts (Redis-cached, 60s TTL)
2. When `MessageSent` broadcast arrives for a channel the user is NOT currently viewing → increment that channel's count in local query cache
3. When user views a channel → existing `POST /commons/channels/{slug}/read` fires → sets count to 0 locally + invalidates Redis cache
4. Background refetch every 60s keeps counts synchronized

### No New WebSocket Channels

Both features piggyback on existing `commons.channel.{id}` private channels. The `ReactionUpdated` event joins `MessageSent` and `MessageUpdated` on the same channel.

---

## 6. Error Handling & Edge Cases

- **Double-click race**: Unique constraint `(message_id, user_id, emoji)` prevents duplicate reactions at DB level. Frontend disables button during pending mutation.
- **Reacting to deleted messages**: Backend validates `deleted_at IS NULL` before toggling. Returns 422 if message is deleted.
- **Stale reaction cache**: `ReactionUpdated` broadcast corrects all clients. No persistent staleness.
- **Unread counter drift**: Redis TTL of 60s bounds maximum drift. `GET /commons/channels/unread` always recomputes from DB on cache miss.
- **Already-viewing channel**: `MessageSent` for the active channel does NOT increment unread count (user is watching it).
- **Non-member channels**: Unread counts only computed for channels where user has a `channel_members` row.
- **Zero reactions**: Reaction pills row hidden entirely. Only the `+` button appears on message hover.
- **Badge overflow**: Unread badge displays "99+" for channels with >99 unread messages.

---

## 7. Out of Scope (Phase 2c+)

- @mention autocomplete
- File uploads and attachments
- Direct messages (DM channels)
- Custom emoji / emoji skin tone selection
- Reaction analytics or activity feed
