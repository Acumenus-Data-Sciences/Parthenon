<?php

namespace App\Services\Achilles;

use App\Concerns\SourceAware;
use App\Contracts\AchillesAnalysisInterface;
use App\Enums\DaimonType;
use App\Events\AchillesStepCompleted;
use App\Models\App\Source;
use App\Models\Results\AchillesPerformance;
use App\Models\Results\AchillesResult;
use App\Models\Results\AchillesResultDist;
use App\Models\Results\AchillesRun;
use App\Models\Results\AchillesRunStep;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\Log;

class AchillesEngineService
{
    use SourceAware;

    public function __construct(
        private AchillesAnalysisRegistry $registry,
        private SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Run all analyses (optionally filtered by categories).
     *
     * @param  list<string>|null  $categories
     * @return array{completed: int, failed: int, results: list<array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}>}
     */
    public function runAll(Source $source, ?array $categories = null, ?string $runId = null): array
    {
        $analyses = $categories
            ? collect($categories)->flatMap(fn (string $c) => $this->registry->byCategory($c))->all()
            : $this->registry->all();

        return $this->executeAnalyses($source, $analyses, $runId);
    }

    /**
     * Run specific analyses by ID.
     *
     * @param  list<int>  $analysisIds
     * @return array{completed: int, failed: int, results: list<array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}>}
     */
    public function runAnalyses(Source $source, array $analysisIds, ?string $runId = null): array
    {
        $analyses = array_filter(
            array_map(fn (int $id) => $this->registry->get($id), $analysisIds),
        );

        return $this->executeAnalyses($source, $analyses, $runId);
    }

    /**
     * Run a single analysis.
     *
     * @return array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}|null
     */
    public function runSingle(Source $source, int $analysisId): ?array
    {
        $analysis = $this->registry->get($analysisId);

        if (! $analysis) {
            return null;
        }

        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if (! $cdmSchema || ! $resultsSchema) {
            return [
                'analysis_id' => $analysisId,
                'status' => 'failed',
                'elapsed_seconds' => 0.0,
                'error' => 'Source is missing CDM or Results daimon configuration.',
            ];
        }

        return $this->executeSingle($source, $analysis, $cdmSchema, $resultsSchema);
    }

    /**
     * Clear existing results for given analysis IDs.
     * If no IDs provided, clears all results.
     *
     * @param  list<int>|null  $analysisIds
     */
    public function clearResults(?array $analysisIds = null): void
    {
        if ($analysisIds) {
            AchillesResult::whereIn('analysis_id', $analysisIds)->delete();
            AchillesResultDist::whereIn('analysis_id', $analysisIds)->delete();
            AchillesPerformance::whereIn('analysis_id', $analysisIds)->delete();
        } else {
            AchillesResult::truncate();
            AchillesResultDist::truncate();
            AchillesPerformance::truncate();
        }
    }

    /**
     * Execute a batch of analyses.
     *
     * @param  array<int, AchillesAnalysisInterface>  $analyses
     * @return array{completed: int, failed: int, results: list<array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}>}
     */
    private function executeAnalyses(Source $source, array $analyses, ?string $runId = null): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if (! $cdmSchema || ! $resultsSchema) {
            if ($runId) {
                AchillesRun::where('run_id', $runId)->update([
                    'status' => 'failed',
                    'completed_at' => now(),
                ]);
            }

            return [
                'completed' => 0,
                'failed' => count($analyses),
                'results' => array_map(fn (AchillesAnalysisInterface $a) => [
                    'analysis_id' => $a->analysisId(),
                    'status' => 'failed',
                    'elapsed_seconds' => 0.0,
                    'error' => 'Source is missing CDM or Results daimon configuration.',
                ], array_values($analyses)),
            ];
        }

