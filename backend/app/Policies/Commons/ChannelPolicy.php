<?php

namespace App\Policies\Commons;

use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;

class ChannelPolicy
{
    public function view(User $user, Channel $channel): bool
    {
        if ($channel->isPublic()) {
            return true;
        }

        return $this->isMember($user, $channel);
    }

    public function update(User $user, Channel $channel): bool
    {
        $member = $this->getMember($user, $channel);

        return $member !== null && $member->isAdmin();
    }

    public function archive(User $user, Channel $channel): bool
    {
        $member = $this->getMember($user, $channel);

        return $member !== null && $member->isOwner();
    }

    public function sendMessage(User $user, Channel $channel): bool
    {
        if ($channel->isPublic()) {
            return true;
        }

        return $this->isMember($user, $channel);
    }

    private function isMember(User $user, Channel $channel): bool
    {
        return ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    private function getMember(User $user, Channel $channel): ?ChannelMember
    {
        return ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->first();
    }
}
