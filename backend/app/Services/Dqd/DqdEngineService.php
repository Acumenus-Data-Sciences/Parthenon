<?php

namespace App\Services\Dqd;

use App\Contracts\DqdCheckInterface;
use App\Enums\DaimonType;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DqdEngineService
{
    public function __construct(
        private DqdCheckRegistry $registry,
    ) {}

    /**
     * Run all DQD checks for a source.
     *
     * @return array{runId: string, completed: int, failed: int, results: array<int, array<string, mixed>>}
     */
    public function runAll(Source $source, ?string $runId = null): array
    {
        $runId ??= (string) Str::uuid();
        $checks = $this->registry->all();

        return $this->executeChecks($source, $checks, $runId);
    }

    /**
     * Run checks for a specific category.
     *
     * @return array{runId: string, completed: int, failed: int, results: array<int, array<string, mixed>>}
     */
    public function runCategory(Source $source, string $category, ?string $runId = null): array
    {
        $runId ??= (string) Str::uuid();
        $checks = $this->registry->byCategory($category);

        return $this->executeChecks($source, $checks, $runId);
    }

    /**
     * Run checks for a specific CDM table.
     *
     * @return array{runId: string, completed: int, failed: int, results: array<int, array<string, mixed>>}
     */
    public function runForTable(Source $source, string $cdmTable, ?string $runId = null): array
    {
        $runId ??= (string) Str::uuid();
        $checks = $this->registry->byTable($cdmTable);

        return $this->executeChecks($source, $checks, $runId);
    }

    /**
     * Get summary statistics for a completed run.
     *
     * @return array{run_id: string, total_checks: int, passed: int, failed: int, warnings: int, errors: int, by_category: array<int, array<string, mixed>>}
     */
    public function getSummary(string $runId): array
    {
        $results = DqdResult::where('run_id', $runId)->get();

        if ($results->isEmpty()) {
            return [
                'run_id' => $runId,
                'total_checks' => 0,
                'passed' => 0,
                'failed' => 0,
                'warnings' => 0,
                'errors' => 0,
                'by_category' => [],
            ];
        }

        $totalChecks = $results->count();
        $passed = $results->where('passed', true)->count();
        $failed = $results->where('passed', false)->count();
        $warnings = $results->where('passed', false)->where('severity', 'warning')->count();
        $errors = $results->where('passed', false)->where('severity', 'error')->count();

        // Build per-category breakdown
        $byCategory = [];
        $grouped = $results->groupBy('category');

        foreach ($grouped as $category => $categoryResults) {
            $catTotal = $categoryResults->count();
            $catPassed = $categoryResults->where('passed', true)->count();
            $catFailed = $categoryResults->where('passed', false)->count();
            $passRate = $catTotal > 0 ? round(($catPassed / $catTotal) * 100, 2) : 0.0;

            $byCategory[] = [
                'category' => $category,
                'total' => $catTotal,
                'passed' => $catPassed,
                'failed' => $catFailed,
                'pass_rate' => $passRate,
            ];
        }

        return [
            'run_id' => $runId,
            'total_checks' => $totalChecks,
            'passed' => $passed,
            'failed' => $failed,
            'warnings' => $warnings,
            'errors' => $errors,
            'by_category' => $byCategory,
        ];
    }

    /**
     * Get paginated results for a run with optional filters.
     *
     * @return array{data: array<int, mixed>, current_page: int, per_page: int, total: int, last_page: int}
     */
    public function getResults(
        string $runId,
        ?string $category = null,
        ?string $table = null,
        ?bool $passed = null,
        ?string $severity = null,
        int $page = 1,
        int $perPage = 50,
    ): array {
        $query = DqdResult::where('run_id', $runId);

        if ($category !== null) {
            $query->where('category', $category);
        }

        if ($table !== null) {
            $query->where('cdm_table', $table);
        }

        if ($passed !== null) {
            $query->where('passed', $passed);
        }

        if ($severity !== null) {
            $query->where('severity', $severity);
        }

        $query->orderByRaw('CASE WHEN passed = false THEN 0 ELSE 1 END')
            ->orderBy('severity')
            ->orderBy('category')
            ->orderBy('cdm_table');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
            'last_page' => $paginated->lastPage(),
        ];
    }

    /**
     * Execute a batch of checks against the CDM database.
     *
     * @param  array<string, DqdCheckInterface>  $checks
     * @return array{runId: string, completed: int, failed: int, results: array<int, array<string, mixed>>}
     */
    private function executeChecks(Source $source, array $checks, string $runId): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM) ?? 'omop';
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? 'omop';

        $completed = 0;
        $failed = 0;
        $results = [];

        Log::info("DQD Engine: Starting run {$runId} with ".count($checks).' checks', [
            'source_id' => $source->id,
            'cdm_schema' => $cdmSchema,
            'vocab_schema' => $vocabSchema,
        ]);

        foreach ($checks as $check) {
            $result = $this->executeSingleCheck($source, $check, $cdmSchema, $vocabSchema, $runId);
            $results[] = $result;

            if ($result['status'] === 'completed') {
                $completed++;
            } else {
                $failed++;
            }
        }

        Log::info("DQD Engine: Run {$runId} finished", [
            'completed' => $completed,
            'failed' => $failed,
        ]);

        return compact('runId', 'completed', 'failed', 'results');
    }

    /**
     * Execute a single check: run sqlViolated and sqlTotal, compute violation%, store DqdResult.
     *
     * @return array{check_id: string, status: string, passed?: bool, violation_percentage?: float, error?: string}
     */
    private function executeSingleCheck(
        Source $source,
        DqdCheckInterface $check,
        string $cdmSchema,
        string $vocabSchema,
        string $runId,
    ): array {
        $startTime = microtime(true);

        try {
            // Run total count query
            $totalSql = $check->sqlTotal($cdmSchema, $vocabSchema);
            $totalResult = DB::connection('cdm')->select($totalSql);
            $totalRows = (int) ($totalResult[0]->count ?? 0);

            // Run violation count query
            $violatedSql = $check->sqlViolated($cdmSchema, $vocabSchema);
            $violatedResult = DB::connection('cdm')->select($violatedSql);
            $violatedRows = (int) ($violatedResult[0]->count ?? 0);

            // Compute violation percentage
            $violationPct = $totalRows > 0 ? ($violatedRows / $totalRows) * 100 : 0.0;
            $passed = $violationPct <= $check->threshold();

            $elapsedMs = (int) ((microtime(true) - $startTime) * 1000);

            // Store result — use bigint-safe casting via string for large row counts
            DqdResult::create([
                'source_id' => $source->id,
                'run_id' => $runId,
                'check_id' => $check->checkId(),
                'category' => $check->category(),
                'subcategory' => $check->subcategory(),
                'cdm_table' => $check->cdmTable(),
                'cdm_column' => $check->cdmColumn(),
                'severity' => $check->severity(),
                'threshold' => $check->threshold(),
                'passed' => $passed,
                'violated_rows' => $violatedRows,
                'total_rows' => $totalRows,
                'violation_percentage' => round($violationPct, 4),
                'description' => $check->description(),
                'execution_time_ms' => $elapsedMs,
            ]);

            return [
                'check_id' => $check->checkId(),
                'status' => 'completed',
                'passed' => $passed,
                'violation_percentage' => round($violationPct, 4),
            ];
        } catch (\Throwable $e) {
            $elapsedMs = (int) ((microtime(true) - $startTime) * 1000);

            Log::warning("DQD check {$check->checkId()} failed: {$e->getMessage()}", [
                'run_id' => $runId,
                'source_id' => $source->id,
            ]);

            DqdResult::create([
                'source_id' => $source->id,
                'run_id' => $runId,
                'check_id' => $check->checkId(),
                'category' => $check->category(),
                'subcategory' => $check->subcategory(),
                'cdm_table' => $check->cdmTable(),
                'cdm_column' => $check->cdmColumn(),
                'severity' => $check->severity(),
                'threshold' => $check->threshold(),
                'passed' => false,
                'violated_rows' => 0,
                'total_rows' => 0,
                'violation_percentage' => null,
                'description' => $check->description(),
                'details' => ['error' => $e->getMessage()],
                'execution_time_ms' => $elapsedMs,
            ]);

            return [
                'check_id' => $check->checkId(),
                'status' => 'error',
                'error' => $e->getMessage(),
            ];
        }
    }
}
