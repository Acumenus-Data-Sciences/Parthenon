<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC005 – Visit Complexity Score
 *
 * For each visit in the CDM, counts how many distinct clinical domains
 * (condition, drug, measurement, procedure, observation) have at least one
 * record on the same date. This "domain multiplicity" is a proxy for
 * visit clinical complexity — a high-complexity inpatient visit will
 * have all 5 domains active; a routine outpatient visit may have 1–2.
 *
 * stratum_1 = visit_type ('inpatient' | 'outpatient' | 'emergency' | 'other')
 * stratum_2 = complexity_bucket ('1' | '2-3' | '4-5' = full complexity)
 * stratum_3 = ''
 * count_value = visit count in this bucket
 * total_value = total visits of this visit type
 *
 * OMOP standard visit concept IDs:
 *   9201 = Inpatient Visit
 *   9202 = Outpatient Visit
 *   9203 = Emergency Room Visit
 *   262  = Emergency Room and Inpatient Visit
 */
class PC005VisitComplexityScore implements PopulationCharacterizationInterface
{
    public function analysisId(): string    { return 'PC005'; }
    public function analysisName(): string  { return 'Visit Complexity Score'; }
    public function category(): string      { return 'Visit'; }
    public function requiresOptionalTables(): bool { return false; }

    public function description(): string
    {
        return 'Counts distinct clinical domains (condition, drug, measurement, procedure, '
            . 'observation) active on each visit date. Bucketed by visit type (inpatient / '
            . 'outpatient / emergency). Low complexity outpatient visits suggest documentation '
            . 'gaps; high-complexity inpatient visits are expected.';
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence', 'condition_occurrence', 'drug_exposure',
                'measurement', 'procedure_occurrence', 'observation'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH visit_types AS (
                SELECT visit_occurrence_id,
                       person_id,
                       visit_start_date,
                       CASE visit_concept_id
                           WHEN 9201 THEN 'inpatient'
                           WHEN 9202 THEN 'outpatient'
                           WHEN 9203 THEN 'emergency'
                           WHEN 262  THEN 'emergency'
                           ELSE           'other'
                       END AS visit_type
                FROM {@cdmSchema}.visit_occurrence
                WHERE visit_concept_id IS NOT NULL
            ),
            domain_flags AS (
                SELECT v.visit_occurrence_id,
                       v.visit_type,
                       -- Count distinct domains active on visit date
                       (CASE WHEN EXISTS (
                               SELECT 1 FROM {@cdmSchema}.condition_occurrence c
                               WHERE c.person_id = v.person_id
                                 AND c.condition_start_date = v.visit_start_date)
                             THEN 1 ELSE 0 END
                        + CASE WHEN EXISTS (
                               SELECT 1 FROM {@cdmSchema}.drug_exposure d
                               WHERE d.person_id = v.person_id
                                 AND d.drug_exposure_start_date = v.visit_start_date)
                             THEN 1 ELSE 0 END
                        + CASE WHEN EXISTS (
                               SELECT 1 FROM {@cdmSchema}.measurement m
                               WHERE m.person_id = v.person_id
                                 AND m.measurement_date = v.visit_start_date)
                             THEN 1 ELSE 0 END
                        + CASE WHEN EXISTS (
                               SELECT 1 FROM {@cdmSchema}.procedure_occurrence p
                               WHERE p.person_id = v.person_id
                                 AND p.procedure_date = v.visit_start_date)
                             THEN 1 ELSE 0 END
                        + CASE WHEN EXISTS (
                               SELECT 1 FROM {@cdmSchema}.observation o
                               WHERE o.person_id = v.person_id
                                 AND o.observation_date = v.visit_start_date)
                             THEN 1 ELSE 0 END
                       )                                            AS domain_count
                FROM visit_types v
            ),
            visit_totals AS (
                SELECT visit_type, COUNT(*) AS total_visits
                FROM visit_types
                GROUP BY visit_type
            ),
            bucketed AS (
                SELECT
                    df.visit_type                              AS stratum_1,
                    CASE WHEN domain_count = 1     THEN '1'
                         WHEN domain_count <= 3    THEN '2-3'
                         ELSE                           '4-5' END  AS stratum_2,
                    ''                                         AS stratum_3,
                    COUNT(*)                                   AS count_value,
                    vt.total_visits                            AS total_value
                FROM domain_flags df
                JOIN visit_totals vt ON vt.visit_type = df.visit_type
                GROUP BY df.visit_type, stratum_2, vt.total_visits
            )
            SELECT * FROM bucketed
            ORDER BY stratum_1, stratum_2
            SQL;
    }
}
