# Commons Phase 2b: Message Reactions & Unread Indicators — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add emoji reactions on messages and unread count badges in the channel sidebar.

**Architecture:** New `commons_message_reactions` table with toggle endpoint and `ReactionUpdated` broadcast event. Unread counts derived from existing `last_read_at` on `channel_members`, cached in Redis. Frontend adds reaction pills below messages, emoji picker popup, and bold+badge unread indicators in sidebar.

**Tech Stack:** Laravel 11 (PHP 8.4), React 19, TypeScript, TanStack Query, Laravel Echo/Reverb, Redis

**Spec:** `docs/superpowers/specs/2026-03-13-commons-phase2b-design.md`

---

## Chunk 1: Backend — Migration, Model, Service, Event, Controller, Routes

### Task 1: Database Migration

**Files:**
- Create: `backend/database/migrations/2026_03_13_500005_create_commons_message_reactions_table.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_message_reactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('message_id');
            $table->unsignedBigInteger('user_id');
            $table->string('emoji', 20);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('message_id')
                ->references('id')->on('commons_messages')
                ->onDelete('cascade');
            $table->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade');

            $table->unique(['message_id', 'user_id', 'emoji'], 'reactions_unique');
            $table->index('message_id', 'reactions_message_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_message_reactions');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating... create_commons_message_reactions_table ... DONE"

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_13_500005_create_commons_message_reactions_table.php
git commit -m "feat(commons): add message reactions migration"
```

---

### Task 2: Reaction Model

**Files:**
- Create: `backend/app/Models/Commons/Reaction.php`
- Modify: `backend/app/Models/Commons/Message.php`

- [ ] **Step 1: Create Reaction model**

