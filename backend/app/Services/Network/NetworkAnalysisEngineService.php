<?php

namespace App\Services\Network;

use App\Contracts\NetworkAnalysisInterface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\NetworkAnalysisResult;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class NetworkAnalysisEngineService
{
    public function __construct(
        private readonly NetworkAnalysisRegistry $registry,
        private readonly SqlRendererService $renderer,
    ) {}

    /**
     * Run all network analyses across all active sources.
     * Returns a summary: {analyses_run, sources_used, failed, results}
     */
    public function runAll(): array
    {
        $sources = Source::with('daimons')->get()->filter(
            fn (Source $s) => $s->getTableQualifier(DaimonType::CDM) !== null
        )->values();

        $completed = 0;
        $failed    = 0;
        $results   = [];

        foreach ($this->registry->all() as $analysis) {
            try {
                $result = $this->runAnalysis($analysis, $sources->all());
                $results[] = $result;
                $completed++;
            } catch (Throwable $e) {
                Log::error("Network analysis {$analysis->analysisId()} failed", [
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        return [
            'analyses_run'  => $completed,
            'sources_used'  => $sources->count(),
            'failed'        => $failed,
            'results'       => $results,
        ];
    }

    /**
     * Run a single analysis across all sources and store results.
     */
    public function runAnalysis(NetworkAnalysisInterface $analysis, array $sources): array
    {
        $perSourceRows = [];
        $sourcesRun    = 0;
        $sourcesFailed = 0;

        // ── 1. Execute per-source SQL ──────────────────────────────────────
        foreach ($sources as $source) {
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            if (! $cdmSchema) {
                continue;
            }

            try {
                $sql  = $this->renderer->render($analysis->perSourceSqlTemplate(), $source);
                $rows = DB::select($sql);

                // Delete stale rows for this analysis + source
                NetworkAnalysisResult::where('analysis_id', $analysis->analysisId())
                    ->where('source_id', $source->id)
                    ->delete();

                $now = now();
                foreach ($rows as $row) {
                    NetworkAnalysisResult::create([
                        'analysis_id'  => $analysis->analysisId(),
                        'source_id'    => $source->id,
                        'stratum_1'    => $row->stratum_1 ?? '',
                        'stratum_2'    => $row->stratum_2 ?? '',
                        'stratum_3'    => $row->stratum_3 ?? '',
                        'count_value'  => (int) ($row->count_value ?? 0),
                        'total_value'  => (int) ($row->total_value ?? 0),
                        'ratio_value'  => $row->total_value > 0
                            ? round($row->count_value / $row->total_value, 6)
                            : null,
                        'run_at'       => $now,
                    ]);

                    $perSourceRows[$source->id][] = $row;
                }

                $sourcesRun++;
            } catch (Throwable $e) {
                Log::warning("Network analysis {$analysis->analysisId()} failed for source {$source->source_key}", [
                    'error' => $e->getMessage(),
                ]);
                $sourcesFailed++;
            }
        }

        // ── 2. Compute cross-source network aggregates ─────────────────────
        $networkRows = $this->computeNetworkAggregates($analysis->analysisId(), $perSourceRows);

        // Delete stale network-level rows (source_id IS NULL)
        NetworkAnalysisResult::where('analysis_id', $analysis->analysisId())
            ->whereNull('source_id')
            ->delete();

        $now = now();
        foreach ($networkRows as $row) {
            NetworkAnalysisResult::create(array_merge($row, [
                'analysis_id' => $analysis->analysisId(),
                'source_id'   => null,
                'run_at'      => $now,
            ]));
        }

        return [
            'analysis_id'    => $analysis->analysisId(),
            'analysis_name'  => $analysis->analysisName(),
            'sources_run'    => $sourcesRun,
            'sources_failed' => $sourcesFailed,
            'network_rows'   => count($networkRows),
        ];
    }

    /**
     * Compute network-level aggregates from per-source rows.
     * Groups by (stratum_1, stratum_2, stratum_3) and computes:
     *   mean_ratio, sd_ratio, min_ratio, max_ratio, heterogeneity_i2, source_count
     * stored as JSON in value_as_string; count_value = total persons summed.
     */
    private function computeNetworkAggregates(string $analysisId, array $perSourceRows): array
    {
        // Flatten into keyed groups: stratum_key => [ratios...]
        $groups = [];

        foreach ($perSourceRows as $sourceId => $rows) {
            foreach ($rows as $row) {
                $key = implode('|', [
                    $row->stratum_1 ?? '',
                    $row->stratum_2 ?? '',
                    $row->stratum_3 ?? '',
                ]);

                $ratio = ($row->total_value ?? 0) > 0
                    ? ($row->count_value / $row->total_value)
                    : null;

                $groups[$key]['stratum_1']    = $row->stratum_1 ?? '';
                $groups[$key]['stratum_2']    = $row->stratum_2 ?? '';
                $groups[$key]['stratum_3']    = $row->stratum_3 ?? '';
                $groups[$key]['count_total']  = ($groups[$key]['count_total'] ?? 0) + ($row->count_value ?? 0);
                $groups[$key]['denom_total']  = ($groups[$key]['denom_total'] ?? 0) + ($row->total_value ?? 0);

                if ($ratio !== null) {
                    $groups[$key]['ratios'][]    = $ratio;
                    $groups[$key]['source_ids'][] = $sourceId;
                }
            }
        }

        $networkRows = [];

        foreach ($groups as $row) {
            $ratios = $row['ratios'] ?? [];
            $n      = count($ratios);

            if ($n === 0) {
                continue;
            }

            $mean = array_sum($ratios) / $n;
            $sd   = $n > 1
                ? sqrt(array_sum(array_map(fn ($r) => ($r - $mean) ** 2, $ratios)) / ($n - 1))
                : 0.0;

            // Cochran's I² approximation: I² = max(0, (Q - df) / Q)
            $i2 = 0.0;
            if ($n > 1) {
                $q  = array_sum(array_map(fn ($r) => (($r - $mean) ** 2) / max($sd * $sd, 1e-12), $ratios));
                $i2 = max(0.0, ($q - ($n - 1)) / max($q, 1e-12));
            }

            $networkRows[] = [
                'stratum_1'       => $row['stratum_1'],
                'stratum_2'       => $row['stratum_2'],
                'stratum_3'       => $row['stratum_3'],
                'count_value'     => (int) ($row['count_total'] ?? 0),
                'total_value'     => (int) ($row['denom_total'] ?? 0),
                'ratio_value'     => $row['denom_total'] > 0
                    ? round($row['count_total'] / $row['denom_total'], 6)
                    : null,
                'value_as_string' => json_encode([
                    'source_count'   => $n,
                    'mean_ratio'     => round($mean, 6),
                    'sd_ratio'       => round($sd, 6),
                    'min_ratio'      => round(min($ratios), 6),
                    'max_ratio'      => round(max($ratios), 6),
                    'heterogeneity_i2' => round($i2, 4),
                ]),
            ];
        }

        return $networkRows;
    }

    /**
     * Retrieve cross-source results for a single analysis.
     */
    public function getResults(string $analysisId): array
    {
        $perSource = NetworkAnalysisResult::where('analysis_id', $analysisId)
            ->whereNotNull('source_id')
            ->orderBy('source_id')
            ->orderBy('stratum_1')
            ->get()
            ->groupBy('source_id');

        $network = NetworkAnalysisResult::where('analysis_id', $analysisId)
            ->whereNull('source_id')
            ->orderBy('stratum_1')
            ->get();

        return [
            'analysis_id' => $analysisId,
            'per_source'  => $perSource,
            'network'     => $network,
        ];
    }

    /**
     * Summary of all registered analyses with latest run metadata.
     */
    public function getSummary(): array
    {
        $summaries = [];

        foreach ($this->registry->all() as $analysis) {
            $latest = NetworkAnalysisResult::where('analysis_id', $analysis->analysisId())
                ->whereNull('source_id')
                ->max('run_at');

            $sourceCount = NetworkAnalysisResult::where('analysis_id', $analysis->analysisId())
                ->whereNotNull('source_id')
                ->distinct('source_id')
                ->count('source_id');

            $summaries[] = [
                'analysis_id'  => $analysis->analysisId(),
                'analysis_name' => $analysis->analysisName(),
                'category'     => $analysis->category(),
                'description'  => $analysis->description(),
                'sources_run'  => $sourceCount,
                'last_run'     => $latest,
            ];
        }

        return $summaries;
    }
}
