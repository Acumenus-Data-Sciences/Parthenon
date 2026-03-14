<?php

namespace App\Services\GIS;

class GisCovidCohortService
{
    private const COVID_CONCEPT_ID = 37311061;

    /**
     * Return a CTE fragment and bindings for COVID diagnosis cases.
     * Uses parameterized query to prevent SQL injection.
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function covidDiagnosisCte(int $conceptId = self::COVID_CONCEPT_ID): array
    {
        return [
            'sql' => 'covid_dx AS (
                SELECT DISTINCT co.person_id,
                       co.condition_start_date AS index_date
                FROM omop.condition_occurrence co
                WHERE co.condition_concept_id = ?
            )',
            'bindings' => [$conceptId],
        ];
    }

    /**
     * CTE for COVID hospitalizations (inpatient visit within ±7 days of diagnosis).
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function hospitalizationCte(): array
    {
        return [
            'sql' => "covid_hosp AS (
                SELECT DISTINCT cd.person_id, cd.index_date
                FROM covid_dx cd
                JOIN omop.visit_occurrence vo ON cd.person_id = vo.person_id
                WHERE vo.visit_concept_id = 9201
                  AND vo.visit_start_date BETWEEN cd.index_date - INTERVAL '7 days'
                                              AND cd.index_date + INTERVAL '30 days'
            )",
            'bindings' => [],
        ];
    }

    /**
     * CTE for COVID mortality (death within 30 days of diagnosis).
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function mortalityCte(): array
    {
        return [
            'sql' => "covid_death AS (
                SELECT DISTINCT cd.person_id, cd.index_date
                FROM covid_dx cd
                JOIN omop.death d ON cd.person_id = d.person_id
                WHERE d.death_date BETWEEN cd.index_date
                                       AND cd.index_date + INTERVAL '30 days'
            )",
            'bindings' => [],
        ];
    }

    /**
     * Build full CTE prefix with all outcome types.
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function allCtes(int $conceptId = self::COVID_CONCEPT_ID): array
    {
        $parts = [
            $this->covidDiagnosisCte($conceptId),
            $this->hospitalizationCte(),
            $this->mortalityCte(),
        ];

        $sql = 'WITH '.implode(",\n", array_column($parts, 'sql'));
        $bindings = array_merge(...array_column($parts, 'bindings'));

        return ['sql' => $sql, 'bindings' => $bindings];
    }

    /**
     * Return the appropriate CTE table name for a metric.
     */
    public function cteTableForMetric(string $metric): string
    {
        return match ($metric) {
            'cases' => 'covid_dx',
            'hospitalizations' => 'covid_hosp',
            'deaths' => 'covid_death',
            default => 'covid_dx',
        };
    }
}
