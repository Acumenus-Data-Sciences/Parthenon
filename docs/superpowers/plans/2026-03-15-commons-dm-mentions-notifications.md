# Commons DM Mentions & Real-Time Notifications — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@[id:username]` mention tokens to message storage, render them as styled chips, dispatch real-time toast + bell notifications on mention/first-DM, and let recipients click through to the exact message.

**Architecture:** Backend parses mention tokens in `MessageService` on create/update, inserts `commons_notifications` rows, then broadcasts `NotificationSent` over Reverb on each recipient's private channel. Frontend upgrades the existing mention autocomplete to write structured tokens, subscribes globally in `MainLayout`, and delivers toast notifications with a "Go to message" action button. `MessageList` reads `?highlight` from the URL and scrolls + fades the target message.

**Tech Stack:** Laravel 11 (Eloquent, Reverb broadcasting, Pest), React 19 + TypeScript (TanStack Query, Zustand, React Router v6, Vitest), Tailwind v4.

---

## File Map

| File | Action |
|------|--------|
| `backend/app/Services/Commons/MessageService.php` | Modify — add `renderHtml()` (replaces `renderMarkdown()` — only internal callers, safe to rename); add `excerptFromBody()`; parse/notify on create/update |
| `backend/app/Events/Commons/NotificationSent.php` | Create — `ShouldBroadcast` event on `App.Models.User.{id}` |
| `frontend/src/components/ui/Toast.tsx` | Modify — add optional `action` to `ToastMessage`; `MAX_TOASTS = 3` cap; render action button |
| `frontend/src/features/commons/components/chat/MessageComposer.tsx` | Modify — `insertMention` to write `@[id:name]` token instead of `@name` plain text |
| `frontend/src/features/commons/hooks/useNotificationListener.ts` | Create — Echo subscription; toast + unread-count invalidation |
| `frontend/src/components/layout/MainLayout.tsx` | Modify — mount `useNotificationListener()` |
| `frontend/src/features/commons/components/sidebar/NotificationBell.tsx` | Modify — per-item read on click (not bulk-on-open); add `?highlight` to navigation URL |
| `frontend/src/features/commons/components/chat/MessageList.tsx` | Modify — `useSearchParams` highlight: scroll + 2s fade on mount |
| `frontend/src/index.css` | Modify — add `.mention` chip style |
| `backend/tests/Feature/Commons/MentionNotificationTest.php` | Create — Pest feature tests for backend logic |
| `frontend/src/components/ui/__tests__/Toast.test.tsx` | Modify — tests for action button + `MAX_TOASTS` cap |
| `frontend/src/features/commons/hooks/__tests__/useNotificationListener.test.ts` | Create — Echo subscription test |

---

## Chunk 1: Backend — NotificationSent Event + MessageService Refactor

### Task 1: Create `NotificationSent` broadcast event

**Files:**
- Create: `backend/app/Events/Commons/NotificationSent.php`

- [ ] **Step 1: Write the failing Pest test**

```php
// backend/tests/Feature/Commons/MentionNotificationTest.php
<?php
use App\Events\Commons\NotificationSent;
use App\Models\Commons\Notification;
use Illuminate\Broadcasting\PrivateChannel;

it('broadcasts on the correct private channel', function () {
    $notification = Notification::factory()->create(['user_id' => 42]);
    $event = new NotificationSent($notification);

    $channels = $event->broadcastOn();
    expect($channels)->toHaveCount(1)
        ->and($channels[0])->toBeInstanceOf(PrivateChannel::class)
        ->and($channels[0]->name)->toContain('App.Models.User.42');
});

it('broadcasts with the correct payload shape', function () {
    $notification = Notification::factory()
        ->for(\App\Models\User::factory(), 'actor')
        ->for(\App\Models\Commons\Channel::factory(), 'channel')
        ->create(['type' => 'mention', 'title' => 'Test', 'body' => 'hello', 'message_id' => 7]);

    $event = new NotificationSent($notification);
    $payload = $event->broadcastWith();

    expect($payload)->toHaveKeys(['id', 'type', 'title', 'body', 'channel_id', 'message_id', 'actor', 'channel', 'created_at'])
        ->and($payload['type'])->toBe('mention')
        ->and($payload['message_id'])->toBe(7)
        ->and($payload['actor'])->toHaveKeys(['id', 'name'])
        ->and($payload['channel'])->toHaveKey('slug');
});
```

- [ ] **Step 2: Run tests to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php --filter "broadcasts"
```
Expected: FAIL — class not found.

- [ ] **Step 3: Create the event class**

```php
// backend/app/Events/Commons/NotificationSent.php
<?php

namespace App\Events\Commons;

use App\Models\Commons\Notification;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Notification $notification) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.User.' . $this->notification->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'NotificationSent';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'id'         => $this->notification->id,
            'type'       => $this->notification->type,
            'title'      => $this->notification->title,
            'body'       => $this->notification->body,
            'channel_id' => $this->notification->channel_id,
            'message_id' => $this->notification->message_id,
            'actor'      => $this->notification->actor
                ? ['id' => $this->notification->actor->id, 'name' => $this->notification->actor->name]
                : null,
            'channel'    => $this->notification->channel
                ? ['slug' => $this->notification->channel->slug]
                : null,
            'created_at' => $this->notification->created_at,
        ];
    }
}
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php --filter "broadcasts"
```
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Events/Commons/NotificationSent.php backend/tests/Feature/Commons/MentionNotificationTest.php
git commit -m "feat: add NotificationSent broadcast event for Commons notifications"
```

