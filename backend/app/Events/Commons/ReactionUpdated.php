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
