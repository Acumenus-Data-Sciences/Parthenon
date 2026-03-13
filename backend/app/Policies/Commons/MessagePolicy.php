<?php

namespace App\Policies\Commons;

use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\User;

class MessagePolicy
{
    public function update(User $user, Message $message): bool
    {
        return $message->user_id === $user->id && ! $message->isDeleted();
    }

    public function delete(User $user, Message $message): bool
    {
        if ($message->isDeleted()) {
            return false;
        }

        // Author can delete their own messages
        if ($message->user_id === $user->id) {
            return true;
        }

        // Channel admin/owner can delete any message
        $member = ChannelMember::where('channel_id', $message->channel_id)
            ->where('user_id', $user->id)
            ->first();

        return $member !== null && $member->isAdmin();
    }
}
