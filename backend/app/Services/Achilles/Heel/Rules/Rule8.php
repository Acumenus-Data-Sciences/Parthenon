<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 8: High rate of unmapped drug concepts (> 10% with concept_id = 0).
 */
class Rule8 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 8;
    }

    public function ruleName(): string
    {
        return 'High rate of unmapped drug concepts (> 10%)';
    }

    public function severity(): string
    {
        return 'warning';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                unmapped_count AS record_count,
                'pct_unmapped_drug_concepts' AS attribute_name,
                CAST(ROUND(CAST(unmapped_count AS NUMERIC) / NULLIF(total_count, 0) * 100, 1) AS VARCHAR(255)) AS attribute_value
            FROM (
                SELECT
                    SUM(CASE WHEN drug_concept_id = 0 THEN 1 ELSE 0 END) AS unmapped_count,
                    COUNT(*) AS total_count
                FROM {@cdmSchema}.drug_exposure
            ) t
            WHERE total_count > 0
              AND CAST(unmapped_count AS NUMERIC) / total_count > 0.10
            SQL;
    }
}
