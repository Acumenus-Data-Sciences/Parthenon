<?php

namespace App\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DqHistoryService
{
    /**
     * Compute delta status for each DQD check in the given release
     * compared to the previous release for the same source.
     *
     * Delta logic:
     *   new      = failed in current, not present in previous (or first release)
     *   resolved = passed in current, failed in previous
     *   existing = failed in both current and previous
     *   stable   = passed in both current and previous
     */
    public function computeDeltas(SourceRelease $release): void
    {
        // Delete any existing deltas for idempotency
        DB::table('dqd_deltas')
            ->where('current_release_id', $release->id)
            ->delete();

        $previousRelease = SourceRelease::where('source_id', $release->source_id)
            ->where('id', '!=', $release->id)
            ->where('created_at', '<', $release->created_at)
            ->orderByDesc('created_at')
            ->first();

        $currentResults = DqdResult::where('source_id', $release->source_id)
            ->where('release_id', $release->id)
            ->get()
            ->keyBy('check_id');

        $previousResults = $previousRelease
            ? DqdResult::where('source_id', $release->source_id)
                ->where('release_id', $previousRelease->id)
                ->get()
                ->keyBy('check_id')
            : collect();

        $deltas = [];
        $now = now();

        foreach ($currentResults as $checkId => $current) {
            $previous = $previousResults->get($checkId);

            if (! $previousRelease || ! $previous) {
                // First release or check not in previous
                $deltaStatus = $current->passed ? 'stable' : 'new';
                $previousPassed = null;
            } elseif ($current->passed && $previous->passed) {
                $deltaStatus = 'stable';
                $previousPassed = true;
            } elseif (! $current->passed && ! $previous->passed) {
                $deltaStatus = 'existing';
                $previousPassed = false;
            } elseif ($current->passed && ! $previous->passed) {
                $deltaStatus = 'resolved';
                $previousPassed = false;
            } else {
                // Failed in current, passed in previous
                $deltaStatus = 'new';
                $previousPassed = true;
            }

            $deltas[] = [
                'source_id' => $release->source_id,
                'current_release_id' => $release->id,
                'previous_release_id' => $previousRelease?->id,
                'check_id' => $checkId,
                'delta_status' => $deltaStatus,
                'current_passed' => $current->passed,
                'previous_passed' => $previousPassed,
                'created_at' => $now,
            ];
        }

        if (! empty($deltas)) {
            DB::table('dqd_deltas')->insert($deltas);
        }

        Log::info("DqHistoryService: computed {$release->id} deltas — " . count($deltas) . ' checks processed.');
    }

    /**
     * Get overall DQ pass rate per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, pass_rate: float, total: int, passed: int}>
     */
    public function getTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $stats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->first();

            $total = (int) $stats->total;
            $passed = (int) $stats->passed_count;

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 1) : 0.0,
                'total' => $total,
                'passed' => $passed,
            ];
        }

        return $trends;
    }

    /**
     * Get DQ pass rate by category per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, categories: array<string, float>}>
     */
    public function getCategoryTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $categoryStats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('category')
                ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->groupBy('category')
                ->get();

            $categories = [];
            foreach ($categoryStats as $stat) {
                $total = (int) $stat->total;
                $categories[$stat->category] = $total > 0
                    ? round(((int) $stat->passed_count / $total) * 100, 1)
                    : 0.0;
            }

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'categories' => $categories,
            ];
        }

        return $trends;
    }

    /**
     * Get DQ pass rate by CDM table per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, domains: array<string, float>}>
     */
    public function getDomainTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $domainStats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('cdm_table')
                ->selectRaw('cdm_table, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->groupBy('cdm_table')
                ->get();

            $domains = [];
            foreach ($domainStats as $stat) {
                $total = (int) $stat->total;
                $domains[$stat->cdm_table] = $total > 0
                    ? round(((int) $stat->passed_count / $total) * 100, 1)
                    : 0.0;
            }

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'domains' => $domains,
            ];
        }

        return $trends;
    }

    /**
     * Get deltas for a specific release.
     *
     * @return Collection<int, object>
     */
    public function getDeltas(int $releaseId): Collection
    {
        return DB::table('dqd_deltas')
            ->where('current_release_id', $releaseId)
            ->orderByRaw("CASE delta_status WHEN 'new' THEN 1 WHEN 'existing' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END")
            ->get();
    }

    /**
     * Get the latest DQ pass rate per source across the network.
     *
     * @return array<int, array{source_id: int, source_name: string, pass_rate: float, trend: string|null, release_name: string|null}>
     */
    public function getNetworkDqSummary(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $summary = [];

        foreach ($sources as $source) {
            $latestRelease = SourceRelease::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->first();

            if (! $latestRelease) {
                $summary[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'pass_rate' => 0.0,
                    'trend' => null,
                    'release_name' => null,
                ];
                continue;
            }

            $stats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $latestRelease->id)
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->first();

            $total = (int) $stats->total;
            $currentRate = $total > 0 ? round(((int) $stats->passed_count / $total) * 100, 1) : 0.0;

            // Compute trend vs previous release
            $previousRelease = SourceRelease::where('source_id', $source->id)
                ->where('id', '!=', $latestRelease->id)
                ->where('created_at', '<', $latestRelease->created_at)
                ->orderByDesc('created_at')
                ->first();

            $trend = null;
            if ($previousRelease) {
                $prevStats = DqdResult::where('source_id', $source->id)
                    ->where('release_id', $previousRelease->id)
                    ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                    ->first();

                $prevTotal = (int) $prevStats->total;
                $prevRate = $prevTotal > 0 ? round(((int) $prevStats->passed_count / $prevTotal) * 100, 1) : 0.0;

                if ($currentRate > $prevRate) {
                    $trend = 'up';
                } elseif ($currentRate < $prevRate) {
                    $trend = 'down';
                } else {
                    $trend = 'stable';
                }
            }

            $summary[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'pass_rate' => $currentRate,
                'trend' => $trend,
                'release_name' => $latestRelease->release_name,
            ];
        }

        return $summary;
    }

    /**
     * Get records per domain across releases for domain continuity.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, domains: array<string, int>}>
     */
    public function getDomainContinuity(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $continuity = [];

        foreach ($releases as $release) {
            $domainCounts = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('cdm_table')
                ->selectRaw('cdm_table, SUM(total_rows) as record_count')
                ->groupBy('cdm_table')
                ->pluck('record_count', 'cdm_table')
                ->map(fn ($v) => (int) $v)
                ->toArray();

            $continuity[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'domains' => $domainCounts,
            ];
        }

        return $continuity;
    }
}