---

### Task 2: Refactor `MessageService` — `renderHtml()`, `excerptFromBody()`, mention parsing

**Files:**
- Modify: `backend/app/Services/Commons/MessageService.php`
- Modify: `backend/tests/Feature/Commons/MentionNotificationTest.php` (add cases)

> **Context:** `MessageService` currently has `renderMarkdown(string $body): string` and `createMessage()` / `updateMessage()` that call it. We will:
> 1. Rename `renderMarkdown` → `renderHtml` and add a second-pass mention token regex
> 2. Add private `excerptFromBody(string $body, int $limit = 160): string`
> 3. In `createMessage()`: parse mention tokens, validate recipients (cap 20), create `mention` notifications, check first-DM and create `dm` notifications, broadcast `NotificationSent` per recipient after commit
> 4. In `updateMessage()`: diff old vs new mention tokens, notify only newly added recipients

- [ ] **Step 1: Add Pest tests for `renderHtml()` and `excerptFromBody()`**

Add these cases to `MentionNotificationTest.php`:

```php
use App\Services\Commons\MessageService;

it('renders mention tokens to HTML spans', function () {
    $service = app(MessageService::class);
    $html = $service->renderHtml('Hello @[42:Dr. Smith]!');
    expect($html)->toContain('<span class="mention" data-user-id="42">@Dr. Smith</span>');
});

it('leaves text without tokens unchanged by the mention pass', function () {
    $service = app(MessageService::class);
    $html = $service->renderHtml('**bold** text');
    expect($html)->toContain('<strong>bold</strong>');
    expect($html)->not->toContain('mention');
});

it('excerpts body: tokens become @Username, HTML stripped, truncated at 160', function () {
    $service = app(MessageService::class);
    $reflection = new ReflectionClass($service);
    $method = $reflection->getMethod('excerptFromBody');
    $method->setAccessible(true);

    $body = '@[42:Dr. Smith] said **hello** ' . str_repeat('x', 200);
    $result = $method->invoke($service, $body);
    expect($result)->toStartWith('@Dr. Smith said')
        ->and(mb_strlen($result))->toBeLessThanOrEqual(161) // 160 + ellipsis char
        ->and($result)->toEndWith('…');
});

it('excerpt strips HTML tags', function () {
    $service = app(MessageService::class);
    $reflection = new ReflectionClass($service);
    $method = $reflection->getMethod('excerptFromBody');
    $method->setAccessible(true);

    $result = $method->invoke($service, '<b>bold</b> text');
    expect($result)->toBe('bold text');
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php --filter "renders|excerpts|excerpt strips|leaves text"
```
Expected: FAIL — `renderHtml` method not found, `excerptFromBody` not found.

- [ ] **Step 3: Implement `renderHtml()` and `excerptFromBody()` in `MessageService`**

In `backend/app/Services/Commons/MessageService.php`:

a. Rename `renderMarkdown` → `renderHtml` and add the mention token second pass:

```php
public function renderHtml(string $body): string
{
    $html = $this->converter->convert($body)->getContent();
    // Second pass: convert @[id:username] tokens to styled spans
    return preg_replace_callback(
        '/@\[(\d+):([^\]]+)\]/',
        fn($m) => '<span class="mention" data-user-id="' . $m[1] . '">@' . htmlspecialchars($m[2], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</span>',
        $html
    ) ?? $html;
}
```

b. Add the private `excerptFromBody` method (note the explicit guard: `…` is only appended when `mb_strlen > $limit`, so short messages stay unchanged):

```php
private function excerptFromBody(string $body, int $limit = 160): string
{
    // Tokens → @Username
    $text = preg_replace('/@\[(\d+):([^\]]+)\]/', '@$2', $body) ?? $body;
    // Strip HTML tags
    $text = strip_tags($text);
    $text = trim($text);
    // Only truncate and append ellipsis if over the limit
    if (mb_strlen($text) > $limit) {
        $text = mb_substr($text, 0, $limit) . '…';
    }
    return $text;
}
```

c. Update the two call sites inside the same file:

> **Note:** `renderMarkdown()` is only called internally within `MessageService` (confirmed by grep — no external callers). All internal call sites are updated in the same task.
- `createMessage()`: `'body_html' => $this->renderHtml($body)`
- `updateMessage()`: `'body_html' => $this->renderHtml($body)`

- [ ] **Step 4: Run tests to confirm PASS**

```bash
docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php --filter "renders|excerpts|excerpt strips|leaves text"
```
Expected: 4 passing.

- [ ] **Step 5: Add tests for mention parsing and notification creation in `createMessage()`**

Add to `MentionNotificationTest.php`:

