<?php

namespace App\Services\Commons;

use App\Events\Commons\MessageSent;
use App\Events\Commons\MessageUpdated;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\Commons\Notification;
use App\Models\User;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\DisallowedRawHtml\DisallowedRawHtmlExtension;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\MarkdownConverter;

class MessageService
{
    /** Matches @[userId:display name] mention tokens in message bodies. */
    private const MENTION_PATTERN = '/@\[(\d+):([^\]]+)\]/';

    private MarkdownConverter $converter;

    public function __construct(private UnreadService $unreadService)
    {
        $environment = new Environment([
            'disallowed_raw_html' => [
                'disallowed_tags' => [],
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension);
        $environment->addExtension(new GithubFlavoredMarkdownExtension);
        $environment->addExtension(new DisallowedRawHtmlExtension);

        $this->converter = new MarkdownConverter($environment);
    }

    /**
     * Render a message body to HTML.
     *
     * Mention tokens (@[id:name]) are converted to
     * <span class="mention" data-user-id="id">@name</span> before
     * the markdown pass so they survive CommonMark processing.
     */
    public function renderHtml(string $body): string
    {
        $withMentions = preg_replace_callback(
            self::MENTION_PATTERN,
            fn ($m) => '<span class="mention" data-user-id="'.$m[1].'">@'.e($m[2]).'</span>',
            $body
        );

        return $this->converter->convert($withMentions)->getContent();
    }

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
            'body_html' => $this->renderHtml($body),
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

        // Invalidate unread caches for all channel members except the sender
        $memberUserIds = ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', '!=', $userId)
            ->pluck('user_id');

        foreach ($memberUserIds as $memberId) {
            $this->unreadService->invalidateCacheForUserId($memberId);
        }

        // Create mention notifications
        $this->createMentionNotifications($message, $channel, $userId, $body);

        // Create DM notification on first message in a DM channel
        if ($channel->type === 'dm') {
            $this->createDmNotification($message, $channel, $userId);
        }

        return $message;
    }

    public function updateMessage(Message $message, string $body): Message
    {
        $message->update([
            'body' => $body,
            'body_html' => $this->renderHtml($body),
            'is_edited' => true,
            'edited_at' => now(),
        ]);

        broadcast(new MessageUpdated($message, 'edited'))->toOthers();

        return $message;
    }

    /**
     * Generate a plain-text excerpt from a message body.
     *
     * Converts mention tokens to @Username, strips HTML, and truncates at 160 chars.
     */
    protected function excerptFromBody(string $body): string
    {
        // Convert mention tokens @[id:Name] to @Name
        $text = preg_replace(self::MENTION_PATTERN, '@$2', $body);

        // Strip any HTML tags
        $text = strip_tags($text);

        // Trim whitespace
        $text = trim($text);

        if (mb_strlen($text) > 160) {
            $text = mb_substr($text, 0, 160).'…';
        }

        return $text;
    }

    private function createMentionNotifications(Message $message, Channel $channel, int $senderId, string $body): void
    {
        preg_match_all(self::MENTION_PATTERN, $body, $matches);

        if (empty($matches[1])) {
            return;
        }

        $mentionedUserIds = collect($matches[1])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn ($id) => $id === $senderId)
            ->values();

        // Cap at 20 recipients
        $mentionedUserIds = $mentionedUserIds->take(20);

        // Only notify users who actually exist and are channel members
        $validUserIds = ChannelMember::where('channel_id', $channel->id)
            ->whereIn('user_id', $mentionedUserIds)
            ->pluck('user_id');

        $existingUserIds = User::whereIn('id', $validUserIds)->pluck('id');

        $excerpt = $this->excerptFromBody($body);

        foreach ($existingUserIds as $userId) {
            Notification::create([
                'user_id' => $userId,
                'actor_id' => $senderId,
                'type' => 'mention',
                'title' => 'You were mentioned',
                'body' => $excerpt,
                'channel_id' => $channel->id,
                'message_id' => $message->id,
            ]);
        }
    }

    private function createDmNotification(Message $message, Channel $channel, int $senderId): void
    {
        // Only notify on the first message in the DM channel
        $priorMessageCount = Message::where('channel_id', $channel->id)
            ->where('id', '!=', $message->id)
            ->count();

        if ($priorMessageCount > 0) {
            return;
        }

        $recipientIds = ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', '!=', $senderId)
            ->pluck('user_id');

        $excerpt = $this->excerptFromBody($message->body);

        foreach ($recipientIds as $userId) {
            Notification::create([
                'user_id' => $userId,
                'actor_id' => $senderId,
                'type' => 'dm',
                'title' => 'New direct message',
                'body' => $excerpt,
                'channel_id' => $channel->id,
                'message_id' => $message->id,
            ]);
        }
    }

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
}
