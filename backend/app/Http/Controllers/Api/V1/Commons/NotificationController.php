<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->with(['actor:id,name', 'channel:id,slug,name'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $notifications]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'nullable|array',
            'ids.*' => 'integer',
        ]);

        $query = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at');

        if ($request->has('ids')) {
            $query->whereIn('id', $request->input('ids'));
        }

        $query->update(['read_at' => now()]);

        return response()->json(['data' => null]);
    }
}
