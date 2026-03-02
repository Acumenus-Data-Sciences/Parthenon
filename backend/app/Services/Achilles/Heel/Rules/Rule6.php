<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 6: Persons with no observation period.
 */
class Rule6 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 6; }

    public function ruleName(): string { return 'Persons with no observation period'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Observation Period'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'persons_no_observation_period' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person p
            WHERE NOT EXISTS (
                SELECT 1 FROM {@cdmSchema}.observation_period op
                WHERE op.person_id = p.person_id
            )
            HAVING COUNT(*) > 0
            SQL;
    }
}
