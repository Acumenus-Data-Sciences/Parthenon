# Commons DM Mentions & Real-Time Notifications — Design Spec

## Goal

Enable users to @mention collaborators in any Commons channel or DM, deliver real-time toast notifications to recipients wherever they are in the app, and let them click through to the relevant conversation.

## Architecture

**Token format:** `@[id:username]` stored raw in `commons_messages.body`. On every read, `MessageService::renderHtml()` converts tokens to styled HTML spans. The `body` column always contains raw tokens; `body_html` always contains rendered HTML — the same pattern already used for CommonMark rendering.

**Notification delivery:** Backend broadcasts a `NotificationSent` event over Laravel Reverb on each recipient's existing private channel (`App.Models.User.{id}`). Frontend subscribes globally in `MainLayout` and reacts with a toast + badge update.

**No schema changes required.** The following already exist and are reused as-is:
- `commons_notifications` table with columns: `id`, `user_id`, `type` (`mention`/`dm`/`review_assigned`/`review_resolved`/`thread_reply`), `title`, `body`, `channel_id`, `message_id`, `actor_id`, `read_at`, `created_at`, `updated_at`
- `Notification` model with `actor()`, `channel()`, `message()` relations
- `useNotifications()`, `useUnreadNotificationCount()`, `useMarkNotificationsRead(ids?)` API hooks
- `App.Models.User.{id}` channel authorization in `routes/channels.php`
- `usePresence()` hook in `frontend/src/features/commons/hooks/usePresence.ts`
- `queryClient` singleton exported from `frontend/src/lib/query-client.ts`
- `toast` singleton exported from `frontend/src/components/ui/Toast.tsx` with `toast.show(variant, message, duration)`

---

## Section 1: Backend — Mention Parsing & Notification Dispatch

### MessageService (`backend/app/Services/Commons/MessageService.php`)

**On `create()`:**

1. **Parse mentions** — regex `/@\[(\d+):[^\]]+\]/` on raw `body`. Collect unique user IDs, excluding the author. Cap at 20 recipients per message to prevent notification spam.
2. **Validate recipients** — query `users` table for the collected IDs; skip any that don't exist.
3. **Create mention notifications** — for each valid recipient: insert a `commons_notifications` row with `type=mention`, `actor_id=author_id`, `channel_id`, `message_id`, `title="{actor_name} mentioned you in #{channel_name}"`, `body=<160-char plain-text excerpt>` (tokens stripped to `@Username`, then `strip_tags()`, then `mb_substr(..., 160)` with `…` appended if truncated).
4. **DM notification** — inside the same DB transaction as the message insert, check `commons_messages` for any prior rows with the same `channel_id`. If none exist (this is the first message), create a `type=dm` notification for each channel member with `type=dm` excluding the author. Keeping this check inside the transaction prevents duplicate notifications from concurrent sends.
5. **Broadcast** — after all DB writes commit, dispatch `NotificationSent::dispatch($notification)` for each recipient notification via the queue (non-blocking).

**On `update()`:**

1. Parse mention tokens from new `body`. Parse tokens from old `body` (available via the Eloquent `$message->getOriginal('body')`).
2. Diff: collect user IDs in new tokens that are not in old tokens.
3. Create `mention` notifications only for newly added recipients. No notifications for unchanged or removed mentions.
4. DM notification is not re-sent on edit.
5. Re-render `body_html` via `renderHtml()`.

### renderHtml()

After CommonMark conversion, apply a second-pass regex:

```
@[42:Dr. Smith]  →  <span class="mention" data-user-id="42">@Dr. Smith</span>
```

Runs on both `create()` and `update()`.

**Excerpt generation** helper (private method `excerptFromBody(string $body, int $limit = 160): string`):
1. `preg_replace('/@\[(\d+):([^\]]+)\]/', '@$2', $body)` — tokens → `@Username`
2. `strip_tags($result)` — remove any HTML
3. Trim whitespace; if `mb_strlen > $limit` append `…` and truncate

### Membership validation for DM notifications

Before creating a `dm` notification for a channel member, confirm a `commons_channel_members` row exists for that `user_id` + `channel_id`. If not, skip silently.

### New Event (`backend/app/Events/Commons/NotificationSent.php`)

