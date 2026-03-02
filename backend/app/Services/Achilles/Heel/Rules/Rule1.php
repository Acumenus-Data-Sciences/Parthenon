<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 1: Death before birth — persons with death_date before their birth year.
 */
class Rule1 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 1; }

    public function ruleName(): string { return 'Death before birth'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Death'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'death_date < birth_year' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.death d
            JOIN {@cdmSchema}.person p ON d.person_id = p.person_id
            WHERE EXTRACT(YEAR FROM d.death_date) < p.year_of_birth
            HAVING COUNT(*) > 0
            SQL;
    }
}
