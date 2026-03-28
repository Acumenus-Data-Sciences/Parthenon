<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Call;
use App\Models\Commons\Channel;
use App\Services\Commons\CallService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CallController extends Controller
{
    public function show(string $slug, CallService $callService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        return response()->json([
            'data' => $this->serializeCall($callService->getActiveCall($channel)),
        ]);
    }

    public function start(Request $request, string $slug, CallService $callService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $validated = $request->validate([
            'call_type' => 'sometimes|string|in:audio,video',
        ]);

        $call = $callService->start(
            $channel,
            $request->user(),
            $validated['call_type'] ?? 'video',
        );

        return response()->json(['data' => $this->serializeCall($call)], 201);
    }

    public function token(Request $request, string $slug, CallService $callService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $call = $callService->getActiveCall($channel);
        abort_if(! $call, 404, 'No active call for this channel');

        try {
            $token = $callService->issueToken($call, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 503);
        }

        return response()->json([
            'data' => [
                'call' => $this->serializeCall($call),
                ...$token,
            ],
        ]);
    }

    public function end(Request $request, string $slug, CallService $callService): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $call = $callService->getActiveCall($channel);
        abort_if(! $call, 404, 'No active call for this channel');

        $call = $callService->end($call, $request->user());

        return response()->json(['data' => $this->serializeCall($call)]);
    }

    /** @return array<string, mixed>|null */
    private function serializeCall(?Call $call): ?array
    {
        if (! $call) {
            return null;
        }

        $call->loadMissing('starter:id,name', 'ender:id,name');

        return [
            'id' => $call->id,
            'channel_id' => $call->channel_id,
            'room_name' => $call->room_name,
            'call_type' => $call->call_type,
            'status' => $call->status,
            'started_at' => optional($call->started_at)?->toISOString(),
            'ended_at' => optional($call->ended_at)?->toISOString(),
            'started_by_user' => $call->starter
                ? ['id' => $call->starter->id, 'name' => $call->starter->name]
                : null,
            'ended_by_user' => $call->ender
                ? ['id' => $call->ender->id, 'name' => $call->ender->name]
                : null,
        ];
    }
}