```php
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Commons\Notification;

class NotificationSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Notification $notification) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.User.' . $this->notification->user_id)];
    }

    public function broadcastAs(): string { return 'NotificationSent'; }

    public function broadcastWith(): array
    {
        return [
            'id'         => $this->notification->id,
            'type'       => $this->notification->type,
            'title'      => $this->notification->title,
            'body'       => $this->notification->body,
            'channel_id' => $this->notification->channel_id,
            'message_id' => $this->notification->message_id,
            'actor'      => [
                'id'   => $this->notification->actor->id,
                'name' => $this->notification->actor->name,
            ],
            'channel' => [
                'slug' => $this->notification->channel?->slug,
            ],
            'created_at' => $this->notification->created_at,
        ];
    }
}
```

---

## Section 2: Frontend — @mention Autocomplete

### MentionAutocomplete (`frontend/src/features/commons/components/chat/MentionAutocomplete.tsx`)

A floating dropdown rendered via a React portal, positioned below the cursor. Appears when `@` is typed in the composer; dismissed on Escape or when the `@` fragment is deleted.

**Data source:** `useMembers(slug)` for all channel types including DMs. DM channels have `commons_channel_members` rows. Filter client-side by the text after `@` (case-insensitive name match). Show a loading spinner while `useMembers` is loading. **Empty state:** "No members found" — no fallback to global user search.

**Keyboard navigation:** Arrow Up/Down moves selection. Enter or Tab confirms. Escape closes with no insertion.

**On selection:** Replace the `@<query>` fragment (from `@` to cursor) with `@[id:username]`. The textarea stores raw token text; no rich-text overlay in this iteration.

### MessageComposer (`frontend/src/features/commons/components/chat/MessageComposer.tsx`)

- Add `mentionQuery: string | null` and `mentionAnchorPos: { top: number; left: number } | null` state.
- On `onChange`: scan textarea value backward from `selectionStart` for an unmatched `@` not preceded by `\w`. Extract the substring as `mentionQuery`. If no `@` found, set both to null.
- Render `<MentionAutocomplete>` when `mentionQuery !== null`, positioned at `mentionAnchorPos`.
- On send: transmit raw `body` (with `@[id:username]` tokens) unchanged to the API.

### Mention rendering in MessageItem

No JS changes. `body_html` from the backend already contains the `<span class="mention">` markup. Add to global CSS:

```css
.mention {
  @apply text-teal-400 font-medium bg-teal-400/10 rounded px-0.5 cursor-default;
}
```

### Highlight-on-navigate

`MessageList` calls `useSearchParams()` directly (no prop required). On mount, if a `highlight` param is present, locate the message element by `data-message-id` attribute, scroll it into view, and apply a CSS animation class for a 2-second yellow → transparent fade. If the message ID is not in the rendered list (deleted or inaccessible), the param is silently ignored.

---

## Section 3: Frontend — Real-Time Notification Listener

### Toast.tsx extension

`ToastMessage` currently has no `action` field and `ToastContainer` renders only plain text. Add an optional `action?: { label: string; onClick: () => void }` field to `ToastMessage`. Extend `ToastContainer` to render an action button when present. Add a `MAX_TOASTS = 3` cap in the `toast.show()` function: if `toasts.length >= MAX_TOASTS`, drop the oldest before appending the new one.

### useNotificationListener (`frontend/src/features/commons/hooks/useNotificationListener.ts`)

Mounted in `MainLayout`. `queryClient` is imported directly from `@/lib/query-client` (singleton pattern used throughout the project).

```ts
import { queryClient } from '@/lib/query-client';
import { toast } from '@/components/ui/Toast';
import { getEcho } from '@/lib/echo';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface NotificationPayload {
  id: number;
  type: string;
  title: string;
  body: string;
  message_id: number | null;
  actor: { id: number; name: string };
  channel: { slug: string } | null;
}

export function useNotificationListener(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    const echo = getEcho();
    if (!echo) return;

    echo.private(`App.Models.User.${userId}`)
      .listen('.NotificationSent', (payload: NotificationPayload) => {
        const channelSlug = payload.channel?.slug;
        const action = channelSlug
          ? {
              label: 'Go to message',
              onClick: () => navigate(
                `/commons/${channelSlug}${payload.message_id ? `?highlight=${payload.message_id}` : ''}`
              ),
            }
          : undefined;

        toast.show('info', `${payload.title}\n${payload.body}`, 6000, action);
        queryClient.invalidateQueries({ queryKey: ['commons', 'notifications', 'unread-count'] });
      });

    return () => {
      echo.leave(`App.Models.User.${userId}`);
    };
  }, [userId, navigate]);
}
```

