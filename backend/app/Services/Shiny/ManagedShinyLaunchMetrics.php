<?php

declare(strict_types=1);

namespace App\Services\Shiny;

use App\Models\App\ManagedShinyLaunch;
use Illuminate\Support\Carbon;

class ManagedShinyLaunchMetrics
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $now = now();
        $lastDay = $now->copy()->subDay();
        $statusCounts = $this->statusCounts();

        return [
            'runtime' => (string) config('services.shiny_proxy.runtime', 'shinyproxy'),
            'base_url_configured' => trim((string) config('services.shiny_proxy.base_url', '')) !== '',
            'workspace_root' => (string) (config('services.shiny_proxy.workspace_root') ?: storage_path('app/managed-shiny')),
            'launch_ttl_minutes' => max(1, (int) config('services.shiny_proxy.launch_ttl_minutes', 15)),
            'launch_context_rate_limit_per_minute' => max(1, (int) config('services.shiny_proxy.launch_context_rate_limit_per_minute', 60)),
            'total_launches' => ManagedShinyLaunch::query()->count(),
            'by_status' => $statusCounts,
            'issued_last_24h' => $this->countSince('created_at', $lastDay),
            'resolved_last_24h' => $this->countSince('resolved_at', $lastDay),
            'failed_last_24h' => $this->countSince('failed_at', $lastDay),
            'active_sessions' => ManagedShinyLaunch::query()
                ->where('status', 'resolved')
                ->where('expires_at', '>', $now)
                ->count(),
            'pending_launches' => ManagedShinyLaunch::query()
                ->where('status', 'issued')
                ->where('expires_at', '>', $now)
                ->count(),
            'expired_unresolved' => ManagedShinyLaunch::query()
                ->where('status', '!=', 'resolved')
                ->where('expires_at', '<=', $now)
                ->count(),
            'average_resolution_seconds' => $this->averageResolutionSeconds(),
            'last_issued_at' => $this->timestampValue('created_at'),
            'last_resolved_at' => $this->timestampValue('resolved_at'),
            'last_failed_at' => $this->timestampValue('failed_at'),
            'failure_reasons' => $this->failureReasonCounts(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function statusCounts(): array
    {
        $counts = ManagedShinyLaunch::query()
            ->selectRaw('status, COUNT(*) AS aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return [
            'issued' => (int) ($counts['issued'] ?? 0),
            'resolved' => (int) ($counts['resolved'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
        ];
    }

    private function countSince(string $column, Carbon $since): int
    {
        return ManagedShinyLaunch::query()
            ->whereNotNull($column)
            ->where($column, '>=', $since)
            ->count();
    }

    private function averageResolutionSeconds(): ?float
    {
        $value = ManagedShinyLaunch::query()
            ->whereNotNull('resolved_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS average_seconds')
            ->value('average_seconds');

        return $value !== null ? round((float) $value, 3) : null;
    }

    private function timestampValue(string $column): ?string
    {
        $value = ManagedShinyLaunch::query()
            ->whereNotNull($column)
            ->max($column);

        return $value !== null ? Carbon::parse((string) $value)->toIso8601String() : null;
    }

    /**
     * @return array<string, int>
     */
    private function failureReasonCounts(): array
    {
        /** @var array<string, int> $counts */
        $counts = ManagedShinyLaunch::query()
            ->whereNotNull('failure_reason')
            ->selectRaw('failure_reason, COUNT(*) AS aggregate')
            ->groupBy('failure_reason')
            ->pluck('aggregate', 'failure_reason')
            ->map(fn (mixed $count): int => (int) $count)
            ->all();

        return $counts;
    }
}
