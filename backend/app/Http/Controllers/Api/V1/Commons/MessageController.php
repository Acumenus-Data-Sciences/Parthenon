<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\SendMessageRequest;
use App\Http\Requests\Commons\UpdateMessageRequest;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Services\Commons\MessageService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private MessageService $messageService) {}

    public function index(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $query = Message::where('channel_id', $channel->id)
            ->whereNull('deleted_at')
            ->whereNull('parent_id')
            ->with('user:id,name')
            ->orderByDesc('id');

        if ($request->has('before')) {
            $query->where('id', '<', (int) $request->input('before'));
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $messages = $query->limit($limit)->get();

        return response()->json(['data' => $messages]);
    }

    public function store(SendMessageRequest $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('sendMessage', $channel);

        $message = $this->messageService->createMessage(
            $channel,
            $request->user()->id,
            $request->validated('body'),
            $request->validated('parent_id'),
        );

        return response()->json(['data' => $message], 201);
    }

    public function update(UpdateMessageRequest $request, int $id): JsonResponse
    {
        $message = Message::findOrFail($id);
        $this->authorize('update', $message);

        $message = $this->messageService->updateMessage(
            $message,
            $request->validated('body'),
        );

        return response()->json(['data' => $message]);
    }

    public function destroy(int $id): JsonResponse
    {
        $message = Message::findOrFail($id);
        $this->authorize('delete', $message);

        $this->messageService->deleteMessage($message);

        return response()->json(['data' => $message]);
    }
}
