<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Models\Commons\ReviewRequest;
use App\Services\Commons\NotificationService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class ReviewRequestController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private NotificationService $notificationService,
    ) {}

    public function index(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $reviews = ReviewRequest::where('channel_id', $channel->id)
            ->with(['message:id,body,user_id,created_at', 'message.user:id,name', 'requester:id,name', 'reviewer:id,name'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $reviews]);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('sendMessage', $channel);

        $request->validate([
            'message_id' => 'required|integer|exists:commons_messages,id',
            'reviewer_id' => 'nullable|integer|exists:users,id',
        ]);

        $message = Message::where('id', $request->input('message_id'))
            ->where('channel_id', $channel->id)
            ->firstOrFail();

        // Prevent duplicate pending reviews on the same message
        $existing = ReviewRequest::where('message_id', $message->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            return response()->json(['data' => $existing], 200);
        }

        $review = ReviewRequest::create([
            'message_id' => $message->id,
            'channel_id' => $channel->id,
            'requested_by' => $request->user()->id,
            'reviewer_id' => $request->input('reviewer_id'),
            'status' => 'pending',
        ]);

        $review->load(['requester:id,name', 'reviewer:id,name']);

        // Notify the assigned reviewer (or message author if no specific reviewer)
        $notifyUserId = $request->input('reviewer_id') ?? $message->user_id;
        $this->notificationService->notifyReviewRequested(
            (int) $notifyUserId,
            $request->user()->id,
            $request->user()->name,
            $channel->id,
            $message->id,
        );

        return response()->json(['data' => $review], 201);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $review = ReviewRequest::findOrFail($id);

        $request->validate([
            'status' => 'required|in:approved,changes_requested',
            'comment' => 'nullable|string|max:1000',
        ]);

        $review->update([
            'reviewer_id' => $request->user()->id,
            'status' => $request->input('status'),
            'comment' => $request->input('comment'),
            'resolved_at' => now(),
        ]);

        $review->load(['requester:id,name', 'reviewer:id,name']);

        // Notify the requester
        $this->notificationService->notifyReviewResolved(
            (int) $review->requested_by,
            $request->user()->id,
            $request->user()->name,
            $request->input('status'),
            (int) $review->channel_id,
            (int) $review->message_id,
        );

        return response()->json(['data' => $review]);
    }
}
