<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 5: Persons outside observation period — clinical records before obs period start or after end.
 */
class Rule5 implements AchillesHeelRuleInterface
{
    public function ruleId(): int
    {
        return 5;
    }

    public function ruleName(): string
    {
        return 'Clinical events outside observation period';
    }

    public function severity(): string
    {
        return 'warning';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            SELECT
                domain_name AS attribute_name,
                CAST(record_count AS VARCHAR(255)) AS attribute_value,
                record_count
            FROM (
                SELECT 'condition_occurrence' AS domain_name, COUNT(*) AS record_count
                FROM {@cdmSchema}.condition_occurrence co
                WHERE NOT EXISTS (
                    SELECT 1 FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = co.person_id
                      AND co.condition_start_date BETWEEN op.observation_period_start_date AND op.observation_period_end_date
                )
                UNION ALL
                SELECT 'drug_exposure', COUNT(*)
                FROM {@cdmSchema}.drug_exposure de
                WHERE NOT EXISTS (
                    SELECT 1 FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = de.person_id
                      AND de.drug_exposure_start_date BETWEEN op.observation_period_start_date AND op.observation_period_end_date
                )
            ) t
            WHERE record_count > 0
            SQL;
    }
}
