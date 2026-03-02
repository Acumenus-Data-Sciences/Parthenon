<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 12: Ethnicity concept completeness — persons with ethnicity_concept_id = 0.
 */
class Rule12 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 12; }

    public function ruleName(): string { return 'Persons with missing ethnicity concept'; }

    public function severity(): string { return 'notification'; }

    public function category(): string { return 'Person'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'persons_missing_ethnicity' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.person
            WHERE ethnicity_concept_id = 0 OR ethnicity_concept_id IS NULL
            HAVING COUNT(*) > 0
            SQL;
    }
}
