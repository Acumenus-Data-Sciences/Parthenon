<?php

use App\Events\Commons\NotificationSent;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\Commons\Notification;
use App\Models\User;
use App\Services\Commons\MessageService;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

// DatabaseTransactions wraps each test in a rolled-back transaction.
// We use this instead of RefreshDatabase because the test DB schema is
// already migrated, and RefreshDatabase would re-run migrations including
// the PostGIS geometry column which fails on re-creation.
uses(DatabaseTransactions::class);

// ── Task 1: NotificationSent broadcast event ─────────────────────────────────

it('broadcasts on the correct private channel', function () {
    $user = User::factory()->create();
    $notification = Notification::factory()->create(['user_id' => $user->id]);
    $event = new NotificationSent($notification);

    $channels = $event->broadcastOn();
    expect($channels)->toHaveCount(1)
        ->and($channels[0])->toBeInstanceOf(PrivateChannel::class)
        ->and($channels[0]->name)->toContain('App.Models.User.'.$user->id);
});

it('broadcasts with the correct payload shape', function () {
    $notification = Notification::factory()
        ->for(User::factory(), 'actor')
        ->for(Channel::factory(), 'channel')
        ->create(['type' => 'mention', 'title' => 'Test', 'body' => 'hello', 'message_id' => null]);

    $event = new NotificationSent($notification);
    $payload = $event->broadcastWith();

    expect($payload)->toHaveKeys(['id', 'type', 'title', 'body', 'channel_id', 'message_id', 'actor', 'channel', 'created_at'])
        ->and($payload['type'])->toBe('mention')
        ->and($payload['actor'])->toHaveKeys(['id', 'name'])
        ->and($payload['channel'])->toHaveKey('slug');
});

// ── Task 2: MessageService renderHtml + excerptFromBody ──────────────────────

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

    $body = '@[42:Dr. Smith] said **hello** '.str_repeat('x', 200);
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

// ── Task 2: mention parsing + notification creation ──────────────────────────

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
        'user_id' => $mentioned->id,
        'actor_id' => $author->id,
        'type' => 'mention',
        'channel_id' => $channel->id,
    ]);
    $this->assertDatabaseMissing('commons_notifications', [
        'user_id' => $author->id,
        'type' => 'mention',
    ]);
});

it('skips mention notification for non-existent user IDs', function () {
    Queue::fake();
    $author = User::factory()->create();
    $channel = Channel::factory()->create(['type' => 'channel']);
    ChannelMember::factory()->create(['channel_id' => $channel->id, 'user_id' => $author->id]);

    $service = app(MessageService::class);
    $service->createMessage($channel, $author->id, '@[99999:Ghost] hello');

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

    $tokens = $users->map(fn ($u) => "@[{$u->id}:{$u->name}]")->join(' ');
    $service = app(MessageService::class);
    $service->createMessage($channel, $author->id, $tokens);

    $count = Notification::where('type', 'mention')->count();
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
        'type' => 'dm',
    ]);

    // Second message: no second dm notification
    $notifCountBefore = Notification::where('type', 'dm')->count();
    $service->createMessage($channel, $sender->id, 'Second message');
    $notifCountAfter = Notification::where('type', 'dm')->count();
    expect($notifCountAfter)->toBe($notifCountBefore);
});

it('skips dm notification for user not in channel', function () {
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
        'type' => 'dm',
    ]);
    $this->assertDatabaseHas('commons_notifications', [
        'user_id' => $receiver->id,
        'type' => 'dm',
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

    $notifCountBefore = Notification::where('type', 'mention')->where('user_id', $mentioned->id)->count();

    // Edit with same mention — should NOT create another notification
    $service->updateMessage($message, "@[{$mentioned->id}:Someone] hello edited");

    $notifCountAfter = Notification::where('type', 'mention')->where('user_id', $mentioned->id)->count();
    expect($notifCountAfter)->toBe($notifCountBefore);
});