```php
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Event;

it('creates mention notifications for valid mentioned users, excluding author', function () {
    Queue::fake();
    $author = User::factory()->create();
    $mentioned = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'channel']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $author->id]);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $mentioned->id]);

    $service = app(MessageService::class);
    $service->createMessage($channel, $author->id, "@[{$mentioned->id}:Someone] hello");

    $this->assertDatabaseHas('commons_notifications', [
        'user_id'    => $mentioned->id,
        'actor_id'   => $author->id,
        'type'       => 'mention',
        'channel_id' => $channel->id,
    ]);
    $this->assertDatabaseMissing('commons_notifications', [
        'user_id' => $author->id,
        'type'    => 'mention',
    ]);
});

it('skips mention notification for non-existent user IDs', function () {
    Queue::fake();
    $author = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'channel']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $author->id]);

    $service = app(MessageService::class);
    $service->createMessage($channel, $author->id, "@[99999:Ghost] hello");

    $this->assertDatabaseMissing('commons_notifications', ['type' => 'mention']);
});

it('caps mention notifications at 20 recipients per message', function () {
    Queue::fake();
    $author = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'channel']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $author->id]);

    $users = User::factory()->count(25)->create();
    foreach ($users as $u) {
        ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $u->id]);
    }

    $tokens = $users->map(fn($u) => "@[{$u->id}:{$u->name}]")->join(' ');
    $service = app(MessageService::class);
    $service->createMessage($channel, $author->id, $tokens);

    $count = \App\Models\Commons\Notification::where('type', 'mention')->count();
    expect($count)->toBe(20);
});

it('sends dm notification only on first message in a DM channel', function () {
    Queue::fake();
    $sender = User::factory()->create();
    $receiver = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'dm']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $sender->id]);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $receiver->id]);

    $service = app(MessageService::class);
    $service->createMessage($channel, $sender->id, 'Hello!');

    $this->assertDatabaseHas('commons_notifications', [
        'user_id' => $receiver->id,
        'actor_id' => $sender->id,
        'type'    => 'dm',
    ]);

    // Second message: no second dm notification
    $notifCountBefore = \App\Models\Commons\Notification::where('type', 'dm')->count();
    $service->createMessage($channel, $sender->id, 'Second message');
    $notifCountAfter = \App\Models\Commons\Notification::where('type', 'dm')->count();
    expect($notifCountAfter)->toBe($notifCountBefore);
});

it('skips dm notification for user removed from channel before first message', function () {
    Queue::fake();
    $sender = User::factory()->create();
    $outsider = User::factory()->create();
    $receiver = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'dm']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $sender->id]);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $receiver->id]);
    // $outsider has no ChannelMember row for this channel

    $service = app(MessageService::class);
    $service->createMessage($channel, $sender->id, 'Hello!');

    $this->assertDatabaseMissing('commons_notifications', [
        'user_id' => $outsider->id,
        'type'    => 'dm',
    ]);
    $this->assertDatabaseHas('commons_notifications', [
        'user_id' => $receiver->id,
        'type'    => 'dm',
    ]);
});

it('does not re-notify on edit for unchanged mentions', function () {
    Queue::fake();
    $author = User::factory()->create();
    $mentioned = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'channel']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $author->id]);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $mentioned->id]);

    $service = app(MessageService::class);
    $message = $service->createMessage($channel, $author->id, "@[{$mentioned->id}:Someone] hello");

    $notifCountBefore = \App\Models\Commons\Notification::where('type', 'mention')->where('user_id', $mentioned->id)->count();

    // Edit with same mention — should NOT create another notification
    $service->updateMessage($message, "@[{$mentioned->id}:Someone] hello edited");

    $notifCountAfter = \App\Models\Commons\Notification::where('type', 'mention')->where('user_id', $mentioned->id)->count();
    expect($notifCountAfter)->toBe($notifCountBefore);
});
```

- [ ] **Step 6: Run to confirm FAIL**

```bash
docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php --filter "creates mention|skips mention|caps mention|sends dm"
```
Expected: FAIL.

- [ ] **Step 7: Implement mention parsing and notification dispatch in `createMessage()`**

Update `createMessage()` in `MessageService.php`. Add the necessary `use` statements at the top of the file:

```php
use App\Events\Commons\NotificationSent;
use App\Models\Commons\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
```

Replace the current `createMessage()` method body with:

