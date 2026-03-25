# Commons Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add threaded replies (one level of nesting), message edit/delete UI with three-dot hover menu, and typing indicators to Commons messaging.

**Architecture:** Adds `depth` column to `commons_messages`, extends existing `MessageSent` broadcast to include `depth`, adds a `GET .../replies` endpoint, and builds 5 new React components (ThreadView, EditMessageInline, DeleteConfirmation, MessageActionMenu, TypingIndicator). Typing uses Echo whispers on existing private channels — no server persistence.

**Tech Stack:** Laravel 11 / PHP 8.4, React 19 / TypeScript, TanStack Query, Laravel Echo + Reverb WebSockets, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-13-commons-phase2a-design.md`

---

## File Structure

### Backend (modify)
| File | Responsibility |
|------|---------------|
| `backend/database/migrations/2026_03_13_500004_add_depth_to_commons_messages.php` | New migration: adds `depth` column |
| `backend/app/Models/Commons/Message.php` | Add `depth` to fillable + casts |
| `backend/app/Http/Requests/Commons/SendMessageRequest.php` | Add `parent_id` validation |
| `backend/app/Services/Commons/MessageService.php` | Accept `parentId`, compute `depth`, null body on delete broadcast |
| `backend/app/Events/Commons/MessageSent.php` | Add `depth` to broadcast payload |
| `backend/app/Events/Commons/MessageUpdated.php` | Null body/body_html on delete |
| `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php` | Add `replies()` action, update `index()` with `withCount` |
| `backend/routes/api.php` | Add replies route |

### Frontend (modify + create)
| File | Responsibility |
|------|---------------|
| `frontend/src/features/commons/types.ts` | Add `depth`, `reply_count`, `latest_reply_at` to Message |
| `frontend/src/features/commons/api.ts` | Add `fetchReplies`, `useReplies`, update `sendMessage` for `parent_id` |
| `frontend/src/features/commons/hooks/useEcho.ts` | Handle reply broadcasts for `reply_count` updates |
| `frontend/src/features/commons/hooks/useTypingIndicator.ts` | **Create:** whisper send + receive logic |
| `frontend/src/features/commons/components/chat/MessageActionMenu.tsx` | **Create:** three-dot dropdown (Reply, Edit, Delete) |
| `frontend/src/features/commons/components/chat/MessageItem.tsx` | Add action menu, reply count link, deleted state |
| `frontend/src/features/commons/components/chat/ThreadView.tsx` | **Create:** inline thread with replies + compact composer |
| `frontend/src/features/commons/components/chat/EditMessageInline.tsx` | **Create:** inline edit textarea |
| `frontend/src/features/commons/components/chat/DeleteConfirmation.tsx` | **Create:** delete confirmation dialog |
| `frontend/src/features/commons/components/chat/TypingIndicator.tsx` | **Create:** animated dots component |
| `frontend/src/features/commons/components/chat/MessageList.tsx` | Integrate ThreadView + TypingIndicator |
| `frontend/src/features/commons/components/CommonsLayout.tsx` | Pass current user to MessageList |

---

## Chunk 1: Backend — Migration, Model, Validation, Service

### Task 1: Database Migration — Add `depth` Column

**Files:**
- Create: `backend/database/migrations/2026_03_13_500004_add_depth_to_commons_messages.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commons_messages', function (Blueprint $table) {
            $table->tinyInteger('depth')->default(0)->after('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('commons_messages', function (Blueprint $table) {
            $table->dropColumn('depth');
        });
    }
};
```

- [ ] **Step 2: Run the migration**

Run: `docker compose exec php php artisan migrate`
Expected: `Migrating: 2026_03_13_500004_add_depth_to_commons_messages` — PASS

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_13_500004_add_depth_to_commons_messages.php
git commit -m "feat(commons): add depth column to commons_messages"
```

---

### Task 2: Update Message Model — Add `depth` to Fillable

**Files:**
- Modify: `backend/app/Models/Commons/Message.php:14-23`

- [ ] **Step 1: Add `depth` to the `$fillable` array**

In `backend/app/Models/Commons/Message.php`, add `'depth'` to the `$fillable` array (line 14-23):

