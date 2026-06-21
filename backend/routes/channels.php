<?php

use App\Models\App\PublicationDraft;
use App\Models\App\Study;
use App\Models\App\StudyDesignSession;
use App\Models\Commons\ChannelMember;
use App\Policies\PublicationDraftPolicy;
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

Broadcast::channel('publish.draft.{draft}', function ($user, int $draft) {
    $d = PublicationDraft::find($draft);

    return $d !== null && (new PublicationDraftPolicy)->view($user, $d);
});

// Abby orchestrator / agent progress stream for a study (ADR-0020 Phase 5).
// Both the deterministic orchestrator (StudyOrchestratorController) and the
// conversational agent (AbbyAgentController) publish to private-abby.study.{study}.
Broadcast::channel('abby.study.{study}', function ($user, int $study) {
    return Study::accessibleBy($user->id)->whereKey($study)->exists();
});