> **Note:** Use `DB::transaction()` return value (not a private instance property) — `DB::transaction(fn) => $returnValue` is idiomatic Laravel and avoids shared-state issues on Horizon workers. Do NOT add a `$messageForBroadcast` private property.

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

    $notificationsToDispatch = [];

    // DB::transaction returns the closure's return value — no private property needed.
    // NOTE: $notificationsToDispatch is captured by reference. This is safe because
    // DB::transaction() with a single argument does NOT retry on deadlock (Laravel default).
    // Do NOT switch to DB::transaction($fn, $attempts > 1) or the array may be appended to
    // multiple times, causing duplicate dispatches.
    $message = DB::transaction(function () use ($channel, $userId, $body, $parentId, $depth, &$notificationsToDispatch) {
        // Check prior messages BEFORE inserting (inside transaction to prevent race)
        $isFirstMessage = !Message::where('channel_id', $channel->id)->exists();

        $message = Message::create([
            'channel_id' => $channel->id,
            'user_id'    => $userId,
            'parent_id'  => $parentId,
            'depth'      => $depth,
            'body'       => $body,
            'body_html'  => $this->renderHtml($body),
        ]);

        $message->load('user');

        // Auto-join user if public channel
        if ($channel->isPublic()) {
            ChannelMember::firstOrCreate(
                ['channel_id' => $channel->id, 'user_id' => $userId],
                ['role' => 'member', 'joined_at' => now()],
            );
        }

        // Parse mention tokens
        preg_match_all('/@\[(\d+):[^\]]+\]/', $body, $matches);
        $mentionedIds = array_unique(array_map('intval', $matches[1]));
        $mentionedIds = array_filter($mentionedIds, fn($id) => $id !== $userId);
        $mentionedIds = array_slice($mentionedIds, 0, 20);

        if (!empty($mentionedIds)) {
            $validUsers = User::whereIn('id', $mentionedIds)->get()->keyBy('id');
            $excerpt = $this->excerptFromBody($body);

            foreach ($mentionedIds as $recipientId) {
                if (!isset($validUsers[$recipientId])) {
                    continue;
                }
                $notif = Notification::create([
                    'user_id'    => $recipientId,
                    'actor_id'   => $userId,
                    'type'       => 'mention',
                    'channel_id' => $channel->id,
                    'message_id' => $message->id,
                    'title'      => ($message->user->name ?? 'Someone') . ' mentioned you in #' . $channel->name,
                    'body'       => $excerpt,
                ]);
                // Eager-load relations needed by broadcastWith() to prevent N+1 in the dispatch loop
                $notif->load('actor', 'channel');
                $notificationsToDispatch[] = $notif;
            }
        }

        // DM first-message notification
        if ($isFirstMessage && in_array($channel->type, ['dm', 'group_dm'])) {
            // Confirm membership before creating notification (skips removed members)
            $memberIds = ChannelMember::where('channel_id', $channel->id)
                ->where('user_id', '!=', $userId)
                ->pluck('user_id');

            foreach ($memberIds as $memberId) {
                $notif = Notification::create([
                    'user_id'    => $memberId,
                    'actor_id'   => $userId,
                    'type'       => 'dm',
                    'channel_id' => $channel->id,
                    'message_id' => $message->id,
                    'title'      => ($message->user->name ?? 'Someone') . ' sent you a message',
                    'body'       => $this->excerptFromBody($body),
                ]);
                $notif->load('actor', 'channel');
                $notificationsToDispatch[] = $notif;
            }
        }

        return $message;
    });

    // Broadcast message to channel (non-blocking, outside transaction)
    broadcast(new MessageSent($message))->toOthers();

    // Invalidate unread caches
    $memberUserIds = ChannelMember::where('channel_id', $channel->id)
        ->where('user_id', '!=', $userId)
        ->pluck('user_id');
    foreach ($memberUserIds as $memberId) {
        $this->unreadService->invalidateCacheForUserId($memberId);
    }

    // Dispatch notifications (outside transaction)
    foreach ($notificationsToDispatch as $notif) {
        try {
            NotificationSent::dispatch($notif);
        } catch (\Throwable) {
            // Non-fatal — notification DB row already exists, broadcast failure is acceptable
        }
    }

    return $message;
}
```

- [ ] **Step 8: Implement mention diff in `updateMessage()`**

Replace `updateMessage()`:

```php
public function updateMessage(Message $message, string $body): Message
{
    $oldBody = $message->body;

    $message->update([
        'body'      => $body,
        'body_html' => $this->renderHtml($body),
        'is_edited' => true,
        'edited_at' => now(),
    ]);

    broadcast(new MessageUpdated($message, 'edited'))->toOthers();

    // Diff mentions: only notify newly added recipients
    preg_match_all('/@\[(\d+):[^\]]+\]/', $oldBody, $oldMatches);
    preg_match_all('/@\[(\d+):[^\]]+\]/', $body, $newMatches);
    $oldIds = array_unique(array_map('intval', $oldMatches[1]));
    $newIds = array_unique(array_map('intval', $newMatches[1]));
    $addedIds = array_diff($newIds, $oldIds);
    $addedIds = array_filter($addedIds, fn($id) => $id !== $message->user_id);
    $addedIds = array_slice($addedIds, 0, 20);

    if (!empty($addedIds)) {
        $message->load('user', 'channel');
        $validUsers = User::whereIn('id', $addedIds)->get()->keyBy('id');
        $excerpt = $this->excerptFromBody($body);

        foreach ($addedIds as $recipientId) {
            if (!isset($validUsers[$recipientId])) {
                continue;
            }
            $notif = Notification::create([
                'user_id'    => $recipientId,
                'actor_id'   => $message->user_id,
                'type'       => 'mention',
                'channel_id' => $message->channel_id,
                'message_id' => $message->id,
                'title'      => ($message->user->name ?? 'Someone') . ' mentioned you in #' . ($message->channel->name ?? 'channel'),
                'body'       => $excerpt,
            ]);
            $notif->load('actor', 'channel');
            try {
                NotificationSent::dispatch($notif);
            } catch (\Throwable) {
                // Non-fatal
            }
        }
    }

    return $message;
}
```

- [ ] **Step 9: Run all backend tests to confirm PASS**

```bash
docker compose exec php vendor/bin/pest tests/Feature/Commons/MentionNotificationTest.php
```
Expected: All passing.

- [ ] **Step 10: Run full backend test suite to check for regressions**

```bash
docker compose exec php vendor/bin/pest
```
Expected: All passing (no regressions from renaming `renderMarkdown` → `renderHtml`).

- [ ] **Step 11: Commit**

```bash
git add backend/app/Services/Commons/MessageService.php backend/tests/Feature/Commons/MentionNotificationTest.php
git commit -m "feat: add mention parsing, excerptFromBody, and notification dispatch to MessageService"
```

---

## Chunk 2: Frontend — Toast Action Button + Mention Token Format

### Task 3: Extend `Toast.tsx` — action button + `MAX_TOASTS` cap

**Files:**
- Modify: `frontend/src/components/ui/Toast.tsx`
- Modify: `frontend/src/components/ui/__tests__/Toast.test.tsx` (existing test file, or create if not present)

- [ ] **Step 1: Write failing tests**

Find the existing Toast test file:

```bash
find /home/smudoshi/Github/Parthenon/frontend/src -name "Toast.test*" 2>/dev/null
```

If no test file exists, create `frontend/src/components/ui/__tests__/Toast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer, toast } from '../Toast';

