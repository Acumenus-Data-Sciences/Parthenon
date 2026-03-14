<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\ToggleReactionRequest;
use App\Models\Commons\Message;
use App\Services\Commons\ReactionService;
use Illuminate\Http\JsonResponse;

class ReactionController extends Controller
{
    public function __construct(private ReactionService $reactionService) {}

    public function toggle(ToggleReactionRequest $request, int $id): JsonResponse
    {
        $message = Message::findOrFail($id);

        if ($message->isDeleted()) {
            return response()->json(['message' => 'Cannot react to a deleted message.'], 422);
        }

        $summary = $this->reactionService->toggleReaction(
            $message,
            $request->user(),
            $request->validated('emoji'),
        );

        return response()->json(['data' => $summary]);
    }
}
