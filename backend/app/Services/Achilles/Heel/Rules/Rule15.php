<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 15: Visit end before visit start — visit_occurrence records where end < start.
 */
class Rule15 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 15;
    }

    public function ruleName(): string
    {
        return 'Visit end date before visit start date';
    }

    public function severity(): string
    {
        return 'error';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'visit_end_before_start' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.visit_occurrence
            WHERE visit_end_date < visit_start_date
            HAVING COUNT(*) > 0
            SQL;
    }
}
