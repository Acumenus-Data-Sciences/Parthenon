<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class DirectMessageController extends Controller
{
    /**
     * Search users to start a DM conversation.
     */
    public function searchUsers(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:100',
        ]);

        $user = $request->user();
        $q = $request->input('q');

        $users = User::query()
            ->where('id', '!=', $user->id)
            ->where(function ($query) use ($q) {
                $query->where('name', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%");
            })
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name', 'email'])
            ->map(fn (User $match) => [
                'id' => $match->id,
                'name' => $match->name,
                'email' => $match->email,
            ]);

        return response()->json(['data' => $users]);
    }

    /**
     * List all DM conversations for the current user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $channels = Channel::where('type', 'dm')
            ->whereHas('members', fn ($q) => $q->where('user_id', $user->id))
            ->with(['members.user:id,name,email'])
            ->withCount('members')
            ->withMax('messages', 'created_at')
            ->orderByDesc('messages_max_created_at')
            ->get()
            ->map(function (Channel $channel) use ($user) {
                $otherMember = $channel->members->first(
                    fn (ChannelMember $m) => $m->user_id !== $user->id
                );

                return [
                    'id' => $channel->id,
                    'slug' => $channel->slug,
                    'other_user' => $otherMember?->user
                        ? ['id' => $otherMember->user->id, 'name' => $otherMember->user->name]
                        : null,
                    'last_message_at' => $channel->messages_max_created_at,
                    'members_count' => $channel->members_count,
                ];
            });

        return response()->json(['data' => $channels]);
    }

    /**
     * Find or create a DM channel with another user.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $currentUser = $request->user();
        $targetUserId = (int) $request->input('user_id');

        if ($targetUserId === $currentUser->id) {
            return response()->json(['message' => 'Cannot DM yourself'], 422);
        }

        $targetUser = User::findOrFail($targetUserId);

        // Deterministic slug: dm_{lower_id}_{higher_id}
        $ids = [$currentUser->id, $targetUserId];
        sort($ids);
        $slug = "dm_{$ids[0]}_{$ids[1]}";

        // Find existing DM channel
        $channel = Channel::where('slug', $slug)->first();

        if (! $channel) {
            $channel = Channel::create([
                'name' => "DM: {$currentUser->name} & {$targetUser->name}",
                'slug' => $slug,
                'type' => 'dm',
                'visibility' => 'private',
                'created_by' => $currentUser->id,
            ]);

            // Add both users as members
            ChannelMember::create([
                'channel_id' => $channel->id,
                'user_id' => $currentUser->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);

            ChannelMember::create([
                'channel_id' => $channel->id,
                'user_id' => $targetUserId,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        $channel->loadCount('members');

        return response()->json(['data' => $channel], 201);
    }
}
