<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Models\Commons\PinnedMessage;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class PinController extends Controller
{
    use AuthorizesRequests;

    public function index(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $pins = PinnedMessage::where('channel_id', $channel->id)
            ->with(['message.user:id,name', 'pinner:id,name'])
            ->orderByDesc('pinned_at')
            ->get()
            ->map(function (PinnedMessage $pin) {
                return [
                    'id' => $pin->id,
                    'message' => [
                        'id' => $pin->message->id,
                        'body' => $pin->message->body,
                        'user' => $pin->message->user,
                        'created_at' => $pin->message->created_at,
                    ],
                    'pinned_by' => $pin->pinner,
                    'pinned_at' => $pin->pinned_at,
                ];
            });

        return response()->json(['data' => $pins]);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $request->validate([
            'message_id' => 'required|integer|exists:commons_messages,id',
        ]);

        $message = Message::where('id', $request->input('message_id'))
            ->where('channel_id', $channel->id)
            ->whereNull('deleted_at')
            ->firstOrFail();

        $pin = PinnedMessage::firstOrCreate(
            ['channel_id' => $channel->id, 'message_id' => $message->id],
            ['pinned_by' => $request->user()->id],
        );

        $pin->load(['message.user:id,name', 'pinner:id,name']);

        return response()->json([
            'data' => [
                'id' => $pin->id,
                'message' => [
                    'id' => $pin->message->id,
                    'body' => $pin->message->body,
                    'user' => $pin->message->user,
                    'created_at' => $pin->message->created_at,
                ],
                'pinned_by' => $pin->pinner,
                'pinned_at' => $pin->pinned_at,
            ],
        ], 201);
    }

    public function destroy(Request $request, string $slug, int $pinId): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $pin = PinnedMessage::where('id', $pinId)
            ->where('channel_id', $channel->id)
            ->firstOrFail();

        $pin->delete();

        return response()->json(['data' => null], 200);
    }
}
