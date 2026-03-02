<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC002 – Age-Condition Plausibility
 *
 * Detects conditions diagnosed at biologically implausible ages:
 *  - Pediatric/neonatal conditions in adults (age > 18 at diagnosis)
 *  - Geriatric/late-onset conditions in young patients (age < 30 at diagnosis)
 *
 * Age is approximated as condition_start_date year minus year_of_birth.
 */
class CC002AgeConditionPlausibility implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string { return 'CC002'; }

    public function analysisName(): string
    {
        return 'Age-Condition Plausibility';
    }

    public function category(): string { return 'Age Plausibility'; }

    public function description(): string
    {
        return 'Identifies conditions diagnosed at biologically implausible ages, such as pediatric-only conditions in adults or late-onset conditions in young patients.';
    }

    public function severity(): string { return 'major'; }

    public function flagThreshold(): ?float { return null; } // flag any occurrence > threshold enforced in HAVING

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            -- Pediatric / neonatal / congenital conditions in adults (age > 18)
            SELECT
                'pediatric_condition_in_adult'                                              AS stratum_1,
                CAST(co.condition_concept_id AS VARCHAR(255))                               AS stratum_2,
                c.concept_name                                                              AS stratum_3,
                COUNT(DISTINCT co.person_id)                                                AS count_value,
                COUNT(DISTINCT co.person_id)                                                AS total_value,
                NULL::NUMERIC                                                               AS ratio_value,
                'Pediatric/neonatal/congenital condition recorded for patient aged > 18 at diagnosis' AS notes
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.person p ON co.person_id = p.person_id
            JOIN {@cdmSchema}.concept c
                ON co.condition_concept_id = c.concept_id AND c.domain_id = 'Condition'
            WHERE co.condition_concept_id != 0
              AND (EXTRACT(YEAR FROM co.condition_start_date) - p.year_of_birth) > 18
              AND (
                  c.concept_name ILIKE '%childhood%'
                  OR c.concept_name ILIKE '%juvenile%'
                  OR c.concept_name ILIKE '%neonatal%'
                  OR c.concept_name ILIKE '%congenital%'
                  OR c.concept_name ILIKE '%perinatal%'
                  OR c.concept_name ILIKE '%newborn%'
                  OR c.concept_name ILIKE '%infantile%'
                  OR c.concept_name ILIKE '%of newborn%'
                  OR c.concept_name ILIKE '%of infant%'
                  OR c.concept_name ILIKE '%in infancy%'
                  OR c.concept_name ILIKE '%pediatric%'
              )
            GROUP BY co.condition_concept_id, c.concept_name
            HAVING COUNT(DISTINCT co.person_id) > 5

            UNION ALL

            -- Geriatric / late-onset conditions in young patients (age < 30)
            SELECT
                'geriatric_condition_in_young'                                              AS stratum_1,
                CAST(co.condition_concept_id AS VARCHAR(255))                               AS stratum_2,
                c.concept_name                                                              AS stratum_3,
                COUNT(DISTINCT co.person_id)                                                AS count_value,
                COUNT(DISTINCT co.person_id)                                                AS total_value,
                NULL::NUMERIC                                                               AS ratio_value,
                'Geriatric/late-onset condition recorded for patient aged < 30 at diagnosis' AS notes
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.person p ON co.person_id = p.person_id
            JOIN {@cdmSchema}.concept c
                ON co.condition_concept_id = c.concept_id AND c.domain_id = 'Condition'
            WHERE co.condition_concept_id != 0
              AND (EXTRACT(YEAR FROM co.condition_start_date) - p.year_of_birth) < 30
              AND (
                  c.concept_name ILIKE '%alzheimer%'
                  OR c.concept_name ILIKE '%senile%'
                  OR c.concept_name ILIKE '%age-related macular%'
                  OR c.concept_name ILIKE '%presbyopia%'
                  OR c.concept_name ILIKE '%presbycusis%'
                  OR c.concept_name ILIKE '%primary osteoporosis%'
                  OR c.concept_name ILIKE '%dementia%'
                  OR c.concept_name ILIKE '%late-onset%'
                  OR c.concept_name ILIKE '%late onset%'
                  OR c.concept_name ILIKE '%senile cataract%'
              )
            GROUP BY co.condition_concept_id, c.concept_name
            HAVING COUNT(DISTINCT co.person_id) > 5

            ORDER BY count_value DESC
            SQL;
    }
}
