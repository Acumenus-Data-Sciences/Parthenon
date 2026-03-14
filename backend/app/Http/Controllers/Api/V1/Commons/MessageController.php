<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\SendMessageRequest;
use App\Http\Requests\Commons\UpdateMessageRequest;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Models\Commons\ObjectReference;
use App\Services\Commons\MessageService;
use App\Services\Commons\NotificationService;
use App\Services\Commons\ReactionService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private MessageService $messageService,
        private ReactionService $reactionService,
        private NotificationService $notificationService,
    ) {}

    public function index(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $query = Message::where('channel_id', $channel->id)
            ->whereNull('deleted_at')
            ->whereNull('parent_id')
            ->with(['user:id,name', 'objectReferences', 'attachments'])
            ->withCount('replies')
            ->withMax('replies', 'created_at')
            ->orderByDesc('id');

        if ($request->has('before')) {
            $query->where('id', '<', (int) $request->input('before'));
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $messages = $query->limit($limit)->get();

        // Rename the withMax column for cleaner JSON
        // Must use setAttribute() so it goes into the attributes array and appears in JSON
        $messages->each(function ($msg) {
            $msg->setAttribute('latest_reply_at', $msg->getAttribute('replies_max_created_at'));
            unset($msg->replies_max_created_at);
        });

        // Attach reaction summaries
        $reactionSummaries = $this->reactionService->getReactionSummaryForMessages(
            $messages,
            $request->user(),
        );
        $messages->each(function ($msg) use ($reactionSummaries) {
            $msg->setAttribute('reactions', $reactionSummaries[$msg->id] ?? (object) []);
        });

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

        // Save object references if provided
        $refs = $request->input('references', []);
        if (is_array($refs)) {
            foreach ($refs as $ref) {
                if (isset($ref['type'], $ref['id'], $ref['name'])) {
                    ObjectReference::create([
                        'message_id' => $message->id,
                        'referenceable_type' => $ref['type'],
                        'referenceable_id' => (int) $ref['id'],
                        'display_name' => $ref['name'],
                    ]);
                }
            }
            $message->load('objectReferences');
        }

        // Fire notifications
        $message->load('user:id,name');
        if ($channel->type === 'dm') {
            $this->notificationService->notifyDirectMessage($message, $channel->id);
        } else {
            $this->notificationService->notifyMentions($message, $channel->id);
        }
        if ($message->parent_id) {
            $this->notificationService->notifyThreadReply($message, $channel->id);
        }

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

    public function replies(Request $request, string $slug, int $messageId): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $parent = Message::where('id', $messageId)
            ->where('channel_id', $channel->id)
            ->firstOrFail();

        // Fetch depth-1 children and depth-2 grandchildren (max depth = 2)
        // Note: soft-deleted replies are included — they render as "[message deleted]"
        $childIds = Message::where('parent_id', $parent->id)
            ->pluck('id');

        $replies = Message::where('channel_id', $channel->id)
            ->where(function ($q) use ($parent, $childIds) {
                $q->where('parent_id', $parent->id)
                    ->orWhereIn('parent_id', $childIds);
            })
            ->with('user:id,name')
            ->orderBy('created_at', 'asc')
            ->get();

        // Attach reaction summaries to replies
        $reactionSummaries = $this->reactionService->getReactionSummaryForMessages(
            $replies,
            $request->user(),
        );
        $replies->each(function ($msg) use ($reactionSummaries) {
            $msg->setAttribute('reactions', $reactionSummaries[$msg->id] ?? (object) []);
        });

        return response()->json(['data' => $replies]);
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:200',
            'channel' => 'nullable|string',
        ]);

        $query = Message::whereNull('deleted_at')
            ->whereNull('parent_id')
            ->whereRaw("to_tsvector('english', body) @@ plainto_tsquery('english', ?)", [$request->input('q')])
            ->with(['user:id,name', 'channel:id,slug,name'])
            ->orderByDesc('created_at')
            ->limit(50);

        if ($request->filled('channel')) {
            $channel = Channel::where('slug', $request->input('channel'))->first();
            if ($channel) {
                $query->where('channel_id', $channel->id);
            }
        }

        $messages = $query->get();

        return response()->json(['data' => $messages]);
    }
}