```php
protected $fillable = [
    'channel_id',
    'user_id',
    'parent_id',
    'depth',
    'body',
    'body_html',
    'is_edited',
    'edited_at',
    'deleted_at',
];
```

- [ ] **Step 2: Add `depth` to the casts**

In the `casts()` method (line 26-33), add `'depth' => 'integer'`:

```php
protected function casts(): array
{
    return [
        'depth' => 'integer',
        'is_edited' => 'boolean',
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Models/Commons/Message.php
git commit -m "feat(commons): add depth to Message model fillable and casts"
```

---

### Task 3: Update SendMessageRequest — Add `parent_id` Validation

**Files:**
- Modify: `backend/app/Http/Requests/Commons/SendMessageRequest.php`

- [ ] **Step 1: Add `parent_id` validation rule**

Replace the `rules()` method in `SendMessageRequest.php`:

```php
/** @return array<string, mixed> */
public function rules(): array
{
    return [
        'body' => 'required|string|max:10000',
        'parent_id' => 'nullable|integer|exists:commons_messages,id',
    ];
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Http/Requests/Commons/SendMessageRequest.php
git commit -m "feat(commons): add parent_id validation to SendMessageRequest"
```

---

### Task 4: Update MessageService — Depth Computation + Privacy on Delete

**Files:**
- Modify: `backend/app/Services/Commons/MessageService.php:39-61` (createMessage)
- Modify: `backend/app/Services/Commons/MessageService.php:78-87` (deleteMessage)

- [ ] **Step 1: Update `createMessage` to compute depth from parent**

Replace the `createMessage` method (lines 39-62):

```php
public function createMessage(Channel $channel, int $userId, string $body, ?int $parentId = null): Message
{
    $depth = 0;
    if ($parentId !== null) {
        $parent = Message::where('id', $parentId)
            ->where('channel_id', $channel->id)
            ->firstOrFail();

        if ($parent->depth >= 2) {
            abort(422, 'Maximum thread depth exceeded.');
        }
        $depth = $parent->depth + 1;
    }

    $message = Message::create([
        'channel_id' => $channel->id,
        'user_id' => $userId,
        'parent_id' => $parentId,
        'depth' => $depth,
        'body' => $body,
        'body_html' => $this->renderMarkdown($body),
    ]);

    $message->load('user');

    // Auto-join user to channel if public and not a member
    if ($channel->isPublic()) {
        ChannelMember::firstOrCreate(
            ['channel_id' => $channel->id, 'user_id' => $userId],
            ['role' => 'member', 'joined_at' => now()],
        );
    }

    broadcast(new MessageSent($message))->toOthers();

    return $message;
}
```

- [ ] **Step 2: Update `deleteMessage` to null out body in broadcast for privacy**

Replace the `deleteMessage` method (lines 78-87):

```php
public function deleteMessage(Message $message): Message
{
    $message->update([
        'deleted_at' => now(),
    ]);

    // Null out body before broadcasting for privacy
    $broadcastMessage = clone $message;
    $broadcastMessage->body = null;
    $broadcastMessage->body_html = null;

    broadcast(new MessageUpdated($broadcastMessage, 'deleted'))->toOthers();

    return $message;
}
```

- [ ] **Step 3: Update the store() controller to pass parent_id**

In `MessageController.php`, update the `store` method (line 42-54) to pass `parent_id`:

```php
public function store(SendMessageRequest $request, string $slug): JsonResponse
{
    $channel = Channel::where('slug', $slug)->firstOrFail();
    $this->authorize('sendMessage', $channel);

    $message = $this->messageService->createMessage(
        $channel,
        $request->user()->id,
        $request->validated('body'),
        $request->validated('parent_id'),
    );

    return response()->json(['data' => $message], 201);
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Commons/MessageService.php backend/app/Http/Controllers/Api/V1/Commons/MessageController.php
git commit -m "feat(commons): add depth computation and privacy-safe delete broadcast"
```

---

### Task 5: Update Broadcast Events — Add `depth` to MessageSent

**Files:**
- Modify: `backend/app/Events/Commons/MessageSent.php:25-42`

- [ ] **Step 1: Add `depth` to the `broadcastWith` payload**

