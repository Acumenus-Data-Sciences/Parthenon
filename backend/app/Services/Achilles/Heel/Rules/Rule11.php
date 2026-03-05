<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 11: Race concept completeness — persons with race_concept_id = 0.
 */
class Rule11 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 11;
    }

    public function ruleName(): string
    {
        return 'Persons with missing race concept';
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
                'persons_missing_race' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person
            WHERE race_concept_id = 0 OR race_concept_id IS NULL
            HAVING COUNT(*) > 0
            SQL;
    }
}
