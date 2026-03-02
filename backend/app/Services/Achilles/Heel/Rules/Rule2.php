<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 2: Impossible age — persons with age > 150 years at any recorded event.
 */
class Rule2 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 2; }

    public function ruleName(): string { return 'Impossible age (> 150 years)'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Person'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'persons_age_over_150' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person
            WHERE year_of_birth < EXTRACT(YEAR FROM CURRENT_DATE) - 150
            HAVING COUNT(*) > 0
            SQL;
    }
}