In `MessageSent.php`, update `broadcastWith()` (lines 25-42) to include `depth`:

```php
/** @return array<string, mixed> */
public function broadcastWith(): array
{
    return [
        'message' => [
            'id' => $this->message->id,
            'channel_id' => $this->message->channel_id,
            'user' => [
                'id' => $this->message->user->id,
                'name' => $this->message->user->name,
            ],
            'body' => $this->message->body,
            'body_html' => $this->message->body_html,
            'parent_id' => $this->message->parent_id,
            'depth' => $this->message->depth,
            'is_edited' => $this->message->is_edited,
            'created_at' => $this->message->created_at->toISOString(),
        ],
    ];
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Events/Commons/MessageSent.php
git commit -m "feat(commons): add depth to MessageSent broadcast payload"
```

---

### Task 6: Add Replies Endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php`
- Modify: `backend/routes/api.php:928`

- [ ] **Step 1: Add `replies()` method to MessageController**

Add this method after the `destroy` method (after line 77) in `MessageController.php`:

```php
public function replies(string $slug, int $messageId): JsonResponse
{
    $channel = Channel::where('slug', $slug)->firstOrFail();
    $this->authorize('view', $channel);

    $parent = Message::where('id', $messageId)
        ->where('channel_id', $channel->id)
        ->firstOrFail();

    // Fetch depth-1 children and depth-2 grandchildren (max depth = 2)
    // Note: soft-deleted replies are included — they render as "[message deleted]"
    $childIds = Message::where('parent_id', $parent->id)
        ->pluck('id');

    $replies = Message::where('channel_id', $channel->id)
        ->where(function ($q) use ($parent, $childIds) {
            $q->where('parent_id', $parent->id)
              ->orWhereIn('parent_id', $childIds);
        })
        ->with('user:id,name')
        ->orderBy('created_at', 'asc')
        ->get();

    return response()->json(['data' => $replies]);
}
```

- [ ] **Step 2: Update `index()` to include `reply_count` and `latest_reply_at`**

In the `index()` method (lines 21-40), replace the query building:

```php
public function index(Request $request, string $slug): JsonResponse
{
    $channel = Channel::where('slug', $slug)->firstOrFail();
    $this->authorize('view', $channel);

    $query = Message::where('channel_id', $channel->id)
        ->whereNull('deleted_at')
        ->whereNull('parent_id')
        ->with('user:id,name')
        ->withCount('replies')
        ->withMax('replies', 'created_at')
        ->orderByDesc('id');

    if ($request->has('before')) {
        $query->where('id', '<', (int) $request->input('before'));
    }

    $limit = min((int) $request->input('limit', 50), 100);
    $messages = $query->limit($limit)->get();

    // Rename the withMax column for cleaner JSON
    // Must use setAttribute() so it goes into the attributes array and appears in JSON
    $messages->each(function ($msg) {
        $msg->setAttribute('latest_reply_at', $msg->getAttribute('replies_max_created_at'));
        unset($msg->replies_max_created_at);
    });

    return response()->json(['data' => $messages]);
}
```

- [ ] **Step 3: Add the route**

In `backend/routes/api.php`, add the replies route after line 928 (after the `delete messages/{id}` route):

```php
Route::get('channels/{slug}/messages/{messageId}/replies', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'replies']);
```

- [ ] **Step 4: Verify API works**