```php
<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reaction extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'commons_message_reactions';

    /** @var list<string> */
    protected $fillable = [
        'message_id',
        'user_id',
        'emoji',
    ];

    public const ALLOWED_EMOJI = [
        'thumbsup',
        'heart',
        'laugh',
        'surprised',
        'celebrate',
        'eyes',
    ];

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'message_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 2: Add `reactions()` relationship to Message model**

In `backend/app/Models/Commons/Message.php`, add this import at the top (if not already present):

```php
use App\Models\Commons\Reaction;
```

Then add this method after the `replies()` method:

```php
    /** @return HasMany<Reaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class, 'message_id');
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Models/Commons/Reaction.php backend/app/Models/Commons/Message.php
git commit -m "feat(commons): add Reaction model and Message relationship"
```

---

### Task 3: ReactionService

**Files:**
- Create: `backend/app/Services/Commons/ReactionService.php`

- [ ] **Step 1: Create ReactionService**

```php
<?php

namespace App\Services\Commons;

use App\Events\Commons\ReactionUpdated;
use App\Models\Commons\Message;
use App\Models\Commons\Reaction;
use App\Models\User;
use Illuminate\Support\Collection;

class ReactionService
{
    /**
     * Toggle a reaction on a message. Returns the updated reaction summary.
     *
     * @return array<string, array{count: int, users: list<array{id: int, name: string}>, reacted: bool}>
     */
    public function toggleReaction(Message $message, User $user, string $emoji): array
    {
        $existing = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->first();

        if ($existing) {
            $existing->delete();
            $action = 'removed';
        } else {
            Reaction::create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
            $action = 'added';
        }

        $summary = $this->getReactionSummary($message, $user);

        // Build broadcast summary without `reacted` (broadcast goes to all users)
        $broadcastSummary = $this->getReactionSummary($message, null);

        broadcast(new ReactionUpdated(
            $message,
            $emoji,
            $user,
            $action,
            $broadcastSummary,
        ))->toOthers();

        return $summary;
    }

    /**
     * Get reaction summary for a single message.
     * When $currentUser is provided, `reacted` reflects that user's state.
     * When $currentUser is null, `reacted` is omitted (for broadcasts).
     *
     * @return array<string, array{count: int, users: list<array{id: int, name: string}>}>
     */
    public function getReactionSummary(Message $message, ?User $currentUser): array
    {
        $reactions = Reaction::where('message_id', $message->id)
            ->with('user:id,name')
            ->get();

        return $this->buildSummary($reactions, $currentUser);
    }

    /**
     * Batch-load reaction summaries for a collection of messages.
     * Returns [message_id => summary].
     *
     * @param Collection<int, Message> $messages
     * @return array<int, array<string, array{count: int, users: list<array{id: int, name: string}>}>>
     */
    public function getReactionSummaryForMessages(Collection $messages, ?User $currentUser): array
    {
        $messageIds = $messages->pluck('id')->all();

        if (empty($messageIds)) {
            return [];
        }

        $reactions = Reaction::whereIn('message_id', $messageIds)
            ->with('user:id,name')
            ->get()
            ->groupBy('message_id');

        $result = [];
        foreach ($messageIds as $id) {
            $messageReactions = $reactions->get($id, collect());
            $summary = $this->buildSummary($messageReactions, $currentUser);
            if (! empty($summary)) {
                $result[$id] = $summary;
            }
        }

        return $result;
    }

    /**
     * @param Collection<int, Reaction> $reactions
     * @return array<string, mixed>
     */
    private function buildSummary(Collection $reactions, ?User $currentUser): array
    {
        $grouped = $reactions->groupBy('emoji');
        $summary = [];

        foreach ($grouped as $emoji => $emojiReactions) {
            $entry = [
                'count' => $emojiReactions->count(),
                'users' => $emojiReactions->map(fn (Reaction $r) => [
                    'id' => $r->user->id,
                    'name' => $r->user->name,
                ])->values()->all(),
            ];

            if ($currentUser !== null) {
                $entry['reacted'] = $emojiReactions->contains('user_id', $currentUser->id);
            }

            $summary[$emoji] = $entry;
        }

        return $summary;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Services/Commons/ReactionService.php
git commit -m "feat(commons): add ReactionService with toggle and batch summary"
```

---

### Task 4: UnreadService

**Files:**
- Create: `backend/app/Services/Commons/UnreadService.php`

- [ ] **Step 1: Create UnreadService**

```php
<?php

namespace App\Services\Commons;

use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class UnreadService
{
    private const CACHE_TTL = 60; // seconds

    /**
     * Get unread message counts for all channels the user is a member of.
     * Returns [slug => count].
     *
     * @return array<string, int>
     */
    public function getUnreadCounts(User $user): array
    {
        $cacheKey = "commons:unread:{$user->id}";

        return Cache::store('redis')->remember($cacheKey, self::CACHE_TTL, function () use ($user) {
            return $this->computeUnreadCounts($user);
        });
    }

    /**
     * Invalidate the cached unread counts for a user.
     */
    public function invalidateCache(User $user): void
    {
        Cache::store('redis')->forget("commons:unread:{$user->id}");
    }

    /**
     * Invalidate cache by user ID directly (avoids loading User model).
     */
    public function invalidateCacheForUserId(int $userId): void
    {
        Cache::store('redis')->forget("commons:unread:{$userId}");
    }

    /**
     * Compute unread counts from DB.
     *
     * @return array<string, int>
     */
    private function computeUnreadCounts(User $user): array
    {
        $memberships = ChannelMember::where('user_id', $user->id)
            ->with('channel:id,slug')
            ->get();

        $counts = [];
        foreach ($memberships as $membership) {
            $channel = $membership->channel;
            if (! $channel) {
                continue;
            }

            $query = Message::where('channel_id', $channel->id)
                ->whereNull('parent_id')
                ->whereNull('deleted_at');

            if ($membership->last_read_at !== null) {
                $query->where('created_at', '>', $membership->last_read_at);
            }

            $counts[$channel->slug] = $query->count();
        }

        return $counts;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Services/Commons/UnreadService.php
git commit -m "feat(commons): add UnreadService with Redis-cached counts"
```

---

### Task 5: ReactionUpdated Event

**Files:**
- Create: `backend/app/Events/Commons/ReactionUpdated.php`

- [ ] **Step 1: Create ReactionUpdated event**

```php
<?php

namespace App\Events\Commons;

use App\Models\Commons\Message;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReactionUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param array<string, array{count: int, users: list<array{id: int, name: string}>}> $summary
     */
    public function __construct(
        public Message $message,
        public string $emoji,
        public User $user,
        public string $action,
        public array $summary,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->message->channel_id}")];
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'message_id' => $this->message->id,
            'emoji' => $this->emoji,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'action' => $this->action,
            'summary' => $this->summary,
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Events/Commons/ReactionUpdated.php
git commit -m "feat(commons): add ReactionUpdated broadcast event"
```

---

### Task 6: ToggleReactionRequest & ReactionController

**Files:**
- Create: `backend/app/Http/Requests/Commons/ToggleReactionRequest.php`
- Create: `backend/app/Http/Controllers/Api/V1/Commons/ReactionController.php`

- [ ] **Step 1: Create ToggleReactionRequest**

```php
<?php

namespace App\Http\Requests\Commons;

use App\Models\Commons\Reaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ToggleReactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'emoji' => ['required', 'string', Rule::in(Reaction::ALLOWED_EMOJI)],
        ];
    }
}
```

- [ ] **Step 2: Create ReactionController**

```php
<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\ToggleReactionRequest;
use App\Models\Commons\Message;
use App\Services\Commons\ReactionService;
use Illuminate\Http\JsonResponse;

