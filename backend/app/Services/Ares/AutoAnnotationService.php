<?php

declare(strict_types=1);

namespace App\Services\Ares;

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Support\Facades\DB;

class AutoAnnotationService
{
    private const DQ_DROP_THRESHOLD = 5.0; // percent

    private const UNMAPPED_SPIKE_THRESHOLD = 50; // new codes

    private const FRESHNESS_WARNING_DAYS = 14;

    private const FRESHNESS_CRITICAL_DAYS = 30;

    /**
     * Generate all active alerts across the network.
     *
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: float|int}>
     */
    public function getAlerts(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $alerts = [];

        foreach ($sources as $source) {
            $alerts = [...$alerts, ...$this->getDqAlerts($source)];
            $alerts = [...$alerts, ...$this->getFreshnessAlerts($source)];
            $alerts = [...$alerts, ...$this->getUnmappedAlerts($source)];
        }

        // Sort by severity: critical first, then warning
        usort($alerts, fn (array $a, array $b) => ($a['severity'] === 'critical' ? 0 : 1) <=> ($b['severity'] === 'critical' ? 0 : 1));

        return $alerts;
    }

    /**
     * Create a system annotation automatically (called from event listeners).
     */
    public function createSystemAnnotation(
        int $sourceId,
        string $chartType,
        string $xValue,
        string $text,
        string $tag = 'system',
    ): ChartAnnotation {
        return ChartAnnotation::create([
            'source_id' => $sourceId,
            'chart_type' => $chartType,
            'chart_context' => (object) [],
            'x_value' => $xValue,
            'annotation_text' => $text,
            'created_by' => 1, // System user (admin)
            'tag' => $tag,
        ]);
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: float}>
     */
    private function getDqAlerts(Source $source): array
    {
        $alerts = [];
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(2)
            ->get();

        if ($releases->count() < 2) {
            return [];
        }

        $current = $releases->first();
        $previous = $releases->last();

        $currentRate = $this->getPassRate($source->id, $current->id);
        $previousRate = $this->getPassRate($source->id, $previous->id);

        $delta = $previousRate - $currentRate;

        if ($delta > self::DQ_DROP_THRESHOLD) {
            $alerts[] = [
                'severity' => $delta > 10 ? 'critical' : 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'dq_drop',
                'message' => "{$source->source_name} DQ dropped {$delta}% ({$previousRate}% -> {$currentRate}%)",
                'value' => round($delta, 1),
            ];
        }

        return $alerts;
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: int}>
     */
    private function getFreshnessAlerts(Source $source): array
    {
        $latest = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->first();

        if (! $latest) {
            return [];
        }

        $daysSince = (int) $latest->created_at->diffInDays(now());

        if ($daysSince >= self::FRESHNESS_CRITICAL_DAYS) {
            return [[
                'severity' => 'critical',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'stale_data',
                'message' => "{$source->source_name} has not been refreshed in {$daysSince} days",
                'value' => $daysSince,
            ]];
        }

        if ($daysSince >= self::FRESHNESS_WARNING_DAYS) {
            return [[
                'severity' => 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'stale_data',
                'message' => "{$source->source_name} last refreshed {$daysSince} days ago",
                'value' => $daysSince,
            ]];
        }

        return [];
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: int}>
     */
    private function getUnmappedAlerts(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(2)
            ->get();

        if ($releases->count() < 2) {
            return [];
        }

        $currentCount = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $releases->first()->id)
            ->count();

        $previousCount = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $releases->last()->id)
            ->count();

        $newCodes = $currentCount - $previousCount;

        if ($newCodes >= self::UNMAPPED_SPIKE_THRESHOLD) {
            return [[
                'severity' => $newCodes > 200 ? 'critical' : 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'unmapped_spike',
                'message' => "{$source->source_name} has {$newCodes} new unmapped codes",
                'value' => $newCodes,
            ]];
        }

        return [];
    }

    private function getPassRate(int $sourceId, int $releaseId): float
    {
        $stats = DB::table('dqd_results')
            ->where('source_id', $sourceId)
            ->where('release_id', $releaseId)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $passed = (int) ($stats->passed_count ?? 0);

        return $total > 0 ? round(($passed / $total) * 100, 1) : 0.0;
    }
}