Run: `docker compose exec php php artisan route:list --path=commons`
Expected: The replies route appears in the list.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Commons/MessageController.php backend/routes/api.php
git commit -m "feat(commons): add replies endpoint and reply_count to message index"
```

---

## Chunk 2: Frontend — Types, API, Echo Updates

### Task 7: Update TypeScript Types

**Files:**
- Modify: `frontend/src/features/commons/types.ts:32-43`

- [ ] **Step 1: Add `depth`, `reply_count`, and `latest_reply_at` to Message interface**

Update the `Message` interface (lines 32-43):

```typescript
export interface Message {
  id: number;
  channel_id: number;
  user: ChannelUser;
  body: string;
  body_html: string | null;
  parent_id: number | null;
  depth: number;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  reply_count?: number;
  latest_reply_at?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/types.ts
git commit -m "feat(commons): add depth and reply_count to Message type"
```

---

### Task 8: Update API Layer — Replies + Threaded Send

**Files:**
- Modify: `frontend/src/features/commons/api.ts`

- [ ] **Step 1: Add `fetchReplies` API function**

Add after the `deleteMessage` function (after line 66):

```typescript
async function fetchReplies(slug: string, messageId: number): Promise<Message[]> {
  const { data } = await apiClient.get<{ data: Message[] }>(
    `/commons/channels/${slug}/messages/${messageId}/replies`,
  );
  return data.data;
}
```

- [ ] **Step 2: Fix `useUpdateMessage` cache invalidation (pre-existing bug)**

The existing `useUpdateMessage` invalidates with `String(updated.channel_id)` but the cache key uses a slug string. Fix by passing `slug` into the mutation:

```typescript
export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, slug }: { id: number; body: string; slug: string }) =>
      updateMessage(id, body),
    onSuccess: (_updated, variables) => {
      void qc.invalidateQueries({
        queryKey: [MESSAGES_KEY, variables.slug],
      });
    },
  });
}
```

- [ ] **Step 3: Update `sendMessage` to accept optional `parentId`**

Replace the `sendMessage` function (lines 48-54):

```typescript
async function sendMessage(
  slug: string,
  body: string,
  parentId?: number,
): Promise<Message> {
  const { data } = await apiClient.post<{ data: Message }>(
    `/commons/channels/${slug}/messages`,
    { body, parent_id: parentId ?? null },
  );
  return data.data;
}
```

- [ ] **Step 4: Add `useReplies` hook**

Add after `useMessages` (after line 111):

```typescript
export function useReplies(slug: string, messageId: number | null) {
  return useQuery({
    queryKey: [MESSAGES_KEY, slug, "replies", messageId],
    queryFn: () => fetchReplies(slug, messageId!),
    enabled: !!slug && messageId !== null,
  });
}
```

- [ ] **Step 5: Update `useSendMessage` to support `parentId`**

Replace the `useSendMessage` hook (lines 113-122):

```typescript
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      body,
      parentId,
    }: {
      slug: string;
      body: string;
      parentId?: number;
    }) => sendMessage(slug, body, parentId),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [MESSAGES_KEY, variables.slug] });
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/commons/api.ts
git commit -m "feat(commons): add replies API, fix updateMessage cache, parent_id support"
```

---

### Task 9: Update Echo Hook — Handle Reply Broadcasts

**Files:**
- Modify: `frontend/src/features/commons/hooks/useEcho.ts:28-48`

- [ ] **Step 1: Update MessageSent handler to handle replies**

Replace the `.listen("MessageSent", ...)` block (lines 30-36) to handle both top-level messages and replies:

```typescript
.listen("MessageSent", (event: { message: Message }) => {
  if (event.message.parent_id) {
    // Reply: increment reply_count on the parent message
    qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
      if (!old) return old;
      return old.map((m) =>
        m.id === event.message.parent_id
          ? {
              ...m,
              reply_count: (m.reply_count ?? 0) + 1,
              latest_reply_at: event.message.created_at,
            }
          : m,
      );
    });
    // Also append to the thread's reply cache if it exists
    qc.setQueryData<Message[]>(
      [MESSAGES_KEY, slug, "replies", event.message.parent_id],
      (old) => {
        if (!old) return old;
        if (old.some((m) => m.id === event.message.id)) return old;
        return [...old, event.message];
      },
    );
  } else {
    // Top-level message: prepend to main list
    qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
      if (!old) return [event.message];
      if (old.some((m) => m.id === event.message.id)) return old;
      return [event.message, ...old];
    });
  }
})
```

- [ ] **Step 2: Add the MESSAGES_KEY import**

At the top of `useEcho.ts`, add the constant (or import it). Since `api.ts` doesn't export it, define it locally:

```typescript
const MESSAGES_KEY = "commons-messages";
```

Add this line after the existing imports (before line 5).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/hooks/useEcho.ts
git commit -m "feat(commons): handle reply broadcasts in Echo subscription"
```

---

### Task 10: Create Typing Indicator Hook

