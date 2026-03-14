<?php

namespace App\Services\Commons;

use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class UnreadService
{
    private const CACHE_TTL = 60; // seconds

    /**
     * Get unread message counts for all channels the user is a member of.
     * Returns [slug => count].
     *
     * @return array<string, int>
     */
    public function getUnreadCounts(User $user): array
    {
        $cacheKey = "commons:unread:{$user->id}";

        return Cache::store('redis')->remember($cacheKey, self::CACHE_TTL, function () use ($user) {
            return $this->computeUnreadCounts($user);
        });
    }

    /**
     * Invalidate the cached unread counts for a user.
     */
    public function invalidateCache(User $user): void
    {
        Cache::store('redis')->forget("commons:unread:{$user->id}");
    }

    /**
     * Invalidate cache by user ID directly (avoids loading User model).
     */
    public function invalidateCacheForUserId(int $userId): void
    {
        Cache::store('redis')->forget("commons:unread:{$userId}");
    }

    /**
     * Compute unread counts from DB.
     *
     * @return array<string, int>
     */
    private function computeUnreadCounts(User $user): array
    {
        $memberships = ChannelMember::where('user_id', $user->id)
            ->with('channel:id,slug')
            ->get();

        $counts = [];
        foreach ($memberships as $membership) {
            $channel = $membership->channel;
            if (! $channel) {
                continue;
            }

            $query = Message::where('channel_id', $channel->id)
                ->whereNull('parent_id')
                ->whereNull('deleted_at');

            if ($membership->last_read_at !== null) {
                $query->where('created_at', '>', $membership->last_read_at);
            }

            $counts[$channel->slug] = $query->count();
        }

        return $counts;
    }
}
