<?php

namespace App\Services\ClinicalCoherence;

use App\Models\App\Source;
use App\Models\Results\ClinicalCoherenceResult;
use App\Services\Achilles\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class ClinicalCoherenceEngineService
{
    public function __construct(
        private readonly ClinicalCoherenceAnalysisRegistry $registry,
        private readonly SqlRendererService $renderer,
    ) {}

    /**
     * Execute all registered clinical coherence analyses against a Source.
     *
     * @return array{completed: int, failed: int, flagged: int, results: array}
     */
    public function run(Source $source): array
    {
        $completed = 0;
        $failed    = 0;
        $flagged   = 0;
        $results   = [];

        // Purge previous run for this source
        ClinicalCoherenceResult::where('source_id', $source->id)->delete();

        foreach ($this->registry->all() as $analysis) {
            $start = microtime(true);
            try {
                $sql     = $this->renderer->render($analysis->sqlTemplate(), $source);
                $rows    = DB::connection($source->connection_name)->select($sql);
                $inserts = [];

                foreach ($rows as $row) {
                    $row      = (array) $row;
                    $ratio    = isset($row['ratio_value']) ? (float) $row['ratio_value'] : null;
                    $count    = (int) ($row['count_value'] ?? 0);
                    $threshold = $analysis->flagThreshold();

                    $isFlagged = $threshold === null
                        ? $count > 0
                        : ($ratio !== null && $ratio >= $threshold);

                    if ($isFlagged) {
                        $flagged++;
                    }

                    $inserts[] = [
                        'source_id'     => $source->id,
                        'analysis_id'   => $analysis->analysisId(),
                        'analysis_name' => $analysis->analysisName(),
                        'category'      => $analysis->category(),
                        'severity'      => $analysis->severity(),
                        'stratum_1'     => $row['stratum_1'] ?? null,
                        'stratum_2'     => $row['stratum_2'] ?? null,
                        'stratum_3'     => $row['stratum_3'] ?? null,
                        'count_value'   => $count,
                        'total_value'   => isset($row['total_value']) ? (int) $row['total_value'] : null,
                        'ratio_value'   => $ratio,
                        'flagged'       => $isFlagged,
                        'notes'         => $row['notes'] ?? null,
                        'run_at'        => now(),
                        'created_at'    => now(),
                        'updated_at'    => now(),
                    ];
                }

                if (!empty($inserts)) {
                    ClinicalCoherenceResult::insert($inserts);
                }

                $elapsed = round((microtime(true) - $start) * 1000);
                Log::info("[CC] {$analysis->analysisId()} completed in {$elapsed}ms — " . count($rows) . ' rows');
                $completed++;
                $results[] = [
                    'analysis_id' => $analysis->analysisId(),
                    'status'      => 'completed',
                    'rows'        => count($rows),
                    'elapsed_ms'  => $elapsed,
                ];
            } catch (Throwable $e) {
                Log::error("[CC] {$analysis->analysisId()} failed: " . $e->getMessage());
                $failed++;
                $results[] = [
                    'analysis_id' => $analysis->analysisId(),
                    'status'      => 'failed',
                    'error'       => $e->getMessage(),
                ];
            }
        }

        return compact('completed', 'failed', 'flagged', 'results');
    }

    /**
     * Return stored results for a source, grouped by severity then analysis.
     */
    public function getResults(Source $source): array
    {
        $rows = ClinicalCoherenceResult::where('source_id', $source->id)
            ->orderBy('severity')
            ->orderBy('analysis_id')
            ->get();

        $grouped = ['critical' => [], 'major' => [], 'informational' => []];

        foreach ($rows->groupBy('analysis_id') as $id => $group) {
            $first = $group->first();
            $entry = [
                'analysis_id'   => $id,
                'analysis_name' => $first->analysis_name,
                'category'      => $first->category,
                'severity'      => $first->severity,
                'flagged_count' => $group->where('flagged', true)->count(),
                'rows'          => $group->values(),
            ];
            $grouped[$first->severity][] = $entry;
        }

        return $grouped;
    }

    /**
     * Summary counts by severity.
     */
    public function getSummary(Source $source): array
    {
        return ClinicalCoherenceResult::where('source_id', $source->id)
            ->selectRaw('severity, COUNT(*) AS total_rows, SUM(CASE WHEN flagged THEN 1 ELSE 0 END) AS flagged_rows')
            ->groupBy('severity')
            ->get()
            ->keyBy('severity')
            ->toArray();
    }
}