**Files:**
- Create: `frontend/src/features/commons/hooks/useTypingIndicator.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { getEcho } from "@/lib/echo";

/**
 * Manages typing indicator whispers on the private channel.
 * Returns { isTyping, sendTypingWhisper }.
 * - isTyping: true when any remote user is typing
 * - sendTypingWhisper: call on keydown in the composer (debounced internally)
 */
export function useTypingIndicator(channelId: number | undefined) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWhisperRef = useRef(0);

  useEffect(() => {
    if (!channelId) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = `commons.channel.${channelId}`;
    const channel = echo.private(channelName);

    channel.listenForWhisper("typing", () => {
      setIsTyping(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });

    return () => {
      // Only detach the whisper listener — do NOT call echo.leave()
      // because useChannelSubscription manages the channel lifecycle
      channel.stopListeningForWhisper("typing");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsTyping(false);
    };
  }, [channelId]);

  const sendTypingWhisper = useCallback(() => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastWhisperRef.current < 3000) return; // debounce 3s
    lastWhisperRef.current = now;

    const echo = getEcho();
    if (!echo) return;

    echo.private(`commons.channel.${channelId}`).whisper("typing", {});
  }, [channelId]);

  return { isTyping, sendTypingWhisper };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/hooks/useTypingIndicator.ts
git commit -m "feat(commons): add typing indicator whisper hook"
```

---

## Chunk 3: Frontend — UI Components

### Task 11: Create MessageActionMenu Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/MessageActionMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Reply } from "lucide-react";

