<?php

namespace App\Services\Commons;

use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\Commons\Notification;

class NotificationService
{
    /**
     * Create notifications for @mentions in a message body.
     * Parses @Name patterns and notifies matching channel members.
     */
    public function notifyMentions(Message $message, int $channelId): void
    {
        // Find @mentions in the body (matches @FirstName LastName or @FirstName)
        if (! preg_match_all('/@([\w]+ ?[\w]*)/', $message->body, $matches)) {
            return;
        }

        $mentionedNames = array_unique($matches[1]);

        $members = ChannelMember::where('channel_id', $channelId)
            ->with('user:id,name')
            ->get();

        foreach ($members as $member) {
            if ($member->user_id === $message->user_id) {
                continue; // Don't notify yourself
            }

            foreach ($mentionedNames as $name) {
                if (stripos($member->user->name, trim($name)) === 0) {
                    Notification::create([
                        'user_id' => $member->user_id,
                        'type' => 'mention',
                        'title' => "{$message->user->name} mentioned you",
                        'body' => mb_substr($message->body, 0, 200),
                        'channel_id' => $channelId,
                        'message_id' => $message->id,
                        'actor_id' => $message->user_id,
                    ]);
                    break; // Only one notification per user
                }
            }
        }
    }

    /**
     * Notify the other user in a DM channel when a message is sent.
     */
    public function notifyDirectMessage(Message $message, int $channelId): void
    {
        $members = ChannelMember::where('channel_id', $channelId)
            ->where('user_id', '!=', $message->user_id)
            ->pluck('user_id');

        foreach ($members as $userId) {
            Notification::create([
                'user_id' => $userId,
                'type' => 'dm',
                'title' => "New message from {$message->user->name}",
                'body' => mb_substr($message->body, 0, 200),
                'channel_id' => $channelId,
                'message_id' => $message->id,
                'actor_id' => $message->user_id,
            ]);
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

        // Get the parent message author
        $parent = Message::find($reply->parent_id);
        if (! $parent || $parent->user_id === $reply->user_id) {
            return;
        }

        Notification::create([
            'user_id' => $parent->user_id,
            'type' => 'thread_reply',
            'title' => "{$reply->user->name} replied to your message",
            'body' => mb_substr($reply->body, 0, 200),
            'channel_id' => $channelId,
            'message_id' => $reply->id,
            'actor_id' => $reply->user_id,
        ]);
    }

    /**
     * Notify the message author when a review is requested.
     */
    public function notifyReviewRequested(int $userId, int $requestedBy, string $requesterName, int $channelId, int $messageId): void
    {
        if ($userId === $requestedBy) {
            return;
        }

        Notification::create([
            'user_id' => $userId,
            'type' => 'review_assigned',
            'title' => "{$requesterName} requested your review",
            'channel_id' => $channelId,
            'message_id' => $messageId,
            'actor_id' => $requestedBy,
        ]);
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

        Notification::create([
            'user_id' => $requesterId,
            'type' => 'review_resolved',
            'title' => "{$reviewerName} {$statusLabel} your review",
            'channel_id' => $channelId,
            'message_id' => $messageId,
            'actor_id' => $reviewerId,
        ]);
    }
}
