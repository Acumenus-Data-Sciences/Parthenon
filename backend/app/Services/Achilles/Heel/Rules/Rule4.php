<?php

namespace App\Services\Achilles\Heel\Rules;

use App\Contracts\AchillesHeelRuleInterface;

/**
 * Rule 4: Events after death — condition, drug, procedure or measurement records after death date.
 */
class Rule4 implements AchillesHeelRuleInterface
{
    public function ruleId(): int { return 4; }

    public function ruleName(): string { return 'Clinical events after death'; }

    public function severity(): string { return 'error'; }

    public function category(): string { return 'Death'; }

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
                JOIN {@cdmSchema}.death d ON co.person_id = d.person_id
                WHERE co.condition_start_date > d.death_date
                UNION ALL
                SELECT 'drug_exposure', COUNT(*)
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.death d ON de.person_id = d.person_id
                WHERE de.drug_exposure_start_date > d.death_date
                UNION ALL
                SELECT 'procedure_occurrence', COUNT(*)
                FROM {@cdmSchema}.procedure_occurrence po
                JOIN {@cdmSchema}.death d ON po.person_id = d.person_id
                WHERE po.procedure_date > d.death_date
                UNION ALL
                SELECT 'measurement', COUNT(*)
                FROM {@cdmSchema}.measurement m
                JOIN {@cdmSchema}.death d ON m.person_id = d.person_id
                WHERE m.measurement_date > d.death_date
            ) t
            WHERE record_count > 0
            SQL;
    }
}
