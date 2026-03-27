<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\CreateChannelRequest;
use App\Http\Requests\Commons\UpdateChannelRequest;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class ChannelController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $channels = Channel::whereNull('archived_at')
            ->where('type', '!=', 'dm')
            ->where(function ($query) use ($user) {
                $query->where('visibility', 'public')
                    ->orWhereHas('members', fn ($q) => $q->where('user_id', $user->id));
            })
            ->withCount('members')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $channels]);
    }

    public function store(CreateChannelRequest $request): JsonResponse
    {
        $channel = Channel::create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        // Creator becomes owner
        ChannelMember::create([
            'channel_id' => $channel->id,
            'user_id' => $request->user()->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);

        $channel->loadCount('members');

        return response()->json(['data' => $channel], 201);
    }

    public function show(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)
            ->withCount('members')
            ->firstOrFail();

        $this->authorize('view', $channel);

        return response()->json(['data' => $channel]);
    }

    public function update(UpdateChannelRequest $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('update', $channel);

        $channel->update($request->validated());

        return response()->json(['data' => $channel]);
    }

    public function archive(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('archive', $channel);

        $channel->update(['archived_at' => now()]);

        return response()->json(['data' => $channel]);
    }
}
