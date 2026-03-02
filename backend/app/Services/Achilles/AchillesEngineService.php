<?php

namespace App\Services\Achilles;

use App\Contracts\AchillesAnalysisInterface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesPerformance;
use App\Models\Results\AchillesResult;
use App\Models\Results\AchillesResultDist;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AchillesEngineService
{
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
    public function runAll(Source $source, ?array $categories = null): array
    {
        $analyses = $categories
            ? collect($categories)->flatMap(fn (string $c) => $this->registry->byCategory($c))->all()
            : $this->registry->all();

        return $this->executeAnalyses($source, $analyses);
    }

    /**
     * Run specific analyses by ID.
     *
     * @param  list<int>  $analysisIds
     * @return array{completed: int, failed: int, results: list<array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}>}
     */
    public function runAnalyses(Source $source, array $analysisIds): array
    {
        $analyses = array_filter(
            array_map(fn (int $id) => $this->registry->get($id), $analysisIds),
        );

        return $this->executeAnalyses($source, $analyses);
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
    private function executeAnalyses(Source $source, array $analyses): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if (! $cdmSchema || ! $resultsSchema) {
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

        $completed = 0;
        $failed = 0;
        $results = [];

        foreach ($analyses as $analysis) {
            $result = $this->executeSingle($source, $analysis, $cdmSchema, $resultsSchema);
            $results[] = $result;

            if ($result['status'] === 'completed') {
                $completed++;
            } else {
                $failed++;
            }
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

            foreach ($statements as $statement) {
                $statement = trim($statement);
                if ($statement !== '') {
                    DB::connection('results')->statement($statement);
                }
            }

            $elapsed = round(microtime(true) - $startTime, 3);

            // Record performance
            AchillesPerformance::create([
                'analysis_id' => $analysisId,
                'elapsed_seconds' => $elapsed,
                'query_text' => mb_substr($renderedSql, 0, 10000),
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
