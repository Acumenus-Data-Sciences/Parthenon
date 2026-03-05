<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 10: Gender concept completeness — persons with gender_concept_id = 0.
 */
class Rule10 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 10;
    }

    public function ruleName(): string
    {
        return 'Persons with missing gender concept';
    }

    public function severity(): string
    {
        return 'warning';
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
                'persons_missing_gender' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person
            WHERE gender_concept_id = 0 OR gender_concept_id IS NULL
            HAVING COUNT(*) > 0
            SQL;
    }
}
