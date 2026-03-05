<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 13: Low data density — sources with fewer than 1,000 persons.
 */
class Rule13 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 13;
    }

    public function ruleName(): string
    {
        return 'Low person count (< 1,000)';
    }

    public function severity(): string
    {
        return 'notification';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'total_person_count' AS attribute_name,
                CAST(COUNT(*) AS VARCHAR(255)) AS attribute_value
            FROM {@cdmSchema}.person
            HAVING COUNT(*) < 1000
            SQL;
    }
}