beforeEach(() => {
  // Reset internal toast state between tests by dismissing all
  act(() => { toast.dismiss('_all_reset_'); });
});

describe('Toast action button', () => {
  it('renders action button when action is provided', () => {
    render(<ToastContainer />);
    act(() => {
      toast.show('info', 'Test notification', 0, { label: 'Go to message', onClick: vi.fn() });
    });
    expect(screen.getByText('Go to message')).toBeInTheDocument();
  });

  it('calls onClick when action button is clicked', () => {
    render(<ToastContainer />);
    const onClick = vi.fn();
    act(() => {
      toast.show('info', 'Test notification', 0, { label: 'Go', onClick });
    });
    fireEvent.click(screen.getByText('Go'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders without action button when action is not provided', () => {
    render(<ToastContainer />);
    act(() => {
      toast.show('info', 'Plain toast', 0);
    });
    expect(screen.queryByRole('button', { name: /go/i })).not.toBeInTheDocument();
  });
});

describe('MAX_TOASTS cap', () => {
  it('drops oldest toast when MAX_TOASTS (3) is exceeded', () => {
    render(<ToastContainer />);
    act(() => {
      toast.show('info', 'Toast 1', 0);
      toast.show('info', 'Toast 2', 0);
      toast.show('info', 'Toast 3', 0);
      toast.show('info', 'Toast 4', 0); // should drop Toast 1
    });
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/components/ui/__tests__/Toast.test.tsx
```
Expected: FAIL — `action` parameter not accepted, `MAX_TOASTS` not enforced.

- [ ] **Step 3: Implement changes in `Toast.tsx`**

a. Add `action` to `ToastMessage` interface:

```ts
export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}
```

b. Add `MAX_TOASTS = 3` constant and update `toast.show()`.

> **Note:** Only `toast.show()` needs the 4th `action` argument. The shorthand convenience methods (`toast.info()`, `toast.success()`, etc.) do NOT need to be updated — `useNotificationListener` calls `toast.show()` directly, and no other current caller needs to pass an action via the shorthands.

```ts
const MAX_TOASTS = 3;

export const toast = {
  show(variant: ToastVariant, message: string, duration = 5000, action?: { label: string; onClick: () => void }) {
    const id = crypto.randomUUID();
    // Drop oldest if at cap
    if (toasts.length >= MAX_TOASTS) {
      toasts = toasts.slice(1);
    }
    toasts = [...toasts, { id, variant, message, duration, action }];
    notify();
    if (duration > 0) {
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        notify();
      }, duration);
    }
  },
  // ... rest of methods unchanged
};
```

c. Render action button in `ToastContainer`:

```tsx
<div key={t.id} className={cn("toast", `toast-${t.variant}`)}>
  <span className="toast-icon">{icons[t.variant]}</span>
  <span className="toast-message">{t.message}</span>
  {t.action && (
    <button
      className="toast-action"
      onClick={() => { t.action!.onClick(); toast.dismiss(t.id); }}
    >
      {t.action.label}
    </button>
  )}
  <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
    <X size={14} />
  </button>
</div>
```

d. Add `.toast-action` style to `frontend/src/index.css`:

```css
.toast-action {
  @apply ml-1 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium bg-white/10 hover:bg-white/20 text-foreground transition-colors;
}
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/components/ui/__tests__/Toast.test.tsx
```
Expected: All passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Toast.tsx frontend/src/components/ui/__tests__/Toast.test.tsx frontend/src/index.css
git commit -m "feat: add action button and MAX_TOASTS=3 cap to Toast component"
```

---

### Task 4: Upgrade `MessageComposer` mention token format

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageComposer.tsx`

**Context:** The composer already has working @mention detection and dropdown. The only change is `insertMention()` — it currently inserts `@${member.user.name}` but needs to insert `@[${member.user_id}:${member.user.name}]` (the structured token that the backend will parse).

Also, the `mentionStart` calculation sets position of `@` correctly, but the `after` slice uses `mentionStart + mentionQuery.length + 1`. The token format doesn't affect this logic since it still replaces from `@` to end of query fragment.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/commons/components/chat/__tests__/MessageComposer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageComposer } from '../MessageComposer';
import type { ChannelMember } from '../../../types';

const members: ChannelMember[] = [
  {
    id: 1,
    channel_id: 1,
    user_id: 42,
    role: 'member',
    joined_at: '',
    user: { id: 42, name: 'Dr. Smith' },
  } as ChannelMember,
];

it('inserts structured mention token @[id:name] on member selection', async () => {
  const onSend = vi.fn();
  render(<MessageComposer channelName="general" onSend={onSend} members={members} />);

  const textarea = screen.getByPlaceholderText('Write a message...');
  fireEvent.change(textarea, { target: { value: '@Dr' } });

  // Member appears in dropdown
  expect(await screen.findByText('Dr. Smith')).toBeInTheDocument();

  // Click the member
  fireEvent.mouseDown(screen.getByText('Dr. Smith'));

  // Submit
  fireEvent.keyDown(textarea, { key: 'Enter' });

  expect(onSend).toHaveBeenCalledWith(
    expect.stringContaining('@[42:Dr. Smith]'),
    undefined,
    undefined
  );
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/chat/__tests__/MessageComposer.test.tsx
```
Expected: FAIL — sends `@Dr. Smith` not `@[42:Dr. Smith]`.

- [ ] **Step 3: Update `insertMention` in `MessageComposer.tsx`**

Change:

```ts
function insertMention(member: ChannelMember) {
  const before = body.slice(0, mentionStart);
  const after = body.slice(mentionStart + (mentionQuery?.length ?? 0) + 1);
  const newBody = `${before}@${member.user.name} ${after}`;
  setBody(newBody);
  setMentionQuery(null);
  requestAnimationFrame(() => {
    const ta = textareaRef.current;
    if (ta) {
      const pos = mentionStart + member.user.name.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }
  });
}
```

To:

```ts
function insertMention(member: ChannelMember) {
  const token = `@[${member.user_id}:${member.user.name}]`;
  const before = body.slice(0, mentionStart);
  const after = body.slice(mentionStart + (mentionQuery?.length ?? 0) + 1);
  const newBody = `${before}${token} ${after}`;
  setBody(newBody);
  setMentionQuery(null);
  requestAnimationFrame(() => {
    const ta = textareaRef.current;
    if (ta) {
      const pos = mentionStart + token.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }
  });
}
```

- [ ] **Step 4: Run test to confirm PASS**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/chat/__tests__/MessageComposer.test.tsx
```
Expected: Passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageComposer.tsx frontend/src/features/commons/components/chat/__tests__/MessageComposer.test.tsx
git commit -m "feat: upgrade MessageComposer mention token format to @[id:name]"
```

---

## Chunk 3: Frontend — Notification Listener, Bell, MessageList, CSS

### Task 5: Create `useNotificationListener` + mount in `MainLayout`

**Files:**
- Create: `frontend/src/features/commons/hooks/useNotificationListener.ts`
- Modify: `frontend/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/commons/hooks/__tests__/useNotificationListener.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

// Mock Echo
const mockListen = vi.fn().mockReturnThis();
const mockLeave = vi.fn();
const mockPrivate = vi.fn().mockReturnValue({ listen: mockListen });
vi.mock('@/lib/echo', () => ({ getEcho: () => ({ private: mockPrivate, leave: mockLeave }) }));

// Mock toast
const mockToastShow = vi.fn();
vi.mock('@/components/ui/Toast', () => ({ toast: { show: mockToastShow } }));

// Mock queryClient
const mockInvalidate = vi.fn();
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: mockInvalidate } }));

// Mock authStore
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 7 } }),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

import { useNotificationListener } from '../useNotificationListener';

describe('useNotificationListener', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('subscribes to the correct private channel', () => {
    renderHook(() => useNotificationListener());
    expect(mockPrivate).toHaveBeenCalledWith('App.Models.User.7');
    expect(mockListen).toHaveBeenCalledWith('.NotificationSent', expect.any(Function));
  });

  it('shows toast and invalidates unread-count on NotificationSent event', () => {
    renderHook(() => useNotificationListener());

    const callback = mockListen.mock.calls[0][1] as (p: unknown) => void;
    act(() => {
      callback({
        id: 1,
        type: 'mention',
        title: 'Alice mentioned you',
        body: 'hello',
        message_id: 99,
        actor: { id: 3, name: 'Alice' },
        channel: { slug: 'general' },
      });
    });

    expect(mockToastShow).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Alice mentioned you'),
      6000,
      expect.objectContaining({ label: 'Go to message' }),
    );
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['commons', 'notifications', 'unread-count'],
    });
  });

  it('leaves channel on unmount', () => {
    const { unmount } = renderHook(() => useNotificationListener());
    unmount();
    expect(mockLeave).toHaveBeenCalledWith('App.Models.User.7');
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/hooks/__tests__/useNotificationListener.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `useNotificationListener.ts`**

```ts
// frontend/src/features/commons/hooks/useNotificationListener.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEcho } from '@/lib/echo';
import { toast } from '@/components/ui/Toast';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/authStore';

interface NotificationPayload {
  id: number;
  type: string;
  title: string;
  body: string;
  message_id: number | null;
  actor: { id: number; name: string } | null;
  channel: { slug: string } | null;
}

export function useNotificationListener(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    const echo = getEcho();
    if (!echo) return;

    echo
      .private(`App.Models.User.${userId}`)
      .listen('.NotificationSent', (payload: NotificationPayload) => {
        const channelSlug = payload.channel?.slug;
        const action = channelSlug
          ? {
              label: 'Go to message',
              onClick: () =>
                navigate(
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

- [ ] **Step 4: Mount in `MainLayout.tsx`**

Add import and hook call:

```tsx
import { useNotificationListener } from '@/features/commons/hooks/useNotificationListener';

// Inside MainLayout() function body, after useGlobalPresence():
useNotificationListener();
```

- [ ] **Step 5: Run tests to confirm PASS**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/hooks/__tests__/useNotificationListener.test.ts
```
Expected: All 3 passing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/commons/hooks/useNotificationListener.ts frontend/src/features/commons/hooks/__tests__/useNotificationListener.test.ts frontend/src/components/layout/MainLayout.tsx
git commit -m "feat: add useNotificationListener hook, mount globally in MainLayout"
```

---

### Task 6: Fix `NotificationBell` — per-click read + `?highlight` navigation

**Files:**
- Modify: `frontend/src/features/commons/components/sidebar/NotificationBell.tsx`

**Context:** Two changes:
1. `handleOpen()` currently calls `markRead.mutate(undefined)` on every open — remove this. Notifications are only marked read when individually clicked.
2. `handleClick(n)` navigates to `/commons/${n.channel.slug}` — add `?highlight=${n.message_id}` and call `markRead.mutate([n.id])`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/commons/components/sidebar/__tests__/NotificationBell.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API hooks
const mockMarkRead = vi.fn();
vi.mock('../../../api', () => ({
  useNotifications: () => ({
    data: [
      {
        id: 5,
        type: 'mention',
        title: 'Alice mentioned you',
        body: 'hello',
        message_id: 99,
        actor: { id: 3, name: 'Alice' },
        channel: { id: 1, slug: 'general', name: 'general' },
        actor_id: 3,
        channel_id: 1,
        user_id: 7,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ],
  }),
  useUnreadNotificationCount: () => ({ data: 1 }),
  useMarkNotificationsRead: () => ({ mutate: mockMarkRead }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { NotificationBell } from '../NotificationBell';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NotificationBell', () => {
  it('does NOT mark all read when dropdown opens', () => {
    render(<NotificationBell />, { wrapper });
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('marks specific notification read and navigates with ?highlight on click', () => {
    render(<NotificationBell />, { wrapper });
    fireEvent.click(screen.getByTitle('Notifications')); // open
    fireEvent.click(screen.getByText('Alice mentioned you'));
    expect(mockMarkRead).toHaveBeenCalledWith([5]);
    expect(mockNavigate).toHaveBeenCalledWith('/commons/general?highlight=99');
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/sidebar/__tests__/NotificationBell.test.tsx
```
Expected: FAIL — marks all read on open; navigates without `?highlight`.

- [ ] **Step 3: Update `NotificationBell.tsx`**

Change `handleOpen()` — remove the bulk mark-read:

```ts
function handleOpen() {
  setOpen(!open);
  // No automatic mark-read on open — notifications are marked read per-click
}
```

Change `handleClick()` — add `?highlight`, per-item mark-read:

```ts
function handleClick(n: CommonsNotification) {
  if (n.channel) {
    const url = `/commons/${n.channel.slug}${n.message_id ? `?highlight=${n.message_id}` : ''}`;
    navigate(url);
  }
  markRead.mutate([n.id]);
  setOpen(false);
}
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/sidebar/__tests__/NotificationBell.test.tsx
```
Expected: Both passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/commons/components/sidebar/NotificationBell.tsx frontend/src/features/commons/components/sidebar/__tests__/NotificationBell.test.tsx
git commit -m "fix: NotificationBell — per-click mark read, add ?highlight to navigation"
```

---

### Task 7: `MessageList` — highlight on `?highlight` URL param

**Files:**
- Modify: `frontend/src/features/commons/components/chat/MessageList.tsx`

**Context:** When a user arrives at `/commons/general?highlight=99`, `MessageList` should find the message with `id=99`, scroll it into view, and apply a 2-second highlight fade. The message element needs a `data-message-id` attribute. If the message isn't in the list (deleted/inaccessible), silently do nothing.

> **Architecture decision:** `MessageList` reads `useSearchParams()` internally (Option A). This keeps the highlight logic self-contained and avoids adding a new prop to `CommonsLayout`. Trade-off: tests must wrap the component in a `MemoryRouter` context — this is already the case in the test code below.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/commons/components/chat/__tests__/MessageList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MessageList } from '../MessageList';
import type { Message } from '../../../types';

const messages: Message[] = [
  {
    id: 99,
    channel_id: 1,
    user_id: 1,
    body: 'Hello there',
    body_html: '<p>Hello there</p>',
    parent_id: null,
    depth: 0,
    is_edited: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 1, name: 'Alice' },
    reactions: [],
    replies: [],
  } as unknown as Message,
];

it('adds data-message-id attribute to each message row', () => {
  render(
    <MemoryRouter initialEntries={['/commons/general']}>
      <Routes>
        <Route
          path="/commons/:slug"
          element={
            <MessageList
              messages={messages}
              isLoading={false}
              slug="general"
              currentUserId={2}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
  expect(document.querySelector('[data-message-id="99"]')).not.toBeNull();
});

it('applies highlight class to message when ?highlight param matches', () => {
  render(
    <MemoryRouter initialEntries={['/commons/general?highlight=99']}>
      <Routes>
        <Route
          path="/commons/:slug"
          element={
            <MessageList
              messages={messages}
              isLoading={false}
              slug="general"
              currentUserId={2}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
  const el = document.querySelector('[data-message-id="99"]');
  expect(el?.classList.contains('message-highlight')).toBe(true);
});

it('silently does nothing when ?highlight param references a non-existent message ID', async () => {
  // Must use act() to flush effects (including the setTimeout in the highlight effect)
  // before asserting, to avoid spurious act() warnings in CI
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/commons/general?highlight=9999']}>
        <Routes>
          <Route
            path="/commons/:slug"
            element={
              <MessageList
                messages={messages}
                isLoading={false}
                slug="general"
                currentUserId={2}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );
  });
  // No element should have highlight class — message 9999 doesn't exist in the list
  expect(document.querySelector('.message-highlight')).toBeNull();
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/chat/__tests__/MessageList.test.tsx
```
Expected: FAIL — no `data-message-id`, no `message-highlight` class.

- [ ] **Step 3: Implement highlight in `MessageList.tsx`**

a. Add import:

```ts
import { useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
```

b. Inside `MessageList()`, after existing refs, add:

```ts
const [searchParams] = useSearchParams();
// Number() of null/empty string is NaN which will never match msg.id; guard to null explicitly
const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;
const highlightRef = useRef<HTMLDivElement | null>(null);
```

c. Add a `useEffect` to scroll to and highlight the message.

> **Important:** The existing "scroll to bottom on initial load" `useEffect` (dependency `[isLoading]`) will conflict with the highlight scroll if both fire at the same time. Suppress the bottom-scroll when a highlight param is active by adding an early return guard.

Modify **both** existing scroll effects (lines 70–89 in original file) and add the new highlight effect:

```ts
// Auto-scroll to bottom when new messages arrive — suppressed when ?highlight is active
// (guard prevents scroll-away from a highlighted message when real-time messages arrive)
useEffect(() => {
  if (highlightId) return;
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
}, [messages.length, highlightId]);

// Scroll to bottom on initial load — suppressed when ?highlight is active
useEffect(() => {
  if (highlightId) return; // highlight effect handles scroll instead
  if (!isLoading && messages.length > 0) {
    bottomRef.current?.scrollIntoView();
  }
}, [isLoading, highlightId]); // eslint-disable-line react-hooks/exhaustive-deps
```

Then add the new highlight effect after the two scroll effects:

```ts
useEffect(() => {
  if (!highlightId || !highlightRef.current) return;
  highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlightRef.current.classList.add('message-highlight');
  const timer = setTimeout(() => {
    highlightRef.current?.classList.remove('message-highlight');
  }, 2000);
  return () => clearTimeout(timer); // cleanup: prevent timer firing after unmount
}, [highlightId, sorted]); // re-run when messages load
```

d. Update the message wrapper div to carry `data-message-id` and conditionally assign `highlightRef`:

```tsx
return (
  <div
    key={msg.id}
    data-message-id={msg.id}
    ref={msg.id === highlightId ? highlightRef : null}
  >
    {showDateSep && <DateSeparator label={formatDateLabel(msg.created_at)} />}
    {showUnread && <UnreadDivider />}
    <MessageItem ... />
  </div>
);
```

- [ ] **Step 4: Add `.message-highlight` animation to `frontend/src/index.css`**

```css
.message-highlight {
  animation: highlight-fade 2s ease-out forwards;
}

@keyframes highlight-fade {
  0%   { background-color: rgb(234 179 8 / 0.25); }
  100% { background-color: transparent; }
}
```

- [ ] **Step 5: Add `.mention` chip style to `frontend/src/index.css`**

```css
.mention {
  @apply text-teal-400 font-medium bg-teal-400/10 rounded px-0.5 cursor-default;
}
```

- [ ] **Step 6: Run tests to confirm PASS**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/commons/components/chat/__tests__/MessageList.test.tsx
```
Expected: Both passing.

- [ ] **Step 7: Run full frontend test suite to check for regressions**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run
```
Expected: All passing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/commons/components/chat/MessageList.tsx frontend/src/features/commons/components/chat/__tests__/MessageList.test.tsx frontend/src/index.css
git commit -m "feat: MessageList ?highlight scroll+fade, .mention chip style, .message-highlight animation"
```

---

## Chunk 4: Integration Verification

### Task 8: TypeScript check + deploy

**Files:**
- No new files — verification only.

- [ ] **Step 1: TypeScript strict check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```
Expected: 0 errors. If errors appear, fix them before proceeding.

- [ ] **Step 2: PHPStan analysis**

```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec php vendor/bin/phpstan analyse --memory-limit=512M
```
Expected: 0 errors beyond existing baseline. If new errors appear in the modified files, fix them.

- [ ] **Step 3: Full test suites**

```bash
# Backend
docker compose exec php vendor/bin/pest

# Frontend
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run
```
Expected: All passing.

- [ ] **Step 4: Deploy**

```bash
cd /home/smudoshi/Github/Parthenon && ./deploy.sh
```

- [ ] **Step 5: Smoke test on production**

1. Log in as `admin@acumenus.net` in one browser tab
2. Open Commons > `#general` channel
3. Type `@` in the composer — confirm dropdown appears with channel members
4. Select a member — confirm `@[id:name]` token appears in raw textarea value
5. Send the message — confirm it renders with teal `@Name` chip on the recipient's side
6. Check the notification bell — confirm unread count badge appears for the mentioned user
7. Click a notification — confirm navigation to the channel with `?highlight=<id>`
8. Confirm the highlighted message scrolls into view with a yellow fade

- [ ] **Step 6: Final commit (if any fixup needed during smoke test)**

```bash
git add -p
git commit -m "fix: address issues found during integration smoke test"
```

---

## Error Handling Reference

| Case | Behaviour |
|------|-----------|
| Mention token referencing deleted user | Backend skips notification; `renderHtml()` renders `@Username` from stored token text |
| `?highlight` message ID not found in list | Silent no-op — `highlightRef` stays null, no scroll |
| DM notification for removed channel member | Notification skipped (membership check in `createMessage`) |
| Concurrent first-message sends to DM | Prevented by `isFirstMessage` check inside DB transaction |
| Echo unavailable | `useNotificationListener` exits early; unread count continues via polling |
| Broadcast failure | Non-fatal `try/catch` in `MessageService`; message saved, notification DB row exists |
| > 20 mentions in one message | Capped at 20 recipients; extras silently dropped |
| Toast storm | `MAX_TOASTS = 3` cap; oldest dropped when exceeded |
