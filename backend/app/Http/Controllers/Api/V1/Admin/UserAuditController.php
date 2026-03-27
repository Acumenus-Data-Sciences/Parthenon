<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\UserAuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Administration
 */
class UserAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = UserAuditLog::query()
            ->with('user:id,name,email')
            ->when($request->user_id, fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->action, fn ($q) => $q->where('action', $request->string('action')->toString()))
            ->when($request->feature, fn ($q) => $q->where('feature', $request->string('feature')->toString()))
            ->when($request->date_from, fn ($q) => $q->where('occurred_at', '>=', $request->string('date_from')->toString()))
            ->when($request->date_to, fn ($q) => $q->where('occurred_at', '<=', $request->string('date_to')->toString().' 23:59:59'))
            ->orderByDesc('occurred_at');

        $perPage = $request->integer('per_page', 50);
        $logs = $query->paginate($perPage);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (UserAuditLog $log) => $this->formatLog($log))->values(),
            'meta' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    public function forUser(Request $request, User $user): JsonResponse
    {
        $logs = UserAuditLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('occurred_at')
            ->paginate($request->integer('per_page', 25));

        return response()->json([
            'data' => $logs->getCollection()->map(fn (UserAuditLog $log) => $this->formatLog($log))->values(),
            'meta' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    /** Summary stats for the audit dashboard: unique active users, top features, logins today */
    public function summary(): JsonResponse
    {
        $today = now()->startOfDay();
        $week = now()->subDays(7);

        $loginsToday = UserAuditLog::where('action', 'login')
            ->where('occurred_at', '>=', $today)
            ->count();

        $activeUsersWeek = UserAuditLog::where('occurred_at', '>=', $week)
            ->distinct('user_id')
            ->count('user_id');

        $topFeatures = UserAuditLog::where('action', 'api_access')
            ->where('occurred_at', '>=', $week)
            ->whereNotNull('feature')
            ->selectRaw('feature, COUNT(*) as access_count')
            ->groupBy('feature')
            ->orderByDesc('access_count')
            ->limit(10)
            ->get()
            ->map(fn ($row) => ['feature' => $row->feature, 'count' => $row->access_count]);

        $recentLogins = UserAuditLog::with('user:id,name,email')
            ->where('action', 'login')
            ->orderByDesc('occurred_at')
            ->limit(10)
            ->get()
            ->map(fn (UserAuditLog $log) => $this->formatLog($log));

        return response()->json([
            'logins_today' => $loginsToday,
            'active_users_week' => $activeUsersWeek,
            'top_features' => $topFeatures,
            'recent_logins' => $recentLogins,
        ]);
    }

    private function formatLog(UserAuditLog $log): array
    {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user?->name,
            'user_email' => $log->user?->email,
            'action' => $log->action,
            'feature' => $log->feature,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'metadata' => $log->metadata,
            'occurred_at' => $log->occurred_at?->toIso8601String(),
        ];
    }
}
