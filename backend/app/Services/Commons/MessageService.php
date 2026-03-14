<?php

namespace App\Services\Commons;

use App\Events\Commons\MessageSent;
use App\Events\Commons\MessageUpdated;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\DisallowedRawHtml\DisallowedRawHtmlExtension;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\MarkdownConverter;

class MessageService
{
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

    public function renderMarkdown(string $body): string
    {
        return $this->converter->convert($body)->getContent();
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

        // Invalidate unread caches for all channel members (except the sender)
        $memberUserIds = ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', '!=', $userId)
            ->pluck('user_id');

        foreach ($memberUserIds as $memberId) {
            $this->unreadService->invalidateCacheForUserId($memberId);
        }

        return $message;
    }

    public function updateMessage(Message $message, string $body): Message
    {
        $message->update([
            'body' => $body,
            'body_html' => $this->renderMarkdown($body),
            'is_edited' => true,
            'edited_at' => now(),
        ]);

        broadcast(new MessageUpdated($message, 'edited'))->toOthers();

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
