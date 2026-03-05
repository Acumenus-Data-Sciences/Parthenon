<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 7: Standard concept check — high fraction of non-standard condition concepts.
 * Fires when >10% of condition_occurrence records use concept_id = 0.
 */
class Rule7 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 7;
    }

    public function ruleName(): string
    {
        return 'High rate of unmapped condition concepts (> 10%)';
    }

    public function severity(): string
    {
        return 'warning';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                unmapped_count AS record_count,
                'pct_unmapped_condition_concepts' AS attribute_name,
                CAST(ROUND(CAST(unmapped_count AS NUMERIC) / NULLIF(total_count, 0) * 100, 1) AS VARCHAR(255)) AS attribute_value
            FROM (
                SELECT
                    SUM(CASE WHEN condition_concept_id = 0 THEN 1 ELSE 0 END) AS unmapped_count,
                    COUNT(*) AS total_count
                FROM {@cdmSchema}.condition_occurrence
            ) t
            WHERE total_count > 0
              AND CAST(unmapped_count AS NUMERIC) / total_count > 0.10
            SQL;
    }
}
