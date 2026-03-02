<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that person year_of_birth implies a plausible age (0-130 years).
 */
class AgeRangeCheck extends AbstractDqdCheck
{
    public function checkId(): string
    {
        return 'plausibility_ageRange_person_year_of_birth';
    }

    public function category(): string
    {
        return 'plausibility';
    }

    public function subcategory(): string
    {
        return 'plausibleValueRange';
    }

    public function cdmTable(): string
    {
        return 'person';
    }

    public function cdmColumn(): ?string
    {
        return 'year_of_birth';
    }

    public function severity(): string
    {
        return 'error';
    }

    public function description(): string
    {
        return 'Person age should be between 0 and 130 years (year_of_birth is plausible)';
    }

    public function sqlViolated(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.person
            WHERE year_of_birth IS NOT NULL
              AND (
                  EXTRACT(YEAR FROM CURRENT_DATE) - year_of_birth > 130
                  OR year_of_birth > EXTRACT(YEAR FROM CURRENT_DATE)
              )
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.person
            WHERE year_of_birth IS NOT NULL
            SQL;
    }
}
