<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\AbbyConversation;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('AI Assistant (Abby)', weight: 211)]
class AbbyConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $conversations = AbbyConversation::forUser($request->user()->id)
                ->withCount('messages')
                ->orderByDesc('updated_at')
                ->paginate($request->integer('per_page', 20));

            return response()->json($conversations);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to list conversations', $e);
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $conversation = AbbyConversation::forUser($request->user()->id)
                ->with('messages')
                ->findOrFail($id);

            return response()->json(['data' => $conversation]);
        } catch (ModelNotFoundException) {
            return response()->json(['error' => 'Conversation not found'], 404);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to load conversation', $e);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|nullable|string|max:500',
            'page_context' => 'sometimes|string|max:64',
        ]);

        try {
            $conversation = AbbyConversation::create([
                'user_id' => $request->user()->id,
                'title' => $validated['title'] ?? null,
                'page_context' => $validated['page_context'] ?? 'general',
            ]);

            return response()->json(['data' => $conversation], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create conversation', $e);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $conversation = AbbyConversation::forUser($request->user()->id)
                ->findOrFail($id);

            $conversation->delete();

            return response()->json(['message' => 'Conversation deleted']);
        } catch (ModelNotFoundException) {
            return response()->json(['error' => 'Conversation not found'], 404);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete conversation', $e);
        }
    }

    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