class ReactionController extends Controller
{
    public function __construct(private ReactionService $reactionService) {}

    public function toggle(ToggleReactionRequest $request, int $id): JsonResponse
    {
        $message = Message::findOrFail($id);

        if ($message->isDeleted()) {
            return response()->json(['message' => 'Cannot react to a deleted message.'], 422);
        }

        $summary = $this->reactionService->toggleReaction(
            $message,
            $request->user(),
            $request->validated('emoji'),
        );

        return response()->json(['data' => $summary]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Requests/Commons/ToggleReactionRequest.php backend/app/Http/Controllers/Api/V1/Commons/ReactionController.php
git commit -m "feat(commons): add ReactionController with toggle endpoint"
```

---

### Task 7: Unread Counts Endpoint & Route Registration

**Files:**
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Http/Controllers/Api/V1/Commons/MemberController.php`

- [ ] **Step 1: Add `unreadCounts` method to MemberController**

In `backend/app/Http/Controllers/Api/V1/Commons/MemberController.php`, add this import at the top:

```php
use App\Services\Commons\UnreadService;
```

Then add this method at the end of the class (before the closing `}`):

```php
    public function unreadCounts(Request $request, UnreadService $unreadService): JsonResponse
    {
        $counts = $unreadService->getUnreadCounts($request->user());

        return response()->json(['data' => $counts]);
    }
```

- [ ] **Step 2: Update `markRead` to invalidate unread cache**

In the same file, update the `markRead` method to accept `UnreadService` and invalidate cache:

Replace the existing `markRead` method with:

```php
    public function markRead(Request $request, string $slug, UnreadService $unreadService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();

        ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);

        $unreadService->invalidateCache($request->user());

        return response()->json(['status' => 'ok']);
    }
```

- [ ] **Step 3: Add routes to api.php**

In `backend/routes/api.php`, inside the `Route::prefix('commons')` group, add two new routes.

**Route 1 — `channels/unread`:** Insert on line 920, between `Route::post('channels', ...)` and `Route::get('channels/{slug}', ...)`. It MUST come before `channels/{slug}` or Laravel will match `unread` as a slug parameter.

```php
        Route::get('channels/unread', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'unreadCounts']);
```

**Route 2 — `messages/{id}/reactions`:** Add at the end of the commons group, after the existing `Route::post('channels/{slug}/read', ...)` line:

```php
        Route::post('messages/{id}/reactions', [App\Http\Controllers\Api\V1\Commons\ReactionController::class, 'toggle'])
            ->middleware('throttle:30,1');
```

The final route order should be:
```
Route::get('channels', ...);
Route::post('channels', ...);
Route::get('channels/unread', ...);       // ← NEW, before {slug}
Route::get('channels/{slug}', ...);
Route::patch('channels/{slug}', ...);
// ... existing routes ...
Route::post('messages/{id}/reactions', ...);  // ← NEW, at end
```

- [ ] **Step 4: Verify routes**

Run: `docker compose exec php php artisan route:list --path=commons`
Expected: Should show `GET commons/channels/unread` and `POST commons/messages/{id}/reactions` among the routes.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/api.php backend/app/Http/Controllers/Api/V1/Commons/MemberController.php
git commit -m "feat(commons): add unread counts endpoint and reaction toggle route"
```

---

### Task 8: Add Reaction Summaries to Message Responses

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php`
- Modify: `backend/app/Services/Commons/MessageService.php`

- [ ] **Step 1: Update MessageController to include reaction summaries**

In `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php`:

Add this import at the top:

```php
use App\Services\Commons\ReactionService;
```

Update the constructor to inject both services:

```php
    public function __construct(
        private MessageService $messageService,
        private ReactionService $reactionService,
    ) {}
```

Update the `index` method — after `$messages` is fetched and the `latest_reply_at` rename loop, add reaction summaries before the return:

Replace the block from `$messages->each(function ($msg) {` to `return response()->json(...)` with:

```php
        $messages->each(function ($msg) {
            $msg->setAttribute('latest_reply_at', $msg->getAttribute('replies_max_created_at'));
            unset($msg->replies_max_created_at);
        });

        // Attach reaction summaries
        $reactionSummaries = $this->reactionService->getReactionSummaryForMessages(
            $messages,
            $request->user(),
        );
        $messages->each(function ($msg) use ($reactionSummaries) {
            $msg->setAttribute('reactions', $reactionSummaries[$msg->id] ?? (object) []);
        });

        return response()->json(['data' => $messages]);
```

Update the `replies` method — add reaction summaries before the return. Replace the last two lines (`$replies = ...` fetch and `return`) with:

```php
        $replies = Message::where('channel_id', $channel->id)
            ->where(function ($q) use ($parent, $childIds) {
                $q->where('parent_id', $parent->id)
                  ->orWhereIn('parent_id', $childIds);
            })
            ->with('user:id,name')
            ->orderBy('created_at', 'asc')
            ->get();

        // Attach reaction summaries to replies
        $reactionSummaries = $this->reactionService->getReactionSummaryForMessages(
            $replies,
            $request->user(),
        );
        $replies->each(function ($msg) use ($reactionSummaries) {
            $msg->setAttribute('reactions', $reactionSummaries[$msg->id] ?? (object) []);
        });

        return response()->json(['data' => $replies]);
```

Note: The `replies` method needs `Request $request` as the first parameter (it currently does not have it). Update the method signature:

```php
    public function replies(Request $request, string $slug, int $messageId): JsonResponse
```

- [ ] **Step 2: Invalidate unread cache on new message**

In `backend/app/Services/Commons/MessageService.php`, add import at top:

```php
use App\Services\Commons\UnreadService;
```

Update the constructor to inject UnreadService:

```php
    public function __construct(private UnreadService $unreadService)
    {
        $environment = new Environment([
            'disallowed_raw_html' => [
                'disallowed_tags' => [],
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension());
        $environment->addExtension(new GithubFlavoredMarkdownExtension());
        $environment->addExtension(new DisallowedRawHtmlExtension());

        $this->converter = new MarkdownConverter($environment);
    }
```

In `createMessage`, after `broadcast(new MessageSent($message))->toOthers();`, add:

```php
        // Invalidate unread caches for all channel members (except the sender)
        $memberUserIds = ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', '!=', $userId)
            ->pluck('user_id');

        foreach ($memberUserIds as $memberId) {
            $this->unreadService->invalidateCacheForUserId($memberId);
        }
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Commons/MessageController.php backend/app/Services/Commons/MessageService.php
git commit -m "feat(commons): attach reaction summaries to messages and invalidate unread cache"
```

---

## Chunk 2: Frontend — Types, API, Hooks

### Task 9: Update TypeScript Types

**Files:**
- Modify: `frontend/src/features/commons/types.ts`

- [ ] **Step 1: Add ReactionSummary and update Message**

Add the `ReactionSummary` interface before the `Message` interface, and add `reactions` to `Message`:

After the `ChannelMember` interface, add:

```typescript
export interface ReactionUser {
  id: number;
  name: string;
}

export interface ReactionEntry {
  count: number;
  users: ReactionUser[];
  reacted: boolean;
}

export type ReactionSummary = Record<string, ReactionEntry>;
```

Then update the `Message` interface — add after `latest_reply_at`:

```typescript
  reactions: ReactionSummary;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/types.ts
git commit -m "feat(commons): add ReactionSummary types and update Message interface"
```

---

### Task 10: Add API Functions and Hooks

**Files:**
- Modify: `frontend/src/features/commons/api.ts`

- [ ] **Step 1: Add reaction and unread API functions**

At the end of the API functions section (after `markChannelRead`), add:

```typescript
async function toggleReaction(
  messageId: number,
  emoji: string,
): Promise<ReactionSummary> {
  const { data } = await apiClient.post<{ data: ReactionSummary }>(
    `/commons/messages/${messageId}/reactions`,
    { emoji },
  );
  return data.data;
}

async function fetchUnreadCounts(): Promise<Record<string, number>> {
  const { data } = await apiClient.get<{ data: Record<string, number> }>(
    "/commons/channels/unread",
  );
  return data.data;
}
```

Add the import for `ReactionSummary` at the top:

```typescript
import type {
  Channel,
  ChannelMember,
  CreateChannelPayload,
  Message,
  ReactionSummary,
} from "./types";
```

- [ ] **Step 2: Add TanStack Query hooks**

At the end of the hooks section, add:

```typescript
const UNREAD_KEY = "commons-unread";

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) =>
      toggleReaction(messageId, emoji),
    onSuccess: (_data, variables) => {
      // Invalidate all message caches to refresh reaction summaries
      void qc.invalidateQueries({ queryKey: [MESSAGES_KEY] });
    },
  });
}

export function useUnreadCounts() {
  return useQuery({
    queryKey: [UNREAD_KEY],
    queryFn: fetchUnreadCounts,
    refetchInterval: 60_000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/api.ts
git commit -m "feat(commons): add reaction toggle and unread counts API hooks"
```

---

### Task 11: Update Echo Hook for Reactions and Unread

**Files:**
- Modify: `frontend/src/features/commons/hooks/useEcho.ts`

- [ ] **Step 1: Add ReactionUpdated listener and unread increment**

Update the imports at the top:

```typescript
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import { useAuthStore } from "@/stores/authStore";
import type { Message, ReactionSummary } from "../types";

const MESSAGES_KEY = "commons-messages";
```

Update the `useChannelSubscription` function signature to accept `activeSlug`:

The function already takes `slug` — we need to know the active slug to avoid incrementing unread for the channel we're viewing. The existing `slug` parameter IS the active slug, so we can use it directly.

Inside the `useEffect`, after the `.listen("MessageUpdated", ...)` block, chain a new `.listen("ReactionUpdated", ...)`:

```typescript
      .listen(
        "ReactionUpdated",
        (event: {
          message_id: number;
          emoji: string;
          user: { id: number; name: string };
          action: "added" | "removed";
          summary: Record<string, { count: number; users: { id: number; name: string }[] }>;
        }) => {
          const currentUserId = useAuthStore.getState().user?.id;

          // Derive `reacted` for each emoji locally
          const enrichedSummary: ReactionSummary = {};
          for (const [emoji, data] of Object.entries(event.summary)) {
            enrichedSummary[emoji] = {
              ...data,
              reacted: data.users.some((u) => u.id === currentUserId),
            };
          }

          // Patch main message list
          qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
            if (!old) return old;
            return old.map((m) =>
              m.id === event.message_id
                ? { ...m, reactions: enrichedSummary }
                : m,
            );
          });

          // Patch thread reply cache (for reactions on replies)
          qc.getQueriesData<Message[]>({ queryKey: [MESSAGES_KEY, slug, "replies"] })
            .forEach(([queryKey, data]) => {
              if (!data) return;
              const hasMessage = data.some((m) => m.id === event.message_id);
              if (hasMessage) {
                qc.setQueryData<Message[]>(queryKey, (old) => {
                  if (!old) return old;
                  return old.map((m) =>
                    m.id === event.message_id
                      ? { ...m, reactions: enrichedSummary }
                      : m,
                  );
                });
              }
            });
        },
      );
```

Also update the existing `MessageSent` listener to increment unread counts for other channels. After the existing `MessageSent` handler, we need to check: this handler only fires for the CURRENTLY SUBSCRIBED channel. So the currently-viewed channel should NOT get its unread incremented. The unread increment for OTHER channels happens when those channels broadcast — but since we're only subscribed to one channel at a time, we won't receive broadcasts from other channels.

Instead, the unread increment for non-active channels must happen via the 60s refetch interval. No change needed to the Echo hook for unread — the `useUnreadCounts` hook's refetch interval handles it.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/hooks/useEcho.ts
git commit -m "feat(commons): add ReactionUpdated listener to Echo hook"
```

---

## Chunk 3: Frontend — UI Components (ReactionPills, EmojiPicker, ReactionTooltip)

### Task 12: EmojiPicker Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/EmojiPicker.tsx`

- [ ] **Step 1: Create EmojiPicker**

```tsx
import { useRef, useEffect } from "react";

const EMOJI_MAP: Record<string, { emoji: string; label: string }> = {
  thumbsup: { emoji: "👍", label: "Like" },
  heart: { emoji: "❤️", label: "Love" },
  laugh: { emoji: "😂", label: "Haha" },
  surprised: { emoji: "😮", label: "Wow" },
  celebrate: { emoji: "🎉", label: "Celebrate" },
  eyes: { emoji: "👀", label: "Looking" },
};

export const EMOJI_KEYS = Object.keys(EMOJI_MAP);
export const EMOJI_DISPLAY = EMOJI_MAP;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-lg border border-border bg-card p-1.5 shadow-lg"
    >
      {EMOJI_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => {
            onSelect(key);
            onClose();
          }}
          title={EMOJI_MAP[key].label}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted"
        >
          {EMOJI_MAP[key].emoji}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/EmojiPicker.tsx
git commit -m "feat(commons): add EmojiPicker component"
```

---

### Task 13: ReactionTooltip Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/ReactionTooltip.tsx`

- [ ] **Step 1: Create ReactionTooltip**

```tsx
interface ReactionTooltipProps {
  users: { id: number; name: string }[];
}

export function ReactionTooltip({ users }: ReactionTooltipProps) {
  if (users.length === 0) return null;

  let text: string;
  if (users.length < 5) {
    text = users.map((u) => u.name).join(", ");
  } else {
    const shown = users.slice(0, 4).map((u) => u.name);
    const remaining = users.length - 4;
    text = `${shown.join(", ")}, and ${remaining} ${remaining === 1 ? "other" : "others"}`;
  }

  return (
    <div className="absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg">
      {text}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/ReactionTooltip.tsx
git commit -m "feat(commons): add ReactionTooltip component"
```

---

### Task 14: ReactionPills Component

**Files:**
- Create: `frontend/src/features/commons/components/chat/ReactionPills.tsx`

- [ ] **Step 1: Create ReactionPills**

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import type { ReactionSummary } from "../../types";
import { useToggleReaction } from "../../api";
import { EmojiPicker, EMOJI_DISPLAY } from "./EmojiPicker";
import { ReactionTooltip } from "./ReactionTooltip";

interface ReactionPillsProps {
  messageId: number;
  reactions: ReactionSummary;
}

export function ReactionPills({ messageId, reactions }: ReactionPillsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const toggleReaction = useToggleReaction();

  const emojiKeys = Object.keys(reactions);

  function handleToggle(emoji: string) {
    toggleReaction.mutate({ messageId, emoji });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {emojiKeys.map((key) => {
        const entry = reactions[key];
        const display = EMOJI_DISPLAY[key];
        if (!display || entry.count === 0) return null;

        return (
          <div
            key={key}
            className="relative"
            onMouseEnter={() => setHoveredEmoji(key)}
            onMouseLeave={() => setHoveredEmoji(null)}
          >
            <button
              onClick={() => handleToggle(key)}
              disabled={toggleReaction.isPending}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                entry.reacted
                  ? "border border-primary/50 bg-primary/20 text-primary-foreground"
                  : "border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="text-sm">{display.emoji}</span>
              <span>{entry.count}</span>
            </button>
            {hoveredEmoji === key && <ReactionTooltip users={entry.users} />}
          </div>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex h-6 w-7 items-center justify-center rounded-full border border-dashed border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleToggle}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/ReactionPills.tsx
git commit -m "feat(commons): add ReactionPills component with toggle and tooltip"
```

---

## Chunk 4: Frontend — Integration (MessageItem, ThreadView, MessageActionMenu, ChannelList)

### Task 15: Integrate ReactionPills into MessageItem

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageItem.tsx`

- [ ] **Step 1: Add ReactionPills to MessageItem**

Add this import at the top of the file:

```typescript
import { ReactionPills } from "./ReactionPills";
```

In the JSX, add `<ReactionPills>` after the markdown rendering block (the `<div className="prose ...">` block) and before the reply count link. The ReactionPills should only render when the message is not deleted and not being edited.

Find the closing `</div>` of the prose block (around line 86) and the reply count button (around line 90). Between them, add:

```tsx
            {/* Reaction pills */}
            {!isDeleted && !editing && (
              <ReactionPills
                messageId={message.id}
                reactions={message.reactions}
              />
            )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageItem.tsx
git commit -m "feat(commons): integrate ReactionPills into MessageItem"
```

---

### Task 16: Integrate ReactionPills into ThreadView

**Files:**
- Modify: `frontend/src/features/commons/components/chat/ThreadView.tsx`

- [ ] **Step 1: Add ReactionPills to thread replies**

Add this import at the top:

```typescript
import { ReactionPills } from "./ReactionPills";
```

Inside the reply map, after the prose markdown block (the `<div className="prose ...">` block, just before the closing `</>` of the fragment), add:

```tsx
                <ReactionPills
                  messageId={reply.id}
                  reactions={reply.reactions}
                />
```

This should be placed inside the fragment (`<>...</>`) that renders for non-deleted replies, after the markdown `<div>`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/chat/ThreadView.tsx
git commit -m "feat(commons): integrate ReactionPills into ThreadView replies"
```

---

### Task 17: Add "React" Option to MessageActionMenu

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageActionMenu.tsx`

- [ ] **Step 1: Add React option and EmojiPicker**

Add imports at the top:

```typescript
import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Reply, SmilePlus } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
```

Update the props interface to add `onReact`:

```typescript
interface MessageActionMenuProps {
  isAuthor: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}
```

Update the function signature to destructure `onReact`:

```typescript
export function MessageActionMenu({
  isAuthor,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageActionMenuProps) {
```

Add state for the emoji picker:

```typescript
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
```

In the JSX dropdown menu, add the "React" button as the first item (before Reply):

```tsx
          <button
            onClick={() => { setShowEmojiPicker(true); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <SmilePlus className="h-3.5 w-3.5" />
            React
          </button>
```

After the menu `</div>`, add the emoji picker (before the closing `</div>` of the relative container):

```tsx
      {showEmojiPicker && (
        <div className="absolute right-0 top-full z-20 mt-1">
          <EmojiPicker
            onSelect={(emoji) => {
              onReact(emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}
```

- [ ] **Step 2: Update MessageItem to pass `onReact` to MessageActionMenu**

In `frontend/src/features/commons/components/chat/MessageItem.tsx`, add import for `useToggleReaction` if not already present:

```typescript
import { useToggleReaction } from "../../api";
```

Inside the `MessageItem` function, add:

```typescript
  const toggleReaction = useToggleReaction();
```

Update the `<MessageActionMenu>` usage to pass `onReact`:

```tsx
                <MessageActionMenu
                  isAuthor={isAuthor}
                  isAdmin={isAdmin}
                  onReply={() => setShowThread(true)}
                  onEdit={() => setEditing(true)}
                  onDelete={() => setShowDeleteConfirm(true)}
                  onReact={(emoji) => toggleReaction.mutate({ messageId: message.id, emoji })}
                />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageActionMenu.tsx frontend/src/features/commons/components/chat/MessageItem.tsx
git commit -m "feat(commons): add React option to message action menu"
```

---

### Task 18: Unread Badges in ChannelList

**Files:**
- Modify: `frontend/src/features/commons/components/sidebar/ChannelList.tsx`

- [ ] **Step 1: Add unread counts to ChannelList**

Add import at the top:

```typescript
import { useUnreadCounts } from "../../api";
```

Inside the `ChannelList` function, add:

```typescript
  const { data: unreadCounts = {} } = useUnreadCounts();
```

Update the `ChannelItem` usage to pass unread count. Change each `<ChannelItem>` to pass `unreadCount`:

```tsx
        <ChannelItem
          key={ch.id}
          channel={ch}
          isActive={ch.slug === activeSlug}
          onClick={() => navigate(`/commons/${ch.slug}`)}
          unreadCount={unreadCounts[ch.slug] ?? 0}
        />
```

(Do this for both topicChannels and studyChannels maps.)

- [ ] **Step 2: Update ChannelItem to display unread state**

Update the `ChannelItem` function to accept and display `unreadCount`:

```tsx
function ChannelItem({
  channel,
  isActive,
  onClick,
  unreadCount = 0,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  unreadCount?: number;
}) {
  const hasUnread = unreadCount > 0 && !isActive;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      onClick={onClick}
      className={`mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : hasUnread
            ? "text-foreground hover:bg-muted"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Hash className="h-4 w-4 shrink-0" />
      <span className={`truncate ${hasUnread ? "font-semibold" : ""}`}>
        {channel.slug}
      </span>
      {hasUnread && (
        <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {displayCount}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/sidebar/ChannelList.tsx
git commit -m "feat(commons): add unread count badges to channel list"
```

---

### Task 19: Verify & Deploy

- [ ] **Step 1: TypeScript check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Frontend build**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds

- [ ] **Step 3: Backend route check**

Run: `docker compose exec php php artisan route:list --path=commons`
Expected: Shows `GET commons/channels/unread` and `POST commons/messages/{id}/reactions` among routes

- [ ] **Step 4: Deploy**

Run: `./deploy.sh`
Expected: Deploy complete