interface MessageActionMenuProps {
  isAuthor: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MessageActionMenu({
  isAuthor,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
}: MessageActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-card py-1 shadow-lg">
          <button
            onClick={() => { onReply(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </button>

          {isAuthor && (
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}

          {(isAuthor || isAdmin) && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageActionMenu.tsx
git commit -m "feat(commons): add MessageActionMenu three-dot dropdown"
```

---

### Task 12: Create EditMessageInline Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/EditMessageInline.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useUpdateMessage } from "../../api";

interface EditMessageInlineProps {
  messageId: number;
  originalBody: string;
  slug: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function EditMessageInline({
  messageId,
  originalBody,
  slug,
  onCancel,
  onSaved,
}: EditMessageInlineProps) {
  const [body, setBody] = useState(originalBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateMessage = useUpdateMessage();

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function handleSave() {
    const trimmed = body.trim();
    if (!trimmed || trimmed === originalBody) {
      onCancel();
      return;
    }
    updateMessage.mutate(
      { id: messageId, body: trimmed, slug },
      { onSuccess: () => onSaved() },
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <div className="mt-1">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full resize-none rounded-md border border-border bg-muted p-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <div className="mt-1 flex gap-2">
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={updateMessage.isPending}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Escape to cancel · Enter to save
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/EditMessageInline.tsx
git commit -m "feat(commons): add EditMessageInline component"
```

---

### Task 13: Create DeleteConfirmation Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/DeleteConfirmation.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useDeleteMessage } from "../../api";

interface DeleteConfirmationProps {
  messageId: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmation({
  messageId,
  onCancel,
  onDeleted,
}: DeleteConfirmationProps) {
  const deleteMessage = useDeleteMessage();

  function handleDelete() {
    deleteMessage.mutate(messageId, {
      onSuccess: () => onDeleted(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">
          Delete this message?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This message will be removed from the conversation.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMessage.isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/DeleteConfirmation.tsx
git commit -m "feat(commons): add DeleteConfirmation modal component"
```

---

### Task 14: Create TypingIndicator Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/TypingIndicator.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface TypingIndicatorProps {
  isTyping: boolean;
}

export function TypingIndicator({ isTyping }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-1 px-5 py-1">
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/TypingIndicator.tsx
git commit -m "feat(commons): add TypingIndicator animated dots component"
```

---

### Task 15: Create ThreadView Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/ThreadView.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Send } from "lucide-react";
import { useReplies, useSendMessage } from "../../api";
import type { Message } from "../../types";

interface ThreadViewProps {
  parentMessage: Message;
  slug: string;
  currentUserId: number;
}

export function ThreadView({ parentMessage, slug, currentUserId }: ThreadViewProps) {
  const { data: replies = [], isLoading } = useReplies(slug, parentMessage.id);
  const sendMessage = useSendMessage();
  const [replyBody, setReplyBody] = useState("");

  function handleSendReply() {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      { slug, body: trimmed, parentId: parentMessage.id },
      { onSuccess: () => setReplyBody("") },
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  }

  return (
    <div className="ml-12 border-l-2 border-border pl-4">
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">Loading replies...</p>
      ) : (
        replies.map((reply) => (
          <div
            key={reply.id}
            className="py-1.5"
            style={{ paddingLeft: reply.depth === 2 ? 24 : 0 }}
          >
            {reply.deleted_at ? (
              <p className="text-xs italic text-muted-foreground">
                [message deleted]
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {reply.user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {reply.is_edited && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
                <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                  >
                    {reply.body}
                  </ReactMarkdown>
                </div>
              </>
            )}
          </div>
        ))
      )}

      {/* Compact reply composer */}
      <div className="mt-2 flex gap-2">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply..."
          rows={1}
          className="flex-1 resize-none rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleSendReply}
          disabled={sendMessage.isPending || !replyBody.trim()}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/ThreadView.tsx
git commit -m "feat(commons): add ThreadView inline thread component"
```

---

## Chunk 4: Frontend — Integration

### Task 16: Update MessageItem — Add Action Menu, Thread Toggle, Deleted State

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageItem.tsx`

- [ ] **Step 1: Rewrite MessageItem with action menu and thread support**

Replace the entire file:

```tsx
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown } from "lucide-react";
import type { Message } from "../../types";
import { MessageActionMenu } from "./MessageActionMenu";
import { EditMessageInline } from "./EditMessageInline";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { ThreadView } from "./ThreadView";

interface MessageItemProps {
  message: Message;
  slug: string;
  currentUserId: number;
  isAdmin?: boolean;
}

export function MessageItem({
  message,
  slug,
  currentUserId,
  isAdmin = false,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAuthor = message.user.id === currentUserId;
  const isDeleted = message.deleted_at !== null;

  return (
    <>
      <div className="group flex gap-3 px-5 py-2 hover:bg-muted/30">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {getInitials(message.user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {message.user.name}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {message.is_edited && !isDeleted && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {/* Action menu — visible on hover */}
            {!isDeleted && (
              <div className="ml-auto opacity-0 group-hover:opacity-100">
                <MessageActionMenu
                  isAuthor={isAuthor}
                  isAdmin={isAdmin}
                  onReply={() => setShowThread(true)}
                  onEdit={() => setEditing(true)}
                  onDelete={() => setShowDeleteConfirm(true)}
                />
              </div>
            )}
          </div>

          {isDeleted ? (
            <p className="text-sm italic text-muted-foreground">
              [message deleted]
            </p>
          ) : editing ? (
            <EditMessageInline
              messageId={message.id}
              originalBody={message.body}
              slug={slug}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-foreground [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_code]:text-teal-400">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {message.body}
              </ReactMarkdown>
            </div>
          )}

          {/* Reply count link */}
          {(message.reply_count ?? 0) > 0 && !showThread && (
            <button
              onClick={() => setShowThread(true)}
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ChevronDown className="h-3 w-3" />
              {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {/* Inline thread */}
      {showThread && (
        <ThreadView
          parentMessage={message}
          slug={slug}
          currentUserId={currentUserId}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <DeleteConfirmation
          messageId={message.id}
          onCancel={() => setShowDeleteConfirm(false)}
          onDeleted={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageItem.tsx
git commit -m "feat(commons): integrate action menu, threads, and delete into MessageItem"
```

---

### Task 17: Update MessageList — Pass Props + Add TypingIndicator

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageList.tsx`

- [ ] **Step 1: Update MessageList to pass new props and add TypingIndicator**

Replace the entire file:

```tsx
import { useEffect, useRef } from "react";
import type { Message } from "../../types";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  slug: string;
  currentUserId: number;
  isAdmin?: boolean;
  isTyping?: boolean;
}

export function MessageList({
  messages,
  isLoading,
  slug,
  currentUserId,
  isAdmin = false,
  isTyping = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const container = containerRef.current;
      if (container) {
        const isAtBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isAtBottom) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  // Messages come from API in descending order — reverse for display
  const sorted = [...messages].reverse();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {sorted.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        <div className="py-4">
          {sorted.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              slug={slug}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
      <TypingIndicator isTyping={isTyping} />
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageList.tsx
git commit -m "feat(commons): update MessageList with new props and typing indicator"
```

---

### Task 18: Update CommonsLayout — Wire Everything Together

**Prerequisite:** Task 10 (useTypingIndicator hook) must be completed first.

**Files:**
- Modify: `frontend/src/features/commons/components/CommonsLayout.tsx`

- [ ] **Step 1: Update CommonsLayout to pass currentUserId, typing, and admin status**

Replace the entire file:

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead, useMembers } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useChannelSubscription } from "../hooks/useEcho";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import { useAuthStore } from "@/stores/authStore";
import { ChannelList } from "./sidebar/ChannelList";
import { OnlineUsers } from "./sidebar/OnlineUsers";
import { ChannelHeader } from "./chat/ChannelHeader";
import { MessageList } from "./chat/MessageList";
import { MessageComposer } from "./chat/MessageComposer";
import { RightPanel } from "./rightpanel/RightPanel";

export function CommonsLayout() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const activeSlug = slug ?? "general";
  const user = useAuthStore((s) => s.user);

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: channel } = useChannel(activeSlug);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeSlug);
  const { data: members = [] } = useMembers(activeSlug);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const onlineUsers = usePresence();
  const { isTyping, sendTypingWhisper } = useTypingIndicator(channel?.id);

  // Subscribe to real-time events for the active channel
  useChannelSubscription(channel?.id, activeSlug);

  // Mark channel as read when viewed
  useEffect(() => {
    if (activeSlug) {
      markRead.mutate(activeSlug);
    }
  }, [activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /commons/general if no slug
  useEffect(() => {
    if (!slug && channels.length > 0) {
      navigate(`/commons/general`, { replace: true });
    }
  }, [slug, channels, navigate]);

  function handleSend(body: string) {
    sendMessage.mutate({ slug: activeSlug, body });
  }

  // Check if current user is admin/owner in this channel
  const currentMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-4">
          <h1 className="text-lg font-bold text-foreground">Commons</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <ChannelList channels={channels} activeSlug={activeSlug} />
          )}
        </div>
        <OnlineUsers users={onlineUsers} />
      </div>

      {/* Center chat area */}
      <div className="flex flex-1 flex-col">
        {channel && <ChannelHeader channel={channel} />}
        <MessageList
          messages={messages}
          isLoading={messagesLoading}
          slug={activeSlug}
          currentUserId={user?.id ?? 0}
          isAdmin={isAdmin}
          isTyping={isTyping}
        />
        {channel && (
          <MessageComposer
            channelName={channel.slug}
            onSend={handleSend}
            disabled={sendMessage.isPending}
            onKeyDown={sendTypingWhisper}
          />
        )}
      </div>

      {/* Right panel */}
      <RightPanel />
    </div>
  );
}
```

- [ ] **Step 2: Update MessageComposer to accept `onKeyDown` prop**

Replace the entire `MessageComposer.tsx` file:

```tsx
import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void;
  disabled?: boolean;
  onKeyDown?: () => void;
}

export function MessageComposer({ channelName, onSend, disabled, onKeyDown }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setBody("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="rounded-lg border border-border bg-muted p-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName} — Markdown supported`}
          rows={2}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            **bold** *italic* `code` — Shift+Enter for new line
          </p>
          <button
            onClick={handleSubmit}
            disabled={disabled || !body.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/CommonsLayout.tsx frontend/src/features/commons/components/chat/MessageComposer.tsx
git commit -m "feat(commons): wire typing indicator and thread props through CommonsLayout"
```

---

### Task 19: Verify + Deploy

- [ ] **Step 1: Run TypeScript check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run frontend build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Run backend route check**

Run: `docker compose exec php php artisan route:list --path=commons`
Expected: All Commons routes listed including the new replies route

- [ ] **Step 4: Deploy**

Run: `./deploy.sh`
Expected: Deployment succeeds

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "feat(commons): Phase 2a complete — threads, edit/delete UI, typing indicators"
```