        // Determine which analyses were already completed (for resume after retry)
        $completedIds = [];
        if ($runId) {
            $completedIds = AchillesRunStep::where('run_id', $runId)
                ->where('status', 'completed')
                ->pluck('analysis_id')
                ->all();

            if (count($completedIds) > 0) {
                Log::info("Achilles resuming run {$runId}: skipping ".count($completedIds).' already-completed analyses');
            }

            // Pre-populate step rows for analyses that don't have rows yet
            $existingIds = AchillesRunStep::where('run_id', $runId)
                ->pluck('analysis_id')
                ->all();

            $stepRows = [];
            $now = now();
            foreach ($analyses as $analysis) {
                if (! in_array($analysis->analysisId(), $existingIds)) {
                    $stepRows[] = [
                        'run_id' => $runId,
                        'analysis_id' => $analysis->analysisId(),
                        'analysis_name' => $analysis->analysisName(),
                        'category' => $analysis->category(),
                        'status' => 'pending',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
            if (count($stepRows) > 0) {
                foreach (array_chunk($stepRows, 50) as $chunk) {
                    AchillesRunStep::insert($chunk);
                }
            }

            // Reset any steps stuck in 'running' from a prior crashed attempt
            AchillesRunStep::where('run_id', $runId)
                ->where('status', 'running')
                ->update(['status' => 'pending', 'started_at' => null]);

            AchillesRun::where('run_id', $runId)->update([
                'status' => 'running',
                'total_analyses' => count($analyses),
                'started_at' => now(),
            ]);
        }

        $completed = count($completedIds); // credit already-completed analyses
        $failed = 0;
        $results = [];

        foreach ($analyses as $analysis) {
            // Skip analyses already completed in a prior attempt
            if (in_array($analysis->analysisId(), $completedIds)) {
                continue;
            }

            // Mark step running
            if ($runId) {
                AchillesRunStep::where('run_id', $runId)
                    ->where('analysis_id', $analysis->analysisId())
                    ->update(['status' => 'running', 'started_at' => now()]);
            }

            $result = $this->executeSingle($source, $analysis, $cdmSchema, $resultsSchema);
            $results[] = $result;

            if ($result['status'] === 'completed') {
                $completed++;
            } else {
                $failed++;
            }

            // Update step and run, broadcast
            if ($runId) {
                AchillesRunStep::where('run_id', $runId)
                    ->where('analysis_id', $analysis->analysisId())
                    ->update([
                        'status' => $result['status'],
                        'elapsed_seconds' => $result['elapsed_seconds'],
                        'error_message' => $result['error'] ?? null,
                        'completed_at' => now(),
                    ]);

                AchillesRun::where('run_id', $runId)->update([
                    'completed_analyses' => $completed,
                    'failed_analyses' => $failed,
                ]);

                broadcast(new AchillesStepCompleted(
                    runId: $runId,
                    sourceId: $source->id,
                    analysisId: $analysis->analysisId(),
                    analysisName: $analysis->analysisName(),
                    category: $analysis->category(),
                    status: $result['status'],
                    elapsedSeconds: $result['elapsed_seconds'],
                    completedAnalyses: $completed,
                    totalAnalyses: count($analyses),
                    failedAnalyses: $failed,
                    errorMessage: $result['error'] ?? null,
                ));
            }
        }

        // Mark run complete
        if ($runId) {
            AchillesRun::where('run_id', $runId)->update([
                'status' => $failed === count($analyses) ? 'failed' : 'completed',
                'completed_at' => now(),
            ]);
        }

        return [
            'completed' => $completed,
            'failed' => $failed,
            'results' => $results,
        ];
    }

    /**
     * Execute a single analysis and return timing/status.
     *
     * @return array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}
     */
    private function executeSingle(
        Source $source,
        AchillesAnalysisInterface $analysis,
        string $cdmSchema,
        string $resultsSchema,
    ): array {
        $analysisId = $analysis->analysisId();
        $startTime = microtime(true);

        try {
            $renderedSql = $this->sqlRenderer->render(
                $analysis->sqlTemplate(),
                [
                    'cdmSchema' => $cdmSchema,
                    'resultsSchema' => $resultsSchema,
                ],
                $source->source_dialect ?? 'postgresql',
            );

            // Execute each statement separately (template may contain DELETE + INSERT)
            $statements = $this->splitStatements($renderedSql);

            $conn = $this->results();

            // Set per-statement timeout (30 min) to prevent single queries from blocking the run
            $conn->statement('SET LOCAL statement_timeout = 1800000');

            foreach ($statements as $statement) {
                $statement = trim($statement);
                if ($statement !== '') {
                    $conn->statement($statement);
                }
            }

            $elapsed = round(microtime(true) - $startTime, 3);

            // Record performance
            AchillesPerformance::create([
                'analysis_id' => $analysisId,
                'elapsed_seconds' => $elapsed,
            ]);

            Log::info("Achilles analysis {$analysisId} ({$analysis->analysisName()}) completed in {$elapsed}s");

            return [
                'analysis_id' => $analysisId,
                'status' => 'completed',
                'elapsed_seconds' => $elapsed,
            ];
        } catch (\Throwable $e) {
            $elapsed = round(microtime(true) - $startTime, 3);

            Log::error("Achilles analysis {$analysisId} failed: {$e->getMessage()}", [
                'analysis_id' => $analysisId,
                'analysis_name' => $analysis->analysisName(),
                'exception' => $e,
            ]);

            return [
                'analysis_id' => $analysisId,
                'status' => 'failed',
                'elapsed_seconds' => $elapsed,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Split a multi-statement SQL string into individual statements.
     *
     * @return list<string>
     */
    private function splitStatements(string $sql): array
    {
        // Split on semicolons that are not inside quotes
        $statements = [];
        $current = '';
        $inSingleQuote = false;

        for ($i = 0; $i < strlen($sql); $i++) {
            $char = $sql[$i];

            if ($char === "'" && ($i === 0 || $sql[$i - 1] !== '\\')) {
                $inSingleQuote = ! $inSingleQuote;
            }

            if ($char === ';' && ! $inSingleQuote) {
                $trimmed = trim($current);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $current = '';
            } else {
                $current .= $char;
            }
        }

        $trimmed = trim($current);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }
}
