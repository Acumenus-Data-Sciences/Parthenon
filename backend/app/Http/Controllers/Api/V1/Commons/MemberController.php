<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Services\Commons\UnreadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    use AuthorizesRequests;
    public function index(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $members = ChannelMember::where('channel_id', $channel->id)
            ->with('user:id,name,email')
            ->orderBy('joined_at')
            ->get();

        return response()->json(['data' => $members]);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();

        if ($channel->isPublic()) {
            // Public channels: self-join only
            $userId = $request->user()->id;
        } else {
            // Private channels: admin can invite others
            $this->authorize('update', $channel);
            $request->validate(['user_id' => 'sometimes|integer|exists:users,id']);
            $userId = $request->input('user_id', $request->user()->id);
        }

        $member = ChannelMember::firstOrCreate(
            ['channel_id' => $channel->id, 'user_id' => $userId],
            ['role' => 'member', 'joined_at' => now()],
        );

        $member->load('user:id,name,email');

        return response()->json(['data' => $member], 201);
    }

    public function destroy(Request $request, string $slug, int $memberId): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $member = ChannelMember::where('channel_id', $channel->id)
            ->findOrFail($memberId);

        // Can remove self, or admin can remove others
        $isSelf = $member->user_id === $request->user()->id;
        if (! $isSelf) {
            $this->authorize('update', $channel);
        }

        $member->delete();

        return response()->json(null, 204);
    }

    public function markRead(Request $request, string $slug, UnreadService $unreadService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();

        ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);

        $unreadService->invalidateCache($request->user());

        return response()->json(['status' => 'ok']);
    }

    public function unreadCounts(Request $request, UnreadService $unreadService): JsonResponse
    {
        $counts = $unreadService->getUnreadCounts($request->user());

        return response()->json(['data' => $counts]);
    }
}
