<?php

use App\Models\Commons\ChannelMember;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('commons.online', function ($user) {
    return ['id' => $user->id, 'name' => $user->name];
});

Broadcast::channel('commons.channel.{channelId}', function ($user, int $channelId) {
    return ChannelMember::where('channel_id', $channelId)
        ->where('user_id', $user->id)
        ->exists();
});
