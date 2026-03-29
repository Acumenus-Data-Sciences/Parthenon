<?php

namespace App\Services\Cohort\Builders;

use App\Models\App\RiskScoreAnalysis;

/**
 * Generates CTEs that filter patients by pre-computed risk score results.
 *
 * Each RiskScoreCriteria entry becomes a CTE that resolves the latest
 * completed execution for the given analysis and filters person_ids
 * by score value or tier.
 */
class RiskScoreCriteriaBuilder
{
    private const OPERATORS = [
        'gt' => '>',
        'gte' => '>=',
        'lt' => '<',
        'lte' => '<=',
        'eq' => '=',
    ];

    /**
     * Build CTEs for risk score criteria.
     *
     * @param  array<int, array<string, mixed>>  $criteria  The RiskScoreCriteria array
     * @return array{ctes: list<string>, filters: list<array{index: int, exclude: bool}>}
     */
    public function build(array $criteria): array
    {
        $ctes = [];
        $filters = [];

        foreach ($criteria as $index => $criterion) {
            $analysisId = (int) $criterion['analysisId'];
            $scoreId = $this->escape($criterion['scoreId']);
            $exclude = (bool) ($criterion['exclude'] ?? false);

            $analysisType = $this->escape(RiskScoreAnalysis::class);

            // Subquery to find the latest completed execution for this analysis
            $latestExecSubquery = <<<SQL
                SELECT MAX(ae2.id)
                FROM analysis_executions ae2
                WHERE ae2.analysis_type = '{$analysisType}'
                  AND ae2.analysis_id = {$analysisId}
                  AND ae2.status = 'completed'
            SQL;

            // Build the WHERE clause based on operator+value or tier
            $filterClause = $this->buildFilterClause($criterion);

            $cteName = "risk_score_filter_{$index}";

            $ctes[] = <<<SQL
{$cteName} AS (
    SELECT DISTINCT rspr.person_id
    FROM risk_score_patient_results rspr
    INNER JOIN analysis_executions ae
        ON ae.id = rspr.execution_id
        AND ae.analysis_type = '{$analysisType}'
        AND ae.analysis_id = {$analysisId}
        AND ae.status = 'completed'
    WHERE rspr.score_id = '{$scoreId}'
      AND {$filterClause}
      AND ae.id = ({$latestExecSubquery})
)
SQL;

            $filters[] = ['index' => $index, 'exclude' => $exclude];
        }

        return ['ctes' => $ctes, 'filters' => $filters];
    }

    /**
     * Build the WHERE filter clause for a single criterion.
     *
     * @param  array<string, mixed>  $criterion
     */
    private function buildFilterClause(array $criterion): string
    {
        // Tier-based filter
        if (! empty($criterion['tier'])) {
            $tier = $this->escape($criterion['tier']);

            return "rspr.risk_tier = '{$tier}'";
        }

        // Value-based filter
        $operator = $criterion['operator'] ?? 'gte';
        $value = (float) ($criterion['value'] ?? 0);
        $sqlOp = self::OPERATORS[$operator] ?? '>=';

        return "rspr.score_value {$sqlOp} {$value}";
    }

    /**
     * Escape a string value for safe SQL interpolation.
     * Uses simple single-quote escaping (no user input — values come from validated expression_json).
     */
    private function escape(string $value): string
    {
        return str_replace("'", "''", $value);
    }
}
