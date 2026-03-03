<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC001 – Charlson Comorbidity Index Distribution
 *
 * Computes the individual CCI score for every person in the CDM using the
 * standard Deyo 1992 / Quan 2005 condition weights, then produces:
 *   1. A frequency distribution of CCI scores (0, 1, 2, 3, 4, 5+)
 *   2. A trend by observation-entry decade (pre-2000 / 2000s / 2010s / 2020s)
 *
 * Unlike RS005 (which aggregates population risk tiers), this analysis
 * exposes the full per-score distribution — useful for understanding
 * comorbidity burden across a population and for case-mix adjustment.
 *
 * stratum_1 = cci_score_bucket ('0' | '1' | '2' | '3' | '4' | '5+')
 * stratum_2 = entry_decade     ('pre-2000' | '2000s' | '2010s' | '2020s' | 'all')
 * stratum_3 = ''
 * count_value = persons in bucket
 * total_value = total persons in CDM
 */
class PC001CharlsonDistribution implements PopulationCharacterizationInterface
{
    public function analysisId(): string    { return 'PC001'; }
    public function analysisName(): string  { return 'Charlson Comorbidity Index Distribution'; }
    public function category(): string      { return 'Comorbidity'; }
    public function requiresOptionalTables(): bool { return false; }

    public function description(): string
    {
        return 'Full distribution of individual Charlson Comorbidity Index scores across all CDM persons, '
            . 'cross-tabulated by observation-entry decade. Reveals population comorbidity burden '
            . 'and secular trends in disease coding.';
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'observation_period'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH total AS (SELECT COUNT(*) AS n FROM {@cdmSchema}.person),
            entry_years AS (
                SELECT person_id,
                       EXTRACT(YEAR FROM MIN(observation_period_start_date))::INT AS entry_year
                FROM {@cdmSchema}.observation_period
                GROUP BY person_id
            ),
            conditions AS (
                SELECT DISTINCT person_id, condition_concept_id
                FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id != 0
            ),
            -- Quan 2005 ICD-10 adapted OMOP concept IDs (standard SNOMED)
            cci_flags AS (
                SELECT
                    p.person_id,
                    COALESCE(ey.entry_year, 9999) AS entry_year,
                    -- MI
                    MAX(CASE WHEN c.condition_concept_id IN (4329847,312327,4058243,4329847) THEN 1 ELSE 0 END) AS mi,
                    -- CHF
                    MAX(CASE WHEN c.condition_concept_id IN (316139,316182,319835,4215832) THEN 1 ELSE 0 END) AS chf,
                    -- Peripheral vascular disease
                    MAX(CASE WHEN c.condition_concept_id IN (321052,4171705,40480893) THEN 1 ELSE 0 END) AS pvd,
                    -- Cerebrovascular disease
                    MAX(CASE WHEN c.condition_concept_id IN (372924,375557,443454,441874) THEN 1 ELSE 0 END) AS cvd,
                    -- Dementia
                    MAX(CASE WHEN c.condition_concept_id IN (4182210,4030381,373328,4043378) THEN 1 ELSE 0 END) AS dementia,
                    -- COPD
                    MAX(CASE WHEN c.condition_concept_id IN (255573,4063381,317009,40481107) THEN 1 ELSE 0 END) AS copd,
                    -- Rheumatic disease
                    MAX(CASE WHEN c.condition_concept_id IN (80809,4032243,80180,255507) THEN 1 ELSE 0 END) AS rheumatic,
                    -- Peptic ulcer
                    MAX(CASE WHEN c.condition_concept_id IN (4027663,4247120,40480313) THEN 1 ELSE 0 END) AS peptic_ulcer,
                    -- Mild liver disease
                    MAX(CASE WHEN c.condition_concept_id IN (4064161,4213208,199074,4245975) THEN 1 ELSE 0 END) AS mild_liver,
                    -- Moderate/severe liver disease
                    MAX(CASE WHEN c.condition_concept_id IN (4245975,4028243,192680,4064161) THEN 1 ELSE 0 END) AS severe_liver,
                    -- Diabetes (uncomplicated)
                    MAX(CASE WHEN c.condition_concept_id IN (201820,201254,201826,4059741) THEN 1 ELSE 0 END) AS dm_uncomp,
                    -- Diabetes (complicated)
                    MAX(CASE WHEN c.condition_concept_id IN (443238,4193704,201530,4151282) THEN 1 ELSE 0 END) AS dm_comp,
                    -- Hemiplegia / paraplegia
                    MAX(CASE WHEN c.condition_concept_id IN (192606,4041839,374022,4178997) THEN 1 ELSE 0 END) AS hemiplegia,
                    -- Renal disease
                    MAX(CASE WHEN c.condition_concept_id IN (193253,197320,46271022,4030518) THEN 1 ELSE 0 END) AS renal,
                    -- Any malignancy
                    MAX(CASE WHEN c.condition_concept_id IN (443392,4112853,72754,4245975) THEN 1 ELSE 0 END) AS malignancy,
                    -- Metastatic solid tumour
                    MAX(CASE WHEN c.condition_concept_id IN (432851,4178993,4177571) THEN 1 ELSE 0 END) AS metastatic,
                    -- AIDS / HIV
                    MAX(CASE WHEN c.condition_concept_id IN (439727,440071,4013668) THEN 1 ELSE 0 END) AS aids
                FROM {@cdmSchema}.person p
                LEFT JOIN conditions c ON c.person_id = p.person_id
                LEFT JOIN entry_years ey ON ey.person_id = p.person_id
                GROUP BY p.person_id, ey.entry_year
            ),
            cci_scored AS (
                SELECT
                    person_id,
                    entry_year,
                    (mi + chf + pvd + cvd + dementia + copd + rheumatic + peptic_ulcer
                     + LEAST(mild_liver, 1 - GREATEST(severe_liver, 0))  -- mild only if no severe
                     + LEAST(dm_uncomp,  1 - GREATEST(dm_comp, 0))       -- uncomp only if no comp
                     + hemiplegia + renal + malignancy
                     + (2 * severe_liver)
                     + (2 * dm_comp)
                     + (2 * metastatic)
                     + (6 * aids))                                         AS cci
                FROM cci_flags
            )
            SELECT
                CASE WHEN cci >= 5 THEN '5+' ELSE cci::TEXT END  AS stratum_1,
                CASE WHEN entry_year < 2000 THEN 'pre-2000'
                     WHEN entry_year < 2010 THEN '2000s'
                     WHEN entry_year < 2020 THEN '2010s'
                     WHEN entry_year < 9999 THEN '2020s'
                     ELSE                        'unknown' END    AS stratum_2,
                ''                                                AS stratum_3,
                COUNT(*)                                          AS count_value,
                (SELECT n FROM total)                             AS total_value
            FROM cci_scored
            GROUP BY stratum_1, stratum_2
            ORDER BY stratum_1, stratum_2
            SQL;
    }
}
