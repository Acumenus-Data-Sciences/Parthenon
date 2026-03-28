<?php

namespace App\Services\Ares;

use App\Concerns\SourceAware;
use App\Enums\DaimonType;
use App\Models\App\ChartAnnotation;
use App\Models\App\DqdResult;
use App\Models\App\DqSlaTarget;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DqHistoryService
{
    use SourceAware;

    /**
     * Standard CDM domain analysis IDs for domain coverage counting.
     *
     * @var array<int, int>
     */
    private const DOMAIN_ANALYSIS_IDS = [400, 600, 700, 800, 200, 1800, 2100, 900, 1000, 1100, 1300, 1500];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

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

        Log::info("DqHistoryService: computed {$release->id} deltas — ".count($deltas).' checks processed.');
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
     * Get the latest DQ pass rate per source across the network,
     * including sparkline data, freshness, domain count, and person count.
     *
     * @return array<int, array{source_id: int, source_name: string, pass_rate: float, trend: string|null, release_name: string|null, sparkline: array<int, float>, days_since_refresh: int|null, domain_count: int, person_count: int}>
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
                $achillesData = $this->getAchillesMetrics($source);

                $summary[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'pass_rate' => 0.0,
                    'trend' => null,
                    'release_name' => null,
                    'sparkline' => [],
                    'days_since_refresh' => null,
                    'domain_count' => $achillesData['domain_count'],
                    'person_count' => $achillesData['person_count'],
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

            // Sparkline: last 6 DQ pass rates
            $sparkline = $this->getSparklineData($source);

            // Freshness: days since latest release
            $daysSinceRefresh = (int) now()->diffInDays($latestRelease->created_at);

            // Domain count and person count from Achilles results
            $achillesData = $this->getAchillesMetrics($source);

            $summary[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'pass_rate' => $currentRate,
                'trend' => $trend,
                'release_name' => $latestRelease->release_name,
                'sparkline' => $sparkline,
                'days_since_refresh' => $daysSinceRefresh,
                'domain_count' => $achillesData['domain_count'],
                'person_count' => $achillesData['person_count'],
            ];
        }

        return $summary;
    }

    /**
     * Get last 6 DQ pass rates for sparkline display.
     *
     * @return array<int, float>
     */
    private function getSparklineData(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->reverse()
            ->values();

        return $releases->map(function (SourceRelease $release) use ($source): float {
            $stats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->first();

            $total = (int) $stats->total;

            return $total > 0 ? round(((int) $stats->passed_count / $total) * 100, 1) : 0.0;
        })->toArray();
    }

    /**
     * Get domain count and person count from Achilles results for a source.
     *
     * @return array{domain_count: int, person_count: int}
     */
    private function getAchillesMetrics(Source $source): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                $this->results()->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            // Count distinct domains with Achilles data
            $domainCount = (int) AchillesResult::on($connection)
                ->whereIn('analysis_id', self::DOMAIN_ANALYSIS_IDS)
                ->where('count_value', '>', 0)
                ->distinct()
                ->count('analysis_id');

            // Person count from analysis_id = 1
            $personCount = (int) (AchillesResult::on($connection)
                ->where('analysis_id', 1)
                ->value('count_value') ?? 0);

            return [
                'domain_count' => $domainCount,
                'person_count' => $personCount,
            ];
        } catch (\Throwable $e) {
            Log::warning("DqHistory: failed to query Achilles for source {$source->source_name}: {$e->getMessage()}");

            return [
                'domain_count' => 0,
                'person_count' => 0,
            ];
        }
    }

    /**
     * Get category x release heatmap data for a source.
     *
     * @return array{releases: array<int, array{id: int, name: string, date: string}>, categories: string[], cells: array<int, array{release_id: int, category: string, pass_rate: float}>}
     */
    public function getCategoryHeatmap(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $releaseList = $releases->map(fn (SourceRelease $r) => [
            'id' => $r->id,
            'name' => $r->release_name,
            'date' => $r->created_at->toDateString(),
        ])->toArray();

        $allCategories = [];
        $cells = [];

        foreach ($releases as $release) {
            $categoryStats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('category')
                ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->groupBy('category')
                ->get();

            foreach ($categoryStats as $stat) {
                $allCategories[$stat->category] = true;
                $total = (int) $stat->total;
                $cells[] = [
                    'release_id' => $release->id,
                    'category' => $stat->category,
                    'pass_rate' => $total > 0 ? round(((int) $stat->passed_count / $total) * 100, 1) : 0.0,
                ];
            }
        }

        return [
            'releases' => array_values($releaseList),
            'categories' => array_keys($allCategories),
            'cells' => $cells,
        ];
    }

    /**
     * Get check-level sparklines for a release's delta table.
     * Returns per-check historical pass/fail across last 6 releases.
     *
     * @return array<string, array<int, bool|null>>
     */
    public function getCheckSparklines(int $releaseId): array
    {
        $release = SourceRelease::findOrFail($releaseId);

        $recentReleases = SourceRelease::where('source_id', $release->source_id)
            ->where('created_at', '<=', $release->created_at)
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->reverse()
            ->values();

        // Get all check_ids from the current release
        $currentChecks = DqdResult::where('source_id', $release->source_id)
            ->where('release_id', $release->id)
            ->pluck('check_id')
            ->toArray();

        $sparklines = [];

        foreach ($currentChecks as $checkId) {
            $history = [];
            foreach ($recentReleases as $r) {
                $result = DqdResult::where('source_id', $release->source_id)
                    ->where('release_id', $r->id)
                    ->where('check_id', $checkId)
                    ->first();

                $history[] = $result ? (bool) $result->passed : null;
            }
            $sparklines[$checkId] = $history;
        }

        return $sparklines;
    }

    /**
     * Get DQ trend data for all sources overlaid on same timeline.
     *
     * @return array<int, array{source_id: int, source_name: string, trends: array<int, array{release_name: string, created_at: string, pass_rate: float}>}>
     */
    public function getNetworkDqOverlay(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $result = [];

        foreach ($sources as $source) {
            $trends = $this->getTrends($source);
            $result[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'trends' => array_map(fn (array $t) => [
                    'release_name' => $t['release_name'],
                    'created_at' => $t['created_at'],
                    'pass_rate' => $t['pass_rate'],
                ], $trends),
            ];
        }

        return $result;
    }

    /**
     * Kahn DQ dimensions mapped from DQD category values.
     *
     * @var array<string, string>
     */
    private const KAHN_DIMENSION_MAP = [
        'completeness' => 'completeness',
        'Completeness' => 'completeness',
        'conformance' => 'conformance_value',
        'Conformance' => 'conformance_value',
        'conformance_value' => 'conformance_value',
        'conformance_relational' => 'conformance_relational',
        'plausibility' => 'plausibility_atemporal',
        'Plausibility' => 'plausibility_atemporal',
        'plausibility_atemporal' => 'plausibility_atemporal',
        'plausibility_temporal' => 'plausibility_temporal',
    ];

    /**
     * Get radar profile for a single source — pass rates by Kahn DQ dimension.
     *
     * @return array{source_id: int, source_name: string, dimensions: array<string, float>}
     */
    public function getRadarProfile(Source $source): array
    {
        $latestRelease = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->first();

        $defaultDimensions = [
            'completeness' => 0.0,
            'conformance_value' => 0.0,
            'conformance_relational' => 0.0,
            'plausibility_atemporal' => 0.0,
            'plausibility_temporal' => 0.0,
        ];

        if (! $latestRelease) {
            return [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'dimensions' => $defaultDimensions,
            ];
        }

        $categoryStats = DqdResult::where('source_id', $source->id)
            ->where('release_id', $latestRelease->id)
            ->whereNotNull('category')
            ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->groupBy('category')
            ->get();

        $dimensions = $defaultDimensions;

        foreach ($categoryStats as $stat) {
            $total = (int) $stat->total;
            $passRate = $total > 0 ? round(((int) $stat->passed_count / $total) * 100, 1) : 0.0;

            $dimension = self::KAHN_DIMENSION_MAP[$stat->category] ?? null;
            if ($dimension !== null) {
                // If multiple categories map to the same dimension, take the average
                if ($dimensions[$dimension] > 0) {
                    $dimensions[$dimension] = round(($dimensions[$dimension] + $passRate) / 2, 1);
                } else {
                    $dimensions[$dimension] = $passRate;
                }
            }
        }

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'dimensions' => $dimensions,
        ];
    }

    /**
     * Get radar profiles for all sources in the network.
     *
     * @return array<int, array{source_id: int, source_name: string, dimensions: array<string, float>}>
     */
    public function getNetworkRadarProfiles(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $profiles = [];

        foreach ($sources as $source) {
            $profiles[] = $this->getRadarProfile($source);
        }

        return $profiles;
    }

    /**
     * Get SLA compliance for a source.
     *
     * @return array<int, array{category: string, target: float, actual: float, compliant: bool, error_budget_remaining: float}>
     */
    public function getSlaCompliance(Source $source): array
    {
        $targets = DqSlaTarget::where('source_id', $source->id)->get();

        if ($targets->isEmpty()) {
            return [];
        }

        $latestRelease = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->first();

        if (! $latestRelease) {
            return $targets->map(fn (DqSlaTarget $t) => [
                'category' => $t->category,
                'target' => $t->min_pass_rate,
                'actual' => 0.0,
                'compliant' => false,
                'error_budget_remaining' => -$t->min_pass_rate,
            ])->toArray();
        }

        $categoryStats = DqdResult::where('source_id', $source->id)
            ->where('release_id', $latestRelease->id)
            ->whereNotNull('category')
            ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->groupBy('category')
            ->get()
            ->keyBy('category');

        return $targets->map(function (DqSlaTarget $target) use ($categoryStats) {
            $stat = $categoryStats->get($target->category);
            $total = $stat ? (int) $stat->total : 0;
            $actual = $total > 0 ? round(((int) $stat->passed_count / $total) * 100, 1) : 0.0;

            return [
                'category' => $target->category,
                'target' => $target->min_pass_rate,
                'actual' => $actual,
                'compliant' => $actual >= $target->min_pass_rate,
                'error_budget_remaining' => round($actual - $target->min_pass_rate, 1),
            ];
        })->toArray();
    }

    /**
     * Export DQ history data as CSV string.
     */
    public function exportDqHistory(Source $source, string $format = 'csv'): string
    {
        $trends = $this->getTrends($source);
        $categoryTrends = $this->getCategoryTrends($source);

        $lines = [];
        $lines[] = 'release_name,created_at,overall_pass_rate,total_checks,passed_checks';

        foreach ($trends as $trend) {
            $lines[] = implode(',', [
                '"'.str_replace('"', '""', $trend['release_name']).'"',
                $trend['created_at'],
                $trend['pass_rate'],
                $trend['total'],
                $trend['passed'],
            ]);
        }

        // Add category breakdown section
        if (! empty($categoryTrends)) {
            $lines[] = '';
            $allCategories = [];
            foreach ($categoryTrends as $ct) {
                foreach (array_keys($ct['categories']) as $cat) {
                    $allCategories[$cat] = true;
                }
            }
            $categories = array_keys($allCategories);

            $lines[] = implode(',', array_merge(['release_name', 'created_at'], $categories));
            foreach ($categoryTrends as $ct) {
                $row = [
                    '"'.str_replace('"', '""', $ct['release_name']).'"',
                    $ct['created_at'],
                ];
                foreach ($categories as $cat) {
                    $row[] = (string) ($ct['categories'][$cat] ?? 0.0);
                }
                $lines[] = implode(',', $row);
            }
        }

        return implode("\n", $lines);
    }

    /**
     * Get regression context — annotations and release changes for a specific check.
     *
     * @return array{annotations: array<int, array<string, mixed>>, release_changes: array{vocab_changed: bool, etl_changed: bool, person_delta: int}}
     */
    public function getRegressionContext(Source $source, int $releaseId, string $checkId): array
    {
        $release = SourceRelease::findOrFail($releaseId);

        // Get annotations near the release date
        $annotations = ChartAnnotation::where('source_id', $source->id)
            ->where('x_value', $release->created_at->toDateString())
            ->get()
            ->map(fn (ChartAnnotation $a) => [
                'id' => $a->id,
                'text' => $a->annotation_text,
                'tag' => $a->tag,
                'created_at' => $a->created_at?->toIso8601String(),
            ])
            ->toArray();

        // Compare release metadata with previous
        $previousRelease = SourceRelease::where('source_id', $source->id)
            ->where('id', '!=', $release->id)
            ->where('created_at', '<', $release->created_at)
            ->orderByDesc('created_at')
            ->first();

        $vocabChanged = $previousRelease
            ? $release->vocabulary_version !== $previousRelease->vocabulary_version
            : false;

        $etlChanged = $previousRelease
            ? $release->etl_version !== $previousRelease->etl_version
            : false;

        $personDelta = $previousRelease
            ? $release->person_count - $previousRelease->person_count
            : 0;

        return [
            'annotations' => $annotations,
            'release_changes' => [
                'vocab_changed' => $vocabChanged,
                'etl_changed' => $etlChanged,
                'person_delta' => $personDelta,
            ],
        ];
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
