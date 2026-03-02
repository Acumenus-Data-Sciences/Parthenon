<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 3: Future birth — persons with year_of_birth in the future.
 */
class Rule3 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 3; }

    public function ruleName(): string { return 'Future birth year'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Person'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'year_of_birth_future' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person
            WHERE year_of_birth > EXTRACT(YEAR FROM CURRENT_DATE)
            HAVING COUNT(*) > 0
            SQL;
    }
}
