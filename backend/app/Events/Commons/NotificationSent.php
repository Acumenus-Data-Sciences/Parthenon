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
        return [new PrivateChannel('App.Models.User.'.$this->notification->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'NotificationSent';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->notification->id,
            'type' => $this->notification->type,
            'title' => $this->notification->title,
            'body' => $this->notification->body,
            'channel_id' => $this->notification->channel_id,
            'message_id' => $this->notification->message_id,
            'actor' => $this->notification->actor
                ? ['id' => $this->notification->actor->id, 'name' => $this->notification->actor->name]
                : null,
            'channel' => $this->notification->channel
                ? ['slug' => $this->notification->channel->slug]
                : null,
            'created_at' => $this->notification->created_at,
        ];
    }
}
