<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 14: Negative days supply in drug_exposure records.
 */
class Rule14 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 14; }

    public function ruleName(): string { return 'Negative days supply in drug exposure'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Drug'; }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                COUNT(*) AS record_count,
                'drug_exposure_negative_days_supply' AS attribute_name,
                NULL AS attribute_value
            FROM {@cdmSchema}.drug_exposure
            WHERE days_supply < 0
            HAVING COUNT(*) > 0
            SQL;
    }
}
