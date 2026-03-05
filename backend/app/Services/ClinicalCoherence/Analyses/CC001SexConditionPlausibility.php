<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC001 – Sex-Condition Plausibility
 *
 * Detects conditions that are biologically specific to one sex recorded for
 * patients of the opposite sex. Uses OMOP gender_concept_id:
 *   8507 = Male  |  8532 = Female
 */
class CC001SexConditionPlausibility implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'CC001';
    }

    public function analysisName(): string
    {
        return 'Sex-Condition Plausibility';
    }

    public function category(): string
    {
        return 'Sex Plausibility';
    }

    public function description(): string
    {
        return 'Identifies conditions that are biologically specific to one sex but recorded for patients of the other sex (e.g. uterine conditions in male patients).';
    }

    public function severity(): string
    {
        return 'critical';
    }

    public function flagThreshold(): ?float
    {
        return null;
    } // flag any occurrence

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            -- Female-specific conditions in male patients (gender_concept_id = 8507)
            SELECT
                'female_condition_in_male'                                      AS stratum_1,
                CAST(co.condition_concept_id AS VARCHAR(255))                   AS stratum_2,
                c.concept_name                                                  AS stratum_3,
                COUNT(DISTINCT co.person_id)                                    AS count_value,
                (SELECT COUNT(DISTINCT person_id)
                    FROM {@cdmSchema}.person WHERE gender_concept_id = 8507)    AS total_value,
                ROUND(
                    CAST(COUNT(DISTINCT co.person_id) AS NUMERIC) /
                    NULLIF((SELECT COUNT(DISTINCT person_id)
                            FROM {@cdmSchema}.person WHERE gender_concept_id = 8507), 0),
                    6
                )                                                               AS ratio_value,
                'Female-specific condition recorded for male patient'           AS notes
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.person p
                ON co.person_id = p.person_id AND p.gender_concept_id = 8507
            JOIN {@cdmSchema}.concept c
                ON co.condition_concept_id = c.concept_id AND c.domain_id = 'Condition'
            WHERE co.condition_concept_id != 0
              AND (
                  c.concept_name ILIKE '%cervix%'
                  OR c.concept_name ILIKE '%uterine%'
                  OR c.concept_name ILIKE '% uterus%'
                  OR c.concept_name ILIKE '%ovarian%'
                  OR c.concept_name ILIKE '%endometri%'
                  OR c.concept_name ILIKE '%fallopian%'
                  OR c.concept_name ILIKE '%vagina%'
                  OR c.concept_name ILIKE '%vulv%'
                  OR c.concept_name ILIKE '%menstrual%'
                  OR c.concept_name ILIKE '%menorrhagia%'
                  OR c.concept_name ILIKE '%dysmenorrh%'
                  OR c.concept_name ILIKE '%amenorrh%'
                  OR c.concept_name ILIKE '%ectopic pregnancy%'
                  OR c.concept_name ILIKE '%preeclampsia%'
                  OR c.concept_name ILIKE '%eclampsia%'
              )
            GROUP BY co.condition_concept_id, c.concept_name
            HAVING COUNT(DISTINCT co.person_id) > 0

            UNION ALL

            -- Male-specific conditions in female patients (gender_concept_id = 8532)
            SELECT
                'male_condition_in_female'                                      AS stratum_1,
                CAST(co.condition_concept_id AS VARCHAR(255))                   AS stratum_2,
                c.concept_name                                                  AS stratum_3,
                COUNT(DISTINCT co.person_id)                                    AS count_value,
                (SELECT COUNT(DISTINCT person_id)
                    FROM {@cdmSchema}.person WHERE gender_concept_id = 8532)    AS total_value,
                ROUND(
                    CAST(COUNT(DISTINCT co.person_id) AS NUMERIC) /
                    NULLIF((SELECT COUNT(DISTINCT person_id)
                            FROM {@cdmSchema}.person WHERE gender_concept_id = 8532), 0),
                    6
                )                                                               AS ratio_value,
                'Male-specific condition recorded for female patient'           AS notes
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.person p
                ON co.person_id = p.person_id AND p.gender_concept_id = 8532
            JOIN {@cdmSchema}.concept c
                ON co.condition_concept_id = c.concept_id AND c.domain_id = 'Condition'
            WHERE co.condition_concept_id != 0
              AND (
                  c.concept_name ILIKE '%prostate%'
                  OR c.concept_name ILIKE '%prostatic%'
                  OR c.concept_name ILIKE '%testicular%'
                  OR c.concept_name ILIKE '%testis%'
                  OR c.concept_name ILIKE '%testicle%'
                  OR c.concept_name ILIKE '%epididym%'
                  OR c.concept_name ILIKE '%seminal vesicle%'
                  OR c.concept_name ILIKE '%vas deferens%'
                  OR c.concept_name ILIKE '%hypospadias%'
                  OR c.concept_name ILIKE '%cryptorchidism%'
                  OR c.concept_name ILIKE '%varicocele%'
                  OR c.concept_name ILIKE '%hydrocele%'
                  OR c.concept_name ILIKE '%phimosis%'
                  OR c.concept_name ILIKE '%penile cancer%'
                  OR c.concept_name ILIKE '%spermatic cord%'
              )
            GROUP BY co.condition_concept_id, c.concept_name
            HAVING COUNT(DISTINCT co.person_id) > 0
            ORDER BY count_value DESC
            SQL;
    }
}
