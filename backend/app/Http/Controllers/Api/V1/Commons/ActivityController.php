<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Activity;
use App\Models\Commons\Channel;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $query = Activity::where('channel_id', $channel->id)
            ->with('user:id,name')
            ->orderByDesc('created_at');

        if ($request->filled('type')) {
            $query->where('event_type', $request->input('type'));
        }

        $activities = $query->limit(50)->get();

        return response()->json(['data' => $activities]);
    }

    public function global(Request $request): JsonResponse
    {
        $query = Activity::with(['user:id,name', 'channel:id,slug,name'])
            ->orderByDesc('created_at');

        if ($request->filled('type')) {
            $query->where('event_type', $request->input('type'));
        }

        $activities = $query->limit(50)->get();

        return response()->json(['data' => $activities]);
    }
}
