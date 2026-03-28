<?php

namespace App\Services\PopulationRisk;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\PopulationRiskScoreResult;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class PopulationRiskScoreEngineService
{
    public function __construct(
        private readonly PopulationRiskScoreRegistry $registry,
        private readonly SqlRendererService $renderer,
    ) {}

    /**
     * Run all registered risk scores against a Source and persist population summaries.
     *
     * @return array{completed: int, failed: int, results: array}
     */
    public function run(Source $source): array
    {
        $completed = 0;
        $failed = 0;
        $results = [];

        PopulationRiskScoreResult::where('source_id', $source->id)->delete();

        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $connection = $source->source_connection ?? 'omop';
        $dialect = $source->source_dialect ?? 'postgresql';

        foreach ($this->registry->all() as $score) {
            $start = microtime(true);
            try {
                $sql = $this->renderer->render(
                    $score->sqlTemplate(),
                    ['cdmSchema' => $cdmSchema],
                    $dialect,
                );
                $rows = DB::connection($connection)->select($sql);

                $inserts = [];
                foreach ($rows as $row) {
                    $row = (array) $row;
                    $inserts[] = [
                        'source_id' => $source->id,
                        'score_id' => $score->scoreId(),
                        'score_name' => $score->scoreName(),
                        'category' => $score->category(),
                        'risk_tier' => $row['risk_tier'] ?? 'unknown',
                        'patient_count' => (int) ($row['patient_count'] ?? 0),
                        'total_eligible' => (int) ($row['total_eligible'] ?? 0),
                        'mean_score' => isset($row['mean_score']) ? (float) $row['mean_score'] : null,
                        'p25_score' => isset($row['p25_score']) ? (float) $row['p25_score'] : null,
                        'median_score' => isset($row['median_score']) ? (float) $row['median_score'] : null,
                        'p75_score' => isset($row['p75_score']) ? (float) $row['p75_score'] : null,
                        'mean_confidence' => isset($row['mean_confidence']) ? (float) $row['mean_confidence'] : null,
                        'mean_completeness' => isset($row['mean_completeness']) ? (float) $row['mean_completeness'] : null,
                        'missing_components' => $row['missing_components'] ?? null,
                        'run_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                if (! empty($inserts)) {
                    PopulationRiskScoreResult::insert($inserts);
                }

                $elapsed = round((microtime(true) - $start) * 1000);
                Log::info("[RS] {$score->scoreId()} completed in {$elapsed}ms — ".count($rows).' tiers');
                $completed++;
                $results[] = [
                    'score_id' => $score->scoreId(),
                    'score_name' => $score->scoreName(),
                    'status' => 'completed',
                    'tiers' => count($rows),
                    'elapsed_ms' => $elapsed,
                ];
            } catch (Throwable $e) {
                Log::error("[RS] {$score->scoreId()} failed: ".$e->getMessage());
                $failed++;
                $results[] = [
                    'score_id' => $score->scoreId(),
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        return compact('completed', 'failed', 'results');
    }

    /**
     * Return stored results for a source grouped by category then score.
     */
    public function getResults(Source $source): array
    {
        $rows = PopulationRiskScoreResult::where('source_id', $source->id)
            ->orderBy('category')
            ->orderBy('score_id')
            ->orderByRaw("CASE risk_tier WHEN 'high' THEN 1 WHEN 'very_high' THEN 0 WHEN 'intermediate' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->get();

        $grouped = [];
        foreach ($rows->groupBy('score_id') as $id => $group) {
            $first = $group->first();
            $total = $group->sum('patient_count');
            $computable = $group->where('risk_tier', '!=', 'uncomputable')->sum('patient_count');
            $grouped[$first->category][] = [
                'score_id' => $id,
                'score_name' => $first->score_name,
                'category' => $first->category,
                'total_eligible' => $first->total_eligible,
                'computable_count' => $computable,
                'uncomputable_count' => $total - $computable,
                'mean_confidence' => round($group->avg('mean_confidence') ?? 0, 4),
                'mean_completeness' => round($group->avg('mean_completeness') ?? 0, 4),
                'tiers' => $group->values(),
            ];
        }

        return $grouped;
    }

    public function getSummary(Source $source): array
    {
        return PopulationRiskScoreResult::where('source_id', $source->id)
            ->selectRaw('score_id, score_name, category, SUM(patient_count) AS total_patients,
                         ROUND(AVG(mean_confidence)::NUMERIC, 4) AS avg_confidence,
                         ROUND(AVG(mean_completeness)::NUMERIC, 4) AS avg_completeness,
                         MAX(run_at) AS last_run')
            ->groupBy('score_id', 'score_name', 'category')
            ->orderBy('category')
            ->orderBy('score_id')
            ->get()
            ->toArray();
    }
}