`toast.show()` signature is extended to accept an optional fourth `action` argument matching the `ToastMessage` action field.

The bell dropdown refetches its full list on open — no optimistic cache append.

### NotificationBell dropdown (`frontend/src/features/commons/components/sidebar/NotificationBell.tsx`)

Extend the existing component with a dropdown panel on click:

- Up to 20 most recent notifications, newest first.
- Each row: actor initials avatar, `title`, `body` excerpt, relative timestamp, unread indicator dot.
- **Click item:** navigate to `/commons/{channel-slug}?highlight={message-id}`, call `markNotificationsRead([id])`.
- **"Mark all read" button:** calls `markNotificationsRead()` (no `ids` = mark all). API `POST /commons/notifications/mark-read { ids? }` already exists.
- **Empty state:** "No notifications yet".
- No bulk-mark-on-open behavior.

---

## File Map

| File | Action |
|------|--------|
| `backend/app/Services/Commons/MessageService.php` | Modify — mention parsing, `excerptFromBody()`, notification creation, queued broadcast |
| `backend/app/Events/Commons/NotificationSent.php` | Create — `ShouldBroadcast` event with all three traits |
| `frontend/src/components/ui/Toast.tsx` | Modify — add `action` field to `ToastMessage`, render action button, add `MAX_TOASTS = 3` cap |
| `frontend/src/features/commons/components/chat/MentionAutocomplete.tsx` | Create — floating autocomplete dropdown |
| `frontend/src/features/commons/components/chat/MessageComposer.tsx` | Modify — `@` detection, `mentionQuery` state, render `MentionAutocomplete` |
| `frontend/src/features/commons/components/sidebar/NotificationBell.tsx` | Modify — dropdown, per-item read, "Mark all read" |
| `frontend/src/features/commons/hooks/useNotificationListener.ts` | Create — Echo subscription, toast, unread-count invalidation |
| `frontend/src/components/layout/MainLayout.tsx` | Modify — mount `useNotificationListener` |
| `frontend/src/features/commons/components/chat/MessageList.tsx` | Modify — `useSearchParams` highlight, scroll + fade animation |
| Global CSS | Add `.mention` chip style |

---

## Error Handling

| Case | Behaviour |
|------|-----------|
| Mention token referencing deleted user | Backend skips notification; `renderHtml()` renders `@Username` from stored token text |
| `?highlight` message ID not found or deleted | Silent no-op — no scroll, no error |
| DM notification for removed channel member | Notification skipped (membership check before dispatch) |
| Concurrent first-message sends to DM | Prevented by checking prior message count inside the insert transaction |
| Echo unavailable | `useNotificationListener` exits; 30s poll fallback for unread count |
| Broadcast failure | Non-fatal `try/catch` in `MessageService`; message saved, notification DB row exists |
| > 20 mentions in one message | Capped at 20 recipients; extras silently dropped |
| Toast storm | `MAX_TOASTS = 3` cap in `toast.show()`; oldest dropped when exceeded |

---

## Testing

**Backend (Pest):**
- Mention parsing: 0, 1, multiple mentions; self-mention excluded; invalid user ID skipped; cap at 20 enforced
- `excerptFromBody()`: tokens → `@Username`, HTML stripped, truncated at 160 chars with `…`
- DM notification: fires on first message only; concurrent insert safety (transaction); skips removed members
- Edit diff: only new mentions notified; no re-notification for unchanged mentions
- `NotificationSent` event: correct channel, correct payload, `broadcastOn()` returns array

**Frontend (Vitest):**
- `Toast.tsx`: action button renders and fires `onClick`; `MAX_TOASTS` cap drops oldest
- `MentionAutocomplete`: opens on `@`, filters by query, keyboard nav, token insertion, Escape closes, empty state
- `useNotificationListener`: toast fired on Echo event, unread-count invalidated, cleans up on unmount
- `NotificationBell`: dropdown opens on click, per-item read on click, mark-all-read button works
