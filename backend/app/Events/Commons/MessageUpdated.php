<?php

namespace App\Events\Commons;

use App\Models\Commons\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message,
        public string $action,
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
            'message' => [
                'id' => $this->message->id,
                'body' => $this->message->body,
                'body_html' => $this->message->body_html,
                'is_edited' => $this->message->is_edited,
                'deleted_at' => $this->message->deleted_at?->toISOString(),
            ],
            'action' => $this->action,
        ];
    }
}
