<?php

namespace App\Services\PopulationCharacterization;

use App\Contracts\PopulationCharacterizationInterface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\PopulationCharacterizationResult;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class PopulationCharacterizationEngineService
{
    public function __construct(
        private readonly PopulationCharacterizationRegistry $registry,
        private readonly SqlRendererService $renderer,
    ) {}

    /**
     * Run all population characterization analyses against a source.
     */
    public function run(Source $source): array
    {
        $completed = 0;
        $failed    = 0;
        $results   = [];

        foreach ($this->registry->all() as $analysis) {
            try {
                $result = $this->runAnalysis($analysis, $source);
                $results[] = $result;
                $completed++;
            } catch (Throwable $e) {
                Log::error("Population characterization {$analysis->analysisId()} failed for source {$source->source_key}", [
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        return [
            'source_id'  => $source->id,
            'completed'  => $completed,
            'failed'     => $failed,
            'results'    => $results,
        ];
    }

    /**
     * Run a single analysis and store results.
     */
    public function runAnalysis(PopulationCharacterizationInterface $analysis, Source $source): array
    {
        $sql  = $this->renderer->render($analysis->sqlTemplate(), $source);
        $rows = DB::select($sql);

        // Remove stale results for this analysis + source
        PopulationCharacterizationResult::where('analysis_id', $analysis->analysisId())
            ->where('source_id', $source->id)
            ->delete();

        $now = now();
        foreach ($rows as $row) {
            $countValue = (int) ($row->count_value ?? 0);
            $totalValue = (int) ($row->total_value ?? 0);

            PopulationCharacterizationResult::create([
                'analysis_id' => $analysis->analysisId(),
                'source_id'   => $source->id,
                'stratum_1'   => $row->stratum_1 ?? '',
                'stratum_2'   => $row->stratum_2 ?? '',
                'stratum_3'   => $row->stratum_3 ?? '',
                'count_value' => $countValue,
                'total_value' => $totalValue,
                'ratio_value' => $totalValue > 0
                    ? round($countValue / $totalValue, 6)
                    : null,
                'run_at'      => $now,
            ]);
        }

        return [
            'analysis_id'          => $analysis->analysisId(),
            'analysis_name'        => $analysis->analysisName(),
            'rows_stored'          => count($rows),
            'requires_optional'    => $analysis->requiresOptionalTables(),
        ];
    }

    /**
     * Retrieve results for one analysis, grouped by stratum_1 for charting.
     */
    public function getResults(Source $source, string $analysisId): array
    {
        $analysis = $this->registry->find($analysisId);

        $rows = PopulationCharacterizationResult::where('analysis_id', $analysisId)
            ->where('source_id', $source->id)
            ->orderBy('stratum_1')
            ->orderBy('stratum_2')
            ->get();

        return [
            'analysis' => [
                'id'                    => $analysis->analysisId(),
                'name'                  => $analysis->analysisName(),
                'category'              => $analysis->category(),
                'description'           => $analysis->description(),
                'requires_optional'     => $analysis->requiresOptionalTables(),
            ],
            'data'     => $rows,
            'last_run' => $rows->max('run_at'),
        ];
    }

    /**
     * Summary of all registered analyses with last-run metadata for a source.
     */
    public function getSummary(Source $source): array
    {
        $summaries = [];

        foreach ($this->registry->all() as $analysis) {
            $lastRun = PopulationCharacterizationResult::where('analysis_id', $analysis->analysisId())
                ->where('source_id', $source->id)
                ->max('run_at');

            $rowCount = PopulationCharacterizationResult::where('analysis_id', $analysis->analysisId())
                ->where('source_id', $source->id)
                ->count();

            $summaries[] = [
                'analysis_id'        => $analysis->analysisId(),
                'analysis_name'      => $analysis->analysisName(),
                'category'           => $analysis->category(),
                'description'        => $analysis->description(),
                'requires_optional'  => $analysis->requiresOptionalTables(),
                'last_run'           => $lastRun,
                'row_count'          => $rowCount,
            ];
        }

        return $summaries;
    }
}
