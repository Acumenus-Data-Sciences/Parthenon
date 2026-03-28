<?php

namespace App\Services\Commons;

use App\Events\Commons\NotificationSent;
use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\Commons\Notification;

class NotificationService
{
    /** Matches tokenized mentions stored by the composer: @[id:display name]. */
    private const TOKEN_MENTION_PATTERN = '/@\[(\d+):([^\]]+)\]/';

    private function broadcastNotification(Notification $notification): void
    {
        $notification->loadMissing(['actor:id,name', 'channel:id,slug']);
        broadcast(new NotificationSent($notification));
    }

    /**
     * Create notifications for @mentions in a message body.
     * Parses tokenized mentions and notifies eligible channel members.
     */
    public function notifyMentions(Message $message, int $channelId): void
    {
        if (! preg_match_all(self::TOKEN_MENTION_PATTERN, $message->body, $matches)) {
            return;
        }

        $mentionedIds = array_values(array_unique(array_map('intval', $matches[1] ?? [])));
        if (empty($mentionedIds)) {
            return;
        }

        $members = ChannelMember::where('channel_id', $channelId)
            ->whereIn('user_id', $mentionedIds)
            ->where('user_id', '!=', $message->user_id)
            ->where('notification_preference', '!=', 'none')
            ->get();

        foreach ($members as $member) {
            $notification = Notification::create([
                'user_id' => $member->user_id,
                'type' => 'mention',
                'title' => "{$message->user->name} mentioned you",
                'body' => mb_substr(preg_replace(self::TOKEN_MENTION_PATTERN, '@$2', $message->body) ?? $message->body, 0, 200),
                'channel_id' => $channelId,
                'message_id' => $message->id,
                'actor_id' => $message->user_id,
            ]);

            $this->broadcastNotification($notification);
        }
    }

    /**
     * Notify the other user in a DM channel when a message is sent.
     */
    public function notifyDirectMessage(Message $message, int $channelId): void
    {
        $members = ChannelMember::where('channel_id', $channelId)
            ->where('user_id', '!=', $message->user_id)
            ->where('notification_preference', '!=', 'none')
            ->pluck('user_id');

        foreach ($members as $userId) {
            $notification = Notification::create([
                'user_id' => $userId,
                'type' => 'dm',
                'title' => "New message from {$message->user->name}",
                'body' => mb_substr(preg_replace(self::TOKEN_MENTION_PATTERN, '@$2', $message->body) ?? $message->body, 0, 200),
                'channel_id' => $channelId,
                'message_id' => $message->id,
                'actor_id' => $message->user_id,
            ]);

            $this->broadcastNotification($notification);
        }
    }

    /**
     * Notify thread participants when a reply is posted.
     */
    public function notifyThreadReply(Message $reply, int $channelId): void
    {
        if (! $reply->parent_id) {
            return;
        }

        $parent = Message::find($reply->parent_id);
        if (! $parent || $parent->user_id === $reply->user_id) {
            return;
        }

        $parentMember = ChannelMember::where('channel_id', $channelId)
            ->where('user_id', $parent->user_id)
            ->first();

        if ($parentMember && $parentMember->notification_preference === 'none') {
            return;
        }

        $notification = Notification::create([
            'user_id' => $parent->user_id,
            'type' => 'thread_reply',
            'title' => "{$reply->user->name} replied to your message",
            'body' => mb_substr(preg_replace(self::TOKEN_MENTION_PATTERN, '@$2', $reply->body) ?? $reply->body, 0, 200),
            'channel_id' => $channelId,
            'message_id' => $reply->id,
            'actor_id' => $reply->user_id,
        ]);

        $this->broadcastNotification($notification);
    }

    /**
     * Notify the message author when a review is requested.
     */
    public function notifyReviewRequested(int $userId, int $requestedBy, string $requesterName, int $channelId, int $messageId): void
    {
        if ($userId === $requestedBy) {
            return;
        }

        $notification = Notification::create([
            'user_id' => $userId,
            'type' => 'review_assigned',
            'title' => "{$requesterName} requested your review",
            'channel_id' => $channelId,
            'message_id' => $messageId,
            'actor_id' => $requestedBy,
        ]);

        $this->broadcastNotification($notification);
    }

    /**
     * Notify the requester when a review is resolved.
     */
    public function notifyReviewResolved(int $requesterId, int $reviewerId, string $reviewerName, string $status, int $channelId, int $messageId): void
    {
        if ($requesterId === $reviewerId) {
            return;
        }

        $statusLabel = $status === 'approved' ? 'approved' : 'requested changes on';

        $notification = Notification::create([
            'user_id' => $requesterId,
            'type' => 'review_resolved',
            'title' => "{$reviewerName} {$statusLabel} your review",
            'channel_id' => $channelId,
            'message_id' => $messageId,
            'actor_id' => $reviewerId,
        ]);

        $this->broadcastNotification($notification);
    }
}
