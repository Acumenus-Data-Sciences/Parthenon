<?php

namespace App\Events\Commons;

use App\Models\Commons\Call;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $channelId,
        public ?Call $call,
        public string $action,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->channelId}")];
    }

    public function broadcastAs(): string
    {
        return 'CallUpdated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'call' => $this->call ? [
                'id' => $this->call->id,
                'channel_id' => $this->call->channel_id,
                'room_name' => $this->call->room_name,
                'call_type' => $this->call->call_type,
                'status' => $this->call->status,
                'started_at' => optional($this->call->started_at)?->toISOString(),
                'ended_at' => optional($this->call->ended_at)?->toISOString(),
                'started_by_user' => $this->call->relationLoaded('starter') && $this->call->starter
                    ? [
                        'id' => $this->call->starter->id,
                        'name' => $this->call->starter->name,
                    ]
                    : null,
            ] : null,
        ];
    }
}
