<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Announcement;
use App\Models\Commons\Channel;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class AnnouncementController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $query = Announcement::with('user:id,name,avatar')
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at');

        if ($request->filled('channel')) {
            $channel = Channel::where('slug', $request->input('channel'))->first();
            if ($channel) {
                $query->where(function ($q) use ($channel) {
                    $q->where('channel_id', $channel->id)->orWhereNull('channel_id');
                });
            }
        } else {
            $query->whereNull('channel_id');
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        // Exclude expired announcements
        $query->where(function ($q) {
            $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
        });

        $announcements = $query->limit(50)->get();

        // Attach bookmark status for current user
        $userId = $request->user()->id;
        $bookmarkedIds = \DB::table('commons_announcement_bookmarks')
            ->where('user_id', $userId)
            ->whereIn('announcement_id', $announcements->pluck('id'))
            ->pluck('announcement_id')
            ->toArray();

        $announcements->each(function ($a) use ($bookmarkedIds) {
            $a->setAttribute('is_bookmarked', in_array($a->id, $bookmarkedIds));
        });

        return response()->json(['data' => $announcements]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:10000',
            'category' => 'nullable|string|in:general,study_recruitment,data_update,milestone,policy',
            'channel_slug' => 'nullable|string',
            'is_pinned' => 'nullable|boolean',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $channelId = null;
        if (! empty($validated['channel_slug'])) {
            $channel = Channel::where('slug', $validated['channel_slug'])->firstOrFail();
            $this->authorize('sendMessage', $channel);
            $channelId = $channel->id;
        }

        $announcement = Announcement::create([
            'channel_id' => $channelId,
            'user_id' => $request->user()->id,
            'title' => $validated['title'],
            'body' => $validated['body'],
            'category' => $validated['category'] ?? 'general',
            'is_pinned' => $validated['is_pinned'] ?? false,
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        $announcement->load('user:id,name,avatar');

        return response()->json(['data' => $announcement], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $announcement = Announcement::findOrFail($id);

        if ($announcement->user_id !== $request->user()->id) {
            abort(403, 'You can only edit your own announcements.');
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'body' => 'sometimes|string|max:10000',
            'category' => 'sometimes|string|in:general,study_recruitment,data_update,milestone,policy',
            'is_pinned' => 'sometimes|boolean',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $announcement->update($validated);
        $announcement->load('user:id,name,avatar');

        return response()->json(['data' => $announcement]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $announcement = Announcement::findOrFail($id);

        if ($announcement->user_id !== $request->user()->id) {
            abort(403, 'You can only delete your own announcements.');
        }

        $announcement->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function bookmark(Request $request, int $id): JsonResponse
    {
        $announcement = Announcement::findOrFail($id);
        $userId = $request->user()->id;

        $exists = \DB::table('commons_announcement_bookmarks')
            ->where('announcement_id', $id)
            ->where('user_id', $userId)
            ->exists();

        if ($exists) {
            \DB::table('commons_announcement_bookmarks')
                ->where('announcement_id', $id)
                ->where('user_id', $userId)
                ->delete();

            return response()->json(['data' => ['bookmarked' => false]]);
        }

        \DB::table('commons_announcement_bookmarks')->insert([
            'announcement_id' => $id,
            'user_id' => $userId,
            'created_at' => now(),
        ]);

        return response()->json(['data' => ['bookmarked' => true]]);
    }
}
