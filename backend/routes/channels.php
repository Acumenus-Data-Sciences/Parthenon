<?php

use App\Models\App\Study;
use App\Models\App\StudyDesignSession;
use App\Models\Commons\ChannelMember;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('commons.online', function ($user) {
    $request = request();
    $sessionId = ($request->hasSession() ? $request->session()->getId() : null)
        ?? $request->header('X-Socket-Id')
        ?? (string) Str::uuid();

    return [
        'id' => $user->id,
        'name' => $user->name,
        'session_id' => $sessionId,
    ];
});

Broadcast::channel('commons.channel.{channelId}', function ($user, int $channelId) {
    return ChannelMember::where('channel_id', $channelId)
        ->where('user_id', $user->id)
        ->exists();
});

Broadcast::channel('study-design.session.{session}', function ($user, int $session) {
    $design = StudyDesignSession::find($session);
    if ($design === null) {
        return false;
    }

    return Study::accessibleBy($user->id)->whereKey($design->study_id)->exists();
});
