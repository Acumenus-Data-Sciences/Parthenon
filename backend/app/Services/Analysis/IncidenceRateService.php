<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\ExecutionLog;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncidenceRateService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Execute an incidence rate analysis.
     */
    public function execute(
        IncidenceRateAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Incidence rate execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;
            $targetCohortId = $design['targetCohortId'];
            $outcomeCohortIds = $design['outcomeCohortIds'] ?? [];
            $timeAtRisk = $design['timeAtRisk'] ?? [
                'start' => ['dateField' => 'StartDate', 'offset' => 0],
                'end' => ['dateField' => 'EndDate', 'offset' => 0],
            ];
            $stratifyByGender = $design['stratifyByGender'] ?? false;
            $stratifyByAge = $design['stratifyByAge'] ?? false;
            $ageGroups = $design['ageGroups'] ?? ['0-17', '18-34', '35-49', '50-64', '65+'];
            $minCellCount = $design['minCellCount'] ?? 5;

            // Resolve schemas from source daimons
            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null || $resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM or Results schema configuration.'
                );
            }

            $dialect = $source->source_dialect ?? 'postgresql';
            $cohortTable = "{$resultsSchema}.cohort";
            $connectionName = $source->source_connection ?? 'cdm';

            $results = [
                'targetCohortId' => $targetCohortId,
                'outcomes' => [],
            ];

            foreach ($outcomeCohortIds as $outcomeCohortId) {
                $this->log($execution, 'info', "Computing incidence rate for outcome cohort {$outcomeCohortId}");

                $outcomeResult = $this->computeIncidenceRate(
                    $targetCohortId,
                    $outcomeCohortId,
                    $timeAtRisk,
                    $stratifyByGender,
                    $stratifyByAge,
                    $ageGroups,
                    $cdmSchema,
                    $vocabSchema,
                    $cohortTable,
                    $dialect,
                    $connectionName,
                    $minCellCount,
                    $execution,
                );

                $results['outcomes'][$outcomeCohortId] = $outcomeResult;
            }

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => $results,
            ]);

            $this->log($execution, 'info', 'Incidence rate execution completed');

            Log::info('Incidence rate execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Incidence rate execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Incidence rate execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Compute incidence rate for a single outcome cohort.
     *
     * @param  array{start: array{dateField: string, offset: int}, end: array{dateField: string, offset: int}}  $timeAtRisk
     * @param  list<string>  $ageGroups
     * @return array<string, mixed>
     */
    private function computeIncidenceRate(
        int $targetCohortId,
        int $outcomeCohortId,
        array $timeAtRisk,
        bool $stratifyByGender,
        bool $stratifyByAge,
        array $ageGroups,
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        string $dialect,
        string $connectionName,
        int $minCellCount,
        AnalysisExecution $execution,
    ): array {
        // Build time-at-risk expressions
        $tarStartExpr = $this->buildTarExpression(
            $timeAtRisk['start']['dateField'] ?? 'StartDate',
            (int) ($timeAtRisk['start']['offset'] ?? 0),
            'target',
        );
        $tarEndExpr = $this->buildTarExpression(
            $timeAtRisk['end']['dateField'] ?? 'EndDate',
            (int) ($timeAtRisk['end']['offset'] ?? 0),
            'target',
        );

        // Build overall incidence rate SQL
        $overallSql = $this->buildIncidenceRateSql(
            $targetCohortId,
            $outcomeCohortId,
            $tarStartExpr,
            $tarEndExpr,
            $cdmSchema,
            $vocabSchema,
            $cohortTable,
            null, // no stratification
        );

        $renderedSql = $this->sqlRenderer->render(
            $overallSql,
            [
                'cdmSchema' => $cdmSchema,
                'vocabSchema' => $vocabSchema,
                'cohortTable' => $cohortTable,
            ],
            $dialect,
        );

        $overallRows = DB::connection($connectionName)->select($renderedSql);
        $overallResult = ! empty($overallRows) ? (array) $overallRows[0] : [];
        $overallResult = $this->applyMinCellCount($overallResult, $minCellCount);

        $result = [
            'overall' => $overallResult,
            'strata' => [],
        ];

        // Gender stratification
        if ($stratifyByGender) {
            $this->log($execution, 'info', "Computing gender-stratified incidence rate for outcome {$outcomeCohortId}");

            $genderSql = $this->buildIncidenceRateSql(
                $targetCohortId,
                $outcomeCohortId,
                $tarStartExpr,
                $tarEndExpr,
                $cdmSchema,
                $vocabSchema,
                $cohortTable,
                'gender',
            );

            $renderedGenderSql = $this->sqlRenderer->render(
                $genderSql,
                [
                    'cdmSchema' => $cdmSchema,
                    'vocabSchema' => $vocabSchema,
                    'cohortTable' => $cohortTable,
                ],
                $dialect,
            );

            $genderRows = DB::connection($connectionName)->select($renderedGenderSql);
            $result['strata']['gender'] = array_map(
                fn ($row) => $this->applyMinCellCount((array) $row, $minCellCount),
                $genderRows,
            );
        }

        // Age stratification
        if ($stratifyByAge) {
            $this->log($execution, 'info', "Computing age-stratified incidence rate for outcome {$outcomeCohortId}");

            $ageSql = $this->buildIncidenceRateSql(
                $targetCohortId,
                $outcomeCohortId,
                $tarStartExpr,
                $tarEndExpr,
                $cdmSchema,
                $vocabSchema,
                $cohortTable,
                'age',
                $ageGroups,
            );

            $renderedAgeSql = $this->sqlRenderer->render(
                $ageSql,
                [
                    'cdmSchema' => $cdmSchema,
                    'vocabSchema' => $vocabSchema,
                    'cohortTable' => $cohortTable,
                ],
                $dialect,
            );

            $ageRows = DB::connection($connectionName)->select($renderedAgeSql);
            $result['strata']['age'] = array_map(
                fn ($row) => $this->applyMinCellCount((array) $row, $minCellCount),
                $ageRows,
            );
        }

        return $result;
    }

    /**
     * Build a time-at-risk date expression.
     */
    private function buildTarExpression(string $dateField, int $offset, string $alias): string
    {
        $column = match ($dateField) {
            'StartDate' => "{$alias}.cohort_start_date",
            'EndDate' => "{$alias}.cohort_end_date",
            default => "{$alias}.cohort_start_date",
        };

        if ($offset === 0) {
            return $column;
        }

        return "DATEADD({$column}, {$offset})";
    }

    /**
     * Build the incidence rate SQL query.
     *
     * @param  list<string>|null  $ageGroups
     */
    private function buildIncidenceRateSql(
        int $targetCohortId,
        int $outcomeCohortId,
        string $tarStartExpr,
        string $tarEndExpr,
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        ?string $stratifyBy,
        ?array $ageGroups = null,
    ): string {
        $stratifySelect = '';
        $stratifyJoin = '';
        $stratifyGroup = '';

        if ($stratifyBy === 'gender') {
            $stratifySelect = "COALESCE(gc.concept_name, 'Unknown') AS stratum_name,";
            $stratifyJoin = "
                JOIN {@cdmSchema}.person p ON target.subject_id = p.person_id
                LEFT JOIN {@vocabSchema}.concept gc ON p.gender_concept_id = gc.concept_id
            ";
            $stratifyGroup = "GROUP BY COALESCE(gc.concept_name, 'Unknown')";
        } elseif ($stratifyBy === 'age') {
            $ageCase = $this->buildAgeCaseExpression($ageGroups ?? ['0-17', '18-34', '35-49', '50-64', '65+']);
            $stratifySelect = "{$ageCase} AS stratum_name,";
            $stratifyJoin = "
                JOIN {@cdmSchema}.person p ON target.subject_id = p.person_id
            ";
            $stratifyGroup = "GROUP BY {$ageCase}";
        }

        return "
            WITH tar AS (
                SELECT
                    target.subject_id,
                    {$tarStartExpr} AS tar_start,
                    {$tarEndExpr} AS tar_end
                FROM {@cohortTable} target
                WHERE target.cohort_definition_id = {$targetCohortId}
                    AND {$tarStartExpr} <= {$tarEndExpr}
            ),
            outcomes AS (
                SELECT
                    outcome.subject_id,
                    MIN(outcome.cohort_start_date) AS first_outcome_date
                FROM {@cohortTable} outcome
                JOIN tar ON outcome.subject_id = tar.subject_id
                    AND outcome.cohort_start_date >= tar.tar_start
                    AND outcome.cohort_start_date <= tar.tar_end
                WHERE outcome.cohort_definition_id = {$outcomeCohortId}
                GROUP BY outcome.subject_id
            ),
            ir_data AS (
                SELECT
                    tar.subject_id,
                    tar.tar_start,
                    CASE
                        WHEN outcomes.first_outcome_date IS NOT NULL
                            THEN outcomes.first_outcome_date
                        ELSE tar.tar_end
                    END AS effective_end,
                    CASE
                        WHEN outcomes.first_outcome_date IS NOT NULL THEN 1
                        ELSE 0
                    END AS has_outcome
                FROM tar
                LEFT JOIN outcomes ON tar.subject_id = outcomes.subject_id
            )
            SELECT
                {$stratifySelect}
                COUNT(DISTINCT ir_data.subject_id) AS persons_at_risk,
                SUM(ir_data.has_outcome) AS persons_with_outcome,
                ROUND(
                    SUM(
                        DATEDIFF(ir_data.tar_start, ir_data.effective_end)
                    ) / 365.25,
                    4
                ) AS person_years_at_risk,
                CASE
                    WHEN SUM(DATEDIFF(ir_data.tar_start, ir_data.effective_end)) > 0
                    THEN ROUND(
                        1000.0 * SUM(ir_data.has_outcome) /
                        (SUM(DATEDIFF(ir_data.tar_start, ir_data.effective_end)) / 365.25),
                        4
                    )
                    ELSE 0
                END AS incidence_rate_per_1000py
            FROM ir_data
            JOIN {@cohortTable} target
                ON ir_data.subject_id = target.subject_id
                AND target.cohort_definition_id = {$targetCohortId}
            {$stratifyJoin}
            {$stratifyGroup}
        ";
    }

    /**
     * Build a CASE expression for age grouping.
     *
     * @param  list<string>  $ageGroups
     */
    private function buildAgeCaseExpression(array $ageGroups): string
    {
        $cases = [];

        foreach ($ageGroups as $group) {
            if (str_contains($group, '+')) {
                // e.g. "65+"
                $lower = (int) str_replace('+', '', $group);
                $cases[] = "WHEN (EXTRACT(YEAR FROM target.cohort_start_date) - p.year_of_birth) >= {$lower} THEN '{$group}'";
            } elseif (str_contains($group, '-')) {
                // e.g. "18-34"
                [$lower, $upper] = explode('-', $group);
                $cases[] = "WHEN (EXTRACT(YEAR FROM target.cohort_start_date) - p.year_of_birth) BETWEEN " . (int) $lower . ' AND ' . (int) $upper . " THEN '{$group}'";
            }
        }

        return "CASE\n                    " . implode("\n                    ", $cases) . "\n                    ELSE 'Unknown'\n                END";
    }

    /**
     * Apply minimum cell count privacy protection.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function applyMinCellCount(array $row, int $minCellCount): array
    {
        if (isset($row['persons_with_outcome'])
            && $row['persons_with_outcome'] > 0
            && $row['persons_with_outcome'] < $minCellCount
        ) {
            $row['persons_with_outcome'] = -1;
            $row['incidence_rate_per_1000py'] = -1;
        }

        if (isset($row['persons_at_risk'])
            && $row['persons_at_risk'] > 0
            && $row['persons_at_risk'] < $minCellCount
        ) {
            $row['persons_at_risk'] = -1;
        }

        return $row;
    }

    /**
     * Log a message to the execution logs.
     *
     * @param  array<string, mixed>  $context
     */
    private function log(
        AnalysisExecution $execution,
        string $level,
        string $message,
        array $context = [],
    ): void {
        ExecutionLog::create([
            'execution_id' => $execution->id,
            'level' => $level,
            'message' => $message,
            'context' => ! empty($context) ? $context : null,
        ]);
    }
}
