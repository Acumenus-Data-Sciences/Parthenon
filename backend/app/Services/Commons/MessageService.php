<?php

namespace App\Services\Commons;

use App\Events\Commons\MessageSent;
use App\Events\Commons\MessageUpdated;
use App\Events\Commons\NotificationSent;
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

    private const MAX_MENTION_NOTIFICATIONS = 20;

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

    /**
     * Produce a plain-text excerpt from a message body.
     *
     * Mention tokens become @Name, HTML tags are stripped,
     * and the result is truncated to 160 characters.
     */
    private function excerptFromBody(string $body): string
    {
        $plain = preg_replace(self::MENTION_PATTERN, '@$2', $body);
        $plain = strip_tags((string) $plain);

        if (mb_strlen($plain) > 160) {
            return mb_substr($plain, 0, 160).'…';
        }

        return $plain;
    }

    /**
     * Extract all user IDs referenced by mention tokens in a body string.
     *
     * @return array<int>
     */
    private function extractMentionIds(string $body): array
    {
        preg_match_all(self::MENTION_PATTERN, $body, $matches);

        return array_values(array_unique(array_map('intval', $matches[1] ?? [])));
    }

    /**
     * Create mention notifications for the given user IDs and broadcast each one.
     *
     * Only users who are channel members and are not the author receive
     * a notification. Capped at MAX_MENTION_NOTIFICATIONS per call.
     *
     * @param  array<int>  $mentionIds
     */
    private function dispatchMentionNotifications(
        Message $message,
        int $channelId,
        int $authorId,
        array $mentionIds,
    ): void {
        if (empty($mentionIds)) {
            return;
        }

        $recipientIds = ChannelMember::where('channel_id', $channelId)
            ->whereIn('user_id', $mentionIds)
            ->where('user_id', '!=', $authorId)
            ->limit(self::MAX_MENTION_NOTIFICATIONS)
            ->pluck('user_id')
            ->toArray();

        if (empty($recipientIds)) {
            return;
        }

        $actor = User::find($authorId);
        $title = ($actor?->name ?? 'Someone').' mentioned you';
        $excerpt = $this->excerptFromBody($message->body);

        foreach ($recipientIds as $userId) {
            $notification = Notification::create([
                'user_id' => $userId,
                'actor_id' => $authorId,
                'type' => 'mention',
                'title' => $title,
                'body' => $excerpt,
                'channel_id' => $channelId,
                'message_id' => $message->id,
            ]);

            $notification->load(['actor', 'channel']);
            broadcast(new NotificationSent($notification));
        }
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

        // Check before creation so the new message doesn't count.
        $isFirstDmMessage = $channel->type === 'dm'
            && Message::where('channel_id', $channel->id)->count() === 0;

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

        // Mention notifications (@[id:name] token format)
        $mentionIds = $this->extractMentionIds($body);
        $this->dispatchMentionNotifications($message, $channel->id, $userId, $mentionIds);

        // DM notification — first message only
        if ($isFirstDmMessage) {
            $actor = User::find($userId);
            $dmRecipients = ChannelMember::where('channel_id', $channel->id)
                ->where('user_id', '!=', $userId)
                ->pluck('user_id');

            foreach ($dmRecipients as $recipientId) {
                $notification = Notification::create([
                    'user_id' => $recipientId,
                    'actor_id' => $userId,
                    'type' => 'dm',
                    'title' => 'New message from '.($actor?->name ?? 'Someone'),
                    'body' => $this->excerptFromBody($body),
                    'channel_id' => $channel->id,
                    'message_id' => $message->id,
                ]);

                $notification->load(['actor', 'channel']);
                broadcast(new NotificationSent($notification));
            }
        }

        return $message;
    }

    public function updateMessage(Message $message, string $body): Message
    {
        $oldMentionIds = $this->extractMentionIds($message->body);

        $message->update([
            'body' => $body,
            'body_html' => $this->renderHtml($body),
            'is_edited' => true,
            'edited_at' => now(),
        ]);

        broadcast(new MessageUpdated($message, 'edited'))->toOthers();

        // Only notify for mentions that were not present before the edit
        $newMentionIds = $this->extractMentionIds($body);
        $addedIds = array_values(array_diff($newMentionIds, $oldMentionIds));
        $this->dispatchMentionNotifications($message, $message->channel_id, $message->user_id, $addedIds);

        return $message;
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
